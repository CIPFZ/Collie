// Projection module for the four read-only commands (SPEC 13.2).
// Two layers:
//   1. loadRuns(root) — scans .collie/runs/*/events.ndjson and replays each.
//   2. projectRuns / projectBatches — pure functions, no I/O, no clock.
// This module MUST NOT import from run.ts, runner/, or roles/ (SPEC 13.2).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createJournal, EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from './journal.js';
import { RunIdSchema, type Event } from './schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single run's replay result: either valid events or an unreadable marker. */
export type RunData =
  | { runId: string; status: 'ok'; events: Event[] }
  | { runId: string; status: 'unreadable'; reason: string };

/** Projected run record for display. */
export interface RunProjection {
  runId: string;
  batchId: string | null;
  started: string | null;
  finished: string | null;
  verdict: string | null;
  phase: string | null;
  /** SPEC 13.1: may be null in old journals. */
  numTurns: number | null;
  costUsd: number | null;
  durationMs: number | null;
  rule: number | null;
  exitCode: number | null;
  /** Evidence summary from evidence.collected (SPEC 13.1). */
  testsPassed: number | null;
  testsFailed: number | null;
}

/** Projected batch record for display. */
export interface BatchProjection {
  batchId: string;
  title: string;
  status: string;
  dependsOn: string[];
  lastVerdict: string | null;
  lastRunId: string | null;
  attempts: number;
}

/** Queue run summary. */
export interface QueueProjection {
  queueRunId: string;
  reason: string | null;
  batches: { batch_id: string; run_id: string; verdict: string }[];
  pausedCount: number | null;
  started: string | null;
  finished: string | null;
}

/** The status view output (SPEC 13.2). */
export interface StatusView {
  current: CurrentStatus;
  queue: QueueStatus;
  lastQueue: QueueProjection | null;
}

export interface CurrentStatus {
  state: 'running' | 'idle';
  runId: string | null;
  batchId: string | null;
  attempt: number | null;
  phase: string | null;
  /** Elapsed ms since run.started, when running. */
  elapsedMs: number | null;
  /** Ms since last event. */
  sinceLast: number | null;
  /** When idle: most recent finished run and its verdict. */
  lastRunId: string | null;
  lastVerdict: string | null;
}

export interface QueueStatus {
  pendingCount: number;
  nextExecutable: string | null;
  blocked: string[];
}

// ---------------------------------------------------------------------------
// Layer 1: loadRuns
// ---------------------------------------------------------------------------

/**
 * SPEC 13.2: Scans .collie/runs/ for all run directories, replays each.
 * A run whose journal cannot be parsed is recorded as `unreadable` with a reason;
 * it does not prevent other runs from loading.
 */
export function loadRuns(root: string): RunData[] {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return [];

  const journal = createJournal(root);
  const entries = readdirSync(runsDir)
    .filter(
      (name) =>
        RunIdSchema.safeParse(name).success && existsSync(join(runsDir, name, EVENTS_FILE_NAME)),
    )
    .sort();

  return entries.map((runId): RunData => {
    try {
      const events = journal.replay(runId);
      return { runId, status: 'ok', events };
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      return { runId, status: 'unreadable', reason };
    }
  });
}

// ---------------------------------------------------------------------------
// Layer 2: Pure projection functions
// ---------------------------------------------------------------------------

function findEvent(events: readonly Event[], type: string): Event | undefined {
  return events.find((e) => e.event === type);
}

function findLastEvent(events: readonly Event[], type: string): Event | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]?.event === type) return events[i];
  }
  return undefined;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

/**
 * Determines the current phase of a running run from its events.
 * Order: worker.started but no worker.finished → worker;
 * reviewer.started but no reviewer.finished → reviewer;
 * evidence.collected → arbiter; otherwise unknown.
 */
function inferPhase(events: readonly Event[]): string | null {
  const hasWorkerStarted = events.some((e) => e.event === 'worker.started');
  const hasWorkerFinished = events.some(
    (e) => e.event === 'worker.finished' || e.event === 'worker.crashed',
  );
  const hasReviewerStarted = events.some((e) => e.event === 'reviewer.started');
  const hasReviewerFinished = events.some((e) => e.event === 'reviewer.finished');
  const hasEvidenceCollected = events.some((e) => e.event === 'evidence.collected');

  if (hasEvidenceCollected) return 'arbiter';
  if (hasReviewerStarted && !hasReviewerFinished) return 'reviewer';
  if (hasWorkerStarted && !hasWorkerFinished) return 'worker';
  return null;
}

/**
 * SPEC 13.13: computes the attempt number for a batch run from all loaded runs.
 * attempt = 1 + count of same-batch runs that started before this one
 * and whose final verdict is NOT PASS (no run.finished also counts as non-PASS).
 * A batch run = a non-queue journal with run.started (SPEC 13.10).
 */
export function computeAttempt(
  allRunData: readonly RunData[],
  targetRunId: string,
  targetBatchId: string,
): number {
  // Collect batch runs for this batch, excluding queue runs.
  const batchRuns: { runId: string; startedTs: string; verdict: string | null }[] = [];
  for (const rd of allRunData) {
    if (rd.status !== 'ok' || rd.runId.startsWith('q-')) continue;
    const started = findEvent(rd.events, 'run.started');
    if (started === undefined) continue;
    const bid = rd.events.find((e) => e.batch_id !== undefined)?.batch_id;
    if (bid !== targetBatchId) continue;
    const finished = findEvent(rd.events, 'run.finished');
    const verdict = finished !== undefined ? asString(finished.verdict) : null;
    batchRuns.push({ runId: rd.runId, startedTs: started.ts, verdict });
  }
  // Sort by start time.
  batchRuns.sort((a, b) => (a.startedTs < b.startedTs ? -1 : a.startedTs > b.startedTs ? 1 : 0));

  const targetIndex = batchRuns.findIndex((r) => r.runId === targetRunId);
  if (targetIndex < 0) return 1;

  let priorNonPass = 0;
  for (let i = 0; i < targetIndex; i++) {
    if (batchRuns[i]?.verdict !== 'PASS') priorNonPass++;
  }
  return 1 + priorNonPass;
}

/** Projects a single run's events into a RunProjection. */
export function projectRun(events: readonly Event[]): RunProjection {
  const started = findEvent(events, 'run.started');
  const finished = findEvent(events, 'run.finished');
  const workerFinished = findEvent(events, 'worker.finished');

  // Batch id from any event that carries it.
  const batchId = events.find((e) => e.batch_id !== undefined)?.batch_id ?? null;

  // Verdict from run.finished.
  const verdict = finished !== undefined ? asString(finished.verdict) : null;

  // SPEC 13.1 optional fields from worker.finished.
  const numTurns = workerFinished !== undefined ? asNumber(workerFinished.num_turns) : null;
  const costUsd = workerFinished !== undefined ? asNumber(workerFinished.cost_usd) : null;

  // SPEC 13.13: run duration = run.finished.ts − run.started.ts.
  let durationMs: number | null = null;
  if (started !== undefined && finished !== undefined) {
    const startMs = new Date(started.ts).getTime();
    const endMs = new Date(finished.ts).getTime();
    durationMs = endMs - startMs;
  }

  // Rule and exit_code from run.finished.
  const rule = finished !== undefined ? asNumber(finished.rule) : null;
  const exitCode = finished !== undefined ? asNumber(finished.exit_code) : null;

  // Evidence.collected fields (SPEC 13.1).
  const evidenceCollected = findEvent(events, 'evidence.collected');
  const testsPassed =
    evidenceCollected !== undefined ? asNumber(evidenceCollected.tests_passed) : null;
  const testsFailed =
    evidenceCollected !== undefined ? asNumber(evidenceCollected.tests_failed) : null;

  const phase = finished !== undefined ? null : inferPhase(events);

  return {
    runId: started?.run_id ?? events[0]?.run_id ?? '',
    batchId,
    started: started?.ts ?? null,
    finished: finished?.ts ?? null,
    verdict,
    phase,
    numTurns,
    costUsd,
    durationMs,
    rule,
    exitCode,
    testsPassed,
    testsFailed,
  };
}

/** Projects all readable runs into RunProjection[]. */
export function projectRuns(runDataList: readonly RunData[]): RunProjection[] {
  return runDataList
    .filter((r): r is RunData & { status: 'ok' } => r.status === 'ok')
    .filter((r) => !r.runId.startsWith('q-')) // Skip queue runs
    .map((r) => projectRun(r.events));
}

/** Projects batch-level data from runs and the backlog. */
export function projectBatches(
  runDataList: readonly RunData[],
  batches: readonly { id: string; title: string; status: string; depends_on: string[] }[],
): BatchProjection[] {
  // Group runs by batch_id.
  const runsByBatch = new Map<string, RunProjection[]>();
  for (const rd of runDataList) {
    if (rd.status !== 'ok' || rd.runId.startsWith('q-')) continue;
    const proj = projectRun(rd.events);
    if (proj.batchId === null) continue;
    const list = runsByBatch.get(proj.batchId) ?? [];
    list.push(proj);
    runsByBatch.set(proj.batchId, list);
  }

  return batches.map((b) => {
    const runs = runsByBatch.get(b.id) ?? [];
    const lastRun = runs.length > 0 ? runs[runs.length - 1] : undefined;
    return {
      batchId: b.id,
      title: b.title,
      status: b.status,
      dependsOn: [...b.depends_on],
      lastVerdict: lastRun?.verdict ?? null,
      lastRunId: lastRun?.runId ?? null,
      attempts: runs.length,
    };
  });
}

/** Projects a queue run's events. */
export function projectQueueRun(events: readonly Event[]): QueueProjection {
  const started = findEvent(events, 'run.started');
  const finished = findLastEvent(events, 'queue.finished');

  let reason: string | null = null;
  let batches: { batch_id: string; run_id: string; verdict: string }[] = [];
  let pausedCount: number | null = null;
  if (finished !== undefined) {
    reason = asString(finished.reason);
    pausedCount = asNumber(finished.paused_count);
    if (Array.isArray(finished.batches)) {
      batches = (finished.batches as unknown[])
        .filter(
          (b): b is { batch_id: string; run_id: string; verdict: string } =>
            typeof b === 'object' &&
            b !== null &&
            typeof (b as Record<string, unknown>).batch_id === 'string' &&
            typeof (b as Record<string, unknown>).run_id === 'string' &&
            typeof (b as Record<string, unknown>).verdict === 'string',
        )
        .map((b) => ({
          batch_id: b.batch_id,
          run_id: b.run_id,
          verdict: b.verdict,
        }));
    }
  }

  return {
    queueRunId: events[0]?.run_id ?? '',
    reason,
    batches,
    pausedCount,
    started: started?.ts ?? null,
    finished: finished?.ts ?? null,
  };
}

/**
 * SPEC 13.2: builds the status view.
 * `now` is passed in so the function stays pure / testable.
 */
export function buildStatus(
  runDataList: readonly RunData[],
  batches: readonly { id: string; title: string; status: string; depends_on: string[] }[],
  now: Date,
): StatusView {
  // --- Current ---
  const okRuns = runDataList.filter(
    (r): r is RunData & { status: 'ok' } => r.status === 'ok' && !r.runId.startsWith('q-'),
  );

  // The most recent run that has run.started but no run.finished.
  let currentRun: (RunData & { status: 'ok' }) | undefined;
  for (let i = okRuns.length - 1; i >= 0; i--) {
    const rd = okRuns[i];
    if (rd === undefined) continue;
    const hasStarted = rd.events.some((e) => e.event === 'run.started');
    const hasFinished = rd.events.some((e) => e.event === 'run.finished');
    if (hasStarted && !hasFinished) {
      currentRun = rd;
      break;
    }
  }

  let current: CurrentStatus;
  if (currentRun !== undefined) {
    const proj = projectRun(currentRun.events);
    const startedTs = proj.started !== null ? new Date(proj.started).getTime() : null;
    const lastEvent = currentRun.events[currentRun.events.length - 1];
    const lastTs = lastEvent?.ts !== undefined ? new Date(lastEvent.ts).getTime() : null;
    const nowMs = now.getTime();

    // SPEC 13.13: attempt computed from all runs for this batch.
    const attempt =
      proj.batchId !== null ? computeAttempt(runDataList, currentRun.runId, proj.batchId) : null;

    current = {
      state: 'running',
      runId: proj.runId,
      batchId: proj.batchId,
      attempt,
      phase: proj.phase,
      elapsedMs: startedTs !== null ? nowMs - startedTs : null,
      sinceLast: lastTs !== null ? nowMs - lastTs : null,
      lastRunId: null,
      lastVerdict: null,
    };
  } else {
    // Find the most recent finished run.
    let lastFinished: RunProjection | undefined;
    for (let i = okRuns.length - 1; i >= 0; i--) {
      const rd = okRuns[i];
      if (rd === undefined) continue;
      if (rd.events.some((e) => e.event === 'run.finished')) {
        lastFinished = projectRun(rd.events);
        break;
      }
    }
    current = {
      state: 'idle',
      runId: null,
      batchId: null,
      attempt: null,
      phase: null,
      elapsedMs: null,
      sinceLast: null,
      lastRunId: lastFinished?.runId ?? null,
      lastVerdict: lastFinished?.verdict ?? null,
    };
  }

  // --- Queue ---
  const pendingBatches = batches.filter((b) => b.status === 'pending');
  const blockedBatches = batches.filter((b) => b.status === 'blocked');
  const passedIds = new Set(batches.filter((b) => b.status === 'passed').map((b) => b.id));

  // Next executable: first pending with all deps passed.
  let nextExecutable: string | null = null;
  for (const b of pendingBatches) {
    if (b.depends_on.every((dep) => passedIds.has(dep))) {
      nextExecutable = b.id;
      break;
    }
  }

  const queue: QueueStatus = {
    pendingCount: pendingBatches.length,
    nextExecutable,
    blocked: blockedBatches.map((b) => b.id),
  };

  // --- Last queue run ---
  const queueRuns = runDataList.filter(
    (r): r is RunData & { status: 'ok' } => r.status === 'ok' && r.runId.startsWith('q-'),
  );
  let lastQueue: QueueProjection | null = null;
  if (queueRuns.length > 0) {
    const lastQueueRun = queueRuns[queueRuns.length - 1];
    if (lastQueueRun !== undefined) {
      lastQueue = projectQueueRun(lastQueueRun.events);
    }
  }

  return { current, queue, lastQueue };
}

// ---------------------------------------------------------------------------
// Layer 2: Timeline projection (SPEC 13.3)
// ---------------------------------------------------------------------------

/** The kind of each node in the project timeline. */
export type TimelineNodeKind =
  'batch_start' | 'run_end' | 'batch_status' | 'queue_start' | 'queue_paused' | 'queue_end';

/** A single node in the project timeline (SPEC 13.3). */
export interface TimelineNode {
  ts: string;
  kind: TimelineNodeKind;
  batchId: string | null;
  runId: string | null;
  /** Extra detail varies by kind. */
  detail: Record<string, string | number | null>;
}

/** Version summary for --by version (SPEC 13.3). */
export interface VersionSummary {
  version: string;
  firstStart: string | null;
  lastEnd: string | null;
  batchCount: number;
  runCount: number;
  fixCount: number;
  blockCount: number;
  totalCostUsd: number;
  runsWithoutCost: number;
}

/**
 * SPEC 13.3: projects a flat, time-sorted list of timeline nodes from all runs.
 * Node kinds:
 *   - batch_start: first time a batch's run.started is seen
 *   - run_end: each run.finished (verdict, attempt, duration)
 *   - batch_status: batch.status change
 *   - queue_start: queue run run.started
 *   - queue_paused: queue.paused
 *   - queue_end: queue.finished
 */
export function projectTimeline(runDataList: readonly RunData[]): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  const batchFirstSeen = new Set<string>();

  for (const rd of runDataList) {
    if (rd.status !== 'ok') continue;
    const isQueue = rd.runId.startsWith('q-');

    for (const e of rd.events) {
      // Batch first start: the first run.started we see for a given batch_id.
      if (e.event === 'run.started' && !isQueue) {
        const bid = asString(e.batch_id);
        if (bid !== null && !batchFirstSeen.has(bid)) {
          batchFirstSeen.add(bid);
          nodes.push({ ts: e.ts, kind: 'batch_start', batchId: bid, runId: e.run_id, detail: {} });
        }
      }

      // Each run end.
      if (e.event === 'run.finished' && !isQueue) {
        const bid = asString(e.batch_id);
        const verdict = asString(e.verdict);
        // SPEC 13.13: attempt computed from all runs for this batch.
        const attempt = bid !== null ? computeAttempt(runDataList, rd.runId, bid) : null;
        // SPEC 13.13: run duration = run.finished.ts − run.started.ts.
        const runStarted = findEvent(rd.events, 'run.started');
        const durationMs =
          runStarted !== undefined
            ? new Date(e.ts).getTime() - new Date(runStarted.ts).getTime()
            : null;
        // SPEC 13.23: cost = worker + reviewer; only add what's present, both missing = null.
        const wf = rd.events.find((ev) => ev.event === 'worker.finished');
        const rf = rd.events.find((ev) => ev.event === 'reviewer.finished');
        const wCost = wf !== undefined ? asNumber(wf.cost_usd) : null;
        const rCost = rf !== undefined ? asNumber(rf.cost_usd) : null;
        let costUsd: number | null = null;
        if (wCost !== null || rCost !== null) {
          costUsd = (wCost ?? 0) + (rCost ?? 0);
        }
        nodes.push({
          ts: e.ts,
          kind: 'run_end',
          batchId: bid,
          runId: e.run_id,
          detail: { verdict, attempt, durationMs, costUsd },
        });
      }

      // batch.status change (queue events).
      if (e.event === 'batch.status') {
        const bid = asString(e.batch_id);
        const from = asString(e.from);
        const to = asString(e.to);
        nodes.push({
          ts: e.ts,
          kind: 'batch_status',
          batchId: bid,
          runId: e.run_id,
          detail: { from, to },
        });
      }

      // Queue run start.
      if (e.event === 'run.started' && isQueue) {
        nodes.push({
          ts: e.ts,
          kind: 'queue_start',
          batchId: null,
          runId: e.run_id,
          detail: {},
        });
      }

      // Queue paused.
      if (e.event === 'queue.paused') {
        const bid = asString(e.batch_id);
        const reasons = Array.isArray(e.reasons)
          ? (e.reasons as unknown[]).filter((r): r is string => typeof r === 'string').join(', ')
          : null;
        nodes.push({
          ts: e.ts,
          kind: 'queue_paused',
          batchId: bid,
          runId: e.run_id,
          detail: { reasons },
        });
      }

      // Queue finished.
      if (e.event === 'queue.finished') {
        const reason = asString(e.reason);
        nodes.push({
          ts: e.ts,
          kind: 'queue_end',
          batchId: null,
          runId: e.run_id,
          detail: { reason },
        });
      }
    }
  }

  // Sort ascending by timestamp.
  nodes.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return nodes;
}

/**
 * Extracts the version prefix from a batch_id, e.g. "v03-b04" → "v03".
 * Returns null if the format doesn't match.
 */
function versionPrefix(batchId: string): string | null {
  const match = /^(v\d+)-/.exec(batchId);
  return match?.[1] ?? null;
}

/**
 * SPEC 13.3 --by version: groups timeline nodes by version prefix and summarises.
 * Runs without cost data are not counted towards totalCostUsd and are noted via runsWithoutCost.
 */
export function projectVersionSummary(nodes: readonly TimelineNode[]): VersionSummary[] {
  const map = new Map<
    string,
    {
      firstStart: string | null;
      lastEnd: string | null;
      batches: Set<string>;
      runCount: number;
      fixCount: number;
      blockCount: number;
      totalCostUsd: number;
      runsWithoutCost: number;
    }
  >();

  function getOrCreate(ver: string) {
    let entry = map.get(ver);
    if (entry === undefined) {
      entry = {
        firstStart: null,
        lastEnd: null,
        batches: new Set<string>(),
        runCount: 0,
        fixCount: 0,
        blockCount: 0,
        totalCostUsd: 0,
        runsWithoutCost: 0,
      };
      map.set(ver, entry);
    }
    return entry;
  }

  for (const node of nodes) {
    const bid = node.batchId;
    if (bid === null) continue;
    const ver = versionPrefix(bid);
    if (ver === null) continue;
    const entry = getOrCreate(ver);
    entry.batches.add(bid);

    if (node.kind === 'batch_start') {
      if (entry.firstStart === null || node.ts < entry.firstStart) {
        entry.firstStart = node.ts;
      }
    }

    if (node.kind === 'run_end') {
      entry.runCount++;
      if (entry.lastEnd === null || node.ts > entry.lastEnd) {
        entry.lastEnd = node.ts;
      }
      const verdict = node.detail.verdict;
      if (verdict === 'FIX') entry.fixCount++;
      if (verdict === 'BLOCK') entry.blockCount++;
      const cost = node.detail.costUsd;
      if (typeof cost === 'number') {
        entry.totalCostUsd += cost;
      } else {
        entry.runsWithoutCost++;
      }
    }
  }

  // Sort by version prefix.
  const versions = [...map.keys()].sort();
  return versions.map((ver) => {
    const e = map.get(ver)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- guaranteed by loop
    return {
      version: ver,
      firstStart: e.firstStart,
      lastEnd: e.lastEnd,
      batchCount: e.batches.size,
      runCount: e.runCount,
      fixCount: e.fixCount,
      blockCount: e.blockCount,
      totalCostUsd: e.totalCostUsd,
      runsWithoutCost: e.runsWithoutCost,
    };
  });
}

// ---------------------------------------------------------------------------
// Text formatting helpers (shared)
// ---------------------------------------------------------------------------

/* eslint-disable-next-line no-restricted-syntax -- unit conversion, not a threshold */
const MS_PER_SECOND = 1000;

// ---------------------------------------------------------------------------
// Text formatting for `collie status`
// ---------------------------------------------------------------------------

function dash(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return String(v);
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const totalSecs = Math.floor(ms / MS_PER_SECOND);
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- time conversion
  const mins = Math.floor(totalSecs / 60);
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- time conversion
  const secs = totalSecs % 60;
  return mins > 0 ? `${String(mins)}m${String(secs)}s` : `${String(secs)}s`;
}

/**
 * Formats only the `status` current section (SPEC 13.2). `collie watch` prints
 * this frame on phase changes (SPEC 13.5).
 */
export function formatCurrentSection(current: CurrentStatus): string {
  const lines: string[] = ['== current =='];
  if (current.state === 'running') {
    lines.push(
      `running: ${dash(current.batchId)} (${dash(current.runId)}) attempt ${dash(current.attempt)} phase ${dash(current.phase)}`,
    );
    lines.push(
      `  elapsed ${formatDuration(current.elapsedMs)} since-last ${formatDuration(current.sinceLast)}`,
    );
  } else if (current.lastRunId !== null) {
    lines.push(`idle (last: ${current.lastRunId} ${dash(current.lastVerdict)})`);
  } else {
    lines.push('idle');
  }
  lines.push('');
  return lines.join('\n');
}

/** Formats the status as human-readable text (SPEC 13.2). */
export function formatStatus(status: StatusView): string {
  const lines: string[] = [];

  // Current section (shared with `collie watch`, SPEC 13.5).
  lines.push(formatCurrentSection(status.current));

  // Queue section.
  lines.push('== queue ==');
  lines.push(`pending: ${String(status.queue.pendingCount)}`);
  if (status.queue.nextExecutable !== null) {
    lines.push(`next: ${status.queue.nextExecutable}`);
  }
  if (status.queue.blocked.length > 0) {
    lines.push(`blocked: ${status.queue.blocked.join(', ')}`);
  }
  lines.push('');

  // Last queue run section.
  lines.push('== last queue run ==');
  if (status.lastQueue !== null) {
    const q = status.lastQueue;
    lines.push(`${q.queueRunId}: ${dash(q.reason)}`);
    if (q.batches.length > 0) {
      for (const b of q.batches) {
        lines.push(`  ${b.batch_id} (${b.run_id}): ${b.verdict}`);
      }
    }
    if (q.pausedCount !== null) {
      lines.push(`paused_count: ${String(q.pausedCount)}`);
    }
  } else {
    lines.push('(none)');
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Text formatting for `collie timeline` (SPEC 13.3)
// ---------------------------------------------------------------------------

/** SPEC 13.3: fixed footer line for timeline output. */
const TIMELINE_FOOTER = 'ADR approvals and releases are in `git log`.';

/* eslint-disable-next-line no-restricted-syntax -- display precision for USD, not a threshold */
const COST_DECIMALS = 2;

function formatTimelineNode(node: TimelineNode): string {
  const ts = node.ts;
  switch (node.kind) {
    case 'batch_start':
      return `${ts}  batch_start  ${dash(node.batchId)}`;
    case 'run_end': {
      const v = dash(node.detail.verdict);
      const a = dash(node.detail.attempt);
      const d = formatDuration(
        typeof node.detail.durationMs === 'number' ? node.detail.durationMs : null,
      );
      const c =
        typeof node.detail.costUsd === 'number'
          ? `$${node.detail.costUsd.toFixed(COST_DECIMALS)}`
          : '—';
      return `${ts}  run_end      ${dash(node.batchId)} ${dash(node.runId)} ${v} attempt=${a} ${d} ${c}`;
    }
    case 'batch_status':
      return `${ts}  batch_status ${dash(node.batchId)} ${dash(node.detail.from)} → ${dash(node.detail.to)}`;
    case 'queue_start':
      return `${ts}  queue_start  ${dash(node.runId)}`;
    case 'queue_paused':
      return `${ts}  queue_paused ${dash(node.batchId)} reasons=${dash(node.detail.reasons)}`;
    case 'queue_end':
      return `${ts}  queue_end    ${dash(node.runId)} reason=${dash(node.detail.reason)}`;
  }
}

/** Formats timeline nodes as human-readable text with the fixed footer. */
export function formatTimeline(nodes: readonly TimelineNode[]): string {
  const lines = nodes.map(formatTimelineNode);
  lines.push('');
  lines.push(TIMELINE_FOOTER);
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Why projection (SPEC 13.4)
// ---------------------------------------------------------------------------

/** One attempt's evidence chain for `collie why`. */
export interface WhyAttempt {
  attempt: number;
  runId: string;
  started: string | null;
  finished: string | null;

  /** 1. Worker ending: exit code, stop_reason, turns, cost (SPEC 13.4 order). */
  worker: {
    exitCode: number | null;
    stopReason: string | null;
    turns: number | null;
    costUsd: number | null;
    /** SPEC 13.23: worker.started.model. */
    model: string | null;
    /** SPEC 13.23: worker.finished.duration_ms. */
    durationMs: number | null;
    /** SPEC 13.23: sum of input_tokens + cache_creation_input_tokens + cache_read_input_tokens. */
    tokensIn: number | null;
    /** SPEC 13.23: output_tokens. */
    tokensOut: number | null;
  } | null;

  /** 2. Evidence summary from evidence.collected (SPEC 13.1). */
  evidence: Record<string, unknown> | null;

  /** 3. Each acceptance.failed (SPEC 13.4). */
  failedAcceptance: { cmd: string; exitCode: number; expect: string }[];

  /** 4. claim.mismatch entries (SPEC 13.4). */
  claimMismatches: { field: string; claimed: unknown; actual: unknown }[];

  /** 5. Reviewer conclusion and gaps (SPEC 13.4). */
  reviewer: {
    verdict: string | null;
    gaps: string[];
    /** SPEC 13.23: reviewer.started.model. */
    model: string | null;
    /** SPEC 13.23: reviewer.finished.num_turns. */
    turns: number | null;
    /** SPEC 13.23: reviewer.finished.cost_usd. */
    costUsd: number | null;
    /** SPEC 13.23: reviewer.finished.duration_ms. */
    durationMs: number | null;
  } | null;

  /** 6. CI evidence (SPEC 13.4). */
  ciResolved: {
    conclusion: string | null;
    branchMatched: boolean | null;
    waitedSecs: number | null;
    runUrl: string | null;
  } | null;
  ciWaitTimeout: { waitedSecs: number | null; lastState: string | null } | null;

  /** 7. verdict.downgraded / escalated (SPEC 13.4). */
  downgraded: {
    from: string;
    to: string;
    rule: number;
    reason: string;
    cause: string | null;
  } | null;
  escalated: string | null;

  /** 8. Interrupts: run.orphaned / worker.signaled / worker.rescued / worker.resumed. */
  interrupts: { event: string; ts: string; detail: Record<string, unknown> }[];

  /** 9. tool.denied (SPEC 13.4). */
  toolDenied: { command: string | null; pattern: string | null }[];

  /** 10. Push events: verdict.pushed / push_failed / push_skipped (SPEC 13.4). */
  pushEvents: { event: string; ts: string; detail: Record<string, unknown> }[];

  /** SPEC 13.23: head_sha from reviewer.started or ci.resolved. */
  headSha: string | null;

  /** SPEC 13.23: ci.verdict_commit events for this run. */
  verdictCommitCi: { sha: string; conclusion: string; when: string }[];

  /** SPEC 13.23: cost breakdown per attempt. */
  cost: { worker: number | null; reviewer: number | null; total: number | null };

  /** Conclusion: verdict, rule, reason from run.finished. */
  verdict: string | null;
  rule: number | null;
  reason: string | null;
}

/** Full why projection for a batch (SPEC 13.4). */
export interface WhyProjection {
  batchId: string;
  attempts: WhyAttempt[];
  /** SPEC 13.14: queue.gate_passed events found for this batch. */
  gatePassedCount: number;
  /** queue.paused events for this batch. */
  queuePaused: { reasons: string[] }[];
  /** Gate facts for PASS batches when no queue.gate_passed is available (SPEC 13.4). */
  gateFacts: {
    downgraded: boolean | null;
    claimMismatches: number | null;
    ciConclusion: string | null;
    ciBranchMatched: boolean | null;
    depsDiff: number | null;
    specDiffLines: number | null;
    gaps: number | null;
  } | null;
}

/** SPEC 13.4 interrupt event types. */
const WHY_INTERRUPT_TYPES = new Set([
  'run.orphaned',
  'worker.signaled',
  'worker.rescued',
  'worker.resumed',
]);

/** SPEC 13.4 push event types. */
const WHY_PUSH_TYPES = new Set(['verdict.pushed', 'verdict.push_failed', 'verdict.push_skipped']);

/** Extracts non-envelope fields from an event as a plain record. */
function eventDetail(e: Event): Record<string, unknown> {
  const skip = new Set(['ts', 'run_id', 'batch_id', 'event']);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (!skip.has(k) && v !== undefined) result[k] = v;
  }
  return result;
}

/**
 * SPEC 13.4: projects a single attempt's evidence chain from its run events.
 */
function projectWhyAttempt(events: readonly Event[], attempt: number, runId: string): WhyAttempt {
  const started = findEvent(events, 'run.started');
  const finished = findEvent(events, 'run.finished');
  const workerStarted = findEvent(events, 'worker.started');
  const workerFinished = findEvent(events, 'worker.finished');
  const reviewerStarted = findEvent(events, 'reviewer.started');
  const reviewerFinished = findEvent(events, 'reviewer.finished');

  // SPEC 13.23: worker model from worker.started.
  const workerModel = workerStarted !== undefined ? asString(workerStarted.model) : null;

  // SPEC 13.23: worker token breakdown from usage in worker.finished.
  let workerTokensIn: number | null = null;
  let workerTokensOut: number | null = null;
  if (
    workerFinished !== undefined &&
    typeof workerFinished.usage === 'object' &&
    workerFinished.usage !== null
  ) {
    const u = workerFinished.usage as Record<string, unknown>;
    const inputTokens = typeof u.input_tokens === 'number' ? u.input_tokens : 0;
    const cacheCreation =
      typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0;
    const cacheRead = typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0;
    workerTokensIn = inputTokens + cacheCreation + cacheRead;
    workerTokensOut = typeof u.output_tokens === 'number' ? u.output_tokens : null;
    // If all were zero defaults (no data), stay null.
    if (inputTokens === 0 && cacheCreation === 0 && cacheRead === 0 && !('input_tokens' in u)) {
      workerTokensIn = null;
    }
  }

  // 1. Worker ending.
  const worker =
    workerFinished !== undefined
      ? {
          exitCode: asNumber(workerFinished.exit_code),
          stopReason: asString(workerFinished.stop_reason),
          turns: asNumber(workerFinished.num_turns),
          costUsd: asNumber(workerFinished.cost_usd),
          model: workerModel,
          durationMs: asNumber(workerFinished.duration_ms),
          tokensIn: workerTokensIn,
          tokensOut: workerTokensOut,
        }
      : null;

  // 2. Evidence summary.
  const evidenceEvent = findEvent(events, 'evidence.collected');
  const evidence = evidenceEvent !== undefined ? eventDetail(evidenceEvent) : null;

  // 3. Acceptance failures.
  const failedAcceptance = events
    .filter((e) => e.event === 'acceptance.failed')
    .map((e) => ({
      cmd: asString(e.cmd) ?? '—',
      exitCode: asNumber(e.exit_code) ?? -1,
      expect: asString(e.expect) ?? '—',
    }));

  // 4. Claim mismatches.
  const claimMismatches = events
    .filter((e) => e.event === 'claim.mismatch')
    .map((e) => ({
      field: asString(e.field) ?? '—',
      claimed: e.claimed,
      actual: e.actual,
    }));

  // 5. Reviewer.
  const reviewerEvent = findEvent(events, 'reviewer.verdict');
  const reviewer =
    reviewerEvent !== undefined
      ? {
          verdict: asString(reviewerEvent.verdict),
          gaps: Array.isArray(reviewerEvent.gaps)
            ? (reviewerEvent.gaps as unknown[]).filter((g): g is string => typeof g === 'string')
            : [],
          // SPEC 13.23: reviewer.started.model.
          model: reviewerStarted !== undefined ? asString(reviewerStarted.model) : null,
          // SPEC 13.23: reviewer.finished fields.
          turns: reviewerFinished !== undefined ? asNumber(reviewerFinished.num_turns) : null,
          costUsd: reviewerFinished !== undefined ? asNumber(reviewerFinished.cost_usd) : null,
          durationMs:
            reviewerFinished !== undefined ? asNumber(reviewerFinished.duration_ms) : null,
        }
      : null;

  // 6. CI.
  const ciResolvedEvent = findEvent(events, 'ci.resolved');
  const ciResolved =
    ciResolvedEvent !== undefined
      ? {
          conclusion: asString(ciResolvedEvent.conclusion),
          branchMatched:
            typeof ciResolvedEvent.branch_matched === 'boolean'
              ? ciResolvedEvent.branch_matched
              : null,
          waitedSecs: asNumber(ciResolvedEvent.waited_secs),
          runUrl: asString(ciResolvedEvent.run_url),
        }
      : null;

  const ciTimeoutEvent = findEvent(events, 'ci.wait_timeout');
  const ciWaitTimeout =
    ciTimeoutEvent !== undefined
      ? {
          waitedSecs: asNumber(ciTimeoutEvent.waited_secs),
          lastState: asString(ciTimeoutEvent.last_state),
        }
      : null;

  // 7. Downgraded / escalated (SPEC 13.20: use last verdict.downgraded for fallback).
  const downgradeEvent = findLastEvent(events, 'verdict.downgraded');
  const downgraded =
    downgradeEvent !== undefined
      ? {
          from: asString(downgradeEvent.from) ?? '—',
          to: asString(downgradeEvent.to) ?? '—',
          rule: asNumber(downgradeEvent.rule) ?? 0,
          reason: asString(downgradeEvent.reason) ?? '—',
          cause: asString(downgradeEvent.cause),
        }
      : null;

  const escalatedEvent = findEvent(events, 'escalated');
  const escalated =
    escalatedEvent !== undefined ? (asString(escalatedEvent.reason) ?? '上报：无 report') : null;

  // 8. Interrupts.
  const interrupts = events
    .filter((e) => WHY_INTERRUPT_TYPES.has(e.event))
    .map((e) => ({ event: e.event, ts: e.ts, detail: eventDetail(e) }));

  // 9. Tool denied.
  const toolDenied = events
    .filter((e) => e.event === 'tool.denied')
    .map((e) => ({
      command: asString(e.command),
      pattern: asString(e.pattern),
    }));

  // 10. Push events.
  const pushEvents = events
    .filter((e) => WHY_PUSH_TYPES.has(e.event))
    .map((e) => ({ event: e.event, ts: e.ts, detail: eventDetail(e) }));

  // SPEC 13.23: head_sha from reviewer.started, fallback to ci.resolved.
  const headShaFromReviewer =
    reviewerStarted !== undefined ? asString(reviewerStarted.head_sha) : null;
  const ciResolvedForSha = findEvent(events, 'ci.resolved');
  const headShaFromCi = ciResolvedForSha !== undefined ? asString(ciResolvedForSha.head_sha) : null;
  const headSha = headShaFromReviewer ?? headShaFromCi;

  // SPEC 13.23: ci.verdict_commit events.
  const verdictCommitCi = events
    .filter((e) => e.event === 'ci.verdict_commit')
    .map((e) => ({
      sha: asString(e.sha) ?? '—',
      conclusion: asString(e.conclusion) ?? '—',
      when: asString(e.when) ?? 'startup',
    }));

  // SPEC 13.23: cost breakdown = worker + reviewer; both missing = null.
  const workerCost = worker?.costUsd ?? null;
  const reviewerCost = reviewer?.costUsd ?? null;
  let totalCost: number | null = null;
  if (workerCost !== null || reviewerCost !== null) {
    totalCost = (workerCost ?? 0) + (reviewerCost ?? 0);
  }
  const cost = { worker: workerCost, reviewer: reviewerCost, total: totalCost };

  // Conclusion — SPEC 13.20: rule/reason fallback order:
  //   run.finished → last verdict.downgraded → null.
  const verdict = finished !== undefined ? asString(finished.verdict) : null;
  const finishedRule = finished !== undefined ? asNumber(finished.rule) : null;
  const finishedReason = finished !== undefined ? asString(finished.reason) : null;
  const rule =
    finishedRule ?? (downgradeEvent !== undefined ? asNumber(downgradeEvent.rule) : null);
  const reason =
    finishedReason ?? (downgradeEvent !== undefined ? asString(downgradeEvent.reason) : null);

  return {
    attempt,
    runId,
    started: started?.ts ?? null,
    finished: finished?.ts ?? null,
    worker,
    evidence,
    failedAcceptance,
    claimMismatches,
    reviewer,
    ciResolved,
    ciWaitTimeout,
    downgraded,
    escalated,
    interrupts,
    toolDenied,
    pushEvents,
    headSha,
    verdictCommitCi,
    cost,
    verdict,
    rule,
    reason,
  };
}

/**
 * SPEC 13.4: projects the full why view for a batch across all its attempts.
 * Returns null when no runs exist for this batch (caller maps to exit code 2).
 */
export function projectWhy(
  runDataList: readonly RunData[],
  batchId: string,
  filterAttempt?: number,
): WhyProjection | null {
  // Collect batch runs (non-queue runs for this batch), sorted by start time.
  const batchRuns: { runId: string; events: Event[]; startedTs: string }[] = [];
  for (const rd of runDataList) {
    if (rd.status !== 'ok' || rd.runId.startsWith('q-')) continue;
    const bid = rd.events.find((e) => e.batch_id !== undefined)?.batch_id;
    if (bid !== batchId) continue;
    const started = findEvent(rd.events, 'run.started');
    if (started === undefined) continue;
    batchRuns.push({ runId: rd.runId, events: [...rd.events], startedTs: started.ts });
  }

  if (batchRuns.length === 0) return null;

  batchRuns.sort((a, b) => (a.startedTs < b.startedTs ? -1 : a.startedTs > b.startedTs ? 1 : 0));

  // Project each attempt.
  const attempts: WhyAttempt[] = [];
  for (const br of batchRuns) {
    const attempt = computeAttempt(runDataList, br.runId, batchId);
    if (filterAttempt !== undefined && attempt !== filterAttempt) continue;
    attempts.push(projectWhyAttempt(br.events, attempt, br.runId));
  }

  // SPEC 13.14: look for queue.gate_passed in queue journals.
  let gatePassedCount = 0;
  const queuePaused: { reasons: string[] }[] = [];
  for (const rd of runDataList) {
    if (rd.status !== 'ok' || !rd.runId.startsWith('q-')) continue;
    for (const e of rd.events) {
      // SPEC 13.14: queue.gate_passed may not be in the event type enum yet;
      // cast to string so we can detect it in journals produced by future R2 versions.
      if ((e.event as string) === 'queue.gate_passed' && e.batch_id === batchId) {
        gatePassedCount++;
      }
      if (e.event === 'queue.paused' && e.batch_id === batchId) {
        const reasons = Array.isArray(e.reasons)
          ? (e.reasons as unknown[]).filter((r): r is string => typeof r === 'string')
          : [];
        queuePaused.push({ reasons });
      }
    }
  }

  // SPEC 13.4: gate facts for the last PASS attempt when no queue.gate_passed.
  let gateFacts: WhyProjection['gateFacts'] = null;
  const lastPassAttempt = [...attempts].reverse().find((a) => a.verdict === 'PASS');
  if (lastPassAttempt !== undefined && gatePassedCount === 0) {
    const ev = lastPassAttempt.evidence;
    const rv = lastPassAttempt.reviewer;
    gateFacts = {
      downgraded: lastPassAttempt.downgraded !== null,
      claimMismatches:
        lastPassAttempt.claimMismatches.length > 0 ? lastPassAttempt.claimMismatches.length : 0,
      ciConclusion: lastPassAttempt.ciResolved?.conclusion ?? null,
      ciBranchMatched: lastPassAttempt.ciResolved?.branchMatched ?? null,
      depsDiff: ev !== null && typeof ev.deps_diff === 'number' ? ev.deps_diff : null,
      specDiffLines:
        ev !== null && typeof ev.spec_diff_lines === 'number' ? ev.spec_diff_lines : null,
      gaps: rv !== null ? rv.gaps.length : null,
    };
  }

  return { batchId, attempts, gatePassedCount, queuePaused, gateFacts };
}

// ---------------------------------------------------------------------------
// Rule templates (SPEC 13.4): fixed per rule number, combined with `reason`.
// ---------------------------------------------------------------------------

/* eslint-disable no-restricted-syntax, @typescript-eslint/no-magic-numbers -- SPEC 4.3 rule numbers used as template keys */
const RULE_TEMPLATES: Record<number, string> = {
  1: '裁决不可解析',
  2: '改动受保护文件',
  3: '未批准依赖',
  4: 'reviewer 发现声称不符',
  5: '声称已推送但远端无提交',
  6: '测试计数不符',
  7: '声称 CI 通过但未通过',
  8: '验收命令未满足',
  9: '证据缺失',
  10: '采用 reviewer 原值',
};
/* eslint-enable no-restricted-syntax, @typescript-eslint/no-magic-numbers */

/** Formats the conclusion line for an attempt (SPEC 13.4, 13.20, 13.23). */
function conclusionLine(a: WhyAttempt): string {
  if (a.escalated !== null) {
    return `结论：BLOCK，上报：${a.escalated}`;
  }
  if (a.verdict === null) {
    return '结论：（运行未完成）';
  }
  // SPEC 13.23: reason starting with "声称不符：" and no rule → show reason only, no 规则.
  if (a.rule === null && a.reason?.startsWith('声称不符：') === true) {
    return `结论：${a.verdict}，${a.reason}`;
  }
  // SPEC 13.20: rule fallback already applied in projectWhyAttempt;
  // when still null, display 规则 —.
  const ruleDisplay =
    a.rule !== null
      ? `规则 ${String(a.rule)}：${RULE_TEMPLATES[a.rule] ?? `规则 ${String(a.rule)}`}`
      : '规则 —';
  const reasonPart = a.reason !== null ? ` — ${a.reason}` : '';
  return `结论：${a.verdict}，${ruleDisplay}${reasonPart}`;
}

/** Formats why as human-readable text (SPEC 13.4). */
export function formatWhy(proj: WhyProjection): string {
  const lines: string[] = [];

  for (const a of proj.attempts) {
    lines.push(`== attempt ${String(a.attempt)} (${a.runId}) ==`);

    // 1. Worker ending.
    if (a.worker !== null) {
      const w = a.worker;
      const parts = [
        `exit_code=${dash(w.exitCode)}`,
        `stop_reason=${dash(w.stopReason)}`,
        `turns=${dash(w.turns)}`,
        `cost=${w.costUsd !== null ? `$${w.costUsd.toFixed(COST_DECIMALS)}` : '—'}`,
        `model=${dash(w.model)}`,
        `duration=${formatDuration(w.durationMs)}`,
        `tokens=${w.tokensIn !== null || w.tokensOut !== null ? `in${dash(w.tokensIn)}/out${dash(w.tokensOut)}` : '—'}`,
      ];
      lines.push(`worker: ${parts.join(' ')}`);
    } else {
      lines.push('worker: —');
    }

    // 2. Evidence.
    if (a.evidence !== null) {
      const ev = a.evidence;
      const parts = Object.entries(ev).map(([k, v]) => {
        if (v === null || v === undefined) return `${k}=—`;
        if (typeof v === 'object') return `${k}=${JSON.stringify(v)}`;
        if (typeof v === 'string') return `${k}=${v}`;
        return `${k}=${JSON.stringify(v)}`;
      });
      lines.push(`evidence: ${parts.join(' ')}`);
    } else {
      lines.push('evidence: —');
    }

    // 3. Acceptance failures.
    if (a.failedAcceptance.length > 0) {
      for (const f of a.failedAcceptance) {
        lines.push(
          `acceptance.failed: \`${f.cmd}\` exit ${String(f.exitCode)} (expect ${f.expect})`,
        );
      }
    }

    // 4. Claim mismatches.
    if (a.claimMismatches.length > 0) {
      for (const m of a.claimMismatches) {
        lines.push(
          `claim.mismatch: ${m.field} claimed=${JSON.stringify(m.claimed)} actual=${JSON.stringify(m.actual)}`,
        );
      }
    }

    // 5. Reviewer.
    if (a.reviewer !== null) {
      const gapStr = a.reviewer.gaps.length > 0 ? `, gaps: ${JSON.stringify(a.reviewer.gaps)}` : '';
      const revParts = [
        `model=${dash(a.reviewer.model)}`,
        `turns=${dash(a.reviewer.turns)}`,
        `cost=${a.reviewer.costUsd !== null ? `$${a.reviewer.costUsd.toFixed(COST_DECIMALS)}` : '—'}`,
        `duration=${formatDuration(a.reviewer.durationMs)}`,
      ];
      lines.push(`reviewer: ${dash(a.reviewer.verdict)}${gapStr} ${revParts.join(' ')}`);
    } else {
      lines.push('reviewer: —');
    }

    // 6. CI.
    if (a.ciResolved !== null) {
      const ci = a.ciResolved;
      const parts = [dash(ci.conclusion), `branch_matched=${dash(ci.branchMatched)}`];
      if (ci.waitedSecs !== null) parts.push(`waited ${String(ci.waitedSecs)}s`);
      lines.push(`ci: ${parts.join(' ')}`);
    } else if (a.ciWaitTimeout !== null) {
      lines.push(
        `ci.wait_timeout: waited ${dash(a.ciWaitTimeout.waitedSecs)}s last_state=${dash(a.ciWaitTimeout.lastState)}`,
      );
    }

    // SPEC 13.23: head_sha after evidence section.
    if (a.headSha !== null) {
      lines.push(`head_sha: ${a.headSha}`);
    }

    // SPEC 13.23: ci.verdict_commit entries.
    for (const vc of a.verdictCommitCi) {
      lines.push(`ci.verdict_commit: ${vc.sha} ${vc.conclusion} when=${vc.when}`);
    }

    // 7. Downgraded / escalated.
    if (a.downgraded !== null) {
      const d = a.downgraded;
      const causePart = d.cause !== null ? ` cause=${d.cause}` : '';
      lines.push(
        `verdict.downgraded: ${d.from} → ${d.to}, rule ${String(d.rule)}: ${d.reason}${causePart}`,
      );
    }
    if (a.escalated !== null) {
      lines.push(`escalated: ${a.escalated}`);
    }

    // 8. Interrupts.
    for (const int of a.interrupts) {
      const detail = Object.entries(int.detail)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');
      lines.push(`${int.event}: ${int.ts}${detail !== '' ? ` ${detail}` : ''}`);
    }

    // 9. Tool denied.
    for (const td of a.toolDenied) {
      lines.push(`tool.denied: command=${dash(td.command)} pattern=${dash(td.pattern)}`);
    }

    // 10. Push.
    for (const p of a.pushEvents) {
      const detail = Object.entries(p.detail)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');
      lines.push(`${p.event}: ${p.ts}${detail !== '' ? ` ${detail}` : ''}`);
    }

    // SPEC 13.23: cost breakdown line before conclusion.
    {
      const wc = a.cost.worker !== null ? `$${a.cost.worker.toFixed(COST_DECIMALS)}` : '—';
      const rc = a.cost.reviewer !== null ? `$${a.cost.reviewer.toFixed(COST_DECIMALS)}` : '—';
      const tc = a.cost.total !== null ? `$${a.cost.total.toFixed(COST_DECIMALS)}` : '—';
      lines.push(`cost: worker=${wc} reviewer=${rc} total=${tc}`);
    }

    // Conclusion line.
    lines.push(conclusionLine(a));
    lines.push('');
  }

  // Gate / paused info for PASS batches.
  const lastAttempt = proj.attempts[proj.attempts.length - 1];
  if (lastAttempt?.verdict === 'PASS') {
    if (proj.gatePassedCount > 0) {
      lines.push(`放行：queue.gate_passed ×${String(proj.gatePassedCount)}`);
    } else if (proj.gateFacts !== null) {
      const gf = proj.gateFacts;
      lines.push('放行判定（无 queue.gate_passed）：');
      lines.push(
        `  downgraded=${dash(gf.downgraded)} claim_mismatches=${dash(gf.claimMismatches)} ci=${dash(gf.ciConclusion)} branch_matched=${dash(gf.ciBranchMatched)} deps_diff=${dash(gf.depsDiff)} spec_diff=${dash(gf.specDiffLines)} gaps=${dash(gf.gaps)}`,
      );
    }
    if (proj.queuePaused.length > 0) {
      for (const qp of proj.queuePaused) {
        lines.push(`queue.paused: reasons=${qp.reasons.join(', ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Formats version summary as human-readable text with the fixed footer. */
export function formatVersionSummary(summaries: readonly VersionSummary[]): string {
  const lines: string[] = [];
  for (const s of summaries) {
    lines.push(`${s.version}:`);
    lines.push(`  first: ${dash(s.firstStart)}  last: ${dash(s.lastEnd)}`);
    lines.push(
      `  batches: ${String(s.batchCount)}  runs: ${String(s.runCount)}  FIX: ${String(s.fixCount)}  BLOCK: ${String(s.blockCount)}`,
    );
    // SPEC 13.13: show — when no runs in the version have any cost data.
    if (s.runsWithoutCost === s.runCount) {
      lines.push('  cost: —');
    } else if (s.runsWithoutCost > 0) {
      lines.push(
        `  cost: $${s.totalCostUsd.toFixed(COST_DECIMALS)} (${String(s.runsWithoutCost)} run(s) without cost data)`,
      );
    } else {
      lines.push(`  cost: $${s.totalCostUsd.toFixed(COST_DECIMALS)}`);
    }
  }
  lines.push('');
  lines.push(TIMELINE_FOOTER);
  lines.push('');
  return lines.join('\n');
}
