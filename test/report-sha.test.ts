// SPEC 13.17: sha validation three-step, BLOCK rerun conclusion, runIdAt format.
// Uses Sandbox for real `collie run` invocations through the fake runner.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runIdAt } from '../src/cli.js';
import { git, revParse } from '../src/git.js';
import { EXIT_CODES } from '../src/run.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Report } from '../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

const FENCE = '```';

describe('report sha validation (SPEC 13.17)', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('non-existent 40-char head_sha → exit 20, escalated reason contains "does not resolve to a commit"', async () => {
    const fakeSha = 'dead' + '0'.repeat(36);
    const scene: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', cwd);
        await box.commitAll('feat: add feature', cwd);
        // Write a report with a non-existent sha.
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: fakeSha,
          claims: {
            commits: [fakeSha],
            ...honestClaims(0),
          },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# report\n\n## 做了什么\ndone\n\n## 测试结果\nok\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
      },
      result: { exitCode: 0 },
    };
    const runner = new FakeRunner([scene]);
    const code = await box.run(runner);
    expect(code).toBe(EXIT_CODES.BLOCK);

    const escalated = box.events().filter((e) => e.event === 'escalated');
    expect(escalated.length).toBeGreaterThanOrEqual(1);
    const reason = escalated[0]?.reason;
    expect(typeof reason).toBe('string');
    expect(reason as string).toContain('does not resolve to a commit');
  });

  it('head_sha exists but is not a descendant of base_sha → escalation with "is not a descendant"', async () => {
    // Create a commit on a detached branch that is not a descendant of base.
    // The base_sha is HEAD at the time of run, so we need a sha that resolves
    // but is not reachable from base. We create an orphan branch commit.
    const scene: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        // Create an orphan commit not reachable from main.
        await git(cwd, ['checkout', '--orphan', 'orphan-branch']);
        box.write('feature.txt', 'feature\n', cwd);
        await git(cwd, ['add', '-A']);
        await git(cwd, ['commit', '-q', '-m', 'orphan commit']);
        const orphanSha = await revParse(cwd, 'HEAD');

        // Switch back to main for the report.
        await git(cwd, ['checkout', 'main']);

        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: orphanSha,
          claims: { commits: [orphanSha], ...honestClaims(0) },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# report\n\n## 做了什么\ndone\n\n## 测试结果\nok\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
      },
      result: { exitCode: 0 },
    };
    const runner = new FakeRunner([scene]);
    const code = await box.run(runner);
    expect(code).toBe(EXIT_CODES.BLOCK);

    const escalated = box.events().filter((e) => e.event === 'escalated');
    expect(escalated.length).toBeGreaterThanOrEqual(1);
    const reason = typeof escalated[0]?.reason === 'string' ? escalated[0].reason : '';
    expect(reason).toContain('is not a descendant of base_sha');
  });

  it('BLOCK rerun task contains "上一轮结论：" and reason text, not "请从"', async () => {
    // Run 1: worker exits without report → BLOCK.
    const r1 = new FakeRunner([{ result: { exitCode: 0 } }]);
    const code1 = await box.run(r1);
    expect(code1).toBe(EXIT_CODES.BLOCK);

    // Run 2: check the task body.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('上一轮结论：');
    // The reason should mention "no valid report" (from the escalation).
    expect(taskContent).toContain('no valid report');
    // Must NOT contain the old git-log prompt.
    expect(taskContent).not.toContain('请从');
  });

  it('BLOCK rerun task interrupted_at contains "escalated"', async () => {
    // Run 1: no-report escalation → BLOCK.
    const r1 = new FakeRunner([{ result: { exitCode: 0 } }]);
    await box.run(r1);

    // Run 2: check the task frontmatter.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    // The interrupted_at line should contain 'escalated' (SPEC 13.17).
    expect(taskContent).toMatch(/interrupted_at:.*escalated/);
  });

  it('signal-ladder-killed run keeps the old interrupt section (control)', async () => {
    // A worker that stalls: it writes dirty files and then waits for the stop signal.
    // Uses ignoreSoft so the ladder reaches the hard/kill level and terminates.
    const abort = new AbortController();
    const stalledScene: FakeScene = {
      expectRole: 'worker',
      files: { 'dirty.txt': 'stalled\n' },
      ignoreSoft: true,
      effect: async ({ stopped }: FakeSceneContext) => {
        // Trigger the wallclock ladder after the worker has started.
        abort.abort();
        await stopped;
      },
      result: { exitCode: 1 },
    };

    const r1 = new FakeRunner([stalledScene]);
    await box.run(r1, {
      workerSignal: abort.signal,
      ladderDelay: () => Promise.resolve(),
    });

    // Verify the run ended with wallclock worker_stop_reason.
    const finished = box.events().find((e) => e.event === 'run.finished');
    expect(finished?.worker_stop_reason).toBe('wallclock');

    // Run 2: check the task body retains the old interrupt section (no conclusion).
    const r2 = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('## 上一轮中断');
    // Signal-ladder stop should NOT get the "上一轮结论" treatment.
    expect(taskContent).not.toContain('上一轮结论');
    // Should have the rescue or git-log fallback instead.
    expect(taskContent).toMatch(/救援提交|上一轮未留下救援提交/);
  });

  it('runIdAt produces r-YYYYMMDDHHMMSS without dash between date and time', () => {
    const id = runIdAt(new Date('2026-11-13T06:40:25.000Z'));
    // Must be 16 chars: r- + 14 digits.
    expect(id).toHaveLength(16);
    // No dash after the r- prefix.
    expect(id.slice(2)).not.toContain('-');
    // Correct value.
    expect(id).toBe('r-20261113064025');
  });

  it('non-existent commits[i] sha → exit 20, reason contains "commits[" and "does not resolve"', async () => {
    const realScene: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', cwd);
        const head = await box.commitAll('feat: add feature', cwd);
        // Write a report with a valid head_sha but a bad commits[0].
        const badCommitSha = 'bade' + '0'.repeat(36);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: head,
          claims: {
            commits: [badCommitSha],
            ...honestClaims(0),
          },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# report\n\n## 做了什么\ndone\n\n## 测试结果\nok\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
      },
      result: { exitCode: 0 },
    };
    const runner = new FakeRunner([realScene]);
    const code = await box.run(runner);
    expect(code).toBe(EXIT_CODES.BLOCK);

    const escalated = box.events().filter((e) => e.event === 'escalated');
    expect(escalated.length).toBeGreaterThanOrEqual(1);
    const reason = typeof escalated[0]?.reason === 'string' ? escalated[0].reason : '';
    expect(reason).toContain('commits[');
    expect(reason).toContain('does not resolve to a commit');
  });
});
