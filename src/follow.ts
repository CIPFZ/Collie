// SPEC 14.4 / 14.9: `collie follow` — constant loop that reads docs/ops/next.md,
// decides via handoff.ts, and executes the chosen action (run queue, notify,
// sleep). All side-effects (clock, sleep, subprocess, notify, fs) are injected
// so tests never touch the network or real timers.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { git, isAncestor, push } from './git.js';
import { parseNext, decide, type FollowState, type DecideAction } from './handoff.js';
import { notify as realNotify, type NotifyFetch } from './notify.js';
import { loadConfig } from './config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of spawning a subprocess (SPEC 14.9 item 4: injected). */
export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** SPEC 14.12 item 3: output retention mode for subprocesses. */
export type OutputMode = 'full' | 'tail';

/** Subprocess spawner signature — receives full command line and output mode (SPEC 14.12 item 3). */
export type SpawnFn = (
  cmd: readonly string[],
  cwd: string,
  mode: OutputMode,
) => Promise<SpawnResult>;

/** Notification sender signature. */
export type NotifySender = (text: string) => Promise<void>;

/** Retry/backoff state persisted in follow.json (SPEC 14.9 item 2). */
export interface RetryState {
  failures: number;
  notBefore: number;
}

/** Pending queue-end report to be sent when local is no longer ahead (SPEC 14.12 item 2). */
export interface PendingReport {
  qRunId: string;
  reason: string;
  exitCode: number;
}

/** State persisted to .collie/follow.json between iterations (SPEC 14.4/14.9/14.12). */
export interface FollowJson {
  handledBase: string | null;
  notified: string[];
  /** Pending queue-end report: sent when local is no longer ahead (SPEC 14.12). */
  pendingReport?: PendingReport;
  /** Retry/backoff state (SPEC 14.9 item 2). */
  retry?: RetryState;
  /** Base commit the current retry belongs to; clears on change (SPEC 14.12 item 5). */
  retryBase?: string;
  /** Consecutive sync failure count (SPEC 14.15 item 1). */
  syncFailures?: number;
}

/** Options for the follow loop (SPEC 14.4/14.9). */
export interface FollowOpts {
  root: string;
  once?: boolean;
  dryRun?: boolean;
  intervalSecs?: number;
  timeoutSecs?: number;
  /** Injected clock for timestamps (SPEC 14.4). */
  now?: () => number;
  /** Injected sleep (SPEC 14.4). */
  sleep?: (ms: number) => Promise<void>;
  /** Injected subprocess spawner (SPEC 14.9 item 4). */
  spawn?: SpawnFn;
  /** Injected notification sender (SPEC 14.4). */
  sendNotify?: NotifySender;
  /** Injected output. */
  out?: (text: string) => void;
  /** SPEC 14.9 item 6: parent directory for pinned R2 dirs (default: os.tmpdir). */
  pinnedParentDir?: string;
}

// ---------------------------------------------------------------------------
// Constants (SPEC 14.4 / 14.9)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4: default polling interval (not a tunable threshold)
const DEFAULT_FOLLOW_INTERVAL_SECS = 60;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4: ms-per-second conversion factor, not a threshold
const MS_PER_SEC = 1000;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4 step 2: sha prefix length for pinned dir name
const SHA_PREFIX_LEN = 12;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4 step 5: tail lines for minimal report
const MINIMAL_REPORT_TAIL = 50;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.9 item 5: tail lines for appendix
const APPENDIX_TAIL = 20;

// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 14.9 item 2: initial backoff in ms (5 minutes)
const BACKOFF_INITIAL_MS = 5 * 60 * MS_PER_SEC;

// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 14.9 item 2: max backoff in ms (60 minutes)
const BACKOFF_MAX_MS = 60 * 60 * MS_PER_SEC;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.9 item 4: max tail lines kept in memory for default spawn
const SPAWN_TAIL_LINES = 200;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.15: consecutive sync failure threshold before notification
const SYNC_FAILURE_THRESHOLD = 3;

const FOLLOW_STATE_PATH = '.collie/follow.json';
const NEXT_MD_PATH = 'docs/ops/next.md';

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function loadFollowState(root: string): FollowJson {
  const path = join(root, FOLLOW_STATE_PATH);
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as FollowJson;
  } catch {
    return { handledBase: null, notified: [] };
  }
}

function saveFollowState(root: string, state: FollowJson): void {
  const path = join(root, FOLLOW_STATE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  // eslint-disable-next-line no-restricted-syntax -- standard JSON indentation, not a threshold
  const JSON_INDENT = 2;
  writeFileSync(path, JSON.stringify(state, null, JSON_INDENT) + '\n');
}

function toFollowState(json: FollowJson): FollowState {
  return {
    handledBase: json.handledBase,
    notified: new Set(json.notified),
  };
}

// ---------------------------------------------------------------------------
// Pinned R2 directory (SPEC 14.4 step 2)
// ---------------------------------------------------------------------------

/** Determines the project name from collie.toml for the pinned dir name. */
function projectName(root: string): string {
  try {
    const cfg = loadConfig(root);
    return cfg.project.name;
  } catch {
    return 'unknown';
  }
}

/**
 * SPEC 14.4 step 2 / 14.9 item 6: prepare pinned R2 directory.
 * Directory is `<parentDir>/collie-r2-<project>-<sha12>`.
 * If it already exists, reuse it. Otherwise `git worktree add --detach`.
 * If the pinned sha's package-lock.json matches HEAD's, symlink node_modules.
 * parentDir defaults to os.tmpdir() but can be injected (SPEC 14.9 item 6).
 */
async function preparePinnedR2(
  root: string,
  pinnedSha: string,
  spawnFn: SpawnFn,
  parentDir: string,
): Promise<string> {
  const name = projectName(root);
  const shaPrefix = pinnedSha.slice(0, SHA_PREFIX_LEN);
  const dirName = `collie-r2-${name}-${shaPrefix}`;
  const pinnedDir = join(parentDir, dirName);

  if (existsSync(pinnedDir)) return pinnedDir;

  // Create worktree
  await git(root, ['worktree', 'add', '--detach', '--quiet', pinnedDir, pinnedSha]);

  // Check if package-lock.json matches
  let needsNpmCi = false;
  try {
    const headLock = readFileSync(join(root, 'package-lock.json'), 'utf8');
    const pinnedLock = readFileSync(join(pinnedDir, 'package-lock.json'), 'utf8');
    if (headLock === pinnedLock) {
      // Symlink node_modules
      const targetModules = join(root, 'node_modules');
      const pinnedModules = join(pinnedDir, 'node_modules');
      if (existsSync(targetModules) && !existsSync(pinnedModules)) {
        symlinkSync(targetModules, pinnedModules);
      }
    } else {
      needsNpmCi = true;
    }
  } catch {
    needsNpmCi = true;
  }

  // SPEC 14.12 item 4: npm ci failure → remove dir and throw
  if (needsNpmCi) {
    const npmResult = await spawnFn(['npm', 'ci'], pinnedDir, 'tail');
    if (npmResult.exitCode !== 0) {
      try {
        await git(root, ['worktree', 'remove', '--force', pinnedDir]);
      } catch {
        // Best effort cleanup
      }
      throw new Error(`npm ci failed with exit code ${String(npmResult.exitCode)}`);
    }
  }

  return pinnedDir;
}

// ---------------------------------------------------------------------------
// Find new queue run directories
// ---------------------------------------------------------------------------

function findQueueRunDirs(root: string): string[] {
  const runsDir = join(root, '.collie', 'runs');
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((d) => d.startsWith('q-'))
    .sort();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return last N lines of text. */
function lastLines(text: string, n: number): string {
  const lines = text.split('\n');
  return lines.slice(-n).join('\n');
}

/**
 * SPEC 14.12 item 3: pure line-keeping function (no subprocess dependency).
 * 'full' returns the text unchanged; 'tail' keeps only the last SPAWN_TAIL_LINES lines.
 */
export function keepLines(text: string, mode: OutputMode): string {
  if (mode === 'full') return text;
  const lines = text.split('\n');
  if (lines.length <= SPAWN_TAIL_LINES) return text;
  return lines.slice(-SPAWN_TAIL_LINES).join('\n');
}

/** Check if baseSha was already handled by looking at git log for a matching commit. */
async function isHandledInGitLog(root: string, baseSha: string): Promise<boolean> {
  const shaPrefix = baseSha.slice(0, SHA_PREFIX_LEN);
  const marker = `(base ${shaPrefix})`;
  try {
    const logOutput = await git(root, ['log', `${baseSha}..HEAD`, '--oneline']);
    return logOutput
      .split('\n')
      .some((line) => line.includes('ops: report queue') && line.includes(marker));
  } catch {
    return false;
  }
}

/** Compute backoff delay in ms for a given failure count (SPEC 14.9 item 2). */
function computeBackoffMs(failures: number): number {
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 14.9: 2^(failures-1) multiplier
  const multiplier = Math.pow(2, failures - 1);
  return Math.min(BACKOFF_INITIAL_MS * multiplier, BACKOFF_MAX_MS);
}

/** Extract failed item names from preflight --json output (SPEC 14.9 item 3). */
function extractPreflightFailNames(stdout: string): string[] {
  try {
    const parsed = JSON.parse(stdout) as { checks?: { name: string; ok: boolean }[] };
    if (Array.isArray(parsed.checks)) {
      return parsed.checks.filter((c) => !c.ok).map((c) => c.name);
    }
  } catch {
    // Not valid JSON, ignore
  }
  return [];
}

/** Build notification key for preflight failures (SPEC 14.9 item 2). */
function preflightNotifyKey(baseSha: string, failNames: string[]): string {
  const sorted = [...failNames].sort();
  return `preflight:${baseSha}:${sorted.join(',')}`;
}

/** Try to extract queue.finished.reason via `report --queue <id> --json` (SPEC 14.9 item 3). */
function extractQueueReason(reportJsonStdout: string): string | null {
  try {
    const parsed = JSON.parse(reportJsonStdout) as { reason?: string };
    if (typeof parsed.reason === 'string') return parsed.reason;
  } catch {
    // Not valid JSON
  }
  return null;
}

// ---------------------------------------------------------------------------
// Write minimal report (SPEC 14.4 step 5 fallback)
// ---------------------------------------------------------------------------

function writeMinimalReport(
  root: string,
  qRunId: string,
  runExitCode: number,
  stdout: string,
  stderr: string,
): void {
  const content = [
    `# 队列运行 ${qRunId}`,
    '',
    `退出码：${String(runExitCode)}`,
    '',
    '## stdout (末 50 行)',
    '',
    '```',
    lastLines(stdout, MINIMAL_REPORT_TAIL),
    '```',
    '',
    '## stderr (末 50 行)',
    '',
    '```',
    lastLines(stderr, MINIMAL_REPORT_TAIL),
    '```',
    '',
  ].join('\n');
  const reportPath = join(root, 'docs', 'ops', `queue-${qRunId}.md`);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, content);
}

/** Build the appendix section for the report (SPEC 14.9 item 5 / 14.12 item 5). */
function buildAppendix(ctx: {
  baseSha: string;
  pinnedSha: string;
  runCmd: readonly string[];
  runExitCode: number;
  runStdout: string;
  runStderr: string;
}): string {
  return [
    '',
    '## 运行环境（follow 记录）',
    '',
    `基准提交：${ctx.baseSha}`,
    `固定版本：${ctx.pinnedSha}`,
    `run 命令行：${ctx.runCmd.join(' ')}`,
    `run 退出码：${String(ctx.runExitCode)}`,
    'preflight：ok',
    '',
    '### run stdout (末 20 行)',
    '',
    '```',
    lastLines(ctx.runStdout, APPENDIX_TAIL),
    '```',
    '',
    '### run stderr (末 20 行)',
    '',
    '```',
    lastLines(ctx.runStderr, APPENDIX_TAIL),
    '```',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Run one cycle (SPEC 14.4 steps 1–8, with 14.9 hardening)
// ---------------------------------------------------------------------------

interface ExecuteRunOpts {
  root: string;
  baseSha: string;
  pinnedSha: string;
  max: number;
  spawnFn: SpawnFn;
  sendNotify: NotifySender;
  out: (text: string) => void;
  stateJson: FollowJson;
  nowFn: () => number;
  pinnedParentDir: string;
}

interface ExecuteRunResult {
  /** Always true after run --continue starts (SPEC 14.9 item 1). */
  handled: boolean;
  newNotified: string[];
  retryState: RetryState | undefined;
  /** SPEC 14.12: deferred queue-end notification. */
  pendingReport?: PendingReport;
}

async function executeRun(opts: ExecuteRunOpts): Promise<ExecuteRunResult> {
  const {
    root,
    baseSha,
    pinnedSha,
    max,
    spawnFn,
    sendNotify,
    out,
    stateJson,
    nowFn,
    pinnedParentDir,
  } = opts;
  const newNotified: string[] = [];
  const notifiedSet = new Set(stateJson.notified);

  // Step 1: baseSha must be ancestor of HEAD (SPEC 14.4)
  const headSha = (await git(root, ['rev-parse', 'HEAD'])).trim();
  let isAnc: boolean;
  try {
    isAnc = await isAncestor(root, baseSha, headSha);
  } catch {
    isAnc = false;
  }
  if (!isAnc) {
    // SPEC 14.9 item 2: notify once with key ancestor:<baseSha>, then just wait — no subprocess
    const key = `ancestor:${baseSha}`;
    if (!notifiedSet.has(key)) {
      await sendNotify(`[Collie] 基准提交 ${baseSha} 不是 HEAD 的祖先，跳过`);
      newNotified.push(key);
    }
    return { handled: false, newNotified, retryState: stateJson.retry };
  }

  // SPEC 14.9 item 1: check if already handled via git log
  const handledInLog = await isHandledInGitLog(root, baseSha);
  if (handledInLog) {
    return { handled: true, newNotified, retryState: stateJson.retry };
  }

  // SPEC 14.9 item 2: check backoff — if within notBefore, skip this cycle
  if (stateJson.retry !== undefined && nowFn() < stateJson.retry.notBefore) {
    return { handled: false, newNotified, retryState: stateJson.retry };
  }

  // Step 2: prepare pinned R2 directory (SPEC 14.4 / 14.9 item 6)
  let pinnedDir: string;
  try {
    pinnedDir = await preparePinnedR2(root, pinnedSha, spawnFn, pinnedParentDir);
  } catch {
    // SPEC 14.9 item 2: pinned dir failure → notify once, enter backoff
    const key = `pinned:${pinnedSha}`;
    if (!notifiedSet.has(key)) {
      await sendNotify(`[Collie] 固定版本目录准备失败：${pinnedSha}`);
      newNotified.push(key);
    }
    const failures = (stateJson.retry?.failures ?? 0) + 1;
    const retryState: RetryState = {
      failures,
      notBefore: nowFn() + computeBackoffMs(failures),
    };
    return { handled: false, newNotified, retryState };
  }
  const pinnedCli = join(pinnedDir, 'src', 'cli.ts');

  // Step 3: preflight --smoke --json (SPEC 14.9 items 2–3; SPEC 14.12 item 3: full output)
  const preflightCmd = ['npx', 'tsx', pinnedCli, 'preflight', '--smoke', '--json'];
  const preflightResult = await spawnFn(preflightCmd, root, 'full');
  if (preflightResult.exitCode !== 0) {
    // Extract failed item names from JSON output (SPEC 14.9 item 3)
    const failNames = extractPreflightFailNames(preflightResult.stdout);
    const key = preflightNotifyKey(baseSha, failNames);
    if (!notifiedSet.has(key)) {
      // Notify with just names, no detail / no paths (SPEC 14.9 item 3)
      const nameList = failNames.length > 0 ? failNames.join(', ') : 'unknown';
      await sendNotify(`[Collie] preflight 失败：${nameList}`);
      newNotified.push(key);
    }
    // Enter backoff (SPEC 14.9 item 2)
    const failures = (stateJson.retry?.failures ?? 0) + 1;
    const retryState: RetryState = {
      failures,
      notBefore: nowFn() + computeBackoffMs(failures),
    };
    return { handled: false, newNotified, retryState };
  }

  // Preflight succeeded — clear backoff (SPEC 14.9 item 2: success clears retry)

  // Track queue run dirs before the run
  const qRunsBefore = new Set(findQueueRunDirs(root));

  // Step 4: run --continue --max (SPEC 14.9 item 4; SPEC 14.12 item 3: tail output)
  const runCmd = ['npx', 'tsx', pinnedCli, 'run', '--continue', '--max', String(max)];
  const runResult = await spawnFn(runCmd, root, 'tail');
  const runExitCode = runResult.exitCode;

  // SPEC 14.9 item 1: after starting run --continue, always mark handled
  // (regardless of subsequent failures)

  // Step 5: find new q- run directories
  const qRunsAfter = findQueueRunDirs(root);
  const newQRuns = qRunsAfter.filter((d) => !qRunsBefore.has(d));
  const qRunId = newQRuns[newQRuns.length - 1] ?? 'q-unknown';

  // Try generating report with workspace HEAD's cli.ts (SPEC 14.4 step 5)
  let reportGenerated = false;
  let reportJsonStdout = '';
  try {
    const headCli = join(root, 'src', 'cli.ts');
    const reportCmd = ['npx', 'tsx', headCli, 'report', '--queue', qRunId];
    const reportResult = await spawnFn(reportCmd, root, 'full');
    if (reportResult.exitCode === 0 && reportResult.stdout.trim().length > 0) {
      let reportContent = reportResult.stdout;
      // SPEC 14.9 item 5 / 14.12 item 5: append environment section
      const appendix = buildAppendix({
        baseSha,
        pinnedSha,
        runCmd,
        runExitCode,
        runStdout: runResult.stdout,
        runStderr: runResult.stderr,
      });
      reportContent += appendix;

      const reportPath = join(root, 'docs', 'ops', `queue-${qRunId}.md`);
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, reportContent);
      reportGenerated = true;
    }
    // Also try JSON for extracting reason (SPEC 14.9 item 3; SPEC 14.12 item 3: full output)
    const reportJsonCmd = ['npx', 'tsx', headCli, 'report', '--queue', qRunId, '--json'];
    const jsonResult = await spawnFn(reportJsonCmd, root, 'full');
    if (jsonResult.exitCode === 0) {
      reportJsonStdout = jsonResult.stdout;
    }
  } catch {
    // Fall through to minimal report
  }

  // Step 5 fallback: write minimal report
  if (!reportGenerated) {
    writeMinimalReport(root, qRunId, runExitCode, runResult.stdout, runResult.stderr);
  }

  // Step 6: commit (SPEC 14.9 item 1: commit msg includes base sha prefix)
  // SPEC 14.12: push moved to syncWithRemote at the start of next cycle
  const baseShaPrefix = baseSha.slice(0, SHA_PREFIX_LEN);
  const reportFile = `docs/ops/queue-${qRunId}.md`;
  const commitMsg = `ops: report queue ${qRunId} (base ${baseShaPrefix})`;
  try {
    await git(root, ['add', '--', reportFile]);
    await git(root, ['commit', '-m', commitMsg, '--', reportFile]);
  } catch {
    // Commit may fail if file unchanged; continue
  }

  // SPEC 14.12 item 2 / 14.15 item 2: check commit result and defer queue-end notification
  const journalReason = extractQueueReason(reportJsonStdout);
  const reason = journalReason ?? `exit ${String(runExitCode)}`;

  // SPEC 14.15 item 2: check if report commit succeeded
  let reportCommitted = true;
  try {
    const statusOutput = (await git(root, ['status', '--porcelain', '--', reportFile])).trim();
    if (statusOutput.length > 0) {
      reportCommitted = false;
    }
  } catch {
    // Can't determine status; assume committed
  }

  out(`action: run baseSha=${baseSha} qRunId=${qRunId} exitCode=${String(runExitCode)}\n`);

  // SPEC 14.15 item 2: commit failed → notify immediately, don't record pendingReport
  if (!reportCommitted) {
    const commitKey = `commit:${qRunId}`;
    if (!notifiedSet.has(commitKey)) {
      await sendNotify(
        `[Collie] 队列 ${qRunId} 结束：${reason}，退出码 ${String(runExitCode)}；汇报没能提交，留在操作员机器的 docs/ops/ 下`,
      );
      newNotified.push(commitKey);
    }
    // Base still marked as handled, queue not re-run (SPEC 14.15)
    return { handled: true, newNotified, retryState: undefined };
  }

  const pendingReportEntry: PendingReport = { qRunId, reason, exitCode: runExitCode };

  // Step 8: always mark handled (SPEC 14.9 item 1)
  return { handled: true, newNotified, retryState: undefined, pendingReport: pendingReportEntry };
}

// ---------------------------------------------------------------------------
// Sync with remote (SPEC 14.12 item 1)
// ---------------------------------------------------------------------------

interface SyncResult {
  localAhead: boolean;
  newNotified: string[];
  /** SPEC 14.15 item 1: true when fetch failed or needed pull failed. */
  syncFailed: boolean;
}

async function syncWithRemote(
  root: string,
  sendNotify: NotifySender,
  notifiedSet: ReadonlySet<string>,
): Promise<SyncResult> {
  const newNotified: string[] = [];

  // SPEC 14.15 item 1: track fetch failure as sync failure
  let syncFailed = false;

  // Step 1: git fetch origin main (best-effort)
  try {
    await git(root, ['fetch', '--quiet', 'origin', 'main']);
  } catch {
    // Fetch failure — sync failed for this round
    syncFailed = true;
  }

  let localHead: string;
  let remoteHead: string;
  try {
    localHead = (await git(root, ['rev-parse', 'HEAD'])).trim();
    remoteHead = (await git(root, ['rev-parse', 'origin/main'])).trim();
  } catch {
    // Can't determine state — skip sync
    return { localAhead: false, newNotified, syncFailed };
  }

  if (localHead === remoteHead) {
    return { localAhead: false, newNotified, syncFailed };
  }

  // Check relative positions
  let localIsAncOfRemote: boolean;
  let remoteIsAncOfLocal: boolean;
  try {
    localIsAncOfRemote = await isAncestor(root, localHead, remoteHead);
  } catch {
    localIsAncOfRemote = false;
  }
  try {
    remoteIsAncOfLocal = await isAncestor(root, remoteHead, localHead);
  } catch {
    remoteIsAncOfLocal = false;
  }

  // Case 1: local is behind (remote ahead, local not ahead) → pull
  if (localIsAncOfRemote) {
    try {
      await git(root, ['pull', '--ff-only', '--quiet', 'origin', 'main']);
    } catch {
      // SPEC 14.15 item 1: pull needed and failed → sync failure
      return { localAhead: false, newNotified, syncFailed: true };
    }
    return { localAhead: false, newNotified, syncFailed };
  }

  // Case 2: local is ahead, remote has no new commits → push
  if (remoteIsAncOfLocal) {
    try {
      await push(root, 'origin', 'main');
      return { localAhead: false, newNotified, syncFailed };
    } catch {
      const shaPrefix = localHead.slice(0, SHA_PREFIX_LEN);
      const key = `push:${shaPrefix}`;
      if (!notifiedSet.has(key)) {
        await sendNotify('[Collie] 队列汇报推送失败，会继续重试');
        newNotified.push(key);
      }
      return { localAhead: true, newNotified, syncFailed };
    }
  }

  // Case 3: diverged — both have new commits
  // Check if all local-only commits are "ops: report queue" commits
  let allReport = false;
  try {
    const localOnlyLog = await git(root, ['log', '--oneline', 'origin/main..HEAD']);
    const lines = localOnlyLog
      .trim()
      .split('\n')
      .filter((l) => l.length > 0);
    allReport =
      lines.length > 0 &&
      lines.every((l) => {
        const spaceIdx = l.indexOf(' ');
        const subject = spaceIdx >= 0 ? l.slice(spaceIdx + 1) : '';
        return subject.startsWith('ops: report queue');
      });
  } catch {
    // Can't determine — treat as non-report commits
  }

  if (allReport) {
    // Try rebase then push
    try {
      await git(root, ['pull', '--rebase', '--quiet', 'origin', 'main']);
      // Rebase succeeded, now push
      try {
        await push(root, 'origin', 'main');
        return { localAhead: false, newNotified, syncFailed };
      } catch {
        const newHead = (await git(root, ['rev-parse', 'HEAD'])).trim();
        const shaPrefix = newHead.slice(0, SHA_PREFIX_LEN);
        const key = `push:${shaPrefix}`;
        if (!notifiedSet.has(key)) {
          await sendNotify('[Collie] 队列汇报推送失败，会继续重试');
          newNotified.push(key);
        }
        return { localAhead: true, newNotified, syncFailed };
      }
    } catch {
      // Rebase conflict → abort
      try {
        await git(root, ['rebase', '--abort']);
      } catch {
        // abort may fail if rebase didn't actually start
      }
      // Fall through to diverged notification
    }
  }

  // Diverged, can't auto-resolve
  const shaPrefix = localHead.slice(0, SHA_PREFIX_LEN);
  const key = `diverged:${shaPrefix}`;
  if (!notifiedSet.has(key)) {
    await sendNotify(`[Collie] 仓库分叉，本地 HEAD ${shaPrefix}`);
    newNotified.push(key);
  }
  return { localAhead: true, newNotified, syncFailed };
}

// ---------------------------------------------------------------------------
// Main loop (SPEC 14.4 / 14.9)
// ---------------------------------------------------------------------------

export async function follow(opts: FollowOpts): Promise<number> {
  const {
    root,
    once = false,
    dryRun = false,
    out = (text: string) => process.stdout.write(text),
  } = opts;
  const intervalSecs = opts.intervalSecs ?? DEFAULT_FOLLOW_INTERVAL_SECS;
  const timeoutSecs = opts.timeoutSecs;
  const nowFn = opts.now ?? (() => Date.now());
  const sleepFn = opts.sleep ?? defaultSleep;
  const spawnFn = opts.spawn ?? defaultSpawn;
  const pinnedParentDir = opts.pinnedParentDir ?? tmpdir();

  // Build notification sender
  const sendNotify: NotifySender =
    opts.sendNotify ??
    (async (text: string) => {
      try {
        const config = loadConfig(root);
        const fetchFn: NotifyFetch = (url, init) => fetch(url, init);
        await realNotify(text, config, root, fetchFn);
      } catch {
        // Best effort
      }
    });

  const startTime = nowFn();
  const timeoutMs = timeoutSecs !== undefined ? timeoutSecs * MS_PER_SEC : undefined;

  // Main loop
  for (;;) {
    // Check timeout
    if (timeoutMs !== undefined && nowFn() - startTime >= timeoutMs) {
      out('follow: timeout reached\n');
      return 0;
    }

    // Load persisted state
    const stateJson = loadFollowState(root);

    // SPEC 14.12 item 1: sync with remote before reading next.md (except dry-run)
    if (!dryRun) {
      const notifiedSet = new Set(stateJson.notified);
      const syncResult = await syncWithRemote(root, sendNotify, notifiedSet);
      if (syncResult.newNotified.length > 0) {
        stateJson.notified = [...stateJson.notified, ...syncResult.newNotified];
        saveFollowState(root, stateJson);
      }

      // SPEC 14.15 item 1: track consecutive sync failures
      if (syncResult.syncFailed) {
        stateJson.syncFailures = (stateJson.syncFailures ?? 0) + 1;
        if (
          stateJson.syncFailures >= SYNC_FAILURE_THRESHOLD &&
          !new Set(stateJson.notified).has('pull')
        ) {
          await sendNotify('[Collie] git pull 连续失败');
          stateJson.notified = [...stateJson.notified, 'pull'];
        }
        saveFollowState(root, stateJson);
      } else {
        // Sync succeeded: clear syncFailures and remove pull from notified
        if ((stateJson.syncFailures ?? 0) > 0 || stateJson.notified.includes('pull')) {
          stateJson.syncFailures = 0;
          stateJson.notified = stateJson.notified.filter((k) => k !== 'pull');
          saveFollowState(root, stateJson);
        }
      }

      // SPEC 14.12 item 2: send pending queue-end notification when local is no longer ahead
      if (stateJson.pendingReport !== undefined && !syncResult.localAhead) {
        const pr = stateJson.pendingReport;
        await sendNotify(
          `[Collie] 队列 ${pr.qRunId} 结束：${pr.reason}，退出码 ${String(pr.exitCode)}。到对话里说「看」`,
        );
        stateJson.pendingReport = undefined;
        saveFollowState(root, stateJson);
      }
    }

    // Read next.md
    const nextPath = join(root, NEXT_MD_PATH);
    let nextContent: string;
    try {
      nextContent = readFileSync(nextPath, 'utf8');
    } catch {
      // No next.md: wait
      if (once) return 0;
      await sleepFn(intervalSecs * MS_PER_SEC);
      continue;
    }

    // Parse and decide
    const parsed = parseNext(nextContent);
    const state = toFollowState(stateJson);
    const action: DecideAction = decide(parsed, state);

    if (dryRun) {
      // SPEC 14.4: dry-run only prints the action line
      out(`action: ${action.action}${formatActionDetail(action)}\n`);
      return 0;
    }

    // Execute action
    switch (action.action) {
      case 'wait': {
        // Nothing to do, sleep and loop
        break;
      }
      case 'notify_wait': {
        await sendNotify(action.text);
        const updated: FollowJson = {
          ...stateJson,
          notified: [...stateJson.notified, action.key],
        };
        saveFollowState(root, updated);
        break;
      }
      case 'notify_end': {
        await sendNotify(`[Collie] 收工：${action.text}`);
        const updated: FollowJson = {
          ...stateJson,
          notified: [...stateJson.notified, action.key],
        };
        saveFollowState(root, updated);
        // After notifying end, next iteration decide() returns 'end'
        break;
      }
      case 'end': {
        out('follow: 收工\n');
        return 0;
      }
      case 'run': {
        // SPEC 14.12 item 5: clear backoff when base commit changes
        if (stateJson.retryBase !== undefined && stateJson.retryBase !== action.baseSha) {
          stateJson.retry = undefined;
          stateJson.retryBase = undefined;
          saveFollowState(root, stateJson);
        }

        const result = await executeRun({
          root,
          baseSha: action.baseSha,
          pinnedSha: action.pinnedSha,
          max: action.max,
          spawnFn,
          sendNotify,
          out,
          stateJson,
          nowFn,
          pinnedParentDir,
        });
        const updated: FollowJson = {
          handledBase: result.handled ? action.baseSha : stateJson.handledBase,
          notified: [...stateJson.notified, ...result.newNotified],
          retry: result.retryState,
          retryBase: result.retryState !== undefined ? action.baseSha : stateJson.retryBase,
          pendingReport: result.pendingReport ?? stateJson.pendingReport,
          syncFailures: stateJson.syncFailures,
        };
        saveFollowState(root, updated);
        break;
      }
    }

    if (once) return 0;

    await sleepFn(intervalSecs * MS_PER_SEC);
  }
}

// ---------------------------------------------------------------------------
// Default implementations (only used when opts does not inject them)
// ---------------------------------------------------------------------------

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * SPEC 14.9 item 4 / 14.12 item 3: default subprocess spawner.
 * Streams child's output to follow's stdout.
 * 'tail' mode: keeps only the last 200 lines in memory.
 * 'full' mode: keeps all lines.
 * SPEC 14.12 item 4: program not found → exit 127, no throw.
 */
export async function defaultSpawn(
  cmd: readonly string[],
  cwd: string,
  mode: OutputMode,
): Promise<SpawnResult> {
  const { spawn: spawnChild } = await import('node:child_process');
  return new Promise<SpawnResult>((resolve) => {
    const program = cmd[0] ?? 'echo';
    const args = cmd.slice(1);
    let done = false;

    const child = spawnChild(program, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let stdoutBuf = '';
    let stderrBuf = '';

    const pushLines = (buf: string, lines: string[]): string => {
      const combined = buf;
      const parts = combined.split('\n');
      // Last element is the incomplete line (carry over)
      const carry = parts.pop() ?? '';
      for (const line of parts) {
        process.stdout.write(line + '\n');
        lines.push(line);
        if (mode === 'tail' && lines.length > SPAWN_TAIL_LINES) lines.shift();
      }
      return carry;
    };

    // SPEC 14.12 item 4: program not found → exit 127
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (!done) {
        done = true;
        // eslint-disable-next-line no-restricted-syntax -- SPEC 14.12: well-known exit code for missing program
        const EXIT_NOT_FOUND = 127;
        resolve({
          exitCode: err.code === 'ENOENT' ? EXIT_NOT_FOUND : 1,
          stdout: '',
          stderr: err.message,
        });
      }
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf = pushLines(stdoutBuf + chunk.toString(), stdoutLines);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf = pushLines(stderrBuf + chunk.toString(), stderrLines);
    });

    child.on('close', (code: number | null) => {
      if (!done) {
        done = true;
        // Flush remaining
        if (stdoutBuf.length > 0) {
          stdoutLines.push(stdoutBuf);
          if (mode === 'tail' && stdoutLines.length > SPAWN_TAIL_LINES) stdoutLines.shift();
        }
        if (stderrBuf.length > 0) {
          stderrLines.push(stderrBuf);
          if (mode === 'tail' && stderrLines.length > SPAWN_TAIL_LINES) stderrLines.shift();
        }
        resolve({
          exitCode: code ?? 1,
          stdout: stdoutLines.join('\n'),
          stderr: stderrLines.join('\n'),
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatActionDetail(action: DecideAction): string {
  switch (action.action) {
    case 'wait':
    case 'end':
      return '';
    case 'notify_wait':
    case 'notify_end':
      return ` key=${action.key} text=${action.text}`;
    case 'run':
      return ` baseSha=${action.baseSha} pinnedSha=${action.pinnedSha} max=${String(action.max)}`;
  }
}
