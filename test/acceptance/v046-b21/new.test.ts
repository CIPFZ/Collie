// Acceptance tests for v046-b21 — [新] scenarios S1, S2.
// S1: journal without tester.* events → projectWhy attempt omits tester keys.
// S2: queue without tester.* events → projectReport batchRows omit testerCost key.
import { describe, expect, it } from 'vitest';
import { projectWhy, projectReport, type RunData } from '../../../src/view.js';
import type { Event } from '../../../src/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<Event> & { run_id: string; event: string }): Event {
  return {
    ts: partial.ts ?? '2026-11-20T12:00:00Z',
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// S1: no tester.* events → projectWhy attempt omits tester keys
// ---------------------------------------------------------------------------

describe('S1: no tester events → projectWhy attempt has no tester keys', () => {
  const BATCH = 'v99-b01';
  const RUN = 'r-20261120-120000';

  /** A finished PASS run with worker + reviewer, but zero tester.* events. */
  function runDataNoTester(): RunData[] {
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: BATCH }),
      makeEvent({
        run_id: RUN,
        event: 'worker.started',
        batch_id: BATCH,
        model: 'test-model',
      }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:05:00Z',
        exit_code: 0,
        num_turns: 10,
        cost_usd: 1.5,
        duration_ms: 300000,
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.started',
        batch_id: BATCH,
        ts: '2026-11-20T12:06:00Z',
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.verdict',
        batch_id: BATCH,
        ts: '2026-11-20T12:07:00Z',
        verdict: 'PASS',
        gaps: [],
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:08:00Z',
        exit_code: 0,
        cost_usd: 0.5,
        num_turns: 3,
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:10:00Z',
        verdict: 'PASS',
        rule: 10,
        reason: 'ok',
      }),
    ];
    return [{ runId: RUN, status: 'ok', events }];
  }

  it('S1: attempt object has no "tester" key when journal lacks tester events', () => {
    const proj = projectWhy(runDataNoTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const attempt = proj!.attempts[0]!;
    expect(Object.prototype.hasOwnProperty.call(attempt, 'tester')).toBe(false);
  });

  it('S1: cost object has no "tester" key when journal lacks tester events', () => {
    const proj = projectWhy(runDataNoTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const attempt = proj!.attempts[0]!;
    expect(Object.prototype.hasOwnProperty.call(attempt.cost, 'tester')).toBe(false);
  });

  it('S1: JSON.stringify of projectWhy result contains no "tester:" substring', () => {
    const proj = projectWhy(runDataNoTester(), BATCH);
    expect(proj).not.toBeNull();
    const json = JSON.stringify(proj);
    expect(json).not.toContain('"tester":');
  });
});

// ---------------------------------------------------------------------------
// S2: queue without tester.* events → projectReport omits testerCost key
// ---------------------------------------------------------------------------

describe('S2: queue with no tester events → projectReport omits testerCost', () => {
  const BATCH = 'v99-b01';
  const BATCH_RUN = 'r-20261120-130000';
  const Q_RUN = 'q-20261120-120000';

  /** A queue run referencing one batch run, neither having any tester.* events. */
  function buildData(): { allRunData: RunData[]; queueEvents: Event[] } {
    const batchEvents: Event[] = [
      makeEvent({ run_id: BATCH_RUN, event: 'run.started', batch_id: BATCH }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'worker.started',
        batch_id: BATCH,
        model: 'test-model',
      }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'worker.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:05:00Z',
        exit_code: 0,
        num_turns: 10,
        cost_usd: 1.0,
      }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'reviewer.started',
        batch_id: BATCH,
        ts: '2026-11-20T12:06:00Z',
      }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'reviewer.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:07:00Z',
        exit_code: 0,
        cost_usd: 0.5,
      }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'run.finished',
        batch_id: BATCH,
        ts: '2026-11-20T12:10:00Z',
        verdict: 'PASS',
        rule: 10,
      }),
    ];

    const queueEvents: Event[] = [
      makeEvent({
        run_id: Q_RUN,
        event: 'queue.preflight',
        ts: '2026-11-20T12:00:00Z',
        ok: true,
        checks: [],
      }),
      makeEvent({
        run_id: Q_RUN,
        event: 'queue.batch_started',
        batch_id: BATCH,
        ts: '2026-11-20T12:00:01Z',
        batch_run_id: BATCH_RUN,
      }),
      makeEvent({
        run_id: Q_RUN,
        event: 'queue.finished',
        ts: '2026-11-20T12:15:00Z',
        reason: 'exhausted',
      }),
    ];

    const allRunData: RunData[] = [
      { runId: BATCH_RUN, status: 'ok', events: batchEvents },
      { runId: Q_RUN, status: 'ok', events: queueEvents },
    ];

    return { allRunData, queueEvents };
  }

  it('S2: batchRows entries have no "testerCost" key when journal lacks tester events', () => {
    const { allRunData, queueEvents } = buildData();
    const report = projectReport(allRunData, queueEvents, Q_RUN);
    expect(report.batchRows.length).toBeGreaterThan(0);
    for (const row of report.batchRows) {
      expect(Object.prototype.hasOwnProperty.call(row, 'testerCost')).toBe(false);
    }
  });

  it('S2: JSON.stringify of projectReport result contains no "testerCost:" substring', () => {
    const { allRunData, queueEvents } = buildData();
    const report = projectReport(allRunData, queueEvents, Q_RUN);
    const json = JSON.stringify(report);
    expect(json).not.toContain('"testerCost":');
  });
});
