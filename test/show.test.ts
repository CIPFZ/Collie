// collie show restores event chains for scenarios E, F, and G (SPEC 11.7).
// Each test runs 1-2 batches, then calls `collie show` and verifies the
// decision trail contains the expected event types.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
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

/** Collects the `collie show` output for the default batch. */
async function showOutput(): Promise<string> {
  box.output.length = 0;
  await box.cli(['show', BATCH], undefined);
  return box.output.join('');
}

describe('collie show: scenario E event chain (rescue + interrupt)', () => {
  it('shows worker.rescued and escalated events after a killed run', async () => {
    const killedWorker: ReturnType<typeof workerScene> = {
      expectRole: 'worker',
      files: { 'dirty.txt': 'partial\n' },
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    await box.run(new FakeRunner([killedWorker]));

    const out = await showOutput();
    expect(out).toContain('worker.rescued');
    expect(out).toContain('escalated');
    expect(out).toContain('run.finished');
  });

  it('shows worker.resumed in the second run after an interrupted first run', async () => {
    // Run 1: killed
    const r1 = new FakeRunner([
      {
        expectRole: 'worker',
        files: { 'dirty.txt': 'wip\n' },
        effect: async ({ handle }: FakeSceneContext) => {
          await handle.stop('kill');
        },
        result: { exitCode: 1, sessionId: 'sess-e1' },
      },
    ]);
    await box.run(r1);

    // Run 2: honest PASS
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const out = await showOutput();
    expect(out).toContain('worker.resumed');
    expect(out).toContain('session_id=sess-e1');
    expect(out).toContain('attempt=2');
  });
});

describe('collie show: scenario F event chain (resume strategy)', () => {
  it('shows resumed event with session_id from prior run', async () => {
    // Run 1: worker exits with session id
    const r1 = new FakeRunner([
      {
        expectRole: 'worker',
        effect: async ({ handle }: FakeSceneContext) => {
          await handle.stop('kill');
        },
        result: { exitCode: 1, sessionId: 'sess-f1' },
      },
    ]);
    await box.run(r1);

    // Run 2: uses the session id for resume
    const r2 = new FakeRunner([
      {
        expectRole: 'worker',
        effect: async ({ handle }: FakeSceneContext) => {
          await handle.stop('kill');
        },
        result: { exitCode: 1, sessionId: 'sess-f2' },
      },
    ]);
    await box.run(r2);

    const out = await showOutput();
    expect(out).toContain('worker.resumed');
    expect(out).toContain('sess-f1');
  });
});

describe('collie show: scenario G event chain (idle worker)', () => {
  it('shows worker.idling and worker.signaled for an idle worker', async () => {
    // Override progress_secs to 1s for quick idle detection.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);

    let t = 0;
    const idleWorker: ReturnType<typeof workerScene> = {
      expectRole: 'worker',
      events: [{ type: 'heartbeat' }],
      effect: async ({ stopped }: FakeSceneContext) => {
        // Wait until the signal ladder stops us.
        await stopped;
      },
      result: { exitCode: 1 },
    };
    const runner = new FakeRunner([idleWorker]);
    await box.run(runner, {
      ladderDelay: () => Promise.resolve(),
      livenessIntervalMs: 1,
      livenessNow: () => {
        t += 1;
        return t;
      },
      livenessFingerprint: () => Promise.resolve('unchanged'),
    });

    const out = await showOutput();
    expect(out).toContain('worker.idling');
    expect(out).toContain('worker.signaled');
    expect(out).toContain('run.finished');
  });
});

describe('collie show: 中断链 (interrupt chain section)', () => {
  it('shows 中断链 section with rescue_sha after an interrupted run', async () => {
    // Run 1: worker killed → generates run.orphaned + worker.rescued events.
    const killedWorker: ReturnType<typeof workerScene> = {
      expectRole: 'worker',
      files: { 'dirty.txt': 'partial\n' },
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1, sessionId: 'sess-chain1' },
    };
    await box.run(new FakeRunner([killedWorker]));

    const out = await showOutput();
    expect(out).toContain('== 中断链 ==');
    expect(out).toContain('worker.rescued');
  });

  it('omits 中断链 section when there are no interruptions', async () => {
    // A clean PASS run has no interrupt events → no 中断链 section.
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r)).toBe(0);

    const out = await showOutput();
    expect(out).not.toContain('中断链');
  });
});

describe('collie show: ci.resolved in a normal PASS run', () => {
  it('shows ci.resolved event when CI resolves successfully', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r)).toBe(0);

    const out = await showOutput();
    expect(out).toContain('ci.resolved');
    expect(out).toContain('conclusion=success');
  });
});

describe('collie show: tool.denied in journal and show output (v03-b03-fix2)', () => {
  it('tool.denied event from runner reaches the journal and collie show lists it', async () => {
    // A worker scene that emits a tool.denied event (simulating the PreToolUse hook
    // firing inside the runner) before completing normally.
    const r = new FakeRunner([
      {
        expectRole: 'worker',
        events: [
          {
            event: 'tool.denied',
            role: 'reviewer',
            tool: 'Bash',
            command: 'git push origin main',
            pattern: '^\\s*git\\s+push',
          },
        ],
        effect: async ({ cwd }: FakeSceneContext) => {
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
        result: { exitCode: 0 },
      },
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r)).toBe(0);

    // Journal must contain the tool.denied event.
    const events = box.events();
    const denied = events.find((e) => e.event === 'tool.denied');
    expect(denied).toBeDefined();
    expect(denied?.role).toBe('reviewer');
    expect(denied?.tool).toBe('Bash');
    expect(denied?.command).toBe('git push origin main');
    expect(denied?.pattern).toBe('^\\s*git\\s+push');

    // `collie show` must list the tool.denied section.
    const out = await showOutput();
    expect(out).toContain('tool.denied');
    expect(out).toContain('git push origin main');
  });
});
