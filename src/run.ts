// R2's single-batch loop (SPEC 6): task -> worker -> report -> reviewer in a
// head_sha worktree -> verdict -> own evidence -> arbiter -> progress.
// Deterministic: no LLM decides anything here (ROLES 2 R2).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { arbitrate, type ArbiterDecision } from './arbiter.js';
import { BACKLOG_RELATIVE_PATH, loadBacklog, setBatchStatus } from './backlog.js';
import { queryCi, type Clock, type FetchLike } from './ci.js';
import { loadConfig } from './config.js';
import { collectEvidence, type Evidence } from './evidence.js';
import { isR2Commit } from './evidence.js';
import { gateDecision, type GateInput } from './gate.js';
import {
  addWorktree,
  commit,
  git,
  isAncestor,
  log,
  push,
  remoteContains,
  removeWorktree,
  revParse,
  status,
} from './git.js';
import {
  checkHeartbeat,
  removeHeartbeat,
  touchHeartbeat,
  updateHeartbeat,
  writeHeartbeat,
} from './heartbeat.js';
import { createJournal, EVENTS_FILE_NAME, RUNS_RELATIVE_DIR, type Journal } from './journal.js';
import { LivenessMonitor, runLadder, type LadderReason } from './ladder.js';
import { writeProgress } from './progress.js';
import { readVerdict, runReviewer, verdictPath } from './roles/reviewer.js';
import { buildTask, readReport, runWorker, taskPath, writeTask } from './roles/worker.js';
import { CLAUDE_SDK_PACKAGE } from './runner/claude.js';
import type { AgentRunner, RunHandle } from './runner/index.js';
import type {
  Acceptance,
  Batch,
  BatchStatus,
  Event,
  EventType,
  Report,
  Verdict,
  VerdictValue,
} from './schema/index.js';
import { RunIdSchema } from './schema/index.js';

/** SPEC 5 exit codes of `collie run`. */
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 5 exit codes */
export const EXIT_CODES: Readonly<Record<VerdictValue | 'ERROR' | 'PAUSED', number>> = {
  PASS: 0,
  FIX: 10,
  BLOCK: 20,
  PAUSED: 30,
  ERROR: 1,
};
/* eslint-enable no-restricted-syntax, @typescript-eslint/no-magic-numbers */

// eslint-disable-next-line no-restricted-syntax -- unit conversion, not a threshold
const MS_PER_SECOND = 1000;
/** SPEC 3.6: worker.finished.final_text is cut to this many characters (a format bound, not a tunable). */
// eslint-disable-next-line no-restricted-syntax -- fixed by SPEC 3.6
export const FINAL_TEXT_MAX = 2000;

/** Raw event stream from the agent (SPEC 11.3), separate from Collie's own journal. */
export const STREAM_FILE_NAME = 'stream.ndjson';

/** Raw event stream from the reviewer (SPEC 12.1), same format and redaction as worker. */
export const REVIEWER_STREAM_FILE_NAME = 'reviewer.stream.ndjson';

/**
 * Dependencies approved by SPEC 2.2 and ADR-002, plus the platform SDK of the
 * Claude runner (ADR-004, named by the runner itself); rule 3 blocks anything else.
 */
export const APPROVED_DEPENDENCIES: readonly string[] = [
  CLAUDE_SDK_PACKAGE,
  'commander',
  'zod',
  'smol-toml',
  'yaml',
  'vitest',
  'tsx',
  'typescript',
  '@types/node',
  'eslint',
  '@eslint/js',
  'typescript-eslint',
  'prettier',
  'eslint-config-prettier',
];

export interface RunContext {
  root: string;
  batchId: string;
  runId: string;
  runner: AgentRunner;
  fetch: FetchLike;
  /** Git remote that "pushed" is checked against. */
  remote: string;
  /** Injected clock for deterministic envelopes and journal timestamps. */
  now: () => Date;
  /** Diagnostic output for stderr (SPEC 12.1: startup CI warning). */
  err?: (text: string) => void;
  /** Override for tests; when set, disables the internal wallclock timer. */
  workerSignal?: AbortSignal;
  /** Time source for the CI wait; tests pass a fake one. */
  clock?: Clock;
  /** Injected delay for the signal ladder grace periods (SPEC 11.6: tests must not wait >2s). */
  ladderDelay?: (ms: number) => Promise<void>;
  /** Override the liveness monitor check interval (ms) for tests. */
  livenessIntervalMs?: number;
  /** Injected monotonic clock for the liveness monitor (SPEC 11.5); defaults to Date.now. */
  livenessNow?: () => number;
  /** Injected timer for the liveness monitor (SPEC 11.5); defaults to setTimeout. */
  livenessSetTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Injected fingerprint function for the liveness monitor (SPEC 11.5, v02-b04-fix). */
  livenessFingerprint?: (root: string) => Promise<string>;
  /**
   * SPEC 12.2: when true (--continue mode), runBatch updates the backlog
   * status column as part of the verdict commit. Single-batch mode never sets this.
   */
  updateBacklogStatus?: boolean;
}

export interface RunOutcome {
  final: VerdictValue;
  exitCode: number;
  decision?: ArbiterDecision;
  /** Why the run stopped early, for escalations. */
  escalation?: string;
  /** Evidence collected by R2, available when the full pipeline ran. */
  evidence?: Evidence;
  /** Reviewer gaps from the verdict, available when the verdict parsed. */
  gaps?: readonly string[];
}

class Recorder {
  constructor(
    private readonly journal: Journal,
    private readonly runId: string,
    private readonly batchId: string | undefined,
    private readonly now: () => Date,
  ) {}

  record(event: EventType, fields: Record<string, Event[string]> = {}): void {
    this.journal.append({
      ts: this.now().toISOString(),
      run_id: this.runId,
      ...(this.batchId !== undefined ? { batch_id: this.batchId } : {}),
      event,
      ...fields,
    });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findBatch(root: string, batchId: string): Batch {
  const batch = loadBacklog(root).find((b) => b.id === batchId);
  if (batch === undefined) throw new Error(`batch ${batchId} is not in docs/backlog.md`);
  return batch;
}

/** The expect of `cmd` among the commands R2 ran (global [verify] first, then the batch). */
function expectOf(cmd: string, commands: readonly Acceptance[]): Acceptance['expect'] {
  return commands.find((c) => c.cmd === cmd)?.expect ?? 'exit_zero';
}

/** Global [verify] commands, then the batch acceptance (SPEC 3.1). */
function verifyCommands(globalCommands: readonly string[], batch: Batch): Acceptance[] {
  return [
    ...globalCommands.map((cmd): Acceptance => ({ desc: cmd, cmd, expect: 'exit_zero' })),
    ...batch.acceptance,
  ];
}

/**
 * A worktree at head_sha: the committed result, without report.md (it is
 * committed after head_sha) and without uncommitted leftovers. Dependencies are
 * not part of git, so the main tree's node_modules is linked in when present.
 */
async function withHeadWorktree<T>(
  root: string,
  batchId: string,
  headSha: string,
  body: (dir: string) => Promise<T>,
): Promise<T> {
  const holder = mkdtempSync(join(tmpdir(), `collie-${batchId}-`));
  const dir = join(holder, 'tree');
  try {
    await addWorktree(root, dir, headSha);
    const modules = join(root, 'node_modules');
    if (existsSync(modules)) symlinkSync(modules, join(dir, 'node_modules'), 'dir');
    return await body(dir);
  } finally {
    await removeWorktree(root, dir).catch(() => undefined);
    rmSync(holder, { recursive: true, force: true });
  }
}

/** Persists the reviewer's final reply as verdict.md (SPEC 3.5) and parses it. */
function persistVerdict(
  root: string,
  batchId: string,
  finalText: string | undefined,
): { ok: true; value: Verdict } | { ok: false; error: string } {
  if (finalText === undefined || finalText.trim() === '')
    return { ok: false, error: 'reviewer returned no final text' };
  writeFileSync(
    verdictPath(root, batchId),
    finalText.endsWith('\n') ? finalText : `${finalText}\n`,
  );
  try {
    return { ok: true, value: readVerdict(root, batchId) };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Appends one raw event line to .collie/runs/<run_id>/<fileName> (SPEC 11.3, 12.1). */
function appendStream(
  root: string,
  runId: string,
  event: unknown,
  fileName = STREAM_FILE_NAME,
): void {
  const dir = join(root, RUNS_RELATIVE_DIR, runId);
  mkdirSync(dir, { recursive: true });
  // Raw dump: JSON.stringify never emits bare newlines, so each line is one event.
  appendFileSync(join(dir, fileName), JSON.stringify(event) + '\n');
}

/**
 * SPEC 11.7 (v02-e-fix2): refines a raw SDK event `type` when it is too broad.
 * If `type` is `assistant` or `user`, look for a `subtype` → `type/subtype`,
 * or for a `tool_use` content block → `tool_use/<name>`.
 */
function refineEventType(obj: Record<string, unknown>): string {
  const raw = typeof obj.type === 'string' ? obj.type : 'unknown';
  if (raw !== 'assistant' && raw !== 'user') return raw;
  // Prefer tool_use name (most specific), then subtype.
  if (Array.isArray(obj.content)) {
    for (const block of obj.content as unknown[]) {
      if (typeof block === 'object' && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === 'tool_use' && typeof b.name === 'string') {
          return `tool_use/${b.name}`;
        }
      }
    }
  }
  if (typeof obj.subtype === 'string') return `${raw}/${obj.subtype}`;
  return raw;
}

/**
 * SPEC 11.7 (v02-e-fix2): reads stream.ndjson for a run, extracting the last
 * event's refined type and timestamp.  Used as a fallback when the journal has
 * no `run.finished` (R2 crashed before writing it).
 *
 * Timestamp resolution order (SPEC 11.7):
 *   1. Last line's own `timestamp` field.
 *   2. Nearest earlier line that has `timestamp`.
 *   3. `heartbeatUpdatedAt` (the orphaned heartbeat's `updated_at`).
 * The returned `ts` is never empty (`'unknown'` as the absolute last resort).
 */
function readStreamLastEvent(
  root: string,
  runId: string,
  heartbeatUpdatedAt?: string,
): { type: string; ts: string } | undefined {
  const streamPath = join(root, RUNS_RELATIVE_DIR, runId, STREAM_FILE_NAME);
  let content: string;
  try {
    content = readFileSync(streamPath, 'utf8').trimEnd();
  } catch {
    return undefined;
  }
  if (content === '') return undefined;
  const lines = content.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return undefined;

  // Parse the last line for type and timestamp.
  let lastObj: Record<string, unknown> | undefined;
  const lastLine = lines.at(-1);
  if (lastLine === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(lastLine);
    if (typeof parsed === 'object' && parsed !== null) {
      lastObj = parsed as Record<string, unknown>;
    }
  } catch {
    // Corrupted last line: ignore.
  }
  if (lastObj === undefined) return undefined;

  // SPEC 11.7 (v02-e-fix2): event type refined for assistant/user messages.
  const type = refineEventType(lastObj);

  // SPEC 11.7 (v02-e-fix2): timestamp from this line, backward search, heartbeat fallback.
  let ts = typeof lastObj.timestamp === 'string' ? lastObj.timestamp : '';
  if (ts === '') {
    // Search backward for the nearest line that has a timestamp.
    for (let i = lines.length - 1 - 1; i >= 0; i--) {
      const line = lines[i];
      if (line === undefined) continue;
      try {
        const prev: unknown = JSON.parse(line);
        if (typeof prev === 'object' && prev !== null) {
          const prevTs = (prev as Record<string, unknown>).timestamp;
          if (typeof prevTs === 'string' && prevTs !== '') {
            ts = prevTs;
            break;
          }
        }
      } catch {
        continue;
      }
    }
  }
  // Heartbeat updated_at as final fallback (SPEC 11.7).
  if (ts === '' && typeof heartbeatUpdatedAt === 'string' && heartbeatUpdatedAt !== '') {
    ts = heartbeatUpdatedAt;
  }
  // SPEC 11.7: returned time must never be empty.
  if (ts === '') ts = 'unknown';

  return { type, ts };
}

/**
 * Dirty-workspace rescue (SPEC 11.4): if the working tree is not clean after
 * the worker exits, `git add -A && git commit -m "wip(collie): <batch_id> rescue"`.
 * Returns the rescue sha and file list, or undefined when the tree was clean.
 */
async function rescueDirtyWorkspace(
  root: string,
  batchId: string,
): Promise<{ sha: string; files: string[] } | undefined> {
  const ws = await status(root);
  if (ws.clean) return undefined;
  const files = ws.entries.map((e) => e.path);
  await git(root, ['add', '-A']);
  await git(root, ['commit', '-m', `wip(collie): ${batchId} rescue`]);
  const sha = await revParse(root, 'HEAD');
  return { sha, files };
}

const RULE_ESCALATED = 0;
const RULE_UNPARSEABLE = 1;
// eslint-disable-next-line no-restricted-syntax -- SPEC 4.3 rule number: evidence missing
const RULE_EVIDENCE_MISSING = 9;

/** Synthetic decision for escalation paths that never reach the arbiter (SPEC 11.7). */
function escalationDecision(reason: string): ArbiterDecision {
  return {
    final: 'BLOCK',
    original: null,
    rule: RULE_ESCALATED,
    reason,
    mismatches: [],
    failedAcceptance: [],
    downgraded: false,
  };
}

/** Empty evidence for escalation paths that never reach evidence collection (SPEC 11.7). */
function emptyEvidence(): Evidence {
  return {
    commits_actual: [],
    verify_results: [],
    remote_has_head: false,
    ci_conclusion: 'unknown',
    ci_run_url: '',
    ci_branch_matched: null,
    deps_diff: [],
    spec_diff_lines: 0,
  };
}

/** Real delay: waits `ms` using setTimeout. Production default for ladderDelay. */
function realDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * SPEC 11.7 (v03-b04-fix): renders the "上一轮判 FIX" section for the task body.
 * Includes gaps, failed acceptance commands, commit list, and a note to only
 * fix gaps without re-doing existing work.
 */
export function renderFixSection(info: FixInfo): string {
  const lines = ['', '## 上一轮判 FIX', ''];
  if (info.gaps.length > 0) {
    lines.push('### Gaps');
    lines.push('');
    for (const gap of info.gaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }
  if (info.failedAcceptance.length > 0) {
    lines.push('### 未通过的验收命令');
    lines.push('');
    for (const fa of info.failedAcceptance) {
      lines.push(`- \`${fa.cmd}\` → exit ${String(fa.exit_code)}`);
    }
    lines.push('');
  }
  if (info.commits.length > 0) {
    lines.push('### 上一轮代码提交');
    lines.push('');
    for (const sha of info.commits) {
      lines.push(`- \`${sha}\``);
    }
    lines.push('');
  }
  lines.push('这些提交已在审核范围内，只补缺口，不要重做。');
  lines.push('');
  return lines.join('\n');
}

/**
 * SPEC 11.3: guard daemon interval in milliseconds. The daemon polls every
 * GUARD_POLL_MS to check if R2 is still alive; when it's gone, it kills the
 * worker subprocess and exits.
 */
// eslint-disable-next-line no-restricted-syntax -- SPEC 11.3: guard daemon poll interval, not a tunable threshold
const GUARD_POLL_MS = 2000;

/**
 * SPEC 11.3: spawns a guard daemon that watches R2's pid and the worker's pid.
 * The daemon is a minimal `node -e` script, detached from R2's process group,
 * so it survives R2 being SIGKILL'd. It polls every 2 seconds; if R2 (r2Pid)
 * disappears, it sends SIGKILL to workerPid and exits.
 * Returns the daemon's pid so it can be written to the heartbeat.
 */
export function spawnGuardDaemon(r2Pid: number, workerPid: number): number {
  const script = [
    `const r2 = ${String(r2Pid)}, w = ${String(workerPid)};`,
    `const iv = setInterval(() => {`,
    `  try { process.kill(r2, 0); } catch {`,
    `    try { process.kill(w, 'SIGKILL'); } catch {}`,
    `    clearInterval(iv);`,
    `    process.exit(0);`,
    `  }`,
    `}, ${String(GUARD_POLL_MS)});`,
  ].join(' ');
  const child = spawn(process.execPath, ['-e', script], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const pid = child.pid;
  if (pid === undefined) throw new Error('guard daemon did not start (no pid)');
  return pid;
}

/**
 * SPEC 11.3: kills the guard daemon cleanly when no longer needed.
 */
function killGuard(guardPid: number | undefined): void {
  if (guardPid === undefined) return;
  try {
    process.kill(guardPid, 'SIGTERM');
  } catch {
    // Already dead — expected.
  }
}

/**
 * SPEC 11.3: R2 registers exit/signal handlers to send SIGTERM to the worker
 * process group (-pid) when R2 is exiting normally or via SIGTERM/SIGINT.
 * Returns a cleanup function that removes the handlers.
 */
function registerWorkerKillHandlers(getWorkerPid: () => number | undefined): () => void {
  const killWorkerGroup = (): void => {
    const pid = getWorkerPid();
    if (pid === undefined) return;
    try {
      // Negative pid sends to the process group (detached: true gives the
      // worker its own group).
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Process (group) already dead — expected.
    }
  };

  const onExit = (): void => {
    killWorkerGroup();
  };
  const onSignal = (): void => {
    killWorkerGroup();
  };

  process.on('exit', onExit);
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  return () => {
    process.removeListener('exit', onExit);
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
  };
}

// ---------------------------------------------------------------------------
// Batch history analysis (SPEC 11.7): reads all previous runs of a batch to
// determine attempt, base_sha, interrupt context, and resume eligibility.
// ---------------------------------------------------------------------------

/**
 * Whether a run ended as an "interrupt" per SPEC 11.7: non-PASS verdict AND one
 * of the abnormal end conditions (stalled / idling / wallclock / orphaned /
 * turns_exhausted / non-zero exit).
 * FIX is NOT an interrupt (v03-b04-fix): attempt increments but interrupted_at
 * stays null and the task gets a "上一轮判 FIX" section instead.
 */
function classifyRun(events: readonly Event[]): 'pass' | 'fix' | 'interrupted' {
  const finished = events.findLast((e) => e.event === 'run.finished');
  if (finished === undefined) return 'interrupted'; // no run.finished means crashed hard
  // SPEC 11.7: PASS runs never count as interrupted.
  if (finished.verdict === 'PASS') return 'pass';
  // SPEC 11.7 (v03-b04-fix): FIX runs are not interrupted.
  if (finished.verdict === 'FIX') return 'fix';
  // Any other non-PASS termination is an interrupt for task.md injection purposes.
  return 'interrupted';
}

/**
 * SPEC 11.7 (v03-b04-fix): context from the previous FIX verdict, used to
 * generate the "上一轮判 FIX" section in the next task.md.
 */
export interface FixInfo {
  /** Verbatim gaps from the previous verdict. */
  gaps: readonly string[];
  /** Acceptance commands that failed, with exit codes. */
  failedAcceptance: readonly { cmd: string; exit_code: number }[];
  /** Code commits from the previous run's evidence. */
  commits: readonly string[];
}

export interface BatchHistory {
  /** Attempt number for the next run. */
  attempt: number;
  /** The first run's base_sha (SPEC 4.3: subsequent attempts reuse it). */
  baseSha: string | undefined;
  /** SPEC 11.7: interrupted_at string for the task envelope. */
  interruptedAt: string | undefined;
  /** SPEC 11.7: rescue commit sha from the last run. */
  rescueSha: string | undefined;
  /** Last run's sessionId for resume, if available. */
  lastSessionId: string | undefined;
  /** Number of times resume has been used for this batch. */
  resumeCount: number;
  /**
   * SPEC 11.7 (v03-b03-fix): true when the last interrupted run exited cleanly
   * (worker.finished present, no worker.rescued). When true and the remote
   * contains the last non-R2 commit, the session should NOT be resumed.
   */
  lastRunClean: boolean;
  /**
   * SPEC 11.7 (v03-b04-fix): context from the previous FIX verdict.
   * Present when the last run ended with FIX. Used to render the
   * "上一轮判 FIX" section in the task body.
   */
  fixInfo?: FixInfo;
}

/** All journal events of every run that touched `batchId`, oldest run first. */
function allBatchEvents(root: string): Map<string, Event[]> {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return new Map();
  const journal = createJournal(root);
  const runs = new Map<string, Event[]>();
  for (const runId of readdirSync(runsDir).sort()) {
    if (
      !RunIdSchema.safeParse(runId).success ||
      !existsSync(join(runsDir, runId, EVENTS_FILE_NAME))
    )
      continue;
    runs.set(runId, journal.replay(runId));
  }
  return runs;
}

/**
 * Analyzes the journal to determine the state of a batch across previous runs
 * (SPEC 11.7). Returns the context needed for the next task envelope.
 */
export function batchHistory(root: string, batchId: string, excludeRunId?: string): BatchHistory {
  const allRuns = allBatchEvents(root);
  let attempt = 1;
  let baseSha: string | undefined;
  let interruptedAt: string | undefined;
  let rescueSha: string | undefined;
  let lastSessionId: string | undefined;
  let resumeCount = 0;
  let lastRunClean = false;
  let fixInfo: FixInfo | undefined;

  // SPEC 11.7 (v02-e-fix2): the excluded run (the current run) may contain
  // run.orphaned events with heartbeat updated_at timestamps, and worker.rescued
  // events from the orphan rescue path.  Collect both before the main loop.
  const excludedEvents = excludeRunId !== undefined ? (allRuns.get(excludeRunId) ?? []) : [];
  // Map from orphaned run id → heartbeat updated_at (for readStreamLastEvent fallback).
  const orphanHeartbeatTs = new Map<string, string>();
  for (const e of excludedEvents) {
    if (
      e.event === 'run.orphaned' &&
      typeof e.orphaned_run_id === 'string' &&
      typeof e.updated_at === 'string'
    ) {
      orphanHeartbeatTs.set(e.orphaned_run_id, e.updated_at);
    }
  }
  // SPEC 11.7 (v02-e-fix2): rescue_sha from the current run's orphan rescue path.
  // The rescue happens after run.orphaned and before batchHistory() is called,
  // but excludeRunId filters it out of the main loop — check it separately.
  const currentRunRescued = excludedEvents.findLast(
    (e) => e.event === 'worker.rescued' && e.batch_id === batchId,
  );
  const currentRunRescueSha =
    currentRunRescued !== undefined && typeof currentRunRescued.sha === 'string'
      ? currentRunRescued.sha
      : undefined;

  for (const [runId, events] of allRuns) {
    if (runId === excludeRunId) continue;
    const batchEvents = events.filter((e) => e.batch_id === batchId);
    if (batchEvents.length === 0) continue;

    // Extract first run's base_sha from batch.selected event.
    const selected = batchEvents.find((e) => e.event === 'batch.selected');
    if (selected !== undefined && baseSha === undefined && typeof selected.base_sha === 'string') {
      baseSha = selected.base_sha;
    }

    // Count resume usage from worker.resumed events with a session_id.
    const resumed = batchEvents.find((e) => e.event === 'worker.resumed');
    if (resumed !== undefined && typeof resumed.session_id === 'string') {
      resumeCount++;
    }

    // SPEC 11.7 (v03-b04-fix): three-way classification: pass / fix / interrupted.
    const classification = classifyRun(batchEvents);

    if (classification === 'pass') {
      // PASS run: reset interrupt context, attempt does not increment.
      interruptedAt = undefined;
      rescueSha = undefined;
      lastSessionId = undefined;
      lastRunClean = false;
      fixInfo = undefined;
    } else if (classification === 'fix') {
      // SPEC 11.7 (v03-b04-fix): FIX is not an interrupt. Attempt increments but
      // interrupted_at stays null. Collect FIX-specific context for the task body.
      attempt++;
      interruptedAt = undefined;
      rescueSha = undefined;
      lastSessionId = undefined;
      lastRunClean = false;

      // Collect FIX info: gaps + failed acceptance + commits from verdict and journal.
      let gaps: readonly string[] = [];
      let commits: readonly string[] = [];
      try {
        const verdict = readVerdict(root, batchId);
        gaps = [...verdict.gaps];
        commits = [...verdict.evidence.commits_actual];
      } catch {
        // verdict.md not readable: use empty
      }
      const failedAcceptance = batchEvents
        .filter((e) => e.event === 'acceptance.failed')
        .map((e) => ({
          cmd: typeof e.cmd === 'string' ? e.cmd : '',
          exit_code: typeof e.exit_code === 'number' ? e.exit_code : -1,
        }));
      fixInfo = { gaps, failedAcceptance, commits };
    } else {
      // Interrupted: BLOCK / crashed / orphaned.
      attempt++;
      fixInfo = undefined;

      // Build interrupted_at from the last run's info.
      const finished = batchEvents.findLast((e) => e.event === 'run.finished');
      const workerFinished = batchEvents.findLast((e) => e.event === 'worker.finished');

      // SPEC 11.7 (v03-b03-fix): end reason priority:
      // worker.signaled.reason → worker_stop_reason → result → orphaned → unknown.
      // When the signal ladder fired, its reason (wallclock / stalled / idling) is
      // the true cause; the SDK's stop_reason is a side effect of the interrupt.
      const signaled = batchEvents.findLast((e) => e.event === 'worker.signaled');
      const signaledReason = typeof signaled?.reason === 'string' ? signaled.reason : undefined;

      const stopReason =
        signaledReason ??
        (typeof finished?.worker_stop_reason === 'string'
          ? finished.worker_stop_reason
          : typeof finished?.result === 'string'
            ? finished.result
            : finished === undefined
              ? 'orphaned'
              : 'unknown');

      // SPEC 11.7 (v02-e-fix): when journal has no run.finished, fall back to
      // stream.ndjson for the last event (worker events streamed in real-time).
      // v02-e-fix2: readStreamLastEvent now refines event type and resolves
      // timestamp via backward search + heartbeat fallback.
      let lastType: string;
      let lastTs: string;
      if (finished === undefined) {
        const heartbeatTs = orphanHeartbeatTs.get(runId);
        const streamEvent = readStreamLastEvent(root, runId, heartbeatTs);
        if (streamEvent !== undefined) {
          lastType = streamEvent.type;
          lastTs = streamEvent.ts;
        } else {
          const journalLast = batchEvents.at(-1);
          lastType = journalLast?.event ?? 'unknown';
          lastTs = journalLast?.ts ?? '';
        }
      } else {
        const journalLast = batchEvents.at(-1);
        lastType = journalLast?.event ?? 'unknown';
        lastTs = journalLast?.ts ?? '';
      }
      interruptedAt = `${runId} ${stopReason} ${lastType}@${lastTs}`;

      // Session ID from worker.finished for resume eligibility.
      lastSessionId =
        typeof workerFinished?.session_id === 'string' ? workerFinished.session_id : undefined;

      // Rescue sha from worker.rescued event in this run's journal.
      const rescued = batchEvents.findLast((e) => e.event === 'worker.rescued');
      rescueSha = typeof rescued?.sha === 'string' ? rescued.sha : undefined;

      // SPEC 11.7 (v03-b03-fix): when the worker finished normally (worker.finished
      // exists) and workspace was clean (no worker.rescued), the code is already
      // complete. Resuming the session is wasteful — set lastRunClean so runBatch
      // can skip resume after confirming the commits are on the remote.
      lastRunClean = workerFinished !== undefined && rescued === undefined;
    }
  }

  // SPEC 11.7 (v02-e-fix2): overlay the current run's orphan rescue sha.
  // In the orphan path the rescue is recorded in the CURRENT run's journal
  // (after run.orphaned), not the previous run's.  Take the last one overall.
  if (currentRunRescueSha !== undefined) {
    rescueSha = currentRunRescueSha;
  }

  return {
    attempt,
    baseSha,
    interruptedAt,
    rescueSha,
    lastSessionId,
    resumeCount,
    lastRunClean,
    fixInfo,
  };
}

/**
 * Reads the CI token from `config.ci.token_file` (SPEC 3.1).
 * Returns undefined when the file is not configured, missing, or empty.
 */
function readCiToken(config: { ci: { token_file?: string } }, root: string): string | undefined {
  if (config.ci.token_file === undefined) return undefined;
  const raw = config.ci.token_file;
  const tokenPath = raw.startsWith('~')
    ? join(homedir(), raw.slice(1))
    : isAbsolute(raw)
      ? raw
      : join(root, raw);
  try {
    const content = readFileSync(tokenPath, 'utf8').trim();
    return content === '' ? undefined : content;
  } catch {
    return undefined;
  }
}

/**
 * SPEC 12.1: scans all journal events across all runs and returns the sha from
 * the most recent `verdict.pushed` event. Returns undefined when no such event
 * exists (first run, or all previous pushes failed).
 */
function findLastVerdictPushedSha(root: string): string | undefined {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return undefined;
  const journal = createJournal(root);
  let lastSha: string | undefined;
  for (const dir of readdirSync(runsDir).sort()) {
    if (!RunIdSchema.safeParse(dir).success || !existsSync(join(runsDir, dir, EVENTS_FILE_NAME)))
      continue;
    for (const event of journal.replay(dir)) {
      if (event.event === 'verdict.pushed' && typeof event.sha === 'string') {
        lastSha = event.sha;
      }
    }
  }
  return lastSha;
}

/**
 * SPEC 12.1 (v03-b01-fix): scans all journal events and returns the sha from
 * the most recent `verdict.push_failed` event that has not been subsequently
 * resolved by a `verdict.pushed` with the same sha. Returns undefined when
 * there is no unresolved push failure.
 */
function findLastVerdictPushFailedSha(root: string): string | undefined {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return undefined;
  const journal = createJournal(root);
  let failedSha: string | undefined;
  for (const dir of readdirSync(runsDir).sort()) {
    if (!RunIdSchema.safeParse(dir).success || !existsSync(join(runsDir, dir, EVENTS_FILE_NAME)))
      continue;
    for (const event of journal.replay(dir)) {
      if (event.event === 'verdict.push_failed' && typeof event.sha === 'string') {
        failedSha = event.sha;
      }
      // A successful push resolves the failure: no catch-up needed.
      if (
        event.event === 'verdict.pushed' &&
        typeof event.sha === 'string' &&
        event.sha === failedSha
      ) {
        failedSha = undefined;
      }
    }
  }
  return failedSha;
}

/** Runs one batch end to end. Never throws for agent misbehaviour; only for Collie's own failures. */
export async function runBatch(ctx: RunContext): Promise<RunOutcome> {
  const { root, batchId, runId } = ctx;
  const config = loadConfig(root);
  const batch = findBatch(root, batchId);
  const journal = createJournal(root);
  const rec = new Recorder(journal, runId, batchId, ctx.now);

  // SPEC 12.1 (v03-b01-fix): catch-up push for a failed verdict commit.
  // Must run BEFORE orphan detection (11.3) and rescue (11.4) so that a rescue
  // commit is never accidentally pushed to remote.
  const pushFailedSha = findLastVerdictPushFailedSha(root);
  if (pushFailedSha !== undefined) {
    try {
      const headSha = await revParse(root, 'HEAD');
      if (headSha !== pushFailedSha) {
        // HEAD moved (rescue commit, worker commit, etc.) — not the verdict.
        rec.record('verdict.push_skipped', { head: headSha, reason: 'head_is_not_verdict' });
      } else {
        // HEAD is the verdict commit; check remote before pushing.
        let onRemote = false;
        try {
          onRemote = await remoteContains(root, ctx.remote, config.ci.expected_branch, headSha);
        } catch {
          // Remote unreachable: assume not on remote and attempt push.
        }
        if (onRemote) {
          rec.record('verdict.push_skipped', { head: headSha, reason: 'already_on_remote' });
        } else {
          // verdict.push_failed sha matches HEAD and is not on remote: push it.
          try {
            await push(root, ctx.remote, config.ci.expected_branch);
            rec.record('verdict.pushed', {
              sha: headSha,
              remote: ctx.remote,
              branch: config.ci.expected_branch,
            });
          } catch (pushError) {
            rec.record('verdict.push_failed', {
              sha: headSha,
              error: message(pushError),
            });
          }
        }
      }
    } catch {
      // Best effort: if any git command fails during catch-up, continue.
    }
  }
  // No verdict.push_failed → no push, no event (SPEC 12.1).

  // SPEC 11.3: orphan detection — if a heartbeat file exists and the pid is dead,
  // the previous run was killed. If the pid is alive, refuse to start (铁律 7).
  const hb = checkHeartbeat(root);
  if (hb.status === 'alive') {
    throw new Error(
      `another Collie instance is running (pid ${String(hb.data.pid)}, run ${hb.data.run_id}); refusing to start`,
    );
  }
  if (hb.status === 'orphan') {
    rec.record('run.orphaned', {
      orphaned_run_id: hb.data.run_id,
      orphaned_batch_id: hb.data.batch_id,
      updated_at: hb.data.updated_at,
    });
    // Execute rescue for the orphaned run's dirty workspace (SPEC 11.4).
    const rescue = await rescueDirtyWorkspace(root, hb.data.batch_id);
    if (rescue !== undefined) {
      rec.record('worker.rescued', { sha: rescue.sha, files: rescue.files });
    }
    removeHeartbeat(root);
  }

  rec.record('run.started');

  // SPEC 11.3: heartbeat covers the entire run (worker → reviewer → ci → arbiter),
  // written at run.started, removed after run.finished.
  writeHeartbeat(root, {
    run_id: runId,
    batch_id: batchId,
    pid: process.pid,
    phase: 'worker',
    started_at: ctx.now().toISOString(),
    updated_at: ctx.now().toISOString(),
  });

  // SPEC 12.1: check CI of the most recent verdict.pushed commit at startup.
  const lastVerdictSha = findLastVerdictPushedSha(root);
  if (lastVerdictSha !== undefined) {
    try {
      const ciToken = readCiToken(config, root);
      const ciResult = await queryCi(
        {
          repo: config.project.repo,
          sha: lastVerdictSha,
          expectedBranch: config.ci.expected_branch,
          ...(ciToken !== undefined ? { token: ciToken } : {}),
        },
        ctx.fetch,
      );
      if (ciResult.state === 'completed' && ciResult.conclusion !== null) {
        if (ciResult.conclusion === 'failure' || ciResult.conclusion === 'cancelled') {
          const runUrl = ciResult.runUrl ?? '';
          ctx.err?.(
            `warning: previous verdict commit ${lastVerdictSha} CI ${ciResult.conclusion} (${runUrl})\n`,
          );
          rec.record('ci.verdict_commit', {
            sha: lastVerdictSha,
            conclusion: ciResult.conclusion,
            run_url: runUrl,
          });
        } else if (ciResult.conclusion === 'success') {
          rec.record('ci.verdict_commit', {
            sha: lastVerdictSha,
            conclusion: 'success',
            run_url: ciResult.runUrl ?? '',
          });
        }
        // Other completed conclusions: not specified, skip.
      }
      // no_runs, pending, rate_limited: don't record, don't warn (SPEC 12.1).
    } catch {
      // Best effort: CI check failure doesn't block startup.
    }
  }

  // Track the worker's exit info for run.finished and progress (SPEC 11.7).
  let workerExitCode: number | undefined;
  let workerStopReason: string | undefined;

  const finish = (final: VerdictValue, extra: Partial<RunOutcome> = {}): RunOutcome => {
    rec.record('run.finished', {
      verdict: final,
      exit_code: EXIT_CODES[final],
      // SPEC 11.7: run.finished always carries the worker's exit info.
      ...(workerExitCode !== undefined ? { worker_exit_code: workerExitCode } : {}),
      ...(workerStopReason !== undefined ? { worker_stop_reason: workerStopReason } : {}),
    });
    // SPEC 11.3: heartbeat removed only after run.finished is written.
    removeHeartbeat(root);
    return { final, exitCode: EXIT_CODES[final], ...extra };
  };
  const escalate = async (reason: string, evidenceBaseSha?: string): Promise<RunOutcome> => {
    rec.record('escalated', { reason });
    // SPEC 4.3: "上报：无 report" — escalation without the word "规则 0".
    const escalationReason = `上报：无 report — ${reason}`;
    const decision = escalationDecision(escalationReason);

    // SPEC 4.3: the escalation path still uses git to check base_sha..HEAD for
    // actual commits and push status, so progress records reflect reality.
    let evidence = emptyEvidence();
    if (evidenceBaseSha !== undefined) {
      try {
        const commits = await log(root, evidenceBaseSha, 'HEAD');
        let remoteHasHead = false;
        try {
          remoteHasHead = await remoteContains(
            root,
            ctx.remote,
            config.ci.expected_branch,
            await revParse(root, 'HEAD'),
          );
        } catch {
          // Best effort
        }
        evidence = {
          ...evidence,
          commits_actual: commits.map((c) => c.sha),
          remote_has_head: remoteHasHead,
        };
      } catch {
        // Best effort: if git commands fail, fall back to empty evidence.
      }
    }

    const progressPath = writeProgress(root, {
      batchId,
      runId,
      at: ctx.now().toISOString(),
      decision,
      evidence,
      workerExitCode,
      workerStopReason,
    });
    const escalateEnvelopes = [relative(root, progressPath)];
    // SPEC 12.2: --continue mode updates the backlog status column in this commit.
    if (ctx.updateBacklogStatus === true) {
      const backlogFile = join(root, BACKLOG_RELATIVE_PATH);
      try {
        const backlogText = readFileSync(backlogFile, 'utf8');
        const result = setBatchStatus(backlogText, batchId, 'blocked');
        if (result.changed) {
          writeFileSync(backlogFile, result.text);
          escalateEnvelopes.push(BACKLOG_RELATIVE_PATH);
          rec.record('batch.status', { batch_id: batchId, from: result.from ?? '', to: 'blocked' });
        } else {
          rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
        }
      } catch {
        rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
      }
    }
    await commit(root, `progress: ${batchId} ${decision.final}`, escalateEnvelopes);

    // SPEC 12.1: push the verdict commit to remote (escalation path).
    try {
      await push(root, ctx.remote, config.ci.expected_branch);
      const pushSha = await revParse(root, 'HEAD');
      rec.record('verdict.pushed', {
        sha: pushSha,
        remote: ctx.remote,
        branch: config.ci.expected_branch,
      });
    } catch (pushError) {
      rec.record('verdict.push_failed', {
        sha: await revParse(root, 'HEAD').catch(() => 'unknown'),
        error: message(pushError),
      });
    }

    return finish('BLOCK', { escalation: reason, decision });
  };

  // SPEC 11.3: unhandledRejection handler — catches fire-and-forget promises
  // (e.g. void runLadder()) that reject after stop() throws. The error is stored
  // and handled by the outermost catch below.
  let unhandledError: Error | undefined;
  const onUnhandledRejection = (reason: unknown): void => {
    unhandledError ??=
      reason instanceof Error ? reason : new Error(`unhandled rejection: ${String(reason)}`);
  };
  process.on('unhandledRejection', onUnhandledRejection);

  // SPEC 11.3: outermost try — any unexpected exception after the heartbeat is
  // written triggers the error fallback (run.finished → rescue → progress → heartbeat delete).
  try {
    // SPEC 11.7: analyze previous runs to determine attempt, base_sha, and interrupt context.
    const history = batchHistory(root, batchId, runId);

    // E2: issue the envelope. SPEC 4.3: subsequent attempts reuse the first attempt's base_sha.
    const baseSha = history.baseSha ?? (await revParse(root, 'HEAD'));
    rec.record('batch.selected', { base_sha: baseSha });

    // SPEC 11.7: determine resume eligibility.
    const resumeMax = config.limits.resume_max;
    let resumeSessionId =
      history.lastSessionId !== undefined && history.resumeCount < resumeMax
        ? history.lastSessionId
        : undefined;

    // SPEC 11.7 (v03-b03-fix): skip resume when the last run already pushed code
    // and left a clean workspace (only missing report). Resuming the session is
    // wasteful — the new worker just needs to write the report.
    if (resumeSessionId !== undefined && history.lastRunClean) {
      try {
        const allCommits = await log(root, baseSha, await revParse(root, 'HEAD'));
        const workerCommits = allCommits.filter((c) => !isR2Commit(c.subject));
        const lastWorkerCommit = workerCommits.at(-1);
        if (lastWorkerCommit !== undefined) {
          const onRemote = await remoteContains(
            root,
            ctx.remote,
            config.ci.expected_branch,
            lastWorkerCommit.sha,
          );
          if (onRemote) {
            resumeSessionId = undefined;
          }
        }
      } catch {
        // Remote check failed; keep the resume decision as-is.
      }
    }

    const task = buildTask(batch, {
      run_id: runId,
      base_sha: baseSha,
      created_at: ctx.now().toISOString(),
      attempt: history.attempt,
      interrupted_at: history.interruptedAt,
      rescue_sha: history.rescueSha,
      // SPEC 11.7 (v03-b04-fix): pre-render the FIX section when applicable.
      ...(history.fixInfo !== undefined ? { fixSection: renderFixSection(history.fixInfo) } : {}),
    });
    writeTask(root, batch, task);
    const relTask = taskPath('', batchId);
    const taskSha = await commit(root, `docs: issue ${batchId} task envelope`, [relTask]);
    rec.record('batch.task_written', { path: relTask, commit: taskSha });

    // SPEC 11.7: record worker.resumed event when this is a subsequent attempt.
    if (history.attempt > 1) {
      rec.record('worker.resumed', {
        session_id: resumeSessionId ?? null,
        attempt: history.attempt,
      });
    }

    // E3/E4: the worker, bounded by the wall clock (SPEC 3.3).
    rec.record('worker.started');

    // Liveness detection and signal ladder state (SPEC 11.5, 11.6).
    let workerHandle: RunHandle | undefined;
    let workerExited = false;
    let workerExitResolve: (() => void) | undefined;
    const workerExitPromise = new Promise<void>((r) => {
      workerExitResolve = r;
    });
    let ladderRunning = false;
    // SPEC 11.7 (v03-b03-fix): the ladder reason (wallclock / stalled / idling)
    // is the true stop_reason when the signal ladder is active.
    let ladderReason: LadderReason | undefined;
    const graceSecs = config.limits.grace_secs;
    const ladderDelay = ctx.ladderDelay ?? realDelay;

    function startLadder(reason: LadderReason): void {
      if (ladderRunning || workerExited || workerHandle === undefined) return;
      ladderRunning = true;
      ladderReason = reason;
      if (reason === 'stalled') rec.record('worker.stalled');
      if (reason === 'idling') rec.record('worker.idling');
      void runLadder({
        handle: workerHandle,
        graceSecs,
        reason,
        callbacks: {
          onSignaled: (level, r, error) => {
            rec.record('worker.signaled', {
              level,
              reason: r,
              ...(error !== undefined ? { error } : {}),
            });
          },
        },
        isExited: () => workerExited,
        exitPromise: workerExitPromise,
        delay: ladderDelay,
      });
    }

    // Wallclock timeout triggers the signal ladder (SPEC 11.6: reason=wallclock).
    const wallclockMs = config.limits.wallclock_secs * MS_PER_SECOND;
    const wallclockTimer =
      ctx.workerSignal === undefined
        ? setTimeout(() => {
            startLadder('wallclock');
          }, wallclockMs)
        : undefined;

    // When an external workerSignal replaces the internal timer, its abort
    // triggers the wallclock ladder (SPEC 11.6).
    if (ctx.workerSignal !== undefined) {
      if (ctx.workerSignal.aborted) {
        startLadder('wallclock');
      } else {
        ctx.workerSignal.addEventListener(
          'abort',
          () => {
            startLadder('wallclock');
          },
          { once: true },
        );
      }
    }

    // Liveness monitor (SPEC 11.5).
    const monitor = new LivenessMonitor({
      stallSecs: config.limits.stall_secs,
      progressSecs: config.limits.progress_secs,
      root,
      onStalled: () => {
        startLadder('stalled');
      },
      onIdling: () => {
        startLadder('idling');
      },
      ...(ctx.livenessIntervalMs === undefined ? {} : { checkIntervalMs: ctx.livenessIntervalMs }),
      ...(ctx.livenessNow === undefined ? {} : { now: ctx.livenessNow }),
      ...(ctx.livenessSetTimer === undefined ? {} : { setTimer: ctx.livenessSetTimer }),
      ...(ctx.livenessFingerprint === undefined ? {} : { fingerprint: ctx.livenessFingerprint }),
    });

    // SPEC 11.3: stream + heartbeat callbacks.
    const onEvent = (event: unknown): void => {
      appendStream(root, runId, event);
      touchHeartbeat(root, ctx.now().toISOString());
      monitor.onEvent();
      // SPEC 3.6: tool.denied events emitted by the runner's PreToolUse hook
      // go into the journal for the audit trail (v03-b03-fix2).
      if (
        typeof event === 'object' &&
        event !== null &&
        (event as Record<string, unknown>).event === 'tool.denied'
      ) {
        const e = event as Record<string, unknown>;
        rec.record('tool.denied', {
          role: typeof e.role === 'string' ? e.role : 'unknown',
          tool: typeof e.tool === 'string' ? e.tool : 'unknown',
          command: typeof e.command === 'string' ? e.command : '',
          pattern: typeof e.pattern === 'string' ? e.pattern : '',
        });
      }
    };
    const onStarted = (handle: RunHandle): void => {
      workerHandle = handle;
      // SPEC 11.2 (v02-b05-fix): worker_pid is set by the onPid callback below,
      // not from handle.pid here — the spawn hook may fire after onStarted.
      monitor.start();
    };
    // SPEC 11.2 (v02-b05-fix): the spawn hook calls onPid as soon as the
    // subprocess pid is known, which may be after onStarted. R2 writes it to
    // the heartbeat here instead of reading handle.pid in onStarted.
    // SPEC 11.3 (v02-e-fix): also starts the guard daemon and registers
    // signal handlers so the worker dies with R2.
    let guardPid: number | undefined;
    let removeKillHandlers: (() => void) | undefined;
    const onPid = (pid: number): void => {
      updateHeartbeat(root, { worker_pid: pid, updated_at: ctx.now().toISOString() });
      // SPEC 11.3: R2 registers exit/SIGTERM/SIGINT handlers to kill the worker group.
      removeKillHandlers = registerWorkerKillHandlers(() => workerHandle?.pid);
      // SPEC 11.3: spawn a guard daemon that kills the worker if R2 is SIGKILL'd.
      try {
        guardPid = spawnGuardDaemon(process.pid, pid);
        updateHeartbeat(root, { guard_pid: guardPid, updated_at: ctx.now().toISOString() });
      } catch {
        // Guard daemon failed to start — not fatal, signal handlers still work for normal exits.
      }
    };

    const cleanupTimers = (): void => {
      workerExited = true;
      workerExitResolve?.();
      monitor.stop();
      if (wallclockTimer !== undefined) clearTimeout(wallclockTimer);
      // SPEC 11.3 (v02-e-fix): clean up guard and signal handlers after worker exits.
      removeKillHandlers?.();
      killGuard(guardPid);
    };

    // v02-e-drill: build the redact set from token_file content and CI env vars.
    // The runner masks these in the event stream but never reads config or env itself.
    const redact: string[] = [];
    const ciTokenValue = readCiToken(config, root);
    if (ciTokenValue !== undefined) redact.push(ciTokenValue);
    for (const key of ['GITHUB_TOKEN', 'GH_TOKEN'] as const) {
      const val = process.env[key];
      if (val !== undefined && val !== '') redact.push(val);
    }

    try {
      const result = await runWorker(ctx.runner, config, batch, root, {
        ...(ctx.workerSignal === undefined ? {} : { signal: ctx.workerSignal }),
        onEvent,
        onStarted,
        onPid,
        ...(resumeSessionId === undefined ? {} : { resumeSessionId }),
        ...(redact.length > 0 ? { redact } : {}),
      });
      cleanupTimers();
      // SPEC 11.7 (v03-b03-fix): when the signal ladder was active, the true
      // stop_reason is the ladder reason (wallclock / stalled / idling), not the
      // SDK's value (which is typically 'error' or 'stopped' as a side effect of
      // the soft interrupt). The SDK's value goes into sdk_stop_reason.
      const effectiveStopReason = ladderReason ?? result.stopReason;
      workerExitCode = result.exitCode;
      workerStopReason = effectiveStopReason;
      rec.record('worker.finished', {
        exit_code: result.exitCode,
        // SPEC 3.6: without it a zero-output exit cannot be explained (v01-b05-smoke).
        ...(result.finalText === undefined
          ? {}
          : { final_text: truncate(result.finalText, FINAL_TEXT_MAX) }),
        ...(effectiveStopReason === undefined ? {} : { stop_reason: effectiveStopReason }),
        // SPEC 11.7 (v03-b03-fix): SDK's original stop_reason when overridden by ladder.
        ...(ladderReason !== undefined && result.stopReason !== undefined
          ? { sdk_stop_reason: result.stopReason }
          : {}),
        // SPEC 11.7: session_id for resume eligibility in the next attempt.
        ...(result.sessionId === undefined ? {} : { session_id: result.sessionId }),
      });
    } catch (error) {
      cleanupTimers();
      // SPEC 11.7: crashed worker has no RunResult, record what we know.
      workerExitCode = EXIT_CODES.ERROR;
      workerStopReason = 'error';
      // SPEC 11.6: worker.crashed only for runner self-exceptions, not ladder-induced stops.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by startLadder() during async worker
      if (!ladderRunning) {
        rec.record('worker.crashed', { error: message(error) });
      }
      // SPEC 11.4: rescue any uncommitted work even on crash.
      const rescue = await rescueDirtyWorkspace(root, batchId);
      if (rescue !== undefined) {
        rec.record('worker.rescued', { sha: rescue.sha, files: rescue.files });
      }
      return await escalate(`worker crashed: ${message(error)}`, baseSha);
    }

    // SPEC 11.4: rescue uncommitted work left behind by the worker.
    const rescue = await rescueDirtyWorkspace(root, batchId);
    if (rescue !== undefined) {
      rec.record('worker.rescued', { sha: rescue.sha, files: rescue.files });
    }

    let report: Report;
    try {
      report = readReport(root, batchId);
    } catch (error) {
      return await escalate(`no valid report: ${message(error)}`, baseSha);
    }
    // SPEC 11.7 (v03-b03-fix): head_sha must descend from the first base_sha
    // (not the current task commit — attempt 2 may reference an attempt 1 commit
    // that is earlier than the current task commit) AND be an ancestor of or equal
    // to the current HEAD.
    const headDescendsFromBase = await isAncestor(root, baseSha, report.head_sha).catch(
      () => false,
    );
    const resolvedHead = await revParse(root, report.head_sha).catch(() => '');
    const currentHead = await revParse(root, 'HEAD').catch(() => '');
    const headIsAncestorOfHEAD =
      resolvedHead === currentHead ||
      (await isAncestor(root, report.head_sha, currentHead).catch(() => false));
    if (!headDescendsFromBase || !headIsAncestorOfHEAD)
      return await escalate(
        `report head_sha ${report.head_sha} is not a descendant of base_sha ${baseSha} or not an ancestor of HEAD`,
        baseSha,
      );

    // Worker output is taskSha..head_sha: the task commit is R2's, not the worker's (SPEC 3.3).
    const outcome = await withHeadWorktree(root, batchId, report.head_sha, async (tree) => {
      // SPEC 11.3 (v02-e-fix): reviewer phase clears worker_pid from heartbeat —
      // the worker is done, so its pid is no longer relevant for orphan detection.
      updateHeartbeat(root, {
        phase: 'reviewer',
        worker_pid: null,
        updated_at: ctx.now().toISOString(),
      });

      // E5: the reviewer works in the head_sha worktree, where report.md does not exist (SPEC 3.5).
      let finalText: string | undefined;
      rec.record('reviewer.started', { head_sha: report.head_sha });
      // SPEC 12.1: reviewer event stream falls to reviewer.stream.ndjson with redaction.
      const reviewerOnEvent = (event: unknown): void => {
        appendStream(root, runId, event, REVIEWER_STREAM_FILE_NAME);
      };
      try {
        const reviewer = await runReviewer(
          ctx.runner,
          config,
          {
            batch_id: batchId,
            // SPEC 11.7 (v02-e-fix): use the first run's base_sha for the reviewer,
            // not taskSha. This means attempt ≥ 2 diffs include prior attempt commits.
            base_sha: baseSha,
            head_sha: report.head_sha,
            items: batch.items,
            acceptance: batch.acceptance,
            spec_paths: ['SPEC.md', 'CONSTRAINTS.md'],
          },
          tree,
          {
            onEvent: reviewerOnEvent,
            ...(redact.length > 0 ? { redact } : {}),
          },
        );
        finalText = reviewer.finalText;
      } catch (error) {
        finalText = undefined;
        rec.record('escalated', { reason: `reviewer failed: ${message(error)}` });
      }
      const verdict = persistVerdict(root, batchId, finalText);
      rec.record(
        'reviewer.verdict',
        verdict.ok ? { verdict: verdict.value.verdict } : { error: verdict.error },
      );

      // SPEC 11.3: heartbeat transitions to ci phase (evidence collection includes CI polling).
      updateHeartbeat(root, { phase: 'ci', updated_at: ctx.now().toISOString() });

      // R2's own measurements, also on the committed head_sha tree.
      const collected = await collectEvidence({
        root,
        verifyCwd: tree,
        remote: ctx.remote,
        // SPEC 11.7 (v02-e-fix): use the first run's base_sha for commits_actual,
        // not taskSha. attempt ≥ 2 evidence thus includes prior attempt commits.
        baseSha,
        // SPEC 11.7 (v02-e-fix): protectedDiff and deps use the current run's
        // taskSha so R2's own progress commits don't trigger arbiter rule 2.
        taskSha,
        headSha: report.head_sha,
        commands: verifyCommands(config.verify.commands, batch),
        config,
        fetch: ctx.fetch,
        ...(ctx.clock === undefined ? {} : { clock: ctx.clock }),
      });
      if (collected.ciWait?.timedOut === true) {
        rec.record('ci.wait_timeout', {
          head_sha: report.head_sha,
          waited_secs: Math.round(collected.ciWait.waitedMs / MS_PER_SECOND),
          polls: collected.ciWait.polls,
          last_state: collected.ciWait.lastState,
        });
      }
      // SPEC 3.6: record ci.resolved when CI evidence was successfully collected.
      if (
        collected.ciWait !== undefined &&
        !collected.ciWait.timedOut &&
        collected.ciWait.result !== undefined
      ) {
        rec.record('ci.resolved', {
          head_sha: report.head_sha,
          conclusion: collected.evidence.ci_conclusion,
          branch_matched: collected.evidence.ci_branch_matched,
          run_url: collected.evidence.ci_run_url,
          waited_secs: Math.round(collected.ciWait.waitedMs / MS_PER_SECOND),
          polls: collected.ciWait.polls,
        });
      } else if (
        collected.ciWait === undefined &&
        !('error' in collected.ci) &&
        collected.ci.state === 'completed'
      ) {
        // Single query (not pushed + waited), but still resolved.
        rec.record('ci.resolved', {
          head_sha: report.head_sha,
          conclusion: collected.evidence.ci_conclusion,
          branch_matched: collected.evidence.ci_branch_matched,
          run_url: collected.evidence.ci_run_url,
          waited_secs: 0,
          polls: 1,
        });
      }
      return { verdict, collected };
    });
    const { verdict, collected } = outcome;

    // SPEC 11.3: heartbeat transitions to arbiter phase.
    updateHeartbeat(root, { phase: 'arbiter', updated_at: ctx.now().toISOString() });

    // The arbiter judges claims against R2's measurements; the reviewer contributes its verdict
    // value and its own mismatches, and its evidence stays on record in verdict.md.
    const decision = arbitrate({
      claims: report.claims,
      verdict: verdict.ok
        ? { ok: true, value: { ...verdict.value, evidence: collected.evidence } }
        : verdict,
      approvedDeps: APPROVED_DEPENDENCIES,
      testCommand: collected.testCommand ?? 'npm test',
      // R2's own judgement of every command against its expect (verify.ts), full stdout included.
      failedAcceptance: collected.verify
        .filter((r) => !r.passed)
        .map((r) => ({
          cmd: r.cmd,
          exit_code: r.exit_code,
          expect: expectOf(r.cmd, verifyCommands(config.verify.commands, batch)),
        })),
    });
    for (const m of decision.mismatches) {
      rec.record('claim.mismatch', {
        rule: m.rule,
        field: m.field,
        claimed: toJson(m.claimed),
        actual: toJson(m.actual),
      });
    }
    for (const f of decision.failedAcceptance) {
      rec.record('acceptance.failed', {
        cmd: f.cmd,
        exit_code: f.exit_code,
        expect: toJson(f.expect),
      });
    }
    if (decision.downgraded) {
      rec.record('verdict.downgraded', {
        from: decision.original,
        to: decision.final,
        rule: decision.rule,
        reason: decision.reason,
      });
    }

    const progressPath = writeProgress(root, {
      batchId,
      runId,
      at: ctx.now().toISOString(),
      decision,
      evidence: collected.evidence,
      workerExitCode,
      workerStopReason,
    });
    // R2 commits its envelopes only after the worker has exited (CONSTRAINTS 铁律 19).
    const envelopes = [relative(root, progressPath)];
    if (existsSync(verdictPath(root, batchId)))
      envelopes.push(relative(root, verdictPath(root, batchId)));
    // SPEC 12.2: --continue mode updates the backlog status column in this commit.
    // FIX verdicts skip: the --continue loop retries and only writes 'blocked' on fix_max.
    if (ctx.updateBacklogStatus === true && decision.final !== 'FIX') {
      const backlogFile = join(root, BACKLOG_RELATIVE_PATH);
      try {
        const backlogText = readFileSync(backlogFile, 'utf8');
        const newStatus = decision.final === 'PASS' ? 'passed' : 'blocked';
        const result = setBatchStatus(backlogText, batchId, newStatus);
        if (result.changed) {
          writeFileSync(backlogFile, result.text);
          envelopes.push(BACKLOG_RELATIVE_PATH);
          rec.record('batch.status', { batch_id: batchId, from: result.from ?? '', to: newStatus });
        } else {
          rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
        }
      } catch {
        rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
      }
    }
    await commit(root, `progress: ${batchId} ${decision.final}`, envelopes);

    // SPEC 12.1: push the verdict commit to remote.
    try {
      await push(root, ctx.remote, config.ci.expected_branch);
      const pushSha = await revParse(root, 'HEAD');
      rec.record('verdict.pushed', {
        sha: pushSha,
        remote: ctx.remote,
        branch: config.ci.expected_branch,
      });
    } catch (pushError) {
      rec.record('verdict.push_failed', {
        sha: await revParse(root, 'HEAD').catch(() => 'unknown'),
        error: message(pushError),
      });
      // SPEC 12.1: push failure does not alter the conclusion or throw.
    }

    return finish(decision.final, {
      decision,
      evidence: collected.evidence,
      gaps: verdict.ok ? verdict.value.gaps : [],
    });
  } catch (outerError) {
    // SPEC 11.3: exception fallback. Any unexpected error after heartbeat write
    // must not let the process exit without cleanup.
    const errorMsg = message(outerError);

    // 1. Record run.finished with result=error.
    rec.record('run.finished', {
      result: 'error',
      error: errorMsg,
      ...(workerExitCode !== undefined ? { worker_exit_code: workerExitCode } : {}),
      ...(workerStopReason !== undefined ? { worker_stop_reason: workerStopReason } : {}),
    });

    // 2. Rescue any dirty workspace (SPEC 11.4).
    try {
      const rescue = await rescueDirtyWorkspace(root, batchId);
      if (rescue !== undefined) {
        rec.record('worker.rescued', { sha: rescue.sha, files: rescue.files });
      }
    } catch {
      // Best effort: if rescue itself fails, continue cleanup.
    }

    // 3. Write progress record for this failed run.
    try {
      const decision = escalationDecision(`exception: ${errorMsg}`);
      const progressPath = writeProgress(root, {
        batchId,
        runId,
        at: ctx.now().toISOString(),
        decision,
        evidence: emptyEvidence(),
        workerExitCode,
        workerStopReason,
      });
      await commit(root, `progress: ${batchId} ${decision.final}`, [relative(root, progressPath)]);
      // SPEC 12.1 (v03-b01-fix): exception-path commits are not pushed at
      // this point.  The next startup's verdict.push_failed catch-up handles
      // the normal-path failure; exception-path commits stay local until a
      // successful run pushes the branch forward.
    } catch {
      // Best effort: if progress commit fails, continue cleanup.
    }

    // 4. Delete heartbeat.
    removeHeartbeat(root);

    return { final: 'BLOCK', exitCode: EXIT_CODES.ERROR, escalation: `exception: ${errorMsg}` };
  } finally {
    process.removeListener('unhandledRejection', onUnhandledRejection);
  }
}

/**
 * Keeps the first `max` user-perceived characters (grapheme clusters), so CJK
 * text, emoji and combining sequences are never cut in half.
 */
export function truncate(text: string, max: number): string {
  const graphemes = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (s) => s.segment,
  );
  if (graphemes.length <= max) return text;
  return `${graphemes.slice(0, max).join('')}…[truncated ${String(graphemes.length - max)} chars]`;
}

/** Narrows an arbitrary claim or measurement to a JSON value for the journal. */
function toJson(value: unknown): Event[string] {
  return JSON.parse(JSON.stringify(value ?? null)) as Event[string];
}

/** Reads a batch envelope, or undefined when it does not exist. */
export function readEnvelope(root: string, batchId: string, name: string): string | undefined {
  try {
    return readFileSync(join(dirname(verdictPath(root, batchId)), name), 'utf8');
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Queue mode: --continue (SPEC 12.2)
// ---------------------------------------------------------------------------

export interface QueueContext {
  root: string;
  runner: AgentRunner;
  fetch: FetchLike;
  remote: string;
  now: () => Date;
  err?: (text: string) => void;
  /** Maximum batches to run; undefined = no limit (SPEC 12.2 --max). */
  max?: number;
  /** Test hook: override for worker wall-clock signal. */
  workerSignal?: AbortSignal;
  clock?: Clock;
  ladderDelay?: (ms: number) => Promise<void>;
  livenessIntervalMs?: number;
  livenessNow?: () => number;
  livenessSetTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  livenessFingerprint?: (root: string) => Promise<string>;
}

export interface QueueOutcome {
  /** Combined exit code: 0 for exhausted/limit, 20 for blocked/fix_max/escalated, 30 for paused. */
  exitCode: number;
  /** Why the queue stopped. */
  reason: string;
  /** Batches that ran (in order), each with its run_id and verdict (SPEC 12.2 v03-b04-fix). */
  batches: { batch_id: string; run_id: string; verdict: string }[];
  /** SPEC 12.3: how many times `queue.paused` fired in this --continue session. */
  pausedCount?: number;
}

/**
 * SPEC 12.2: selects the first `pending` batch whose dependencies are all
 * `passed`. Returns the selected batch, plus any that were skipped because
 * their dependencies are not met.
 */
function selectNextBatch(batches: readonly Batch[]): {
  selected: Batch | undefined;
  skipped: { id: string; missing: string[] }[];
} {
  const statusMap = new Map(batches.map((b) => [b.id, b.status]));
  const skipped: { id: string; missing: string[] }[] = [];
  // Batches are already sorted by priority from parseBacklog.
  for (const batch of batches) {
    if (batch.status !== 'pending') continue;
    const missing = batch.depends_on.filter((dep) => statusMap.get(dep) !== 'passed');
    if (missing.length > 0) {
      skipped.push({ id: batch.id, missing });
      continue;
    }
    return { selected: batch, skipped };
  }
  return { selected: undefined, skipped };
}

/** Generates a run_id from a Date, with the given prefix (r- for batch, q- for queue). */
function makeRunId(prefix: string, date: Date): string {
  // Strip non-digits from ISO string: 20261019120000... then take YYYYMMDDHHMMSS (14 chars).
  const digits = date.toISOString().replace(/[^0-9]/g, '');
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers, no-restricted-syntax -- substring bound for YYYYMMDDHHMMSS format, not a threshold
  return RunIdSchema.parse(`${prefix}${digits.slice(0, 14)}`);
}

/**
 * SPEC 12.2: updates docs/backlog.md on disk and records a batch.status event.
 * Used by runQueue for the fix_max escalation path (runBatch handles PASS/BLOCK).
 */
function updateBacklogToDisk(
  root: string,
  batchId: string,
  status: BatchStatus,
  rec: Recorder,
): void {
  const backlogFile = join(root, BACKLOG_RELATIVE_PATH);
  try {
    const text = readFileSync(backlogFile, 'utf8');
    const result = setBatchStatus(text, batchId, status);
    if (result.changed) {
      writeFileSync(backlogFile, result.text);
      rec.record('batch.status', { batch_id: batchId, from: result.from ?? '', to: status });
    } else {
      rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
    }
  } catch {
    rec.record('batch.status', { batch_id: batchId, to: 'unchanged' });
  }
}

/**
 * SPEC 12.3: checks whether any run of `batchId` recorded a
 * `verdict.downgraded` event with rule=9 (evidence missing). Used by
 * the consecutive rule 9 stop condition: two batches in a row with rule 9
 * downgrades pauses the queue.
 */
function hasBatchRule9Downgrade(root: string, batchId: string): boolean {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return false;
  const journal = createJournal(root);
  for (const dir of readdirSync(runsDir).sort()) {
    if (!RunIdSchema.safeParse(dir).success || !existsSync(join(runsDir, dir, EVENTS_FILE_NAME)))
      continue;
    for (const event of journal.replay(dir)) {
      if (
        event.event === 'verdict.downgraded' &&
        event.batch_id === batchId &&
        event.rule === RULE_EVIDENCE_MISSING
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * SPEC 12.3: checks whether `batch.retried` (rule 1) has already been
 * recorded for a given batch across all journal runs. Returns true if the
 * batch has been retried at least once.
 */
function hasBatchRetried(root: string, batchId: string): boolean {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return false;
  const journal = createJournal(root);
  for (const dir of readdirSync(runsDir).sort()) {
    if (!RunIdSchema.safeParse(dir).success || !existsSync(join(runsDir, dir, EVENTS_FILE_NAME)))
      continue;
    for (const event of journal.replay(dir)) {
      if (event.event === 'batch.retried' && event.batch_id === batchId) {
        return true;
      }
    }
  }
  return false;
}

/** Runs batches in --continue mode (SPEC 12.2). */
export async function runQueue(ctx: QueueContext): Promise<QueueOutcome> {
  const { root } = ctx;
  const config = loadConfig(root);
  const batchesRun: { batch_id: string; run_id: string; verdict: string }[] = [];

  // Queue-level journal for batch.skipped / batch.status / queue.finished events.
  // Uses a dedicated run_id distinct from individual batch runs.
  const queueRunId = makeRunId('q-', ctx.now());
  const queueJournal = createJournal(root);
  const queueRec = new Recorder(queueJournal, queueRunId, undefined, ctx.now);

  // Ensure the queue run directory exists.
  mkdirSync(join(root, RUNS_RELATIVE_DIR, queueRunId), { recursive: true });

  let currentBatchId: string | undefined;

  // SPEC 12.3: track queue.paused count for this --continue session.
  let pausedCount = 0;

  // SPEC 12.3: track whether the previous batch had a verdict.downgraded rule=9,
  // for the "consecutive two batches" stop condition.
  let prevBatchRule9Downgraded = false;

  // SPEC 12.2 (v03-b04-fix): in-memory FIX counter per batch, scoped to this
  // --continue session. Does NOT scan historical runs (countBatchFinished removed).
  const fixCounts = new Map<string, number>();

  // SPEC 12.2 (v03-b04-fix): tracks what the next batch run's "why" should be
  // for the queue.batch_started event.
  let nextWhy = 'new';

  // Loop until queue is exhausted, blocked, or --max reached.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional infinite loop; exits via return
  while (true) {
    // Reload backlog each iteration to see status changes from previous batch.
    const batches = loadBacklog(root);
    const { selected, skipped } = selectNextBatch(batches);
    for (const s of skipped) {
      queueRec.record('batch.skipped', { batch_id: s.id, missing: s.missing });
    }

    if (selected === undefined) {
      // Nothing eligible: exhausted or all remaining are blocked.
      const reason = skipped.length > 0 ? 'exhausted' : 'exhausted';
      queueRec.record('queue.finished', { reason, batches: batchesRun, paused_count: pausedCount });
      return { exitCode: EXIT_CODES.PASS, reason, batches: batchesRun, pausedCount };
    }

    currentBatchId = selected.id;
    const runId = makeRunId('r-', ctx.now());

    // SPEC 12.2 (v03-b04-fix): record queue.batch_started before launching.
    const history = batchHistory(root, currentBatchId);
    queueRec.record('queue.batch_started', {
      run_id: runId,
      batch_id: currentBatchId,
      attempt: history.attempt,
      why: nextWhy,
    });
    nextWhy = 'new'; // reset for next iteration

    const outcome = await runBatch({
      root,
      batchId: currentBatchId,
      runId,
      runner: ctx.runner,
      fetch: ctx.fetch,
      remote: ctx.remote,
      now: ctx.now,
      err: ctx.err,
      updateBacklogStatus: true,
      ...(ctx.workerSignal === undefined ? {} : { workerSignal: ctx.workerSignal }),
      ...(ctx.clock === undefined ? {} : { clock: ctx.clock }),
      ...(ctx.ladderDelay === undefined ? {} : { ladderDelay: ctx.ladderDelay }),
      ...(ctx.livenessIntervalMs === undefined
        ? {}
        : { livenessIntervalMs: ctx.livenessIntervalMs }),
      ...(ctx.livenessNow === undefined ? {} : { livenessNow: ctx.livenessNow }),
      ...(ctx.livenessSetTimer === undefined ? {} : { livenessSetTimer: ctx.livenessSetTimer }),
      ...(ctx.livenessFingerprint === undefined
        ? {}
        : { livenessFingerprint: ctx.livenessFingerprint }),
    });
    batchesRun.push({ batch_id: currentBatchId, run_id: runId, verdict: outcome.final });

    if (outcome.final === 'PASS') {
      // SPEC 12.3: gate decision — check seven conditions before continuing.
      const gateInput: GateInput = {
        downgraded: outcome.decision?.downgraded === true,
        claimMismatches: outcome.decision?.mismatches.length ?? 0,
        ciConclusion: outcome.evidence?.ci_conclusion ?? 'unknown',
        ciBranchMatched: outcome.evidence?.ci_branch_matched ?? null,
        depsDiffCount: outcome.evidence?.deps_diff.length ?? 0,
        specDiffLines: outcome.evidence?.spec_diff_lines ?? 0,
        protectedDiffLines: outcome.evidence?.spec_diff_lines ?? 0,
        gapsCount: outcome.gaps?.length ?? 0,
      };
      const gate = gateDecision(gateInput);

      if (!gate.pass) {
        // SPEC 12.3: stop but PASS stands. Backlog status is already 'passed'.
        pausedCount++;
        queueRec.record('queue.paused', { batch_id: currentBatchId, reasons: gate.reasons });
        queueRec.record('queue.finished', {
          reason: 'paused',
          batches: batchesRun,
          paused_count: pausedCount,
        });
        return {
          exitCode: EXIT_CODES.PAUSED,
          reason: 'paused',
          batches: batchesRun,
          pausedCount,
        };
      }

      // SPEC 12.3: rule 9 consecutive check. Scan the journal for verdict.downgraded
      // rule=9 events for this batch (may have occurred in a prior FIX attempt, not
      // necessarily the current PASS run). If both this batch and the previous batch
      // had rule 9, pause the queue.
      const thisBatchHadRule9 = hasBatchRule9Downgrade(root, currentBatchId);
      if (thisBatchHadRule9 && prevBatchRule9Downgraded) {
        pausedCount++;
        queueRec.record('queue.paused', {
          batch_id: currentBatchId,
          reasons: ['rule9_twice'],
        });
        queueRec.record('queue.finished', {
          reason: 'paused',
          batches: batchesRun,
          paused_count: pausedCount,
        });
        return {
          exitCode: EXIT_CODES.PAUSED,
          reason: 'paused',
          batches: batchesRun,
          pausedCount,
        };
      }

      prevBatchRule9Downgraded = thisBatchHadRule9;

      // SPEC 12.2: PASS → take next. Status already updated inside runBatch.
      if (ctx.max !== undefined && batchesRun.length >= ctx.max) {
        queueRec.record('queue.finished', {
          reason: 'limit',
          batches: batchesRun,
          paused_count: pausedCount,
        });
        return { exitCode: EXIT_CODES.PASS, reason: 'limit', batches: batchesRun, pausedCount };
      }
      continue;
    }

    if (outcome.final === 'BLOCK') {
      // SPEC 12.3: rule 1 auto-retry — if BLOCK is due to rule 1 (unparseable verdict)
      // and this batch has not been retried for rule 1 before, retry once.
      if (outcome.decision?.rule === RULE_UNPARSEABLE) {
        if (!hasBatchRetried(root, currentBatchId)) {
          queueRec.record('batch.retried', { batch_id: currentBatchId, rule: RULE_UNPARSEABLE });
          // Don't count against batchesRun for --max (it's the same batch).
          // Remove it from batchesRun so the retry is transparent.
          batchesRun.pop();
          // SPEC 12.3: runBatch set the backlog status to 'blocked' for the BLOCK
          // verdict, but rule 1 retry means the batch should be retried. Reset the
          // status to 'pending' so selectNextBatch picks it up again.
          updateBacklogToDisk(root, currentBatchId, 'pending', queueRec);
          try {
            await commit(root, `progress: ${currentBatchId} rule1_retry`, [BACKLOG_RELATIVE_PATH]);
          } catch {
            // Best effort: the status was written to disk even if commit fails.
          }
          nextWhy = 'rule1_retry';
          continue;
        }
        // Second rule 1 BLOCK: fall through to normal BLOCK handling.
      }

      // BLOCK or escalation: stop.
      // Status already updated to 'blocked' inside runBatch when updateBacklogStatus=true.
      queueRec.record('queue.finished', {
        reason: 'blocked',
        batches: batchesRun,
        paused_count: pausedCount,
      });
      return { exitCode: EXIT_CODES.BLOCK, reason: 'blocked', batches: batchesRun, pausedCount };
    }

    // SPEC 12.2 (v03-b04-fix): FIX → check fix_max using in-memory counter.
    // Only counts FIX verdicts within this --continue session, not all history.
    const currentFixes = (fixCounts.get(currentBatchId) ?? 0) + 1;
    fixCounts.set(currentBatchId, currentFixes);
    if (currentFixes <= config.limits.fix_max) {
      // Rerun the same batch (attempt will increment via batchHistory).
      nextWhy = 'fix_retry';
      continue;
    }
    // Exceeded fix_max: escalate → update status to blocked and stop.
    updateBacklogToDisk(root, currentBatchId, 'blocked', queueRec);
    try {
      await commit(root, `progress: ${currentBatchId} fix_max`, [BACKLOG_RELATIVE_PATH]);
    } catch {
      // Best effort: the status was written to disk even if commit fails.
    }
    queueRec.record('escalated', { reason: 'fix_max', batch_id: currentBatchId });
    queueRec.record('queue.finished', {
      reason: 'fix_max',
      batches: batchesRun,
      paused_count: pausedCount,
    });
    return { exitCode: EXIT_CODES.BLOCK, reason: 'fix_max', batches: batchesRun, pausedCount };
  }
}
