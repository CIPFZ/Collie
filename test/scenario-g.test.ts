// Scenario G (SPEC 11.9): idle worker — sends events but never changes files.
// The liveness monitor detects idle (fingerprint unchanged for progress_secs)
// and the signal ladder escalates. Tests use injected ladder delay so grace
// periods are instant, an injected now() so the monitor uses a fast fake clock,
// an injected fingerprint so no real git subprocess is needed, and progress_secs=1
// so idle is detected quickly.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git, revParse } from '../src/git.js';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import { BATCH, Sandbox } from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
  // Override progress_secs to 1s so idle detection fires quickly.
  const toml = box
    .read('.collie/collie.toml')
    .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
  box.write('.collie/collie.toml', toml);
});

afterEach(() => {
  box.dispose();
});

/**
 * A fake monotonic clock for the liveness monitor (SPEC 11.5). Each call to
 * now() advances time by `stepMs`, ensuring the monitor sees enough elapsed
 * time for idle detection without relying on real wall-clock delays.
 */
function fakeClock(stepMs = 200): { now: () => number } {
  let t = 0;
  return {
    now: () => {
      t += stepMs;
      return t;
    },
  };
}

/** Near-instant delay that yields to the macrotask queue, letting the worker's
 *  async completion chain settle before the ladder proceeds. Records requested
 *  durations. Uses setTimeout(0) instead of bare microtask yields so the test
 *  does not depend on microtask ordering (SPEC 11.5: "不依赖事件循环时序"). */
function instantDelay(): {
  delay: (ms: number) => Promise<void>;
  durations: number[];
} {
  const durations: number[] = [];
  return {
    delay: async (ms: number) => {
      durations.push(ms);
      // Yield to the macrotask queue: all pending microtasks (including the
      // worker's stopped → RunResult → cleanupTimers chain) settle first.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    },
    durations,
  };
}

/**
 * A fake setTimer for the liveness monitor that fires callbacks via the microtask
 * queue instead of real timers (SPEC 11.5). The returned handle is inert
 * (clearTimeout on it is a no-op), but the monitor's own `stopped` flag
 * prevents stale callbacks from doing work.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ms is intentionally unused; the fake fires immediately
function fakeSetTimer(cb: () => void, _ms: number): ReturnType<typeof setTimeout> {
  void Promise.resolve().then(() => {
    cb();
  });
  return undefined as unknown as ReturnType<typeof setTimeout>;
}

/**
 * A controllable fake fingerprint for the liveness monitor (SPEC 11.5).
 * While `frozen` is false, every call returns a unique value (simulating
 * progress). When `frozen` is true, the value stays constant (simulating idle).
 * No real git subprocess is involved, and no event loop timing dependency exists.
 */
function fakeFingerprint(): {
  fingerprint: () => Promise<string>;
  /** Set to true to freeze the fingerprint value, simulating idle. */
  frozen: boolean;
} {
  let counter = 0;
  let frozenValue: string | undefined;
  const state = { frozen: false };
  return {
    fingerprint: () => {
      if (state.frozen) {
        frozenValue ??= `frozen-${String(counter)}`;
        return Promise.resolve(frozenValue);
      }
      return Promise.resolve(`progress-${String(counter++)}`);
    },
    get frozen() {
      return state.frozen;
    },
    set frozen(v: boolean) {
      state.frozen = v;
      if (!v) frozenValue = undefined;
    },
  };
}

/**
 * An idle worker scene: it commits code (to write a valid report), changing the
 * fake fingerprint between each git operation to signal progress. Then it emits
 * events in a loop without changing the fingerprint (frozen). The liveness
 * monitor sees a frozen fingerprint and triggers the ladder. All timing is
 * driven by the injected fake clock, fingerprint and setTimer — no dependency on
 * real subprocesses or event loop ordering.
 */
function idleWorkerScene(
  fp: { frozen: boolean },
  opts: { ignoreSoft?: boolean } = {},
): FakeRunner {
  return new FakeRunner([
    {
      expectRole: 'worker',
      ignoreSoft: opts.ignoreSoft,
      effect: async (ctx: FakeSceneContext) => {
        // ---- Commit phase: fingerprint auto-increments (frozen=false) ----

        const featurePath = join(ctx.cwd, 'feature.txt');
        mkdirSync(dirname(featurePath), { recursive: true });
        writeFileSync(featurePath, 'feature\n');

        ctx.opts.onEvent?.({ type: 'assistant', message: 'staging' });
        await git(ctx.cwd, ['add', '-A']);

        ctx.opts.onEvent?.({ type: 'assistant', message: 'committing' });
        await git(ctx.cwd, ['commit', '-q', '-m', 'feat: add feature']);

        const sha = await revParse(ctx.cwd, 'HEAD');

        // Write report.md
        const reportDir = join(ctx.cwd, '.collie', 'batches', BATCH);
        mkdirSync(reportDir, { recursive: true });
        const report = JSON.stringify(
          {
            schema_version: 1,
            batch_id: BATCH,
            head_sha: sha,
            claims: {
              commits: [sha],
              tests_passed: 0,
              tests_failed: 0,
              pushed: false,
              ci_passed: false,
              new_deps: [],
              spec_touched: false,
            },
            open_questions: [],
          },
          null,
          2,
        );
        writeFileSync(
          join(reportDir, 'report.md'),
          `# Report\n\n## What\nDone.\n\n## Tests\nN/A.\n\n## Deviations\nNone.\n\n## Next\nNone.\n\n\`\`\`json\n${report}\n\`\`\`\n`,
        );

        ctx.opts.onEvent?.({ type: 'assistant', message: 'writing report' });
        await git(ctx.cwd, ['add', '-A']);

        ctx.opts.onEvent?.({ type: 'assistant', message: 'committing report' });
        await git(ctx.cwd, ['commit', '-q', '-m', `report(collie): ${BATCH}`]);

        // ---- Idle phase: freeze fingerprint, emit events without changing it ----
        fp.frozen = true;

        for (let i = 0; i < 10; i++) {
          ctx.opts.onEvent?.({ type: 'assistant', message: 'still thinking...' });
        }

        // Wait for the ladder to stop us.
        await ctx.stopped;
      },
      result: { exitCode: 0 },
    },
  ]);
}

describe('scenario G: idle worker detected by liveness monitor (SPEC 11.5, 11.6)', () => {
  it('detects idle, sends soft, worker responds → no rescue needed', async () => {
    const fp = fakeFingerprint();
    const runner = idleWorkerScene(fp);
    const { delay } = instantDelay();
    const clock = fakeClock();
    const exitCode = await box.run(runner, {
      ladderDelay: delay,
      livenessIntervalMs: 50,
      livenessNow: clock.now,
      livenessSetTimer: fakeSetTimer,
      livenessFingerprint: fp.fingerprint,
    });

    // Exit code 20 (BLOCK) because the escalation path fires.
    expect(exitCode).toBe(20);

    const events = box.events();
    const types = events.map((e) => e.event);

    // worker.idling was detected.
    expect(types).toContain('worker.idling');
    // worker.signaled(soft) was sent.
    expect(events.find((e) => e.event === 'worker.signaled')).toMatchObject({
      level: 'soft',
      reason: 'idling',
    });
    // Worker responded to soft, so no hard/kill were needed.
    const signaled = events.filter((e) => e.event === 'worker.signaled');
    expect(signaled).toHaveLength(1);
    expect(signaled[0]).toMatchObject({ level: 'soft', reason: 'idling' });

    // No rescue: workspace was clean (worker committed before going idle).
    expect(types).not.toContain('worker.rescued');
  });

  it('does not respond to soft → ladder escalates to hard and kill', async () => {
    const fp = fakeFingerprint();
    const runner = idleWorkerScene(fp, { ignoreSoft: true });
    const { delay } = instantDelay();
    const clock = fakeClock();
    const exitCode = await box.run(runner, {
      ladderDelay: delay,
      livenessIntervalMs: 50,
      livenessNow: clock.now,
      livenessSetTimer: fakeSetTimer,
      livenessFingerprint: fp.fingerprint,
    });

    expect(exitCode).toBe(20);

    const events = box.events();
    const types = events.map((e) => e.event);

    expect(types).toContain('worker.idling');

    // The full ladder: soft → hard → kill.
    const signaled = events.filter((e) => e.event === 'worker.signaled');
    expect(signaled.length).toBeGreaterThanOrEqual(2);
    expect(signaled[0]).toMatchObject({ level: 'soft', reason: 'idling' });
    expect(signaled[1]).toMatchObject({ level: 'hard', reason: 'idling' });
  });
});
