// Acceptance tests for v046-b36 — [新] scenarios S1–S3.
// disputed_tests: a worker can dispute acceptance tests in its report JSON.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import { git } from '../../../src/git.js';
import { BATCH, fooledReviewerScene, Sandbox } from '../../support/sandbox.js';

// Module path for dynamic import (ReportSchema may gain disputed_tests).
const SCHEMA_MODULE = '../../../src/schema/index.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers: build a report JSON with disputed_tests
// ---------------------------------------------------------------------------

/** Builds a report-shaped object with disputed_tests (untyped to bypass strict). */
function reportWithDisputed(
  batchId: string,
  headSha: string,
  disputedTests: unknown[],
): Record<string, unknown> {
  return {
    schema_version: 1,
    batch_id: batchId,
    head_sha: headSha,
    claims: {
      commits: [headSha],
      tests_passed: 1,
      tests_failed: 0,
      pushed: true,
      ci_passed: false,
      new_deps: [],
      spec_touched: false,
    },
    open_questions: [],
    disputed_tests: disputedTests,
  };
}

/** A fake worker scene that commits code and writes a report with disputed_tests. */
function workerWithDisputedScene(box: Sandbox, disputedTests: unknown[]): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature with tests', cwd);
      const report = reportWithDisputed(BATCH, head, disputedTests);
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

// ---------------------------------------------------------------------------
// S1: ReportSchema accepts disputed_tests with one valid item
// ---------------------------------------------------------------------------

describe('S1: ReportSchema accepts disputed_tests', () => {
  it('S1: parsing a report with one valid disputed_tests item succeeds and preserves data', async () => {
    const mod = (await import(SCHEMA_MODULE)) as unknown as {
      ReportSchema: { safeParse: (data: unknown) => { success: boolean; data?: unknown } };
    };

    const input = reportWithDisputed('v99-b01', 'abcdef1234567', [
      {
        test: 'test/acceptance/v99-b01/new.test.ts: S1: x',
        why: '情形要的是 A，测试断言的是 B',
      },
    ]);

    const result = mod.ReportSchema.safeParse(input);
    expect(result.success).toBe(true);

    // Verify the disputed_tests item is preserved in the parsed output.
    const data = result.data as {
      disputed_tests?: { test: string; why: string }[];
    };
    expect(data.disputed_tests).toBeDefined();
    expect(data.disputed_tests).toHaveLength(1);

    const items = data.disputed_tests ?? [];
    const item = items[0];
    expect(item).toBeDefined();
    expect(item?.test).toBe('test/acceptance/v99-b01/new.test.ts: S1: x');
    expect(item?.why).toBe('情形要的是 A，测试断言的是 B');
  });
});

// ---------------------------------------------------------------------------
// S2: single-batch run, worker report has disputed_tests → escalated
// ---------------------------------------------------------------------------

describe('S2: disputed_tests triggers escalation with acceptance_disputed', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S2: escalated event reason starts with acceptance_disputed and contains S1: x, has disputed array; progress has worker message', async () => {
    const disputed = [
      {
        test: 'test/acceptance/v99-b01/new.test.ts: S1: x',
        why: '情形要的是 A，测试断言的是 B',
      },
    ];
    const runner = new FakeRunner([workerWithDisputedScene(box, disputed)]);
    await box.run(runner);

    const events = box.events();

    // Find escalated event
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();

    // reason starts with 'acceptance_disputed: ' and contains 'S1: x'
    const rawReason = escalated?.reason;
    expect(typeof rawReason).toBe('string');
    const reason = rawReason as unknown as string;
    expect(reason.startsWith('acceptance_disputed: ')).toBe(true);
    expect(reason).toContain('S1: x');

    // disputed field equals the array from the report
    const escalatedDisputed = (escalated as unknown as { disputed?: unknown[] } | undefined)
      ?.disputed;
    expect(escalatedDisputed).toEqual(disputed);

    // docs/progress.md contains the message about disputed tests
    const progress = box.read('docs/progress.md');
    expect(progress).toContain('worker 认为验收测试有错');
  });
});

// ---------------------------------------------------------------------------
// S3: empty disputed_tests, honest worker, fooled reviewer → PASS
// ---------------------------------------------------------------------------

describe('S3: empty disputed_tests → normal PASS flow', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: runner calls are worker then reviewer, exit code 0', async () => {
    const runner = new FakeRunner([workerWithDisputedScene(box, []), fooledReviewerScene(box)]);

    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    // Runner was called twice: worker, then reviewer
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]?.role).toBe('worker');
    expect(runner.calls[1]?.role).toBe('reviewer');
  });
});
