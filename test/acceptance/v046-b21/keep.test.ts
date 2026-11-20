// Acceptance tests for v046-b21 — [保持] scenarios K1, K2, K3.
// K1: tester.finished present → projectWhy shows tester data and cost.
// K2: tester.finished present → projectReport row has testerCost, formatReport shows column.
// K3: no tester events → formatWhy has no tester: line, formatReport has no tester 花费.
import { describe, expect, it } from 'vitest';
import {
  projectWhy,
  projectReport,
  formatWhy,
  formatReport,
  type RunData,
} from '../../../src/view.js';
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
// K1: tester.finished present → projectWhy returns tester data
// ---------------------------------------------------------------------------

describe('K1: journal with tester.finished → projectWhy populates tester fields', () => {
  const BATCH = 'v99-b01';
  const RUN = 'r-20261120-140000';

  function runDataWithTester(): RunData[] {
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: BATCH }),
      makeEvent({ run_id: RUN, event: 'tester.started', batch_id: BATCH, attempt: 1 }),
      makeEvent({
        run_id: RUN,
        event: 'tester.finished',
        batch_id: BATCH,
        attempt: 1,
        exit_code: 0,
        num_turns: 21,
        cost_usd: 0.29,
        duration_ms: 123000,
      }),
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

  it('K1: attempt.tester has turns 21, costUsd 0.29, durationMs 123000, invocations 1', () => {
    const proj = projectWhy(runDataWithTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const attempt = proj!.attempts[0]!;
    expect(attempt.tester).not.toBeNull();
    expect(attempt.tester?.turns).toBe(21);
    expect(attempt.tester?.costUsd).toBe(0.29);
    expect(attempt.tester?.durationMs).toBe(123000);
    expect(attempt.tester?.invocations).toBe(1);
  });

  it('K1: cost.tester is 0.29', () => {
    const proj = projectWhy(runDataWithTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const attempt = proj!.attempts[0]!;
    expect(attempt.cost.tester).toBe(0.29);
  });

  it('K1: formatWhy text has a line starting with "tester:"', () => {
    const proj = projectWhy(runDataWithTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const text = formatWhy(proj!);
    const lines = text.split('\n');
    expect(lines.some((l) => l.startsWith('tester:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// K2: tester.finished in queue batch → testerCost in report row, column shown
// ---------------------------------------------------------------------------

describe('K2: queue batch with tester.finished → testerCost in report', () => {
  const BATCH = 'v99-b01';
  const BATCH_RUN = 'r-20261120-150000';
  const Q_RUN = 'q-20261120-140000';

  function buildData(): { allRunData: RunData[]; queueEvents: Event[] } {
    const batchEvents: Event[] = [
      makeEvent({ run_id: BATCH_RUN, event: 'run.started', batch_id: BATCH }),
      makeEvent({ run_id: BATCH_RUN, event: 'tester.started', batch_id: BATCH, attempt: 1 }),
      makeEvent({
        run_id: BATCH_RUN,
        event: 'tester.finished',
        batch_id: BATCH,
        attempt: 1,
        exit_code: 0,
        num_turns: 5,
        cost_usd: 0.29,
        duration_ms: 15000,
      }),
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
        cost_usd: 2.0,
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
        ts: '2026-11-20T11:59:00Z',
        ok: true,
        checks: [],
      }),
      makeEvent({
        run_id: Q_RUN,
        event: 'queue.batch_started',
        batch_id: BATCH,
        ts: '2026-11-20T12:00:00Z',
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

  it('K2: projectReport batchRow testerCost is 0.29', () => {
    const { allRunData, queueEvents } = buildData();
    const report = projectReport(allRunData, queueEvents, Q_RUN);
    expect(report.batchRows).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const row = report.batchRows[0]!;
    expect(row.testerCost).toBe(0.29);
  });

  it('K2: formatReport text contains "tester 花费" column', () => {
    const { allRunData, queueEvents } = buildData();
    const report = projectReport(allRunData, queueEvents, Q_RUN);
    const text = formatReport(report, new Map(), '(queue events)', '(none)');
    expect(text).toContain('tester 花费');
  });
});

// ---------------------------------------------------------------------------
// K3: no tester events → formatWhy has no tester: line, no tester 花费 column
// ---------------------------------------------------------------------------

describe('K3: no tester events → formatting omits tester display', () => {
  const BATCH = 'v99-b01';
  const RUN = 'r-20261120-160000';
  const BATCH_RUN = 'r-20261120-170000';
  const Q_RUN = 'q-20261120-160000';

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

  function buildQueueData(): { allRunData: RunData[]; queueEvents: Event[] } {
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
        cost_usd: 1.0,
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

  it('K3: formatWhy text has no line starting with "tester:"', () => {
    const proj = projectWhy(runDataNoTester(), BATCH);
    expect(proj).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- checked above
    const text = formatWhy(proj!);
    const lines = text.split('\n');
    expect(lines.every((l) => !l.startsWith('tester:'))).toBe(true);
  });

  it('K3: formatReport text has no "tester 花费" when no tester events', () => {
    const { allRunData, queueEvents } = buildQueueData();
    const report = projectReport(allRunData, queueEvents, Q_RUN);
    const text = formatReport(report, new Map(), '(queue events)', '(none)');
    expect(text).not.toContain('tester 花费');
  });
});
