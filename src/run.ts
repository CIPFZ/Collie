// R2's single-batch loop (SPEC 6): task -> worker -> report -> reviewer in a
// head_sha worktree -> verdict -> own evidence -> arbiter -> progress.
// Deterministic: no LLM decides anything here (ROLES 2 R2).
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { arbitrate, type ArbiterDecision } from './arbiter.js';
import { loadBacklog } from './backlog.js';
import type { Clock, FetchLike } from './ci.js';
import { loadConfig } from './config.js';
import { collectEvidence } from './evidence.js';
import { addWorktree, commit, isAncestor, removeWorktree, revParse } from './git.js';
import { createJournal, type Journal } from './journal.js';
import { writeProgress } from './progress.js';
import { readVerdict, runReviewer, verdictPath } from './roles/reviewer.js';
import { buildTask, readReport, runWorker, taskPath, writeTask } from './roles/worker.js';
import { CLAUDE_SDK_PACKAGE } from './runner/claude.js';
import type { AgentRunner } from './runner/index.js';
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
  /** Override for tests; defaults to AbortSignal.timeout(limits.wallclock_secs). */
  workerSignal?: AbortSignal;
  /** Time source for the CI wait; tests pass a fake one. */
  clock?: Clock;
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

/** Runs one batch end to end. Never throws for agent misbehaviour; only for Collie's own failures. */
export async function runBatch(ctx: RunContext): Promise<RunOutcome> {
  const { root, batchId, runId } = ctx;
  const config = loadConfig(root);
  const batch = findBatch(root, batchId);
  const rec = new Recorder(createJournal(root), runId, batchId, ctx.now);
  rec.record('run.started');

  const finish = (final: VerdictValue, extra: Partial<RunOutcome> = {}): RunOutcome => {
    rec.record('run.finished', { verdict: final, exit_code: EXIT_CODES[final] });
    return { final, exitCode: EXIT_CODES[final], ...extra };
  };
  const escalate = (reason: string): RunOutcome => {
    rec.record('escalated', { reason });
    return finish('BLOCK', { escalation: reason });
  };

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
  const signal =
    ctx.workerSignal ?? AbortSignal.timeout(config.limits.wallclock_secs * MS_PER_SECOND);
  try {
    const result = await runWorker(ctx.runner, config, batch, root, { signal });
    rec.record('worker.finished', { exit_code: result.exitCode });
  } catch (error) {
    // v0.1: a timeout is recorded as a crash; the signal ladder is v0.2 (SPEC 3.3).
    rec.record('worker.crashed', { error: message(error), timed_out: signal.aborted });
    return escalate(`worker crashed: ${message(error)}`);
  }

  let report: Report;
  try {
    report = readReport(root, batchId);
  } catch (error) {
    return escalate(`no valid report: ${message(error)}`);
  }
  // head_sha is itself a claim: it must be a commit built on top of the task commit.
  const headOk = await isAncestor(root, taskSha, report.head_sha).catch(() => false);
  if (!headOk)
    return escalate(
      `report head_sha ${report.head_sha} does not descend from the task commit ${taskSha}`,
    );

  // Worker output is taskSha..head_sha: the task commit is R2's, not the worker's (SPEC 3.3).
  const outcome = await withHeadWorktree(root, batchId, report.head_sha, async (tree) => {
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

  // The arbiter judges claims against R2's measurements; the reviewer contributes its verdict
  // value and its own mismatches, and its evidence stays on record in verdict.md.
  const decision = arbitrate({
    claims: report.claims,
    verdict: verdict.ok
      ? { ok: true, value: { ...verdict.value, evidence: collected.evidence } }
      : verdict,
    approvedDeps: APPROVED_DEPENDENCIES,
    testCommand: collected.testCommand ?? 'npm test',
  });
  for (const m of decision.mismatches) {
    rec.record('claim.mismatch', {
      rule: m.rule,
      field: m.field,
      claimed: toJson(m.claimed),
      actual: toJson(m.actual),
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
  });
  // R2 commits its envelopes only after the worker has exited (CONSTRAINTS 铁律 19).
  const envelopes = [relative(root, progressPath)];
  if (existsSync(verdictPath(root, batchId)))
    envelopes.push(relative(root, verdictPath(root, batchId)));
  await commit(root, `progress: ${batchId} ${decision.final}`, envelopes);
  return finish(decision.final, { decision });
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
