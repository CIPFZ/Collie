// SPEC 13.17 / 13.21: sha validation three-step, unresolvable sha → FIX with
// claim.mismatch, BLOCK rerun conclusion, runIdAt format, --continue fix_retry.
// Uses Sandbox for real `collie run` invocations through the fake runner.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
  TEST_CMD,
  workerScene,
} from './support/sandbox.js';

const FENCE = '```';

describe('report sha validation (SPEC 13.17 / 13.21)', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  // -----------------------------------------------------------------------
  // SPEC 13.21: unresolvable sha → FIX (not BLOCK), claim.mismatch journal
  // -----------------------------------------------------------------------

  it('non-existent 40-char head_sha → exit 10 FIX, claim.mismatch with actual=unresolvable, no reviewer.started or escalated', async () => {
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
    // SPEC 13.21: FIX, not BLOCK.
    expect(code).toBe(EXIT_CODES.FIX);

    const events = box.events();
    // claim.mismatch events with actual=unresolvable.
    const mismatches = events.filter((e) => e.event === 'claim.mismatch');
    expect(mismatches.length).toBeGreaterThanOrEqual(1);
    const headMismatch = mismatches.find((e) => e.field === 'head_sha');
    expect(headMismatch).toBeDefined();
    expect(headMismatch?.claimed).toBe(fakeSha);
    expect(headMismatch?.actual).toBe('unresolvable');

    // No reviewer should have started (SPEC 13.21: no reviewer, no CI, no acceptance).
    const reviewerStarted = events.filter((e) => e.event === 'reviewer.started');
    expect(reviewerStarted).toHaveLength(0);

    // No escalated events — this is FIX, not BLOCK escalation.
    const escalated = events.filter((e) => e.event === 'escalated');
    expect(escalated).toHaveLength(0);

    // run.finished should record FIX verdict.
    const finished = events.findLast((e) => e.event === 'run.finished');
    expect(finished?.verdict).toBe('FIX');
  });

  it('non-existent commits[i] sha → exit 10 FIX, claim.mismatch for commits[0]', async () => {
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
    // SPEC 13.21: FIX, not BLOCK.
    expect(code).toBe(EXIT_CODES.FIX);

    const mismatches = box.events().filter((e) => e.event === 'claim.mismatch');
    expect(mismatches.length).toBeGreaterThanOrEqual(1);
    const commitMismatch = mismatches.find(
      (e) => typeof e.field === 'string' && e.field.startsWith('commits['),
    );
    expect(commitMismatch).toBeDefined();
    expect(commitMismatch?.actual).toBe('unresolvable');
  });

  // -----------------------------------------------------------------------
  // Steps 2+3 still BLOCK (not a descendant / not an ancestor)
  // -----------------------------------------------------------------------

  it('head_sha exists but is not a descendant of base_sha → escalation with "is not a descendant", exit 20', async () => {
    // Create a commit on a detached branch that is not a descendant of base.
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

  // -----------------------------------------------------------------------
  // BLOCK rerun task (SPEC 13.17)
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // SPEC 13.21: --continue: bad sha FIX → fix_retry → PASS, queue continues
  // -----------------------------------------------------------------------

  it('--continue: 1st run bad sha FIX, 2nd run good sha PASS; queue.batch_started.why=fix_retry, task contains 声称不符', async () => {
    // Set up a single-batch backlog with status=pending for --continue.
    const backlog = `# backlog

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | ${BATCH} | 示例功能 | — | pending |

## ${BATCH} 示例功能

优先级：1 依赖：无

条目：
1. 实现 feature.txt 并补测试

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |
| 功能文件存在 | \`test -f feature.txt\` | exit 0 |
`;
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: set batch to pending');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    let runCount = 0;
    const fakeSha = 'dead' + '0'.repeat(36);

    // Scene 1 (worker): writes bad sha in report → FIX
    const badShaScene: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        runCount++;
        box.write('feature.txt', `feature v${String(runCount)}\n`, cwd);
        box.write('tests/t000.sh', 'exit 0\n', cwd);
        box.write('tests/t001.sh', 'exit 0\n', cwd);
        await box.commitAll(`feat: add feature run ${String(runCount)}`, cwd);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: fakeSha,
          claims: { commits: [fakeSha], ...honestClaims(0) },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# report\n\n## 做了什么\ndone\n\n## 测试结果\nok\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);
      },
      result: { exitCode: 0 },
    };

    // Scene 2 (worker): writes correct sha → will pass
    const goodScene = workerScene(box, {
      passing: 2,
      failing: 0,
      push: true,
      claims: honestClaims(2, true),
    });
    // Scene 3 (reviewer): pass
    const reviewerScene = fooledReviewerScene(box);

    const runner = new FakeRunner([badShaScene, goodScene, reviewerScene]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(EXIT_CODES.PASS);

    const events = box.events();

    // Verify first run got FIX.
    const finishedEvents = events.filter((e) => e.event === 'run.finished');
    expect(finishedEvents.length).toBeGreaterThanOrEqual(2);
    expect(finishedEvents[0]?.verdict).toBe('FIX');
    expect(finishedEvents[1]?.verdict).toBe('PASS');

    // Verify queue.batch_started with why=fix_retry for the second run.
    const batchStarted = events.filter((e) => e.event === 'queue.batch_started');
    expect(batchStarted.length).toBeGreaterThanOrEqual(2);
    expect(batchStarted[1]?.why).toBe('fix_retry');

    // Verify the task.md for the second run contains 声称不符.
    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('声称不符');
  });

  // -----------------------------------------------------------------------
  // SPEC 13.21: stale verdict.md from earlier run is not used
  // -----------------------------------------------------------------------

  it('stale verdict.md from earlier run is not referenced in FIX task when no reviewer.verdict', async () => {
    // Run 1: normal run that produces a verdict.md (PASS).
    const r1 = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r1);

    // Confirm verdict.md exists from the first run.
    const verdictExists = existsSync(join(box.root, '.collie', 'batches', BATCH, 'verdict.md'));
    expect(verdictExists).toBe(true);

    // Run 2: worker writes unresolvable sha → FIX (no reviewer runs).
    const fakeSha = 'aaaa' + '0'.repeat(36);
    const badScene: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        box.write('feature2.txt', 'feature2\n', cwd);
        await box.commitAll('feat: add feature2', cwd);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: fakeSha,
          claims: { commits: [fakeSha], ...honestClaims(0) },
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
    const r2 = new FakeRunner([badScene]);
    const code2 = await box.run(r2);
    expect(code2).toBe(EXIT_CODES.FIX);

    // Run 3: the FIX rerun task should not have gaps from the first run's verdict.
    const r3 = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r3);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    // Should have 声称不符 section but NOT Gaps from the first run.
    expect(taskContent).toContain('声称不符');
    // The first run's reviewer said "the report looks complete" - that should not appear.
    expect(taskContent).not.toContain('the report looks complete');
  });

  // -----------------------------------------------------------------------
  // Consecutive bad sha exceeds fix_max → exit 20
  // -----------------------------------------------------------------------

  it('--continue: consecutive unresolvable sha exceeding fix_max → exit 20', async () => {
    // Set up a single-batch backlog with status=pending.
    const backlog = `# backlog

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | ${BATCH} | 示例功能 | — | pending |

## ${BATCH} 示例功能

优先级：1 依赖：无

条目：
1. 实现 feature.txt 并补测试

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |
| 功能文件存在 | \`test -f feature.txt\` | exit 0 |
`;
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: set batch to pending');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // fix_max defaults to 2, so we need 3 bad scenes (1 original + 2 retries = 3 total).
    let seq = 0;
    const makeBadScene = (): FakeScene => ({
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        seq++;
        const badSha = `bad${String(seq)}` + '0'.repeat(36);
        box.write('feature.txt', `v${String(seq)}\n`, cwd);
        await box.commitAll(`feat: v${String(seq)}`, cwd);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: badSha.slice(0, 40),
          claims: { commits: [badSha.slice(0, 40)], ...honestClaims(0) },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# report\n\n## 做了什么\ndone\n\n## 测试结果\nok\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);
      },
      result: { exitCode: 0 },
    });

    // fix_max=2 means 1 original + 2 retries = 3 worker scenes needed.
    const runner = new FakeRunner([makeBadScene(), makeBadScene(), makeBadScene()]);
    const code = await box.cli(['run', '--continue'], runner);
    // fix_max exceeded → exit 20 (BLOCK).
    expect(code).toBe(EXIT_CODES.BLOCK);

    const events = box.events();
    // All three runs should be FIX.
    const fixFinished = events.filter((e) => e.event === 'run.finished' && e.verdict === 'FIX');
    expect(fixFinished).toHaveLength(3);

    // Queue should have escalated with fix_max reason.
    const escalated = events.filter(
      (e) => e.event === 'escalated' && typeof e.reason === 'string' && e.reason === 'fix_max',
    );
    expect(escalated).toHaveLength(1);
  });
});
