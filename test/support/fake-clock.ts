// Shared fake-clock helpers for liveness-monitor tests (SPEC 13.19).
// The clock is coupled with setTimer: before freeze, now() never advances;
// after freeze, each setTimer call advances the internal clock by its interval.

/**
 * Creates a fake liveness clock + setTimer pair (SPEC 13.19).
 *
 * - Before `isFrozen()` returns true: `now()` always returns the same value
 *   (time is standing still during real git I/O setup).
 * - After `isFrozen()` returns true: each `setTimer(cb, ms)` call advances
 *   the internal clock by `ms` before firing the callback via setImmediate.
 *
 * This prevents the old bug where `now()` auto-incremented on every call,
 * causing the monitor to falsely reach `stall_secs` during long setup phases.
 */
export function fakeLivenessClock(isFrozen: () => boolean): {
  now: () => number;
  setTimer: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
} {
  let t = 0;
  return {
    now: () => t,
    setTimer: (cb: () => void, ms: number): ReturnType<typeof setTimeout> => {
      if (isFrozen()) {
        t += ms;
      }
      setImmediate(cb);
      return undefined as unknown as ReturnType<typeof setTimeout>;
    },
  };
}

/** Near-instant delay that yields via microtasks, letting the worker effect
 *  react to stop() before the ladder escalates. Records requested durations. */
export function instantDelay(): {
  delay: (ms: number) => Promise<void>;
  durations: number[];
} {
  const durations: number[] = [];
  return {
    delay: async (ms: number) => {
      durations.push(ms);
      // Yield several times so the worker's stopped promise and cleanup can run.
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    },
    durations,
  };
}

/**
 * A controllable fingerprint for tests (SPEC 11.5, v02-b04-fix). Returns a new
 * value on each call (simulating file changes during setup) until freeze() is
 * called, after which it returns a constant (simulating idle — no file changes).
 * This lets the test control exactly when the liveness monitor sees "no progress".
 *
 * Resolves via Promise.resolve() (microtask). The check frequency is controlled
 * by the injected livenessSetTimer (setImmediate-based), not by this function.
 */
export function controllableFingerprint(): {
  livenessFingerprint: (root: string) => Promise<string>;
  freeze: () => void;
  unfreeze: () => void;
  isFrozen: () => boolean;
} {
  let counter = 0;
  let frozen = false;
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches LivenessConfig.fingerprint signature
    livenessFingerprint: async (_root: string): Promise<string> => {
      if (!frozen) counter++;
      await Promise.resolve();
      return `fp-${String(counter)}`;
    },
    freeze: () => {
      frozen = true;
    },
    unfreeze: () => {
      frozen = false;
      counter++; // bump so next call returns a new value
    },
    isFrozen: () => frozen,
  };
}
