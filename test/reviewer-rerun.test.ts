// SPEC 14.17: on FIX reruns the reviewer worktree must not contain the
// previous attempt's report.md, even though git ls-tree at head_sha would
// show it.  The path exclusion in the prompt must also be present.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';
const BATCH_ID = 'v99-rr01';

// ---------------------------------------------------------------------------
// Backlog: single batch
// ---------------------------------------------------------------------------

function makeBacklog(): string {
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| 1 | ${BATCH_ID} | 功能 | — | pending |`,
    '',
    `## ${BATCH_ID} 功能`,
    '',
    // eslint-disable-next-line no-irregular-whitespace -- ideographic space matches docs/backlog.md format
    `优先级：1　依赖：无`,
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

// ---------------------------------------------------------------------------
// Scene helpers
// ---------------------------------------------------------------------------

let workerSeq = 0;

interface ReviewerCapture {
  reportExists: boolean;
  taskExists: boolean;
  prompt: string;
  /** Sorted file listing of .collie/batches/<BATCH_ID>/ in the reviewer cwd. */
  batchFiles: string[];
  /** Whether v99-other/report.md survives in the reviewer cwd. */
  otherBatchReportExists: boolean;
}

interface WorkerCapture {
  headSha: string;
}

function workerScene(
  box: Sandbox,
  captures: WorkerCapture[],
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
      captures.push({ headSha: head });
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
        batch_id: BATCH_ID,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH_ID}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH_ID}`, cwd);
      if (push) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

function reviewerFixScene(
  box: Sandbox,
  captures: ReviewerCapture[],
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: BATCH_ID,
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
    gaps: ['needs work'],
    reason: 'not good enough',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd, opts }: FakeSceneContext) => {
      const batchDir = join(cwd, '.collie', 'batches', BATCH_ID);
      captures.push({
        reportExists: existsSync(join(batchDir, 'report.md')),
        taskExists: existsSync(join(batchDir, 'task.md')),
        prompt: opts.prompt,
        batchFiles: existsSync(batchDir) ? readdirSync(batchDir).sort() : [],
        otherBatchReportExists: existsSync(
          join(cwd, '.collie', 'batches', 'v99-other', 'report.md'),
        ),
      });
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

function reviewerPassScene(
  box: Sandbox,
  captures: ReviewerCapture[],
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: BATCH_ID,
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
    effect: ({ cwd, opts }: FakeSceneContext) => {
      const batchDir = join(cwd, '.collie', 'batches', BATCH_ID);
      captures.push({
        reportExists: existsSync(join(batchDir, 'report.md')),
        taskExists: existsSync(join(batchDir, 'task.md')),
        prompt: opts.prompt,
        batchFiles: existsSync(batchDir) ? readdirSync(batchDir).sort() : [],
        otherBatchReportExists: existsSync(
          join(cwd, '.collie', 'batches', 'v99-other', 'report.md'),
        ),
      });
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ===================================================================
// FIX then PASS (same batch, two attempts via --continue)
// ===================================================================

describe('reviewer-rerun: FIX then PASS', { timeout: 300_000 }, () => {
  let box: Sandbox;
  const reviewerCaptures: ReviewerCapture[] = [];
  const workerCaptures: WorkerCapture[] = [];

  beforeEach(async () => {
    workerSeq = 0;
    reviewerCaptures.length = 0;
    workerCaptures.length = 0;
    box = await Sandbox.create();
    box.write('docs/backlog.md', makeBacklog());
    await box.commitAll('chore: single-batch backlog');
    // Commit another batch's envelope to verify it is not removed (SPEC 14.20).
    box.write('.collie/batches/v99-other/report.md', '# other batch report\n');
    await box.commitAll('chore: other batch envelope');

    const runner = new FakeRunner([
      workerScene(box, workerCaptures, true),
      reviewerFixScene(box, reviewerCaptures),
      workerScene(box, workerCaptures, true),
      reviewerPassScene(box, reviewerCaptures),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);
  });

  afterEach(() => {
    box.dispose();
  });

  it('report.md is absent from reviewer cwd on both attempts', () => {
    expect(reviewerCaptures).toHaveLength(2);
    expect(reviewerCaptures[0]?.reportExists).toBe(false);
    expect(reviewerCaptures[1]?.reportExists).toBe(false);
  });

  it('head_sha tree for attempt 2 contains report.md via ls-tree (contrast)', async () => {
    // The second worker's head_sha descends from the first report commit,
    // so git ls-tree must show report.md in the tree — proving the worktree
    // removal is what hides it, not the absence from the tree.
    expect(workerCaptures).toHaveLength(2);
    const secondHead = workerCaptures[1]?.headSha ?? '';
    expect(secondHead).not.toBe('');
    const lsTree = await git(box.root, [
      'ls-tree',
      '-r',
      '--name-only',
      secondHead,
      '--',
      `.collie/batches/${BATCH_ID}/`,
    ]);
    expect(lsTree).toContain('report.md');
  });

  it('head_sha tree for attempt 2 contains verdict.md via ls-tree (contrast)', async () => {
    // The first run's FIX verdict is committed before the second worker runs,
    // so verdict.md must be in the tree — without it this test proves nothing.
    expect(workerCaptures).toHaveLength(2);
    const secondHead = workerCaptures[1]?.headSha ?? '';
    expect(secondHead).not.toBe('');
    const lsTree = await git(box.root, [
      'ls-tree',
      '-r',
      '--name-only',
      secondHead,
      '--',
      `.collie/batches/${BATCH_ID}/`,
    ]);
    expect(lsTree).toContain('verdict.md');
  });

  it('batch dir in reviewer cwd contains only task.md on both attempts', () => {
    expect(reviewerCaptures).toHaveLength(2);
    expect(reviewerCaptures[0]?.batchFiles).toEqual(['task.md']);
    expect(reviewerCaptures[1]?.batchFiles).toEqual(['task.md']);
  });

  it('other batch dir files are not removed from reviewer cwd', () => {
    expect(reviewerCaptures[0]?.otherBatchReportExists).toBe(true);
    expect(reviewerCaptures[1]?.otherBatchReportExists).toBe(true);
  });

  it('task.md is present in reviewer cwd on both attempts', () => {
    expect(reviewerCaptures[0]?.taskExists).toBe(true);
    expect(reviewerCaptures[1]?.taskExists).toBe(true);
  });

  it('reviewer prompt contains path exclusion on both attempts', () => {
    for (const cap of reviewerCaptures) {
      expect(cap.prompt).toContain("':(exclude).collie/batches'");
    }
  });
});

// ===================================================================
// First-time PASS (single attempt)
// ===================================================================

describe('reviewer-rerun: first PASS', () => {
  let box: Sandbox;
  const reviewerCaptures: ReviewerCapture[] = [];
  const workerCaptures: WorkerCapture[] = [];

  beforeEach(async () => {
    workerSeq = 0;
    reviewerCaptures.length = 0;
    workerCaptures.length = 0;
    box = await Sandbox.create();
    box.write('docs/backlog.md', makeBacklog());
    await box.commitAll('chore: single-batch backlog');
    // Commit another batch's envelope to verify it is not removed (SPEC 14.20).
    box.write('.collie/batches/v99-other/report.md', '# other batch report\n');
    await box.commitAll('chore: other batch envelope');

    const runner = new FakeRunner([
      workerScene(box, workerCaptures, true),
      reviewerPassScene(box, reviewerCaptures),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);
  });

  afterEach(() => {
    box.dispose();
  });

  it('report.md absent, task.md present, prompt excludes .collie/batches', () => {
    expect(reviewerCaptures).toHaveLength(1);
    expect(reviewerCaptures[0]?.reportExists).toBe(false);
    expect(reviewerCaptures[0]?.taskExists).toBe(true);
    expect(reviewerCaptures[0]?.prompt).toContain("':(exclude).collie/batches'");
  });

  it('batch dir in reviewer cwd contains only task.md', () => {
    expect(reviewerCaptures).toHaveLength(1);
    expect(reviewerCaptures[0]?.batchFiles).toEqual(['task.md']);
  });

  it('other batch dir files are not removed from reviewer cwd', () => {
    expect(reviewerCaptures[0]?.otherBatchReportExists).toBe(true);
  });
});

// ===================================================================
// task.md comes from the current run (SPEC 16.18)
// ===================================================================

describe('reviewer-rerun: task.md comes from the current run', { timeout: 300_000 }, () => {
  let box: Sandbox;
  const reviewerTaskContents: string[] = [];
  const workerCaptures: WorkerCapture[] = [];

  /**
   * Reviewer scene that captures the full content of task.md in its cwd.
   */
  function reviewerCaptureTaskScene(verdict: 'FIX' | 'PASS'): {
    expectRole: 'reviewer';
    effect: (ctx: FakeSceneContext) => void;
    result: { exitCode: number; finalText: string };
  } {
    const body: Verdict = {
      schema_version: 1,
      batch_id: BATCH_ID,
      verdict,
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
      gaps: verdict === 'FIX' ? ['needs work'] : [],
      reason: verdict === 'FIX' ? 'not good enough' : 'all good',
    };
    return {
      expectRole: 'reviewer',
      effect: ({ cwd }: FakeSceneContext) => {
        const taskPath = join(cwd, '.collie', 'batches', BATCH_ID, 'task.md');
        if (existsSync(taskPath)) {
          reviewerTaskContents.push(readFileSync(taskPath, 'utf8'));
        }
        // Also verify only task.md is present
        const batchDir = join(cwd, '.collie', 'batches', BATCH_ID);
        const files = existsSync(batchDir) ? readdirSync(batchDir).sort() : [];
        expect(files).toEqual(['task.md']);
      },
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n${verdict === 'FIX' ? '修复' : '通过'}。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
      },
    };
  }

  beforeEach(async () => {
    workerSeq = 0;
    reviewerTaskContents.length = 0;
    workerCaptures.length = 0;
    box = await Sandbox.create();
    box.write('docs/backlog.md', makeBacklog());
    await box.commitAll('chore: single-batch backlog');

    const runner = new FakeRunner([
      workerScene(box, workerCaptures, true),
      reviewerCaptureTaskScene('FIX'),
      workerScene(box, workerCaptures, true),
      reviewerCaptureTaskScene('PASS'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);
  });

  afterEach(() => {
    box.dispose();
  });

  it('attempt 2 reviewer sees task.md with attempt: 2 frontmatter', () => {
    expect(reviewerTaskContents).toHaveLength(2);
    const secondTask = reviewerTaskContents[1] ?? '';
    expect(secondTask).toContain('attempt: 2');
  });

  it('attempt 2 reviewer sees "上一轮判 FIX" section in task.md', () => {
    expect(reviewerTaskContents).toHaveLength(2);
    const secondTask = reviewerTaskContents[1] ?? '';
    expect(secondTask).toContain('上一轮判 FIX');
  });

  it('attempt 1 reviewer sees task.md with attempt: 1 frontmatter', () => {
    expect(reviewerTaskContents).toHaveLength(2);
    const firstTask = reviewerTaskContents[0] ?? '';
    expect(firstTask).toContain('attempt: 1');
  });

  it('reviewer cwd has only task.md in both attempts', () => {
    // Verified inside the reviewer effect via expect(files).toEqual(['task.md'])
    // If we got here, both attempts passed that check.
    expect(reviewerTaskContents).toHaveLength(2);
  });
});
