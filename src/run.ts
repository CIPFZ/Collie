// R2's single-batch loop (SPEC 6): task -> worker -> report -> reviewer in a
// head_sha worktree -> verdict -> own evidence -> arbiter -> progress.
// Deterministic: no LLM decides anything here (ROLES 2 R2).
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { arbitrate, type ArbiterDecision } from './arbiter.js';
import { loadBacklog } from './backlog.js';
import type { Clock, FetchLike } from './ci.js';
import { loadConfig } from './config.js';
import { collectEvidence, type Evidence } from './evidence.js';
import { addWorktree, commit, git, isAncestor, removeWorktree, revParse, status } from './git.js';
import {
  checkHeartbeat,
  removeHeartbeat,
  touchHeartbeat,
  updateHeartbeat,
  writeHeartbeat,
} from './heartbeat.js';
import { createJournal, RUNS_RELATIVE_DIR, type Journal } from './journal.js';
import { LivenessMonitor, runLadder, type LadderReason } from './ladder.js';
import { writeProgress } from './progress.js';
import { readVerdict, runReviewer, verdictPath } from './roles/reviewer.js';
import { buildTask, readReport, runWorker, taskPath, writeTask } from './roles/worker.js';
import { CLAUDE_SDK_PACKAGE } from './runner/claude.js';
import type { AgentRunner, RunHandle } from './runner/index.js';
import type {
  Acceptance,
  Batch,
  Event,
  EventType,
  Report,
  Verdict,
  VerdictValue,
} from './schema/index.js';

/** SPEC 5 exit codes of `collie run`. */
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 5 exit codes */
export const EXIT_CODES: Readonly<Record<VerdictValue | 'ERROR', number>> = {
  PASS: 0,
  FIX: 10,
  BLOCK: 20,
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
}

export interface RunOutcome {
  final: VerdictValue;
  exitCode: number;
  decision?: ArbiterDecision;
  /** Why the run stopped early, for escalations. */
  escalation?: string;
}

class Recorder {
  constructor(
    private readonly journal: Journal,
    private readonly runId: string,
    private readonly batchId: string,
    private readonly now: () => Date,
  ) {}

  record(event: EventType, fields: Record<string, Event[string]> = {}): void {
    this.journal.append({
      ts: this.now().toISOString(),
      run_id: this.runId,
      batch_id: this.batchId,
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

/** Appends one raw event line to .collie/runs/<run_id>/stream.ndjson (SPEC 11.3). */
function appendStream(root: string, runId: string, event: unknown): void {
  const dir = join(root, RUNS_RELATIVE_DIR, runId);
  mkdirSync(dir, { recursive: true });
  // Raw dump: JSON.stringify never emits bare newlines, so each line is one event.
  appendFileSync(join(dir, STREAM_FILE_NAME), JSON.stringify(event) + '\n');
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

/** Runs one batch end to end. Never throws for agent misbehaviour; only for Collie's own failures. */
export async function runBatch(ctx: RunContext): Promise<RunOutcome> {
  const { root, batchId, runId } = ctx;
  const config = loadConfig(root);
  const batch = findBatch(root, batchId);
  const journal = createJournal(root);
  const rec = new Recorder(journal, runId, batchId, ctx.now);

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
  const escalate = async (reason: string): Promise<RunOutcome> => {
    rec.record('escalated', { reason });
    // SPEC 11.7: any exit writes a progress record — even escalations that never
    // reach the arbiter. Build synthetic decision + evidence for the commit.
    const decision = escalationDecision(reason);
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
    // E2: issue the envelope. base_sha is the last commit before the task commit (SPEC 3.3).
    const baseSha = await revParse(root, 'HEAD');
    rec.record('batch.selected', { base_sha: baseSha });
    const task = buildTask(batch, {
      run_id: runId,
      base_sha: baseSha,
      created_at: ctx.now().toISOString(),
      attempt: 1,
    });
    writeTask(root, batch, task);
    const relTask = taskPath('', batchId);
    const taskSha = await commit(root, `docs: issue ${batchId} task envelope`, [relTask]);
    rec.record('batch.task_written', { path: relTask, commit: taskSha });

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
    const graceSecs = config.limits.grace_secs;
    const ladderDelay = ctx.ladderDelay ?? realDelay;

    function startLadder(reason: LadderReason): void {
      if (ladderRunning || workerExited || workerHandle === undefined) return;
      ladderRunning = true;
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
    });

    // SPEC 11.3: stream + heartbeat callbacks.
    const onEvent = (event: unknown): void => {
      appendStream(root, runId, event);
      touchHeartbeat(root, ctx.now().toISOString());
      monitor.onEvent();
    };
    const onStarted = (handle: RunHandle): void => {
      workerHandle = handle;
      // SPEC 11.3: add worker_pid to the already-written heartbeat when the runner provides one.
      if (handle.pid !== undefined) {
        updateHeartbeat(root, { worker_pid: handle.pid, updated_at: ctx.now().toISOString() });
      }
      monitor.start();
    };

    const cleanupTimers = (): void => {
      workerExited = true;
      workerExitResolve?.();
      monitor.stop();
      if (wallclockTimer !== undefined) clearTimeout(wallclockTimer);
    };

    try {
      const result = await runWorker(ctx.runner, config, batch, root, {
        ...(ctx.workerSignal === undefined ? {} : { signal: ctx.workerSignal }),
        onEvent,
        onStarted,
      });
      cleanupTimers();
      // SPEC 11.7: track worker exit info for run.finished and progress.
      workerExitCode = result.exitCode;
      workerStopReason = result.stopReason;
      rec.record('worker.finished', {
        exit_code: result.exitCode,
        // SPEC 3.6: without it a zero-output exit cannot be explained (v01-b05-smoke).
        ...(result.finalText === undefined
          ? {}
          : { final_text: truncate(result.finalText, FINAL_TEXT_MAX) }),
        ...(result.stopReason === undefined ? {} : { stop_reason: result.stopReason }),
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
      return await escalate(`worker crashed: ${message(error)}`);
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
      return await escalate(`no valid report: ${message(error)}`);
    }
    // head_sha is itself a claim: it must be a commit built on top of the task commit.
    const headOk = await isAncestor(root, taskSha, report.head_sha).catch(() => false);
    if (!headOk)
      return await escalate(
        `report head_sha ${report.head_sha} does not descend from the task commit ${taskSha}`,
      );

    // Worker output is taskSha..head_sha: the task commit is R2's, not the worker's (SPEC 3.3).
    const outcome = await withHeadWorktree(root, batchId, report.head_sha, async (tree) => {
      // SPEC 11.3: heartbeat transitions to reviewer phase.
      updateHeartbeat(root, { phase: 'reviewer', updated_at: ctx.now().toISOString() });

      // E5: the reviewer works in the head_sha worktree, where report.md does not exist (SPEC 3.5).
      let finalText: string | undefined;
      rec.record('reviewer.started', { head_sha: report.head_sha });
      try {
        const reviewer = await runReviewer(
          ctx.runner,
          config,
          {
            batch_id: batchId,
            base_sha: taskSha,
            head_sha: report.head_sha,
            items: batch.items,
            acceptance: batch.acceptance,
            spec_paths: ['SPEC.md', 'CONSTRAINTS.md'],
          },
          tree,
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
        baseSha: taskSha,
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
    await commit(root, `progress: ${batchId} ${decision.final}`, envelopes);
    return finish(decision.final, { decision });
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
