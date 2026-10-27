// SPEC 12.3 scenario L: gate decision, rule 1 auto-retry, rule 9 consecutive.
// Three groups:
//   a. Batch PASS but reviewer gaps non-empty → queue.paused reasons=gaps, exit 30,
//      backlog status=passed, queue.finished paused_count=1.
//   b. First round reviewer bad JSON (rule 1 BLOCK), second round PASS →
//      batch.retried rule=1, continue to next batch, fix_max unchanged.
//   c. Two batches consecutive with pushed=false (rule 9 downgrade) →
//      queue.paused reason=rule9_twice after second batch.
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

/** Worker scene: commits code + tests, writes a report. */
function queueWorkerScene(
  box: Sandbox,
  batchId: string,
  push: boolean,
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
        pushed: push,
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
      if (push) {
        const { git: gitFn } = await import('../src/git.js');
        await gitFn(cwd, ['push', '-q', 'origin', 'main']);
      }
    },
    result: { exitCode: 0 },
  };
}

/** Reviewer: says PASS with non-empty gaps (triggers gate). */
function reviewerWithGaps(
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
    gaps: ['reviewer noticed a TODO in the code'],
    reason: 'pass with gaps',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过但有备注。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
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

/** Reviewer: returns bad JSON (triggers rule 1 BLOCK). */
function reviewerBadJson(box: Sandbox): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      // Malformed JSON: missing closing brace → rule 1 BLOCK.
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n{ "invalid": true \n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Group a: PASS with gaps → queue.paused
// ---------------------------------------------------------------------------

describe('scenario L group a: PASS with gaps → queue.paused', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: gaps backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('exits 30 when reviewer PASS has non-empty gaps', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerWithGaps(box, 'v99-b01'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(30);
  });

  it('records queue.paused with reasons containing "gaps"', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerWithGaps(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const paused = events.find((e) => e.event === 'queue.paused');
    expect(paused).toBeDefined();
    expect(paused?.batch_id).toBe('v99-b01');
    expect(paused?.reasons).toEqual(expect.arrayContaining(['gaps']));
  });

  it('backlog status becomes passed (gate does not change the verdict)', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerWithGaps(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toMatch(/v99-b01.*passed/);
  });

  it('queue.finished has paused_count=1', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerWithGaps(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished).toBeDefined();
    expect(finished?.reason).toBe('paused');
    expect(finished?.paused_count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Group b: rule 1 BLOCK → auto-retry → PASS → continue
// ---------------------------------------------------------------------------

describe('scenario L group b: rule 1 BLOCK → batch.retried → PASS', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑1', depends: 'v99-a01', status: 'pending' },
      { priority: 3, id: 'v99-c01', title: '待跑2', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: rule1 retry backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('retries on rule 1 BLOCK and continues to next batch', async () => {
    const runner = new FakeRunner([
      // First attempt: worker OK, reviewer bad JSON → rule 1 BLOCK.
      queueWorkerScene(box, 'v99-b01', true),
      reviewerBadJson(box),
      // Retry (auto): worker OK, reviewer OK → PASS.
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
      // Next batch: v99-c01.
      queueWorkerScene(box, 'v99-c01', true),
      reviewerClean(box, 'v99-c01'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);
  });

  it('records batch.retried with rule=1 in the journal', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerBadJson(box),
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01', true),
      reviewerClean(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const retried = events.find((e) => e.event === 'batch.retried');
    expect(retried).toBeDefined();
    expect(retried?.batch_id).toBe('v99-b01');
    expect(retried?.rule).toBe(1);
  });

  it('does not increase fix_max count for rule 1 retry', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerBadJson(box),
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-c01', true),
      reviewerClean(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    // No escalated(fix_max) event should exist.
    const escalated = events.filter((e) => e.event === 'escalated' && e.reason === 'fix_max');
    expect(escalated).toHaveLength(0);
    // The queue should have finished successfully (both batches ran).
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Group c: two consecutive batches with rule 9 → queue.paused rule9_twice
// ---------------------------------------------------------------------------

describe(
  'scenario L group c: rule 9 consecutive → queue.paused rule9_twice',
  { timeout: 60_000 },
  () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
      const backlog = makeBacklog([
        { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
        { priority: 2, id: 'v99-b01', title: '待跑1', depends: 'v99-a01', status: 'pending' },
        { priority: 3, id: 'v99-c01', title: '待跑2', depends: 'v99-a01', status: 'pending' },
      ]);
      box.write('docs/backlog.md', backlog);
      await box.commitAll('chore: rule9_twice backlog');
    });

    afterEach(() => {
      box.dispose();
    });

    it('stops with queue.paused reason=rule9_twice after two consecutive rule 9 downgrades', async () => {
      // Both batches: first attempt worker does NOT push → rule 9 fires → FIX.
      // FIX retry: worker pushes → PASS. Journal has verdict.downgraded rule=9 from attempt 1.
      // After second batch PASS, rule9_twice fires because both batches had rule 9.
      const runner = new FakeRunner([
        // v99-b01 attempt 1: no push → rule 9 → FIX
        queueWorkerScene(box, 'v99-b01', false),
        reviewerClean(box, 'v99-b01'),
        // v99-b01 attempt 2 (FIX retry): push → PASS
        queueWorkerScene(box, 'v99-b01', true),
        reviewerClean(box, 'v99-b01'),
        // v99-c01 attempt 1: no push → rule 9 → FIX
        queueWorkerScene(box, 'v99-c01', false),
        reviewerClean(box, 'v99-c01'),
        // v99-c01 attempt 2 (FIX retry): push → PASS
        queueWorkerScene(box, 'v99-c01', true),
        reviewerClean(box, 'v99-c01'),
      ]);
      const code = await box.cli(['run', '--continue'], runner);
      expect(code).toBe(30);
    });

    it('records queue.paused with reasons containing "rule9_twice"', async () => {
      const runner = new FakeRunner([
        queueWorkerScene(box, 'v99-b01', false),
        reviewerClean(box, 'v99-b01'),
        queueWorkerScene(box, 'v99-b01', true),
        reviewerClean(box, 'v99-b01'),
        queueWorkerScene(box, 'v99-c01', false),
        reviewerClean(box, 'v99-c01'),
        queueWorkerScene(box, 'v99-c01', true),
        reviewerClean(box, 'v99-c01'),
      ]);
      await box.cli(['run', '--continue'], runner);
      const events = box.events();
      const paused = events.find((e) => e.event === 'queue.paused');
      expect(paused).toBeDefined();
      expect(paused?.reasons).toEqual(['rule9_twice']);
    });

    it('both batches have verdict.downgraded rule=9 in the journal', async () => {
      const runner = new FakeRunner([
        queueWorkerScene(box, 'v99-b01', false),
        reviewerClean(box, 'v99-b01'),
        queueWorkerScene(box, 'v99-b01', true),
        reviewerClean(box, 'v99-b01'),
        queueWorkerScene(box, 'v99-c01', false),
        reviewerClean(box, 'v99-c01'),
        queueWorkerScene(box, 'v99-c01', true),
        reviewerClean(box, 'v99-c01'),
      ]);
      await box.cli(['run', '--continue'], runner);
      const events = box.events();
      const downgrades = events.filter((e) => e.event === 'verdict.downgraded' && e.rule === 9);
      // At least one verdict.downgraded for each batch.
      const b01 = downgrades.filter((e) => e.batch_id === 'v99-b01');
      const c01 = downgrades.filter((e) => e.batch_id === 'v99-c01');
      expect(b01.length).toBeGreaterThanOrEqual(1);
      expect(c01.length).toBeGreaterThanOrEqual(1);
    });
  },
);
