// Scenario G (SPEC 11.9): idle worker — sends events but never changes files.
// The liveness monitor detects idle (fingerprint unchanged for progress_secs)
// and the signal ladder escalates. Tests use injected ladder delay so grace
// periods are instant, an injected now() so the monitor uses a fast fake clock,
// and progress_secs=1 so idle is detected quickly.
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

/** Near-instant delay that yields via microtasks, letting the worker effect
 *  react to stop() before the ladder escalates. Records requested durations. */
function instantDelay(): {
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
 * An idle worker scene: it commits code (to write a valid report), then emits
 * events in a loop without making further file changes. The liveness monitor
 * sees a frozen fingerprint and triggers the ladder.
 */
function idleWorkerScene(opts: { ignoreSoft?: boolean } = {}): FakeRunner {
  return new FakeRunner([
    {
      expectRole: 'worker',
      ignoreSoft: opts.ignoreSoft,
      effect: async (ctx: FakeSceneContext) => {
        // Commit code and report so the run can proceed.
        const featurePath = join(ctx.cwd, 'feature.txt');
        mkdirSync(dirname(featurePath), { recursive: true });
        writeFileSync(featurePath, 'feature\n');
        await git(ctx.cwd, ['add', '-A']);
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
        await git(ctx.cwd, ['add', '-A']);
        await git(ctx.cwd, ['commit', '-q', '-m', `report(collie): ${BATCH}`]);

        // Now enter the "idle" phase: emit events but don't change files.
        // The liveness monitor will detect the frozen fingerprint.
        // Events are emitted synchronously; the fake clock in the liveness
        // monitor advances fast enough to detect idle without real timers.
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
    const runner = idleWorkerScene();
    const { delay } = instantDelay();
    const clock = fakeClock();
    const exitCode = await box.run(runner, {
      ladderDelay: delay,
      livenessIntervalMs: 50,
      livenessNow: clock.now,
      livenessSetTimer: fakeSetTimer,
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
    const runner = idleWorkerScene({ ignoreSoft: true });
    const { delay } = instantDelay();
    const clock = fakeClock();
    const exitCode = await box.run(runner, {
      ladderDelay: delay,
      livenessIntervalMs: 50,
      livenessNow: clock.now,
      livenessSetTimer: fakeSetTimer,
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
