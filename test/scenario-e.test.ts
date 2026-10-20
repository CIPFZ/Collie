// Scenario E front half (SPEC 11.9): fake worker writes files, then gets
// killed (effect calls handle.stop('kill')). Collie must: 1) leave a
// wip(collie) rescue commit with those files; 2) record a worker.rescued event.
// The second half (attempt=2, interrupted_at) is v02-b04.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import { BATCH, Sandbox } from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

/**
 * A worker scene that writes two files (dirtying the workspace) then kills
 * itself via the RunHandle (SPEC 11.9: "fake 以「写文件后 stop('kill') 自己」模拟").
 */
function killedWorkerScene(): FakeScene {
  return {
    expectRole: 'worker',
    files: {
      'dirty-a.txt': 'partial work A\n',
      'dirty-b.txt': 'partial work B\n',
    },
    effect: async ({ handle }: FakeSceneContext) => {
      // Simulate a kill mid-run. The RunHandle.stop('kill') causes the scene
      // to return with stopReason: 'stopped', and the dirty files remain.
      await handle.stop('kill');
    },
    // The result the scene would normally return; stop() overrides it with stopReason.
    result: { exitCode: 1 },
  };
}

describe('scenario E front half: worker killed, rescue commit created', () => {
  it('creates a wip(collie) rescue commit containing the dirty files', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    // The run escalates (worker didn't produce a report), but we care about the rescue.
    const code = await box.run(runner);
    // Escalated = BLOCK (exit 20).
    expect(code).toBe(20);

    // The HEAD commit should be the rescue commit (or a progress commit after it).
    const logOutput = await git(box.root, ['log', '--oneline', '-5']);
    expect(logOutput).toContain(`wip(collie): ${BATCH} rescue`);

    // The rescue commit must contain the two dirty files.
    // Find the rescue commit sha.
    const rescueLine = logOutput.split('\n').find((line) => line.includes('wip(collie):'));
    expect(rescueLine).toBeDefined();
    const rescueSha = rescueLine?.split(' ')[0] ?? '';
    const diffOutput = await git(box.root, [
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      rescueSha,
    ]);
    expect(diffOutput).toContain('dirty-a.txt');
    expect(diffOutput).toContain('dirty-b.txt');
  });

  it('records a worker.rescued event with sha and files', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);

    const events = box.events();
    const rescued = events.find((e) => e.event === 'worker.rescued');
    expect(rescued).toBeDefined();
    expect(rescued?.sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(rescued?.files).toEqual(expect.arrayContaining(['dirty-a.txt', 'dirty-b.txt']));
  });

  it('does not record worker.rescued when the workspace is clean', async () => {
    // A worker that commits everything and leaves a clean workspace.
    const cleanWorker: FakeScene = {
      expectRole: 'worker',
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    const runner = new FakeRunner([cleanWorker]);
    await box.run(runner);

    const events = box.events();
    expect(events.find((e) => e.event === 'worker.rescued')).toBeUndefined();
  });

  it('records the worker as finished with stop_reason', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);

    const events = box.events();
    const finished = events.find((e) => e.event === 'worker.finished');
    expect(finished).toBeDefined();
    expect(finished?.stop_reason).toBe('stopped');
  });
});

describe('scenario E: heartbeat lifecycle during a run', () => {
  it('heartbeat file does not exist after a normal run completes', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);
    // After the run, the heartbeat should be cleaned up.
    const fs = await import('node:fs');
    const path = await import('node:path');
    expect(fs.existsSync(path.join(box.root, '.collie', 'heartbeat.json'))).toBe(false);
  });
});
