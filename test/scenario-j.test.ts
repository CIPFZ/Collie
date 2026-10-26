// SPEC 12.2 scenario J: --continue queue mode. Three groups:
// 1. Backlog A(passed), B(pending→A), C(pending→X blocked): B runs PASS,
//    C skipped, queue.finished(exhausted).
// 2. B gets FIX 3 times (fix_max=2): 3rd triggers escalated(fix_max), exit 20,
//    B→blocked, attempt=3, base_sha identical.
// 3. --max 1: run one batch then stop with queue.finished(limit).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers: build a multi-batch backlog and matching scenes for the sandbox.
// ---------------------------------------------------------------------------

/** Counter so each worker scene writes distinct file content (avoids empty commits). */
let workerSceneSeq = 0;

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
    '| 優先級 | 批次 | 標題 | 依赖 | 状态 |'.replace('優先級', '优先级').replace('標題', '标题'),
    '|---|---|---|---|---|',
  ];
  for (const d of defs) {
    lines.push(`| ${String(d.priority)} | ${d.id} | ${d.title} | ${d.depends} | ${d.status} |`);
  }
  lines.push('');
  // Individual batch sections
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

/** Worker scene: commits code + tests, writes a report, optionally pushes. */
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
      workerSceneSeq++;
      box.write('feature.txt', `feature ${String(workerSceneSeq)}\n`, cwd);
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

/** Reviewer scene: says PASS. */
function queueReviewerScene(
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

/** Reviewer scene that says FIX (for fix_max testing). */
function queueReviewerFixScene(
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
    verdict: 'FIX',
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
    gaps: ['needs improvement'],
    reason: 'not good enough',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Group 1: PASS path — B passes, C skipped, queue.finished(exhausted)
// ---------------------------------------------------------------------------

describe('scenario J group 1: PASS → status column → exhausted', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Replace the single-batch backlog with a multi-batch one.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
      { priority: 3, id: 'v99-x01', title: '阻塞', depends: '—', status: 'blocked' },
      { priority: 4, id: 'v99-c01', title: '依赖不满足', depends: 'v99-x01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: multi-batch backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('runs B to PASS, skips C, exits 0 with reason exhausted', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerScene(box, 'v99-b01'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    const events = box.events();
    // batch.status: v99-b01 → passed
    const statusEvents = events.filter((e) => e.event === 'batch.status');
    expect(statusEvents.some((e) => e.batch_id === 'v99-b01' && e.to === 'passed')).toBe(true);

    // batch.skipped: v99-c01 (depends on v99-x01 which is blocked)
    const skipped = events.filter((e) => e.event === 'batch.skipped');
    expect(skipped.some((e) => e.batch_id === 'v99-c01')).toBe(true);
    const c01Skipped = skipped.find((e) => e.batch_id === 'v99-c01');
    expect(c01Skipped?.missing).toEqual(['v99-x01']);

    // queue.finished: reason=exhausted
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'exhausted' });
    expect(finished[0]?.batches).toEqual(['v99-b01']);
  });

  it('updates the backlog file status column to passed', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerScene(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue'], runner);

    const backlog = box.read('docs/backlog.md');
    // The status column for v99-b01 should now be 'passed'.
    expect(backlog).toMatch(/v99-b01.*passed/);
  });
});

// ---------------------------------------------------------------------------
// Group 2: FIX 3 times with fix_max=2 → escalated(fix_max)
// ---------------------------------------------------------------------------

describe('scenario J group 2: FIX × 3 → escalated(fix_max)', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: fix_max backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('escalates on 3rd FIX with exit 20 and blocked status', async () => {
    // 3 worker + 3 reviewer scenes for the 3 FIX runs.
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(20);

    const events = box.events();
    // escalated event with reason=fix_max
    const escalated = events.filter((e) => e.event === 'escalated');
    expect(escalated.some((e) => e.reason === 'fix_max')).toBe(true);

    // queue.finished with reason=fix_max
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'fix_max' });
  });

  it('records attempt=3 on the third run and base_sha stays the same', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
    ]);

    await box.cli(['run', '--continue'], runner);

    const events = box.events();
    // All batch.selected events should have the same base_sha.
    const selected = events.filter((e) => e.event === 'batch.selected' && e.batch_id === 'v99-b01');
    expect(selected).toHaveLength(3);
    const baseShas = selected.map((e) => e.base_sha);
    expect(baseShas[0]).toBe(baseShas[1]);
    expect(baseShas[1]).toBe(baseShas[2]);

    // The third run should have attempt=3 in the task frontmatter.
    // Check via worker.resumed event (recorded for attempt > 1).
    const resumed = events.filter((e) => e.event === 'worker.resumed' && e.batch_id === 'v99-b01');
    expect(resumed).toHaveLength(2); // attempt 2 and 3
    expect(resumed[0]?.attempt).toBe(2);
    expect(resumed[1]?.attempt).toBe(3);
  });

  it('sets batch status to blocked after fix_max', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
    ]);

    await box.cli(['run', '--continue'], runner);

    const backlog = box.read('docs/backlog.md');
    // v99-b01 should be blocked after fix_max exceeded.
    expect(backlog).toMatch(/v99-b01.*blocked/);
  });
});

// ---------------------------------------------------------------------------
// Group 3: --max 1 → run one, stop with queue.finished(limit)
// ---------------------------------------------------------------------------

describe('scenario J group 3: --max 1 → limit', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑1', depends: 'v99-a01', status: 'pending' },
      { priority: 3, id: 'v99-c01', title: '待跑2', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: max backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('runs one batch then stops with reason limit', async () => {
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerScene(box, 'v99-b01'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner);
    expect(code).toBe(0);

    const events = box.events();
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'limit' });
    expect(finished[0]?.batches).toEqual(['v99-b01']);
  });
});
