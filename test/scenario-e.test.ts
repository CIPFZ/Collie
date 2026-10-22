// Scenario E (SPEC 11.9): fake worker writes files, then gets killed (effect
// calls handle.stop('kill')). Front half: rescue commit. Back half (v02-b05):
// attempt=2, interrupted_at, rescue_sha, base_sha reuse across attempts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import { batchHistory } from '../src/run.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

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

// ---------------------------------------------------------------------------
// Scenario E back half (v02-b05): attempt=2, interrupted_at, rescue_sha,
// base_sha reuse across attempts.
// ---------------------------------------------------------------------------

describe('scenario E back half: interrupt marking and base_sha reuse', () => {
  it('second run has attempt=2, interrupted_at, rescue_sha, and reuses the first base_sha', async () => {
    // --- Run 1: worker killed, rescue commit created ---
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Verify batchHistory after run 1.
    const h1 = batchHistory(box.root, BATCH);
    expect(h1.attempt).toBe(2);
    expect(h1.interruptedAt).toBeDefined();
    expect(h1.interruptedAt).toContain('run.finished');
    expect(h1.rescueSha).toMatch(/^[0-9a-f]{40}$/);
    const firstBaseSha = h1.baseSha;
    expect(firstBaseSha).toBeDefined();

    // --- Run 2: honest worker succeeds ---
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    const code2 = await box.run(r2);
    expect(code2).toBe(0);

    // The second run's events should include worker.resumed.
    const events = box.events();
    const resumed = events.filter((e) => e.event === 'worker.resumed');
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.attempt).toBe(2);

    // base_sha reuse (SPEC 4.3): both runs share the same base_sha.
    const selected = events.filter((e) => e.event === 'batch.selected');
    expect(selected).toHaveLength(2);
    expect(selected[0]?.base_sha).toBe(firstBaseSha);
    expect(selected[1]?.base_sha).toBe(firstBaseSha);
  });

  it('PASS run resets interrupt state; a third run starts fresh', async () => {
    // Run 1: killed → interrupted
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Run 2: honest PASS → resets
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r2)).toBe(0);

    // After PASS, interrupt context should be cleared.
    const h = batchHistory(box.root, BATCH);
    expect(h.interruptedAt).toBeUndefined();
    expect(h.rescueSha).toBeUndefined();
    // PASS does not reset attempt; a re-run of this batch would still be attempt 2.
    // In practice, passed batches are never re-run (SPEC 11.7).
    expect(h.attempt).toBe(2);
  });

  it('batch.task_written includes the interrupt section in the task body', async () => {
    // Run 1: killed
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Run 2: check the task.md content includes the interrupt section.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('## 上一轮中断');
    expect(taskContent).toContain('中断信息');
    expect(taskContent).toContain('救援提交');
  });
});
