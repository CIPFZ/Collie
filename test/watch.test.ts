// Tests for collie watch (SPEC 13.5, v04-b05).
// Covers: --once, following to run.finished, following to queue.finished,
// waiting for a new run, timeout, stall annotation.
// No real timers: the clock and sleep are injected, and sleep advances the clock.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Event } from '../src/schema/index.js';
import { loadRuns } from '../src/view.js';
import { watch, type WatchDeps } from '../src/watch.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH = 'v99-b01';
const RUN_ID = 'r-20261020-120000';
const QUEUE_RUN = 'q-20261020-120000';
const T0 = '2026-10-20T12:00:00Z';

/** A clock that only moves when the injected sleep says so. */
interface FakeTime {
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  advance: (ms: number) => void;
}

function fakeTime(start = T0): FakeTime {
  let ms = Date.parse(start);
  return {
    now: () => new Date(ms),
    sleep: (delta) => {
      ms += delta;
      return Promise.resolve();
    },
    advance: (delta) => {
      ms += delta;
    },
  };
}

function makeEvent(partial: Partial<Event> & { run_id: string; event: string }): Event {
  return { ts: T0, ...partial };
}

function writeJournal(root: string, runId: string, events: Event[]): void {
  const dir = join(root, '.collie', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'events.ndjson'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

/** Rewrites a journal wholesale: each poll of `loadRuns` sees the latest content. */
function rewriteJournal(root: string, runId: string, events: Event[]): void {
  writeJournal(root, runId, events);
}

interface Harness {
  run: (overrides?: Partial<WatchDeps>) => Promise<number>;
  output: () => string;
  lines: () => string[];
  time: FakeTime;
}

function harness(root: string, time = fakeTime()): Harness {
  const chunks: string[] = [];
  return {
    output: () => chunks.join(''),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter((l) => l !== ''),
    time,
    run: (overrides = {}) =>
      watch({
        root,
        once: false,
        intervalSecs: 2,
        timeoutSecs: null,
        stallSecs: 300,
        now: time.now,
        sleep: time.sleep,
        load: loadRuns,
        out: (t) => chunks.push(t),
        ...overrides,
      }),
  };
}

const STARTED = makeEvent({ run_id: RUN_ID, event: 'run.started', batch_id: BATCH });
const WORKER_STARTED = makeEvent({
  run_id: RUN_ID,
  event: 'worker.started',
  batch_id: BATCH,
  ts: '2026-10-20T12:00:05Z',
});
const FINISHED = makeEvent({
  run_id: RUN_ID,
  event: 'run.finished',
  batch_id: BATCH,
  ts: '2026-10-20T12:05:00Z',
  verdict: 'PASS',
  exit_code: 0,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('watch (SPEC 13.5)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'watch-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('--once prints the current frame and exits without sleeping', async () => {
    writeJournal(root, RUN_ID, [STARTED, WORKER_STARTED]);
    const h = harness(root);
    const slept: number[] = [];
    const code = await h.run({
      once: true,
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
    });
    expect(code).toBe(0);
    expect(slept).toEqual([]);
    expect(h.output()).toContain('== current ==');
    expect(h.output()).toContain(`running: ${BATCH} (${RUN_ID})`);
    expect(h.output()).toContain('phase worker');
  });

  it('--once on an empty root prints no runs recorded', async () => {
    const h = harness(root);
    expect(await h.run({ once: true })).toBe(0);
    expect(h.output()).toContain('no runs recorded');
  });

  it('follows a batch run and exits on run.finished', async () => {
    writeJournal(root, RUN_ID, [STARTED]);
    const h = harness(root);
    let polls = 0;
    const code = await h.run({
      load: (r) => {
        polls++;
        // Second poll: worker.started appears; third poll: run.finished.
        if (polls === 2) rewriteJournal(r, RUN_ID, [STARTED, WORKER_STARTED]);
        if (polls === 3) rewriteJournal(r, RUN_ID, [STARTED, WORKER_STARTED, FINISHED]);
        return loadRuns(r);
      },
    });
    expect(code).toBe(0);
    const lines = h.lines();
    expect(lines.some((l) => l.includes('worker.started'))).toBe(true);
    expect(lines.some((l) => l.includes('run.finished') && l.includes('verdict=PASS'))).toBe(true);
    // Phase change worker.started prints a current frame.
    expect(h.output()).toContain('phase worker');
    // Terminal frame reflects the finished run.
    expect(h.output()).toContain('idle (last:');
    expect(polls).toBe(3);
  });

  it('follows a queue run and exits on queue.finished', async () => {
    const queueStarted = makeEvent({ run_id: QUEUE_RUN, event: 'run.started' });
    const batchStarted = makeEvent({
      run_id: QUEUE_RUN,
      event: 'queue.batch_started',
      batch_id: BATCH,
      batch_run_id: RUN_ID,
      attempt: 1,
      why: 'new',
      ts: '2026-10-20T12:00:01Z',
    });
    const queueFinished = makeEvent({
      run_id: QUEUE_RUN,
      event: 'queue.finished',
      reason: 'exhausted',
      batches: [{ batch_id: BATCH, run_id: RUN_ID, verdict: 'PASS' }],
      paused_count: 0,
      ts: '2026-10-20T12:10:00Z',
    });
    writeJournal(root, QUEUE_RUN, [queueStarted]);
    writeJournal(root, RUN_ID, [STARTED, FINISHED]);

    const h = harness(root);
    let polls = 0;
    const code = await h.run({
      load: (r) => {
        polls++;
        if (polls === 2) rewriteJournal(r, QUEUE_RUN, [queueStarted, batchStarted]);
        if (polls === 3) rewriteJournal(r, QUEUE_RUN, [queueStarted, batchStarted, queueFinished]);
        return loadRuns(r);
      },
    });
    expect(code).toBe(0);
    expect(h.output()).toContain('queue.batch_started');
    expect(h.output()).toContain('queue.finished');
    expect(h.output()).toContain(`idle (last: ${RUN_ID} PASS)`);
    expect(polls).toBe(3);
  });

  it('waits for a new run when nothing is in progress', async () => {
    const h = harness(root);
    let polls = 0;
    const code = await h.run({
      load: (r) => {
        polls++;
        // Poll 1 is the startup snapshot (empty); the run appears at poll 2.
        if (polls === 2) rewriteJournal(r, RUN_ID, [STARTED]);
        if (polls === 3) rewriteJournal(r, RUN_ID, [STARTED, FINISHED]);
        return loadRuns(r);
      },
    });
    expect(code).toBe(0);
    expect(h.output()).toContain('waiting for a new run');
    const lines = h.lines();
    // The run that appeared after startup is printed in full, from run.started.
    expect(lines.some((l) => l.includes('run.started'))).toBe(true);
    expect(lines.some((l) => l.includes('run.finished'))).toBe(true);
    expect(polls).toBe(3);
  });

  it('exits 0 when --timeout elapses with no run', async () => {
    const h = harness(root);
    const code = await h.run({ timeoutSecs: 3, intervalSecs: 1 });
    expect(code).toBe(0);
    // It did wait (at least one poll) but returned on the timeout.
    expect(h.output()).toContain('waiting for a new run');
  });

  it('marks the silent seconds when no event arrives past stall_secs', async () => {
    writeJournal(root, RUN_ID, [STARTED]);
    const h = harness(root);
    let polls = 0;
    const code = await h.run({
      stallSecs: 5,
      intervalSecs: 4,
      timeoutSecs: 100,
      load: (r) => {
        polls++;
        // Nothing new ever arrives; the timeout ends the watch.
        if (polls >= 3) h.time.advance(100_000);
        return loadRuns(r);
      },
    });
    expect(code).toBe(0);
    expect(h.output()).toMatch(/silent \d+s/);
  });
});
