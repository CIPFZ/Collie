// SPEC 12.2 scenario J: --continue queue mode. Three groups:
// 1. Backlog A(passed), B(pending→A), C(pending→X blocked): B runs PASS,
//    C skipped, queue.finished(exhausted).
// 2. B gets FIX 3 times (fix_max=2): 3rd triggers escalated(fix_max), exit 20,
//    B→blocked, attempt=3, base_sha identical.
// 3. --max 1: run one batch then stop with queue.finished(limit).
// 4. (v03-b04-fix) FIX rerun task semantics: gaps in task.md, no "上一轮中断".
// 5. (v03-b04-fix) fix_max per-queue: historical FIX journals don't exhaust count.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import { EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from '../src/journal.js';
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
    // SPEC 12.2 (v03-b04-fix): batches is now {batch_id, run_id, verdict}[]
    const batchEntries = finished[0]?.batches as
      { batch_id: string; run_id: string; verdict: string }[] | undefined;
    const batchEntry = batchEntries?.[0];
    expect(batchEntry?.batch_id).toBe('v99-b01');
    expect(batchEntry?.verdict).toBe('PASS');
    expect(batchEntry?.run_id).toBeTruthy();
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
    // SPEC 12.2 (v03-b04-fix): batches is now {batch_id, run_id, verdict}[]
    const batchEntries2 = finished[0]?.batches as
      { batch_id: string; run_id: string; verdict: string }[] | undefined;
    const batchEntry2 = batchEntries2?.[0];
    expect(batchEntry2?.batch_id).toBe('v99-b01');
    expect(batchEntry2?.verdict).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Group 4 (v03-b04-fix): FIX rerun task semantics
// Round 1: reviewer gives FIX with gaps. Round 2: task.md contains those gaps,
// interrupted_at is null, and does NOT contain "上一轮中断".
// ---------------------------------------------------------------------------

describe('scenario J group 4: FIX rerun task has 上一轮判 FIX section', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: fix task semantics backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('round 2 task.md contains gaps from round 1 FIX and no 上一轮中断', async () => {
    // The second worker scene captures the task.md content for inspection.
    let capturedTask = '';

    const fixGaps = ['missing unit test for edge case', 'lint warning on line 42'];
    const fixReviewer = (): {
      expectRole: 'reviewer';
      effect: (ctx: FakeSceneContext) => void;
      result: { exitCode: number; finalText: string };
    } => {
      const body: Verdict = {
        schema_version: 1,
        batch_id: 'v99-b01',
        verdict: 'FIX',
        evidence: {
          commits_actual: ['abc1234'],
          verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '0 passed, 1 failed' }],
          remote_has_head: true,
          ci_conclusion: 'success',
          ci_run_url: '',
          ci_branch_matched: true,
          deps_diff: [],
          spec_diff_lines: 0,
        },
        claim_mismatches: [],
        gaps: fixGaps,
        reason: 'tests failing',
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
    };

    /** Worker scene for round 2 that captures task.md before acting. */
    const capturingWorkerScene = (): {
      expectRole: 'worker';
      effect: (ctx: FakeSceneContext) => Promise<void>;
      result: { exitCode: number };
    } => ({
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        // Capture the task.md that was written for this round.
        const taskPath = join(cwd, '.collie', 'batches', 'v99-b01', 'task.md');
        if (existsSync(taskPath)) {
          capturedTask = readFileSync(taskPath, 'utf8');
        }
        workerSceneSeq++;
        box.write('feature.txt', `feature ${String(workerSceneSeq)}\n`, cwd);
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
          batch_id: 'v99-b01',
          head_sha: head,
          claims,
          open_questions: [],
        };
        box.write(
          '.collie/batches/v99-b01/report.md',
          `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll('report(collie): v99-b01', cwd);
        const { git: gitFn } = await import('../src/git.js');
        await gitFn(cwd, ['push', '-q', 'origin', 'main']);
      },
      result: { exitCode: 0 },
    });

    const runner = new FakeRunner([
      // Round 1: worker + reviewer gives FIX
      queueWorkerScene(box, 'v99-b01', true),
      fixReviewer(),
      // Round 2: capturing worker + reviewer gives PASS (so queue ends)
      capturingWorkerScene(),
      queueReviewerScene(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    // Verify the captured task from round 2.
    expect(capturedTask).toBeTruthy();
    // Must contain "上一轮判 FIX" section
    expect(capturedTask).toContain('上一轮判 FIX');
    // Must contain the gaps from round 1
    for (const gap of fixGaps) {
      expect(capturedTask).toContain(gap);
    }
    // Must NOT contain "上一轮中断" section (FIX is not an interrupt)
    expect(capturedTask).not.toContain('上一轮中断');
    // interrupted_at must be null in the frontmatter
    expect(capturedTask).toMatch(/interrupted_at:\s*null/);
    // Must contain "只补缺口，不要重做"
    expect(capturedTask).toContain('只补缺口，不要重做');
  });
});

// ---------------------------------------------------------------------------
// Group 5 (v03-b04-fix): fix_max per-queue — historical FIX journals don't count
// ---------------------------------------------------------------------------

describe('scenario J group 5: fix_max per-queue counting', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: fix_max per-queue backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('historical FIX journals do not exhaust fix_max; --continue still reruns', async () => {
    // Pre-place two historical FIX runs in .collie/runs/ for v99-b01.
    // These simulate previous queue sessions that ended with FIX.
    // Only run.finished events are needed for classifyRun to detect FIX.
    // Deliberately omit batch.selected to avoid setting an invalid baseSha
    // that would break evidence gathering in runBatch.
    for (const runId of ['r-20261018120000', 'r-20261018120001']) {
      const dir = join(box.root, RUNS_RELATIVE_DIR, runId);
      mkdirSync(dir, { recursive: true });
      const events = [
        {
          ts: '2026-10-18T12:00:01Z',
          run_id: runId,
          event: 'run.finished',
          batch_id: 'v99-b01',
          verdict: 'FIX',
          result: 'ok',
        },
      ];
      writeFileSync(
        join(dir, EVENTS_FILE_NAME),
        events.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );
    }

    // Now run --continue with fix_max=2: with the old countBatchFinished approach,
    // the 2 historical FIX runs would count, so even one more FIX would exceed
    // fix_max (2 existing + 1 new = 3 > 2). With in-memory counting, only FIX
    // verdicts from THIS queue session count.
    //
    // Run 1: FIX → in-memory count = 1 (≤ fix_max=2 → retry).
    // Run 2: FIX → in-memory count = 2 (≤ fix_max=2 → retry).
    // Run 3: FIX → in-memory count = 3 (> fix_max=2 → escalated).
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);
    // Should be BLOCK (exit 20) from fix_max, not immediately escalated.
    expect(code).toBe(20);

    const events = box.events();
    // 2 historical run.finished events + 3 from this session = 5 total.
    const runFinished = events.filter(
      (e) => e.event === 'run.finished' && e.batch_id === 'v99-b01',
    );
    expect(runFinished).toHaveLength(5);

    // The escalated event should exist (fix_max exceeded).
    const escalated = events.filter((e) => e.event === 'escalated');
    expect(escalated.some((e) => e.reason === 'fix_max')).toBe(true);

    // The queue.batch_started events should exist for each run in this session.
    const started = events.filter((e) => e.event === 'queue.batch_started');
    expect(started).toHaveLength(3);
    expect(started[0]?.why).toBe('new');
    expect(started[1]?.why).toBe('fix_retry');
    expect(started[2]?.why).toBe('fix_retry');
  });
});
