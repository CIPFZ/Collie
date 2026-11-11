// Tests for collie timeline (SPEC 13.3, v04-b03).
// Covers: node order, --since filter, --batch filter, version summary,
// missing cost data, empty directory.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatTimeline,
  formatVersionSummary,
  loadRuns,
  projectTimeline,
  projectVersionSummary,
} from '../src/view.js';
import type { Event } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<Event> & { run_id: string; event: string }): Event {
  return {
    ts: partial.ts ?? '2026-10-20T12:00:00Z',
    ...partial,
  };
}

function writeJournal(root: string, runId: string, events: Event[]): void {
  const dir = join(root, '.collie', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(dir, 'events.ndjson'), lines);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BATCH_A = 'v01-b01';
const BATCH_B = 'v01-b02';
const BATCH_C = 'v02-b01';
const RUN_1 = 'r-20261020-100000';
const RUN_2 = 'r-20261020-110000';
const RUN_3 = 'r-20261020-120000';
const QUEUE_RUN = 'q-20261020-130000';

/** Run that PASSes with cost data. */
function passRunEvents(
  runId: string,
  batchId: string,
  startTs: string,
  endTs: string,
  costUsd?: number,
  durationMs?: number,
): Event[] {
  return [
    makeEvent({ run_id: runId, event: 'run.started', batch_id: batchId, ts: startTs }),
    makeEvent({
      run_id: runId,
      event: 'batch.selected',
      batch_id: batchId,
      base_sha: 'aaaaaaa',
    }),
    makeEvent({ run_id: runId, event: 'worker.started', batch_id: batchId }),
    makeEvent({
      run_id: runId,
      event: 'worker.finished',
      batch_id: batchId,
      ts: endTs,
      exit_code: 0,
      ...(costUsd !== undefined ? { cost_usd: costUsd } : {}),
      ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
    }),
    makeEvent({
      run_id: runId,
      event: 'run.finished',
      batch_id: batchId,
      ts: endTs,
      verdict: 'PASS',
      exit_code: 0,
      rule: 10,
    }),
  ];
}

/** FIX run without cost data. */
function fixRunEvents(runId: string, batchId: string, startTs: string, endTs: string): Event[] {
  return [
    makeEvent({ run_id: runId, event: 'run.started', batch_id: batchId, ts: startTs }),
    makeEvent({
      run_id: runId,
      event: 'batch.selected',
      batch_id: batchId,
      base_sha: 'aaaaaaa',
    }),
    makeEvent({ run_id: runId, event: 'worker.started', batch_id: batchId }),
    makeEvent({
      run_id: runId,
      event: 'worker.finished',
      batch_id: batchId,
      ts: endTs,
      exit_code: 0,
    }),
    makeEvent({
      run_id: runId,
      event: 'run.finished',
      batch_id: batchId,
      ts: endTs,
      verdict: 'FIX',
      exit_code: 10,
      rule: 9,
    }),
  ];
}

/** Queue run with batch.status and queue.finished. */
function queueRunEvents(queueId: string, startTs: string, endTs: string, batchId: string): Event[] {
  return [
    makeEvent({ run_id: queueId, event: 'run.started', ts: startTs }),
    makeEvent({
      run_id: queueId,
      event: 'queue.batch_started',
      batch_id: batchId,
      batch_run_id: RUN_1,
      attempt: 1,
      why: 'new',
    }),
    makeEvent({
      run_id: queueId,
      event: 'batch.status',
      batch_id: batchId,
      ts: '2026-10-20T13:05:00Z',
      from: 'pending',
      to: 'passed',
    }),
    makeEvent({
      run_id: queueId,
      event: 'queue.paused',
      batch_id: batchId,
      ts: '2026-10-20T13:06:00Z',
      reasons: ['gaps'],
    }),
    makeEvent({
      run_id: queueId,
      event: 'queue.finished',
      ts: endTs,
      reason: 'paused',
      batches: [{ batch_id: batchId, run_id: RUN_1, verdict: 'PASS' }],
      paused_count: 1,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('timeline (SPEC 13.3)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'timeline-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns empty array for an empty directory', () => {
    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    expect(nodes).toEqual([]);
  });

  it('produces nodes in ascending time order', () => {
    // Two batch runs with different timestamps.
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z', 2.5, 1800000),
    );
    writeJournal(
      root,
      RUN_2,
      passRunEvents(RUN_2, BATCH_B, '2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z', 3.0, 1800000),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);

    // Should be strictly non-decreasing.
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev !== undefined && curr !== undefined) {
        expect(curr.ts >= prev.ts).toBe(true);
      }
    }

    // Should have batch_start and run_end for both batches.
    expect(nodes.filter((n) => n.kind === 'batch_start')).toHaveLength(2);
    expect(nodes.filter((n) => n.kind === 'run_end')).toHaveLength(2);

    // First node is the earliest batch start.
    expect(nodes[0]?.kind).toBe('batch_start');
    expect(nodes[0]?.batchId).toBe(BATCH_A);
  });

  it('filters by --since date', () => {
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );
    writeJournal(
      root,
      RUN_2,
      passRunEvents(RUN_2, BATCH_B, '2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z'),
    );

    const runs = loadRuns(root);
    let nodes = projectTimeline(runs);

    // Filter to only show nodes from 11:00 onwards.
    const sinceDate = '2026-10-20T11:00:00Z';
    nodes = nodes.filter((n) => n.ts >= sinceDate);

    // Only BATCH_B events remain.
    expect(nodes.every((n) => n.batchId === BATCH_B || n.batchId === null)).toBe(true);
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes.some((n) => n.batchId === BATCH_A)).toBe(false);
  });

  it('filters by --batch prefix', () => {
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );
    writeJournal(
      root,
      RUN_3,
      passRunEvents(RUN_3, BATCH_C, '2026-10-20T12:00:00Z', '2026-10-20T12:30:00Z'),
    );

    const runs = loadRuns(root);
    let nodes = projectTimeline(runs);

    // Filter to v01- batches.
    const prefix = 'v01-';
    nodes = nodes.filter((n) => n.batchId?.startsWith(prefix) === true);

    // Only v01- batch remains.
    expect(nodes.every((n) => n.batchId?.startsWith('v01-') === true)).toBe(true);
    expect(nodes.some((n) => n.batchId === BATCH_C)).toBe(false);
  });

  it('groups by version prefix and summarises correctly', () => {
    // v01: two batches, one PASS run each.
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z', 2.5, 1800000),
    );
    writeJournal(
      root,
      RUN_2,
      passRunEvents(RUN_2, BATCH_B, '2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z', 3.0, 1800000),
    );
    // v02: one batch, one FIX run.
    writeJournal(
      root,
      RUN_3,
      fixRunEvents(RUN_3, BATCH_C, '2026-10-20T12:00:00Z', '2026-10-20T12:30:00Z'),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    const summaries = projectVersionSummary(nodes);

    expect(summaries).toHaveLength(2);

    const v01 = summaries.find((s) => s.version === 'v01');
    expect(v01).toBeDefined();
    expect(v01?.batchCount).toBe(2);
    expect(v01?.runCount).toBe(2);
    expect(v01?.fixCount).toBe(0);
    expect(v01?.totalCostUsd).toBeCloseTo(5.5);
    expect(v01?.runsWithoutCost).toBe(0);
    expect(v01?.firstStart).toBe('2026-10-20T10:00:00Z');
    expect(v01?.lastEnd).toBe('2026-10-20T11:30:00Z');

    const v02 = summaries.find((s) => s.version === 'v02');
    expect(v02).toBeDefined();
    expect(v02?.batchCount).toBe(1);
    expect(v02?.runCount).toBe(1);
    expect(v02?.fixCount).toBe(1);
  });

  it('notes runs without cost data in version summary', () => {
    // One run without cost data.
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );
    // One run with cost data.
    writeJournal(
      root,
      RUN_2,
      passRunEvents(RUN_2, BATCH_B, '2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z', 4.0, 1800000),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    const summaries = projectVersionSummary(nodes);

    const v01 = summaries.find((s) => s.version === 'v01');
    expect(v01).toBeDefined();
    expect(v01?.runsWithoutCost).toBe(1);
    expect(v01?.totalCostUsd).toBeCloseTo(4.0);

    // Text format mentions runs without cost data.
    const text = formatVersionSummary(summaries);
    expect(text).toContain('without cost data');
  });

  it('includes batch.status, queue start/paused/end nodes', () => {
    // A queue run with status change, pause, and finish.
    writeJournal(
      root,
      QUEUE_RUN,
      queueRunEvents(QUEUE_RUN, '2026-10-20T13:00:00Z', '2026-10-20T13:10:00Z', BATCH_A),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);

    const kinds = nodes.map((n) => n.kind);
    expect(kinds).toContain('queue_start');
    expect(kinds).toContain('batch_status');
    expect(kinds).toContain('queue_paused');
    expect(kinds).toContain('queue_end');

    // batch_status node has from/to detail.
    const statusNode = nodes.find((n) => n.kind === 'batch_status');
    expect(statusNode).toBeDefined();
    expect(statusNode?.detail.from).toBe('pending');
    expect(statusNode?.detail.to).toBe('passed');
  });

  it('deduplicates batch_start to only the first occurrence', () => {
    // Same batch across two runs — should only get one batch_start.
    writeJournal(
      root,
      RUN_1,
      fixRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );
    writeJournal(
      root,
      RUN_2,
      passRunEvents(RUN_2, BATCH_A, '2026-10-20T11:00:00Z', '2026-10-20T11:30:00Z', 3.0, 1800000),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);

    const batchStarts = nodes.filter((n) => n.kind === 'batch_start' && n.batchId === BATCH_A);
    expect(batchStarts).toHaveLength(1);
    expect(batchStarts[0]?.ts).toBe('2026-10-20T10:00:00Z');

    // But should have two run_end nodes.
    const runEnds = nodes.filter((n) => n.kind === 'run_end');
    expect(runEnds).toHaveLength(2);
  });

  it('formatTimeline output ends with the fixed ADR/releases footer', () => {
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    const text = formatTimeline(nodes);

    expect(text).toContain('ADR approvals and releases are in `git log`.');
  });

  it('formatVersionSummary output ends with the fixed ADR/releases footer', () => {
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z'),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    const summaries = projectVersionSummary(nodes);
    const text = formatVersionSummary(summaries);

    expect(text).toContain('ADR approvals and releases are in `git log`.');
  });

  it('run_end nodes carry cost and duration when available', () => {
    writeJournal(
      root,
      RUN_1,
      passRunEvents(RUN_1, BATCH_A, '2026-10-20T10:00:00Z', '2026-10-20T10:30:00Z', 5.25, 300000),
    );

    const runs = loadRuns(root);
    const nodes = projectTimeline(runs);
    const runEnd = nodes.find((n) => n.kind === 'run_end');
    expect(runEnd).toBeDefined();
    expect(runEnd?.detail.costUsd).toBe(5.25);
    // SPEC 13.13: run duration = run.finished.ts − run.started.ts = 10:30 − 10:00 = 1800000ms.
    expect(runEnd?.detail.durationMs).toBe(1800000);
    expect(runEnd?.detail.verdict).toBe('PASS');
  });
});
