// v045-b13: rule 4 deletion integration test. Uses FakeRunner with a real
// `run --continue` queue of two batches. The first batch's reviewer says PASS
// but includes non-empty claim_mismatches; the second batch is a normal PASS.
//
// Expected: exit 0, both batches "passed", the first batch records
// queue.gate_passed, and there is no verdict.downgraded in the journal.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let workerSeq = 0;

interface BatchDef {
  priority: number;
  id: string;
  title: string;
  depends: string;
  status: string;
}

function makeBacklog(defs: BatchDef[]): string {
  const lines: string[] = [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
  ];
  for (const d of defs) {
    lines.push(`| ${String(d.priority)} | ${d.id} | ${d.title} | ${d.depends} | ${d.status} |`);
  }
  lines.push('');
  for (const d of defs) {
    const depText = d.depends === '—' ? '无' : d.depends;
    lines.push(`## ${d.id} ${d.title}`);
    lines.push('');
    // eslint-disable-next-line no-irregular-whitespace -- ideographic space matches docs/backlog.md format
    lines.push(`优先级：${String(d.priority)}　依赖：${depText}`);
    lines.push('');
    lines.push('条目：');
    lines.push(`1. 实现 ${d.id}`);
    lines.push('');
    lines.push('验收标准：');
    lines.push('');
    lines.push('| 说明 | 命令 | 期望 |');
    lines.push('|---|---|---|');
    lines.push(`| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |`);
    lines.push(`| 功能文件存在 | \`test -f feature.txt\` | exit 0 |`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Worker scene: commits code + tests, writes a report, pushes. */
function queueWorkerScene(
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
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
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
      const { git: gitFn } = await import('../src/git.js');
      await gitFn(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/** Reviewer that says PASS with non-empty claim_mismatches (the old rule 4 trigger). */
function reviewerPassWithMismatches(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
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
    claim_mismatches: [{ field: 'tests_passed', claimed: 47, actual: 1 }],
    gaps: [],
    reason: 'pass despite mismatches',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Reviewer: says PASS cleanly (no gaps, CI all good). */
function reviewerClean(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
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
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('no-rule4: reviewer PASS + claim_mismatches non-empty → PASS, gate_passed, no downgrade', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑1', depends: 'v99-a01', status: 'pending' },
      { priority: 3, id: 'v99-c01', title: '待跑2', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: no-rule4 backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('exits 0 with both batches passed', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01'),
      reviewerPassWithMismatches(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01'),
      reviewerClean(box, 'v99-c01'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);
  });

  it('both batches are "passed" in the backlog', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01'),
      reviewerPassWithMismatches(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01'),
      reviewerClean(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toMatch(/v99-b01.*passed/);
    expect(backlog).toMatch(/v99-c01.*passed/);
  });

  it('first batch records queue.gate_passed', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01'),
      reviewerPassWithMismatches(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01'),
      reviewerClean(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const gatePassed = events.find(
      (e) => e.event === 'queue.gate_passed' && e.batch_id === 'v99-b01',
    );
    expect(gatePassed).toBeDefined();
  });

  it('no verdict.downgraded events in the journal', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01'),
      reviewerPassWithMismatches(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01'),
      reviewerClean(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const downgraded = events.filter((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toHaveLength(0);
  });
});
