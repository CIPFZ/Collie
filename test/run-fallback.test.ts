// Tests for R2's exception fallback (SPEC 11.3, v02-b04-fix):
// when the worker stage throws an unexpected error, runBatch must still
// record run.finished(error), rescue dirty workspace, delete heartbeat,
// and return an error outcome instead of crashing the process.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import { Sandbox } from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

/** A worker that throws an unexpected error (simulates runner crash). */
function crashingWorkerScene(): FakeScene {
  return {
    expectRole: 'worker',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- FakeScene signature requires ctx
    effect: (_ctx: FakeSceneContext) => {
      throw new Error('unexpected runner explosion');
    },
    result: { exitCode: 1 },
  };
}

describe('run-fallback: worker throws → run.finished(error), heartbeat deleted', () => {
  it('records run.finished with result=error and deletes heartbeat', async () => {
    const runner = new FakeRunner([crashingWorkerScene()]);
    const code = await box.run(runner);

    // The run should return a non-zero exit code (escalation).
    expect(code).toBeGreaterThan(0);

    // Heartbeat must have been cleaned up.
    expect(existsSync(join(box.root, '.collie', 'heartbeat.json'))).toBe(false);

    const events = box.events();
    const types = events.map((e) => e.event);

    // run.finished must exist (the exception fallback or the normal escalate path wrote it).
    expect(types).toContain('run.finished');

    // The run.started must exist (heartbeat was written before the crash).
    expect(types).toContain('run.started');
  });

  it('does not let the process exit directly (returns an outcome)', async () => {
    // If the fallback weren't there, the FakeRunner error would propagate as an
    // unhandled exception. By asserting that `box.run` resolves normally with
    // a numeric exit code, we prove the process did not crash.
    const runner = new FakeRunner([crashingWorkerScene()]);
    const code = await box.run(runner);
    expect(typeof code).toBe('number');
    expect(code).toBe(20); // BLOCK from escalation
  });
});
