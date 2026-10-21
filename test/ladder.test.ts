// Unit tests for the signal ladder (SPEC 11.6) and liveness monitor (SPEC 11.5).
// Tests use injected delay and never wait real time (task constraint: <2s).
import { describe, expect, it } from 'vitest';
import { runLadder, type StopLevel } from '../src/ladder.js';
import type { RunHandle } from '../src/runner/index.js';

// ---- Helpers ----------------------------------------------------------------

interface FakeHandleResult {
  handle: RunHandle;
  stops: StopLevel[];
  exited: () => boolean;
  exitPromise: Promise<void>;
}

/** A handle that records stop() calls and optionally "exits" after a given level. */
function fakeHandle(exitAfter?: StopLevel): FakeHandleResult {
  const stops: StopLevel[] = [];
  let exitResolve: (() => void) | undefined;
  let exitedFlag = false;
  const exitPromise = new Promise<void>((r) => {
    exitResolve = r;
  });
  const handle: RunHandle = {
    pid: 1,
    // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise<void>
    async stop(level: StopLevel): Promise<void> {
      stops.push(level);
      if (exitAfter === level) {
        exitedFlag = true;
        exitResolve?.();
      }
    },
  };
  return {
    handle,
    stops,
    exited: () => exitedFlag,
    exitPromise,
  };
}

/** An instant delay that records requested durations. */
function instantDelay(): {
  delay: (ms: number) => Promise<void>;
  durations: number[];
} {
  const durations: number[] = [];
  return {
    delay: (ms: number) => {
      durations.push(ms);
      return Promise.resolve();
    },
    durations,
  };
}

// ---- Tests ------------------------------------------------------------------

describe('ladder: runLadder walks soft -> hard -> kill', () => {
  it('records all three levels with correct reason', async () => {
    const { handle, stops, exited, exitPromise } = fakeHandle();
    const signals: { level: StopLevel; reason: string }[] = [];
    const { delay, durations } = instantDelay();

    await runLadder({
      handle,
      graceSecs: 20,
      reason: 'wallclock',
      callbacks: {
        onSignaled: (level, reason) => {
          signals.push({ level, reason });
        },
      },
      isExited: exited,
      exitPromise,
      delay,
    });

    expect(stops).toEqual(['soft', 'hard', 'kill']);
    expect(signals).toEqual([
      { level: 'soft', reason: 'wallclock' },
      { level: 'hard', reason: 'wallclock' },
      { level: 'kill', reason: 'wallclock' },
    ]);
    // Two grace periods (after soft and after hard); none after kill.
    expect(durations).toEqual([20_000, 20_000]);
  });

  it('stops early when the worker exits during the grace period after soft', async () => {
    // The worker responds to soft: exit right away.
    const { handle, stops, exited, exitPromise } = fakeHandle('soft');
    const signals: { level: StopLevel; reason: string }[] = [];
    const { delay } = instantDelay();

    await runLadder({
      handle,
      graceSecs: 20,
      reason: 'idling',
      callbacks: {
        onSignaled: (level, reason) => {
          signals.push({ level, reason });
        },
      },
      isExited: exited,
      exitPromise,
      delay,
    });

    // Only soft was issued; the ladder checks isExited() before each next level.
    expect(stops).toEqual(['soft']);
    expect(signals).toEqual([{ level: 'soft', reason: 'idling' }]);
  });

  it('escalates to hard when the worker ignores soft', async () => {
    // Worker exits on hard.
    const { handle, stops, exited, exitPromise } = fakeHandle('hard');
    const signals: { level: StopLevel; reason: string }[] = [];
    const { delay, durations } = instantDelay();

    await runLadder({
      handle,
      graceSecs: 10,
      reason: 'stalled',
      callbacks: {
        onSignaled: (level, reason) => {
          signals.push({ level, reason });
        },
      },
      isExited: exited,
      exitPromise,
      delay,
    });

    expect(stops).toEqual(['soft', 'hard']);
    expect(signals).toEqual([
      { level: 'soft', reason: 'stalled' },
      { level: 'hard', reason: 'stalled' },
    ]);
    // One grace after soft; the race after hard fires delay but resolves
    // immediately (exitPromise already resolved).
    expect(durations).toEqual([10_000, 10_000]);
  });

  it('does nothing when the worker already exited before the ladder starts', async () => {
    const { handle, stops } = fakeHandle();
    const signals: { level: StopLevel; reason: string }[] = [];
    const { delay } = instantDelay();

    await runLadder({
      handle,
      graceSecs: 20,
      reason: 'wallclock',
      callbacks: {
        onSignaled: (level, reason) => {
          signals.push({ level, reason });
        },
      },
      isExited: () => true, // Already exited.
      exitPromise: Promise.resolve(),
      delay,
    });

    expect(stops).toEqual([]);
    expect(signals).toEqual([]);
  });

  it('uses the injected delay, not real setTimeout', async () => {
    const { handle, exited, exitPromise } = fakeHandle();
    const { delay, durations } = instantDelay();

    await runLadder({
      handle,
      graceSecs: 3600,
      reason: 'wallclock',
      callbacks: {
        onSignaled: () => {
          /* recorded elsewhere */
        },
      },
      isExited: exited,
      exitPromise,
      delay,
    });

    // Despite grace_secs=3600 (1 hour), the ladder completes instantly with the
    // injected delay. Real wall-clock time is not asserted (SPEC 11.5: no real
    // time assertions).
    expect(durations).toEqual([3_600_000, 3_600_000]);
  });
});
