// SPEC 16.20: when the same head_sha gets rule 9 twice in the same batch,
// the queue escalates with rule9_same_head instead of retrying — CI cannot
// produce a different outcome for the same sha.
//
// Three scenarios:
//   1. CI failure twice on same head_sha → queue stops rule9_same_head, exit 20.
//   2. CI failure twice but worker makes a new commit (different head_sha) → fix_max retry.
//   3. First run rule 9 → FIX, second run PASS → queue continues normally.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import { git } from '../src/git.js';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';
const BATCH_ID = 'v99-b01';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function singleBatchBacklog(status = 'pending'): string {
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| 1 | ${BATCH_ID} | 测试功能 | — | ${status} |`,
    '',
    `## ${BATCH_ID} 测试功能`,
    '',
    `优先级：1\u3000依赖：无`,
    '',
    '条目：',
    `1. 实现 ${BATCH_ID}`,
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    `| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |`,
    '| 功能文件存在 | `test -f feature.txt` | exit 0 |',
    '',
  ].join('\n');
}

/** Fetch that always returns CI failure on `main`. */
function ciFailureFetch(): FetchLike {
  return (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    const run = {
      id: 42,
      workflow_id: 1,
      name: 'ci',
      event: 'push',
      head_branch: 'main',
      head_sha: sha,
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/example/sandbox/actions/runs/42',
      created_at: '2026-11-21T07:00:00Z',
    };
    return Promise.resolve(new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })));
  };
}

/** Reviewer that says PASS (R2 will downgrade via rule 9 when evidence is bad). */
function reviewerPass(batchId: string): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'PASS',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed, 0 failed' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: [],
    reason: 'all good',
  };
  return {
    expectRole: 'reviewer',
    effect: () => {
      /* reviewer scene — nothing to do in test */
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/**
 * Worker scene that commits code, pushes to remote, and writes a report.
 * On the first call it stores its head_sha in `shaStore[0]`.
 */
function workerWithPush(
  box: Sandbox,
  batchId: string,
  shaStore: string[],
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', `feature ${String(shaStore.length + 1)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
      shaStore.push(head);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: true,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/**
 * Worker scene for the FIX retry that makes NO new code commit — reuses the
 * head_sha from shaStore[0].  Still pushes (sha already on remote).
 */
function workerSameHead(
  box: Sandbox,
  batchId: string,
  shaStore: string[],
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      const head = shaStore[0];
      if (head === undefined)
        throw new Error('shaStore is empty: first worker must run before retry');
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: true,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      // Different text from first run so git sees a diff; JSON block is the same.
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n重跑，无新提交。\n\n## 测试结果\n同上。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/**
 * Worker scene for the PASS path: pushes to remote and CI succeeds because the
 * default sandbox fetch returns success.
 */
function workerNoPush(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature-nopush\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: false,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
    },
    result: { exitCode: 0 },
  };
}

/**
 * Worker scene that pushes to remote for a successful second run (default
 * sandbox fetch returns CI success).
 */
function workerPushForPass(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature-pass\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature pass', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: true,
        ci_passed: true,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queue: rule 9 twice on the same head_sha escalates', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    box.write('docs/backlog.md', singleBatchBacklog());
    await box.commitAll('chore: rule9 same head backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('same head_sha: stops with rule9_same_head, exit 20, backlog blocked, escalated event', async () => {
    // Run 1: worker pushes, CI failure → rule 9 → FIX.
    // Run 2 (fix retry): worker writes same head_sha (no new commit), CI still failure → rule 9 → FIX.
    // Queue detects same head_sha → escalate rule9_same_head, exit 20.
    const shaStore: string[] = [];
    const fetch = ciFailureFetch();
    const runner = new FakeRunner([
      workerWithPush(box, BATCH_ID, shaStore),
      reviewerPass(BATCH_ID),
      workerSameHead(box, BATCH_ID, shaStore),
      reviewerPass(BATCH_ID),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner, { fetch });
    expect(code).toBe(20);

    // Check journal events.
    const events = box.events();

    // Two verdict.downgraded rule=9 events.
    const downgrades = events.filter((e) => e.event === 'verdict.downgraded' && e.rule === 9);
    expect(downgrades).toHaveLength(2);

    // escalated event with rule9_same_head and head_sha.
    const escalated = events.find((e) => e.event === 'escalated' && e.reason === 'rule9_same_head');
    expect(escalated).toBeDefined();
    expect(escalated?.head_sha).toBe(shaStore[0]);

    // queue.finished reason = rule9_same_head.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('rule9_same_head');

    // Backlog should show the batch as blocked.
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('blocked');
  });

  it('different head_sha: proceeds to third run (fix_max retry)', async () => {
    // Run 1: worker pushes sha-A, CI failure → rule 9 → FIX.
    // Run 2: worker pushes sha-B (new commit), CI failure → rule 9 → FIX.
    // head_sha differs → fix_max counting. fix_max=2, fixes=2 → retry again.
    // Run 3: CI still fails → rule 9 → FIX → fixes=3 > fix_max=2 → fix_max escalation.
    // Single shaStore so each workerWithPush writes unique feature content.
    const shaStore: string[] = [];
    const fetch = ciFailureFetch();
    const runner = new FakeRunner([
      workerWithPush(box, BATCH_ID, shaStore),
      reviewerPass(BATCH_ID),
      workerWithPush(box, BATCH_ID, shaStore),
      reviewerPass(BATCH_ID),
      workerWithPush(box, BATCH_ID, shaStore),
      reviewerPass(BATCH_ID),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner, { fetch });
    // Ends with fix_max (exit 20), not rule9_same_head.
    expect(code).toBe(20);

    const events = box.events();

    // Three rule 9 downgrades (all different head_shas).
    const downgrades = events.filter((e) => e.event === 'verdict.downgraded' && e.rule === 9);
    expect(downgrades).toHaveLength(3);

    // No rule9_same_head escalation.
    const sameHeadEscalated = events.find(
      (e) => e.event === 'escalated' && e.reason === 'rule9_same_head',
    );
    expect(sameHeadEscalated).toBeUndefined();

    // fix_max escalation instead.
    const fixMaxEscalated = events.find((e) => e.event === 'escalated' && e.reason === 'fix_max');
    expect(fixMaxEscalated).toBeDefined();

    // queue.finished reason = fix_max.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('fix_max');
  });

  it('first run rule 9, second run PASS: queue continues normally', async () => {
    // Run 1: worker does NOT push → remote_has_head=false → rule 9 → FIX.
    // Run 2 (fix retry): worker pushes, CI success → PASS → gate passes → queue continues.
    const runner = new FakeRunner([
      workerNoPush(box, BATCH_ID),
      reviewerPass(BATCH_ID),
      workerPushForPass(box, BATCH_ID),
      reviewerPass(BATCH_ID),
    ]);
    // --max 1: queue stops after the first PASS.
    const code = await box.cli(['run', '--continue', '--max', '1'], runner);
    expect(code).toBe(0);

    const events = box.events();

    // One rule 9 downgrade from run 1.
    const downgrades = events.filter((e) => e.event === 'verdict.downgraded' && e.rule === 9);
    expect(downgrades).toHaveLength(1);

    // No rule9_same_head escalation.
    const escalated = events.find((e) => e.event === 'escalated' && e.reason === 'rule9_same_head');
    expect(escalated).toBeUndefined();

    // queue.finished reason = limit (the PASS hit --max 1).
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('limit');
  });
});
