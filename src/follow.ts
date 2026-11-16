// SPEC 14.4: `collie follow` — constant loop that reads docs/ops/next.md,
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

/** Result of spawning a subprocess (SPEC 14.4: injected). */
export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Subprocess spawner signature — (args, cwd) → result. */
export type SpawnFn = (args: readonly string[], cwd: string) => Promise<SpawnResult>;

/** Notification sender signature. */
export type NotifySender = (text: string) => Promise<void>;

/** State persisted to .collie/follow.json between iterations (SPEC 14.4). */
export interface FollowJson {
  handledBase: string | null;
  notified: string[];
  /** Pending push: the file that was committed but not yet pushed. */
  pendingPush?: boolean;
}

/** Options for the follow loop (SPEC 14.4). */
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
  /** Injected subprocess spawner (SPEC 14.4). */
  spawn?: SpawnFn;
  /** Injected notification sender (SPEC 14.4). */
  sendNotify?: NotifySender;
  /** Injected output. */
  out?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Constants (SPEC 14.4)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4: default polling interval (not a tunable threshold)
const DEFAULT_FOLLOW_INTERVAL_SECS = 60;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4: ms-per-second conversion factor, not a threshold
const MS_PER_SEC = 1000;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4 step 2: sha prefix length for pinned dir name
const SHA_PREFIX_LEN = 12;

// eslint-disable-next-line no-restricted-syntax -- SPEC 14.4 step 5: tail lines for minimal report
const MINIMAL_REPORT_TAIL = 50;

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
 * SPEC 14.4 step 2: prepare pinned R2 directory.
 * Directory is `<tmpdir>/collie-r2-<project>-<sha12>`.
 * If it already exists, reuse it. Otherwise `git worktree add --detach`.
 * If the pinned sha's package-lock.json matches HEAD's, symlink node_modules.
 */
async function preparePinnedR2(root: string, pinnedSha: string, spawnFn: SpawnFn): Promise<string> {
  const name = projectName(root);
  const shaPrefix = pinnedSha.slice(0, SHA_PREFIX_LEN);
  const dirName = `collie-r2-${name}-${shaPrefix}`;
  const pinnedDir = join(tmpdir(), dirName);

  if (existsSync(pinnedDir)) return pinnedDir;

  // Create worktree
  await git(root, ['worktree', 'add', '--detach', '--quiet', pinnedDir, pinnedSha]);

  // Check if package-lock.json matches
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
      // Different lock files: run npm ci
      await spawnFn(['npm', 'ci'], pinnedDir);
    }
  } catch {
    // If package-lock.json missing or other error, try npm ci
    try {
      await spawnFn(['npm', 'ci'], pinnedDir);
    } catch {
      // Best effort
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
// Write minimal report (SPEC 14.4 step 5 fallback)
// ---------------------------------------------------------------------------

function writeMinimalReport(
  root: string,
  qRunId: string,
  runExitCode: number,
  stdout: string,
  stderr: string,
): void {
  const lastLines = (text: string, n: number): string => {
    const lines = text.split('\n');
    return lines.slice(-n).join('\n');
  };
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

// ---------------------------------------------------------------------------
// Run one cycle (SPEC 14.4 steps 1–8)
// ---------------------------------------------------------------------------

async function executeRun(
  root: string,
  baseSha: string,
  pinnedSha: string,
  max: number,
  spawnFn: SpawnFn,
  sendNotify: NotifySender,
  out: (text: string) => void,
): Promise<{ handled: boolean; newNotified: string[] }> {
  const newNotified: string[] = [];

  // Step 1: baseSha must be ancestor of HEAD (SPEC 14.4)
  const headSha = (await git(root, ['rev-parse', 'HEAD'])).trim();
  let isAnc: boolean;
  try {
    isAnc = await isAncestor(root, baseSha, headSha);
  } catch {
    isAnc = false;
  }
  if (!isAnc) {
    // Treat as format error — notify once
    const key = `ancestor:${baseSha}`;
    await sendNotify(`[Collie] 基准提交 ${baseSha} 不是 HEAD 的祖先，跳过`);
    newNotified.push(key);
    return { handled: false, newNotified };
  }

  // Step 2: prepare pinned R2 directory (SPEC 14.4)
  const pinnedDir = await preparePinnedR2(root, pinnedSha, spawnFn);
  const pinnedCli = join(pinnedDir, 'src', 'cli.ts');

  // Step 3: preflight --smoke (SPEC 14.4)
  const preflightResult = await spawnFn([pinnedCli, 'preflight', '--smoke'], root);
  if (preflightResult.exitCode !== 0) {
    const key = `preflight:${baseSha}`;
    const failItems = preflightResult.stdout || preflightResult.stderr || 'unknown failure';
    await sendNotify(`[Collie] preflight 失败：${failItems.trim()}`);
    newNotified.push(key);
    // Not recorded as handled — next cycle retries
    return { handled: false, newNotified };
  }

  // Track queue run dirs before the run
  const qRunsBefore = new Set(findQueueRunDirs(root));

  // Step 4: run --continue --max (SPEC 14.4)
  const runResult = await spawnFn([pinnedCli, 'run', '--continue', '--max', String(max)], root);
  const runExitCode = runResult.exitCode;

  // Step 5: find new q- run directories
  const qRunsAfter = findQueueRunDirs(root);
  const newQRuns = qRunsAfter.filter((d) => !qRunsBefore.has(d));
  const qRunId = newQRuns[newQRuns.length - 1] ?? 'q-unknown';

  // Try generating report with workspace HEAD's cli.ts (SPEC 14.4 step 5)
  let reportGenerated = false;
  try {
    const headCli = join(root, 'src', 'cli.ts');
    const reportResult = await spawnFn([headCli, 'report', '--queue', qRunId], root);
    if (reportResult.exitCode === 0 && reportResult.stdout.trim().length > 0) {
      const reportPath = join(root, 'docs', 'ops', `queue-${qRunId}.md`);
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, reportResult.stdout);
      reportGenerated = true;
    }
  } catch {
    // Fall through to minimal report
  }

  // Step 5 fallback: write minimal report
  if (!reportGenerated) {
    writeMinimalReport(root, qRunId, runExitCode, runResult.stdout, runResult.stderr);
  }

  // Step 6: commit and push (SPEC 14.4)
  const reportFile = `docs/ops/queue-${qRunId}.md`;
  const commitMsg = `ops: report queue ${qRunId}`;
  try {
    await git(root, ['add', '--', reportFile]);
    await git(root, ['commit', '-m', commitMsg, '--', reportFile]);
  } catch {
    // Commit may fail if file unchanged; continue
  }

  // Push
  let pushFailed = false;
  try {
    await push(root, 'origin', 'main');
  } catch {
    pushFailed = true;
    await sendNotify('[Collie] 推送失败，下一圈重试');
  }

  // Step 7: notify queue end (SPEC 14.4)
  const reason = runExitCode === 0 ? 'exhausted' : `exit ${String(runExitCode)}`;
  await sendNotify(
    `[Collie] 队列 ${qRunId} 结束：${reason}，退出码 ${String(runExitCode)}。到对话里说「看」`,
  );

  out(`action: run baseSha=${baseSha} qRunId=${qRunId} exitCode=${String(runExitCode)}\n`);

  // Step 8: mark handled unless push failed
  return { handled: !pushFailed, newNotified };
}

// ---------------------------------------------------------------------------
// Retry pending push (SPEC 14.4 step 6 fallback)
// ---------------------------------------------------------------------------

async function retryPendingPush(root: string): Promise<boolean> {
  try {
    await push(root, 'origin', 'main');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main loop (SPEC 14.4)
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

    // Retry pending push if needed (SPEC 14.4 step 6)
    if (stateJson.pendingPush === true && !dryRun) {
      const pushed = await retryPendingPush(root);
      if (pushed) {
        stateJson.pendingPush = undefined;
        saveFollowState(root, stateJson);
      }
    }

    // Pull (SPEC 14.4: each iteration starts with git pull --ff-only)
    if (!dryRun) {
      try {
        await git(root, ['pull', '--ff-only', '--quiet']);
      } catch {
        // Pull failure: continue with current state
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
        const result = await executeRun(
          root,
          action.baseSha,
          action.pinnedSha,
          action.max,
          spawnFn,
          sendNotify,
          out,
        );
        const updated: FollowJson = {
          handledBase: result.handled ? action.baseSha : stateJson.handledBase,
          notified: [...stateJson.notified, ...result.newNotified],
          ...(result.handled ? {} : { pendingPush: true }),
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

async function defaultSpawn(args: readonly string[], cwd: string): Promise<SpawnResult> {
  const cp = await import('node:child_process');
  try {
    const stdout = cp.execFileSync('npx', ['tsx', ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error: unknown) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
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
