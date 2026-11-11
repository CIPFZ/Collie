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
  const durationMs = workerFinished !== undefined ? asNumber(workerFinished.duration_ms) : null;

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

    // Attempt from batch.selected or queue.batch_started.
    const batchSelected =
      findEvent(currentRun.events, 'queue.batch_started') ??
      findEvent(currentRun.events, 'batch.selected');
    const attempt = batchSelected !== undefined ? asNumber(batchSelected.attempt) : null;

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
        const attempt = asNumber(e.attempt);
        // Look up worker.finished for duration in the same run.
        const wf = rd.events.find((ev) => ev.event === 'worker.finished');
        const durationMs = wf !== undefined ? asNumber(wf.duration_ms) : null;
        const costUsd = wf !== undefined ? asNumber(wf.cost_usd) : null;
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

/** Formats the status as human-readable text (SPEC 13.2). */
export function formatStatus(status: StatusView): string {
  const lines: string[] = [];

  // Current section.
  lines.push('== current ==');
  if (status.current.state === 'running') {
    const c = status.current;
    lines.push(
      `running: ${dash(c.batchId)} (${dash(c.runId)}) attempt ${dash(c.attempt)} phase ${dash(c.phase)}`,
    );
    lines.push(
      `  elapsed ${formatDuration(c.elapsedMs)} since-last ${formatDuration(c.sinceLast)}`,
    );
  } else {
    const c = status.current;
    if (c.lastRunId !== null) {
      lines.push(`idle (last: ${c.lastRunId} ${dash(c.lastVerdict)})`);
    } else {
      lines.push('idle');
    }
  }
  lines.push('');

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

/** Formats version summary as human-readable text with the fixed footer. */
export function formatVersionSummary(summaries: readonly VersionSummary[]): string {
  const lines: string[] = [];
  for (const s of summaries) {
    lines.push(`${s.version}:`);
    lines.push(`  first: ${dash(s.firstStart)}  last: ${dash(s.lastEnd)}`);
    lines.push(
      `  batches: ${String(s.batchCount)}  runs: ${String(s.runCount)}  FIX: ${String(s.fixCount)}  BLOCK: ${String(s.blockCount)}`,
    );
    if (s.runsWithoutCost > 0) {
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
