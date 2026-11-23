// Acceptance tests for v046-b36 — [保持] scenarios K1–K4.
// These behaviours must continue to work after disputed_tests is implemented.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import { git } from '../../../src/git.js';
import type { Event } from '../../../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from '../../support/sandbox.js';

// Module path for dynamic import of ReportSchema.
const SCHEMA_MODULE = '../../../src/schema/index.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers
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

/** Queue events helper: read events from every run across the sandbox. */
function allQueueEvents(box: Sandbox): Event[] {
  return box.events();
}

// ---------------------------------------------------------------------------
// K1: report without disputed_tests → normal PASS flow, no escalated
// ---------------------------------------------------------------------------

describe('K1: no disputed_tests key → worker then reviewer, exit 0, no escalated', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: runner calls are worker then reviewer, exit 0, no escalated event', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47),
      }),
      fooledReviewerScene(box),
    ]);

    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    // Runner was called twice: worker, then reviewer
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]?.role).toBe('worker');
    expect(runner.calls[1]?.role).toBe('reviewer');

    // No escalated events in journal
    const events = box.events();
    const escalated = events.filter((e) => e.event === 'escalated');
    expect(escalated).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// K2: ReportSchema rejects invalid disputed_tests items
// ---------------------------------------------------------------------------

describe('K2: ReportSchema rejects invalid disputed_tests items', () => {
  it('K2: test is empty string → parse fails', async () => {
    const mod = (await import(SCHEMA_MODULE)) as unknown as {
      ReportSchema: { safeParse: (data: unknown) => { success: boolean } };
    };

    const input = reportWithDisputed('v99-b01', 'abcdef1234567', [
      { test: '', why: 'some reason' },
    ]);
    const result = mod.ReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('K2: why is empty string → parse fails', async () => {
    const mod = (await import(SCHEMA_MODULE)) as unknown as {
      ReportSchema: { safeParse: (data: unknown) => { success: boolean } };
    };

    const input = reportWithDisputed('v99-b01', 'abcdef1234567', [
      { test: 'test/acceptance/v99-b01/new.test.ts: S1: x', why: '' },
    ]);
    const result = mod.ReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('K2: extra note key → parse fails', async () => {
    const mod = (await import(SCHEMA_MODULE)) as unknown as {
      ReportSchema: { safeParse: (data: unknown) => { success: boolean } };
    };

    const input = reportWithDisputed('v99-b01', 'abcdef1234567', [
      {
        test: 'test/acceptance/v99-b01/new.test.ts: S1: x',
        why: 'valid reason',
        note: 'extra field',
      },
    ]);
    const result = mod.ReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// K3: disputed_tests with one item → exit 20, runner only called once (worker),
//     no reviewer.started, no evidence.collected
// ---------------------------------------------------------------------------

describe('K3: disputed_tests triggers exit 20 without reviewer', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exit 20, runner called once as worker, no reviewer.started, no evidence.collected', async () => {
    const disputed = [
      {
        test: 'test/acceptance/v99-b01/new.test.ts: S1: x',
        why: '情形要的是 A，测试断言的是 B',
      },
    ];
    const runner = new FakeRunner([workerWithDisputedScene(box, disputed)]);

    const exitCode = await box.run(runner);
    expect(exitCode).toBe(20);

    // Runner was called exactly once, as worker
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.role).toBe('worker');

    // No reviewer.started or evidence.collected
    const events = box.events();
    const reviewerStarted = events.filter((e) => e.event === 'reviewer.started');
    expect(reviewerStarted).toHaveLength(0);

    const evidenceCollected = events.filter((e) => e.event === 'evidence.collected');
    expect(evidenceCollected).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// K4: queue mode (--continue), disputed_tests → exit 20, blocked, batch_started
//     count 1, queue.finished reason blocked
// ---------------------------------------------------------------------------

describe('K4: queue mode with disputed_tests → exit 20, blocked', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K4: exit 20, backlog blocked, queue.batch_started once, queue.finished reason blocked', async () => {
    // Queue mode requires the batch to be 'pending' so selectNextBatch picks it.
    const pendingBacklog = box.read('docs/backlog.md').replace(/running/, 'pending');
    box.write('docs/backlog.md', pendingBacklog);
    await box.commitAll('chore: set batch to pending');

    const disputed = [
      {
        test: 'test/acceptance/v99-b01/new.test.ts: S1: x',
        why: '情形要的是 A，测试断言的是 B',
      },
    ];
    const runner = new FakeRunner([workerWithDisputedScene(box, disputed)]);

    const exitCode = await box.cli(['run', '--continue'], runner);
    expect(exitCode).toBe(20);

    // docs/backlog.md: batch status is blocked
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('blocked');

    // Queue journal: queue.batch_started for BATCH appears exactly once
    const events = allQueueEvents(box);
    const batchStarted = events.filter(
      (e) => e.event === 'queue.batch_started' && e.batch_id === BATCH,
    );
    expect(batchStarted).toHaveLength(1);

    // queue.finished reason is 'blocked'
    const queueFinished = events.filter((e) => e.event === 'queue.finished');
    expect(queueFinished).toHaveLength(1);
    expect(queueFinished[0]?.reason).toBe('blocked');
  });
});
