// Scenario F (SPEC 11.7): resume strategy — when a batch is re-attempted after
// an interrupt, R2 decides whether to pass resumeSessionId based on resume_max.
// The 4th attempt (resume_max=2 by default) must NOT pass a session id.
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
 * A worker scene that returns a session_id in its RunResult so that the
 * resume strategy has something to hand back on the next attempt.
 */
function workerWithSession(sessionId: string): ReturnType<typeof workerScene> {
  return {
    expectRole: 'worker',
    effect: async ({ handle }: FakeSceneContext) => {
      // Simulate a kill mid-run, producing a non-PASS result.
      await handle.stop('kill');
    },
    result: { exitCode: 1, sessionId },
  };
}

describe('scenario F: resume_max gating (SPEC 11.7)', () => {
  it('passes resumeSessionId for the first two resumes but not the third', async () => {
    // Default resume_max in collie.toml template is 2.
    // Run 1: worker killed with session id → interrupted.
    const r1 = new FakeRunner([workerWithSession('sess-001')]);
    await box.run(r1);

    // After run 1: attempt=2, resume is eligible (count=0 < 2).
    const h1 = batchHistory(box.root, BATCH);
    expect(h1.attempt).toBe(2);
    expect(h1.lastSessionId).toBe('sess-001');
    expect(h1.resumeCount).toBe(0);

    // Run 2: resumes, gets killed again with a new session id.
    const r2 = new FakeRunner([workerWithSession('sess-002')]);
    await box.run(r2);

    // Verify that run 2 actually received the resumeSessionId.
    expect(r2.calls).toHaveLength(1);
    expect(r2.calls[0]?.resumeSessionId).toBe('sess-001');

    // After run 2: attempt=3, resume count=1, still eligible.
    const h2 = batchHistory(box.root, BATCH);
    expect(h2.attempt).toBe(3);
    expect(h2.lastSessionId).toBe('sess-002');
    expect(h2.resumeCount).toBe(1);

    // Run 3: resumes again (count=1 < 2).
    const r3 = new FakeRunner([workerWithSession('sess-003')]);
    await box.run(r3);
    expect(r3.calls[0]?.resumeSessionId).toBe('sess-002');

    // After run 3: attempt=4, resume count=2. Now at the limit.
    const h3 = batchHistory(box.root, BATCH);
    expect(h3.attempt).toBe(4);
    expect(h3.resumeCount).toBe(2);

    // Run 4: resume_max reached (2), no sessionId passed.
    const r4 = new FakeRunner([workerWithSession('sess-004')]);
    await box.run(r4);
    expect(r4.calls[0]?.resumeSessionId).toBeUndefined();
  });

  it('worker.resumed event carries the session_id and attempt number', async () => {
    // Run 1: killed with a session id.
    const r1 = new FakeRunner([workerWithSession('sess-abc')]);
    await box.run(r1);

    // Run 2: should record worker.resumed with the session id.
    const r2 = new FakeRunner([workerWithSession('sess-def')]);
    await box.run(r2);

    const events = box.events();
    const resumed = events.filter((e) => e.event === 'worker.resumed');
    expect(resumed).toHaveLength(1);
    expect(resumed[0]).toMatchObject({
      session_id: 'sess-abc',
      attempt: 2,
    });
  });

  it('worker.finished records session_id for future resume', async () => {
    // An honest worker that completes (PASS). The session_id should still be in worker.finished.
    const r = new FakeRunner([
      {
        expectRole: 'worker',
        effect: async ({ cwd }: FakeSceneContext) => {
          // Write feature and report like workerScene but also supply sessionId.
          box.write('feature.txt', 'feature\n', cwd);
          box.write('tests/t000.sh', 'exit 0\n', cwd);
          const head = await box.commitAll('feat: add feature with tests', cwd);
          const report = {
            schema_version: 1,
            batch_id: BATCH,
            head_sha: head,
            claims: { commits: [head], ...honestClaims(1, true) },
            open_questions: [],
          };
          box.write(
            `.collie/batches/${BATCH}/report.md`,
            `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`,
            cwd,
          );
          await box.commitAll(`report(collie): ${BATCH}`, cwd);
          const { git: gitFn } = await import('../src/git.js');
          await gitFn(cwd, ['push', '-q', 'origin', 'main']);
        },
        result: { exitCode: 0, sessionId: 'sess-pass' },
      },
      fooledReviewerScene(box),
    ]);
    await box.run(r);

    const events = box.events();
    const finished = events.find((e) => e.event === 'worker.finished');
    expect(finished?.session_id).toBe('sess-pass');
  });

  it('PASS run does not count as an interrupt; resume_count stays zero', async () => {
    // Run 1: PASS.
    const r1 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r1)).toBe(0);

    // After PASS, the history should show attempt=1 (not incremented), no interrupt.
    const h = batchHistory(box.root, BATCH);
    expect(h.attempt).toBe(1);
    expect(h.resumeCount).toBe(0);
    expect(h.interruptedAt).toBeUndefined();
    expect(h.lastSessionId).toBeUndefined();
  });

  it('does not resume when last run pushed code and only report is missing (v03-b03-fix)', async () => {
    // Run 1: worker pushes code, gets killed without writing report.
    // worker.finished is recorded, no worker.rescued (workspace clean).
    const workerPushNoReport: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd, handle }: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', cwd);
        box.write('tests/t000.sh', 'exit 0\n', cwd);
        await box.commitAll('feat: add feature with tests', cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);
        // Killed without writing report — workspace is clean.
        await handle.stop('kill');
      },
      result: { exitCode: 1, sessionId: 'sess-pushed-clean' },
    };
    const r1 = new FakeRunner([workerPushNoReport]);
    const code1 = await box.run(r1);
    expect(code1).toBe(20); // BLOCK: no report

    // History should show lastRunClean=true.
    const h = batchHistory(box.root, BATCH);
    expect(h.lastRunClean).toBe(true);
    expect(h.lastSessionId).toBe('sess-pushed-clean');

    // Run 2: should NOT receive resumeSessionId because the code is already
    // pushed and workspace was clean.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 1, failing: 0, push: true, claims: honestClaims(1, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    // The worker in run 2 should NOT have received resumeSessionId.
    expect(r2.calls[0]?.resumeSessionId).toBeUndefined();

    // The journal should contain a worker.resumed event with session_id=null
    // because resume was skipped but this is still attempt 2 (v03-b03-fix2).
    const events = box.events();
    const resumed = events.filter((e) => e.event === 'worker.resumed');
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.session_id).toBeNull();
  });
});
