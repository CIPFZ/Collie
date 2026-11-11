// Tests for src/view.ts — the projection module (SPEC 13.2, v04-b02).
// Fixtures cover: PASS, FIX→PASS, in-progress run, old-format run_id dir,
// bad-line journal, queue run, old journal missing 13.1 fields, unreadable run.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildStatus,
  formatStatus,
  loadRuns,
  projectBatches,
  projectQueueRun,
  projectRun,
  projectRuns,
} from '../src/view.js';
import type { Event } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_A = 'v99-b01';
const BATCH_B = 'v99-b02';
const RUN_ID_1 = 'r-20261020-120000';
const RUN_ID_2 = 'r-20261020-130000';
const QUEUE_RUN = 'q-20261020-120000';
const NOW = new Date('2026-10-20T14:00:00Z');

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

function writeRawJournal(root: string, runId: string, content: string): void {
  const dir = join(root, '.collie', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'events.ndjson'), content);
}

// A set of batches for buildStatus.
const BATCHES = [
  { id: BATCH_A, title: 'Test A', status: 'passed', depends_on: [] as string[] },
  { id: BATCH_B, title: 'Test B', status: 'pending', depends_on: [BATCH_A] },
];

// ---------------------------------------------------------------------------
// Fixture: events
// ---------------------------------------------------------------------------

/** A completed PASS run with 13.1 fields. */
function passRunEvents(): Event[] {
  return [
    makeEvent({ run_id: RUN_ID_1, event: 'run.started', batch_id: BATCH_A }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'batch.selected',
      batch_id: BATCH_A,
      base_sha: 'aaaaaaa',
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'worker.started',
      batch_id: BATCH_A,
      model: 'claude-opus-4-6',
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'worker.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:05:00Z',
      exit_code: 0,
      num_turns: 42,
      cost_usd: 3.5,
      duration_ms: 300000,
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'reviewer.started',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:06:00Z',
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'reviewer.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:08:00Z',
      exit_code: 0,
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'reviewer.verdict',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:09:00Z',
      verdict: 'PASS',
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'evidence.collected',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:09:30Z',
      tests_passed: 100,
      tests_failed: 0,
      acceptance_passed: 5,
      acceptance_total: 5,
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'run.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:10:00Z',
      verdict: 'PASS',
      exit_code: 0,
      rule: 10,
      reason: 'all acceptance commands pass',
    }),
  ];
}

/** A FIX run followed by a PASS. */
function fixThenPassEvents(): { fix: Event[]; pass: Event[] } {
  const fix = [
    makeEvent({ run_id: RUN_ID_1, event: 'run.started', batch_id: BATCH_A }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'batch.selected',
      batch_id: BATCH_A,
      base_sha: 'aaaaaaa',
    }),
    makeEvent({ run_id: RUN_ID_1, event: 'worker.started', batch_id: BATCH_A }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'worker.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:05:00Z',
      exit_code: 0,
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'reviewer.verdict',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:09:00Z',
      verdict: 'FIX',
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'verdict.downgraded',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:09:30Z',
      from: 'PASS',
      to: 'FIX',
      rule: 9,
    }),
    makeEvent({
      run_id: RUN_ID_1,
      event: 'run.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T12:10:00Z',
      verdict: 'FIX',
      exit_code: 10,
      rule: 9,
      reason: 'remote_has_head=false',
    }),
  ];
  const pass = [
    makeEvent({ run_id: RUN_ID_2, event: 'run.started', batch_id: BATCH_A }),
    makeEvent({
      run_id: RUN_ID_2,
      event: 'batch.selected',
      batch_id: BATCH_A,
      base_sha: 'aaaaaaa',
    }),
    makeEvent({ run_id: RUN_ID_2, event: 'worker.started', batch_id: BATCH_A }),
    makeEvent({
      run_id: RUN_ID_2,
      event: 'worker.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T13:05:00Z',
      exit_code: 0,
    }),
    makeEvent({
      run_id: RUN_ID_2,
      event: 'reviewer.verdict',
      batch_id: BATCH_A,
      ts: '2026-10-20T13:09:00Z',
      verdict: 'PASS',
    }),
    makeEvent({
      run_id: RUN_ID_2,
      event: 'run.finished',
      batch_id: BATCH_A,
      ts: '2026-10-20T13:10:00Z',
      verdict: 'PASS',
      exit_code: 0,
      rule: 10,
    }),
  ];
  return { fix, pass };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('view.ts', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'view-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('loadRuns returns empty when no runs directory exists', () => {
    const runs = loadRuns(root);
    expect(runs).toEqual([]);
  });

  it('projectRun handles a PASS run with 13.1 fields', () => {
    const events = passRunEvents();
    const proj = projectRun(events);
    expect(proj.runId).toBe(RUN_ID_1);
    expect(proj.batchId).toBe(BATCH_A);
    expect(proj.verdict).toBe('PASS');
    expect(proj.numTurns).toBe(42);
    expect(proj.costUsd).toBe(3.5);
    // SPEC 13.13: run duration = run.finished.ts − run.started.ts = 12:10 − 12:00 = 600000ms.
    expect(proj.durationMs).toBe(600000);
    expect(proj.rule).toBe(10);
    expect(proj.exitCode).toBe(0);
    expect(proj.testsPassed).toBe(100);
    expect(proj.testsFailed).toBe(0);
    expect(proj.phase).toBeNull(); // finished run
  });

  it('handles FIX followed by PASS across two runs', () => {
    const { fix, pass } = fixThenPassEvents();
    writeJournal(root, RUN_ID_1, fix);
    writeJournal(root, RUN_ID_2, pass);

    const runs = loadRuns(root);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.status === 'ok')).toBe(true);

    const projections = projectRuns(runs);
    expect(projections).toHaveLength(2);
    expect(projections[0]?.verdict).toBe('FIX');
    expect(projections[1]?.verdict).toBe('PASS');
  });

  it('detects an in-progress run (no run.finished)', () => {
    const events: Event[] = [
      makeEvent({
        run_id: RUN_ID_1,
        event: 'run.started',
        batch_id: BATCH_A,
        ts: '2026-10-20T12:00:00Z',
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'batch.selected',
        batch_id: BATCH_A,
        base_sha: 'aaaaaaa',
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'worker.started',
        batch_id: BATCH_A,
        ts: '2026-10-20T12:01:00Z',
      }),
    ];
    writeJournal(root, RUN_ID_1, events);

    const runs = loadRuns(root);
    expect(runs).toHaveLength(1);
    const run0 = runs[0];
    expect(run0).toBeDefined();
    const proj = projectRun(run0?.status === 'ok' ? run0.events : []);
    expect(proj.verdict).toBeNull();
    expect(proj.phase).toBe('worker');
    expect(proj.finished).toBeNull();

    const status = buildStatus(runs, BATCHES, NOW);
    expect(status.current.state).toBe('running');
    expect(status.current.runId).toBe(RUN_ID_1);
    expect(status.current.phase).toBe('worker');
    expect(status.current.elapsedMs).toBeGreaterThan(0);
    expect(status.current.sinceLast).toBeGreaterThan(0);
  });

  it('marks an old-format run_id directory as valid if events parse', () => {
    // Old format had run ids like "r-20261020-120000" — these should still work.
    const oldRunId = 'r-20261020-120000';
    const events = [
      makeEvent({ run_id: oldRunId, event: 'run.started', batch_id: BATCH_A }),
      makeEvent({
        run_id: oldRunId,
        event: 'run.finished',
        batch_id: BATCH_A,
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
      }),
    ];
    writeJournal(root, oldRunId, events);

    const runs = loadRuns(root);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('ok');
  });

  it('marks a run with bad journal lines as unreadable', () => {
    const badRunId = 'r-20261020-140000';
    writeRawJournal(root, badRunId, '{"this is": "invalid json\n');

    const runs = loadRuns(root);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('unreadable');
    const rd = runs[0];
    if (rd?.status === 'unreadable') {
      expect(rd.reason).toBeTruthy();
    }
  });

  it('loads a run with bad lines without affecting other runs', () => {
    // Good run
    writeJournal(root, RUN_ID_1, passRunEvents());
    // Bad run
    writeRawJournal(root, 'r-20261020-999999', 'not json at all\n');

    const runs = loadRuns(root);
    expect(runs).toHaveLength(2);
    const good = runs.find((r) => r.runId === RUN_ID_1);
    const bad = runs.find((r) => r.runId === 'r-20261020-999999');
    expect(good?.status).toBe('ok');
    expect(bad?.status).toBe('unreadable');
  });

  it('projects a queue run correctly', () => {
    const queueEvents: Event[] = [
      makeEvent({ run_id: QUEUE_RUN, event: 'run.started', ts: '2026-10-20T12:00:00Z' }),
      makeEvent({
        run_id: QUEUE_RUN,
        event: 'queue.batch_started',
        batch_id: BATCH_A,
        batch_run_id: RUN_ID_1,
        attempt: 1,
        why: 'new',
      }),
      makeEvent({
        run_id: QUEUE_RUN,
        event: 'queue.finished',
        reason: 'exhausted',
        batches: [{ batch_id: BATCH_A, run_id: RUN_ID_1, verdict: 'PASS' }],
        paused_count: 0,
      }),
    ];
    const proj = projectQueueRun(queueEvents);
    expect(proj.queueRunId).toBe(QUEUE_RUN);
    expect(proj.reason).toBe('exhausted');
    expect(proj.batches).toHaveLength(1);
    expect(proj.batches[0]?.batch_id).toBe(BATCH_A);
    expect(proj.pausedCount).toBe(0);
  });

  it('gives null for 13.1 fields missing from old journal', () => {
    // Old-style journal: worker.finished without 13.1 fields.
    const events: Event[] = [
      makeEvent({ run_id: RUN_ID_1, event: 'run.started', batch_id: BATCH_A }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'worker.started',
        batch_id: BATCH_A,
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'worker.finished',
        batch_id: BATCH_A,
        exit_code: 0,
        // No num_turns, cost_usd, duration_ms
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'run.finished',
        batch_id: BATCH_A,
        verdict: 'PASS',
        exit_code: 0,
        // No rule or reason
      }),
    ];
    const proj = projectRun(events);
    expect(proj.numTurns).toBeNull();
    expect(proj.costUsd).toBeNull();
    // SPEC 13.13: durationMs is now computed from run.finished.ts − run.started.ts,
    // not worker.finished.duration_ms. Both events share the default ts, so duration = 0.
    expect(proj.durationMs).toBe(0);
    expect(proj.testsPassed).toBeNull(); // No evidence.collected event
    expect(proj.testsFailed).toBeNull();
  });

  it('buildStatus shows idle with last verdict when no run is in progress', () => {
    writeJournal(root, RUN_ID_1, passRunEvents());

    const runs = loadRuns(root);
    const status = buildStatus(runs, BATCHES, NOW);
    expect(status.current.state).toBe('idle');
    expect(status.current.lastRunId).toBe(RUN_ID_1);
    expect(status.current.lastVerdict).toBe('PASS');
  });

  it('buildStatus computes queue section correctly', () => {
    writeJournal(root, RUN_ID_1, passRunEvents());

    const runs = loadRuns(root);
    const status = buildStatus(runs, BATCHES, NOW);
    // BATCH_A is passed, BATCH_B is pending and depends on BATCH_A → executable.
    expect(status.queue.pendingCount).toBe(1);
    expect(status.queue.nextExecutable).toBe(BATCH_B);
    expect(status.queue.blocked).toEqual([]);
  });

  it('buildStatus includes last queue run', () => {
    const queueEvents: Event[] = [
      makeEvent({ run_id: QUEUE_RUN, event: 'run.started' }),
      makeEvent({
        run_id: QUEUE_RUN,
        event: 'queue.finished',
        reason: 'limit',
        batches: [{ batch_id: BATCH_A, run_id: RUN_ID_1, verdict: 'PASS' }],
        paused_count: 1,
      }),
    ];
    writeJournal(root, QUEUE_RUN, queueEvents);

    const runs = loadRuns(root);
    const status = buildStatus(runs, BATCHES, NOW);
    expect(status.lastQueue).not.toBeNull();
    expect(status.lastQueue?.reason).toBe('limit');
    expect(status.lastQueue?.pausedCount).toBe(1);
  });

  it('formatStatus outputs no runs recorded text when run list is empty', () => {
    // No journal at all → buildStatus returns idle, but the cli would print "no runs recorded".
    // Here we test the format with an idle status.
    const status = buildStatus([], BATCHES, NOW);
    const text = formatStatus(status);
    expect(text).toContain('idle');
    expect(text).toContain('queue');
    expect(text).toContain('(none)');
  });

  it('formatStatus includes running info when a run is in progress', () => {
    const events: Event[] = [
      makeEvent({
        run_id: RUN_ID_1,
        event: 'run.started',
        batch_id: BATCH_A,
        ts: '2026-10-20T12:00:00Z',
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'batch.selected',
        batch_id: BATCH_A,
        base_sha: 'aaaaaaa',
      }),
      makeEvent({
        run_id: RUN_ID_1,
        event: 'worker.started',
        batch_id: BATCH_A,
        ts: '2026-10-20T12:01:00Z',
      }),
    ];
    writeJournal(root, RUN_ID_1, events);
    const runs = loadRuns(root);
    const view = buildStatus(runs, BATCHES, NOW);
    const text = formatStatus(view);
    expect(text).toContain('running');
    expect(text).toContain(RUN_ID_1);
    expect(text).toContain(BATCH_A);
  });

  it('projectBatches aggregates runs per batch', () => {
    const { fix, pass } = fixThenPassEvents();
    writeJournal(root, RUN_ID_1, fix);
    writeJournal(root, RUN_ID_2, pass);

    const runs = loadRuns(root);
    const batchProj = projectBatches(runs, BATCHES);
    const batchA = batchProj.find((b) => b.batchId === BATCH_A);
    expect(batchA).toBeDefined();
    expect(batchA?.attempts).toBe(2);
    expect(batchA?.lastVerdict).toBe('PASS');
    expect(batchA?.lastRunId).toBe(RUN_ID_2);

    const batchB = batchProj.find((b) => b.batchId === BATCH_B);
    expect(batchB?.attempts).toBe(0);
    expect(batchB?.lastVerdict).toBeNull();
  });
});
