// SPEC 14.14: --max counts only PASS verdicts, not total runs.
// Tests use FakeRunner with real `run --continue --max N` via Sandbox.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';
import { git } from '../src/git.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Backlog and scene helpers (same pattern as report.test.ts)
// ---------------------------------------------------------------------------

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

let workerSeq = 0;

function workerScene(
  box: Sandbox,
  batchId: string,
  doPush: boolean,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number; costUsd: number; numTurns: number; durationMs: number };
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
        pushed: doPush,
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
      if (doPush) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0, costUsd: 5.0, numTurns: 10, durationMs: 60_000 },
  };
}

function reviewerPassScene(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string; costUsd: number; numTurns: number };
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
      costUsd: 1.0,
      numTurns: 5,
    },
  };
}

function reviewerFixScene(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string; costUsd: number; numTurns: number };
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
    gaps: ['needs work'],
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
      costUsd: 0.5,
      numTurns: 3,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('--max counts only PASS verdicts (SPEC 14.14)', { timeout: 300_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    workerSeq = 0;
  });

  afterEach(() => {
    box.dispose();
  });

  it('--max 2, first batch FIX then PASS, second PASS: both pass, reason limit, 3 batches entries', async () => {
    box.write(
      'docs/backlog.md',
      makeBacklog([
        { priority: 1, id: 'v99-a01', title: '第一', depends: '—', status: 'pending' },
        { priority: 2, id: 'v99-a02', title: '第二', depends: 'v99-a01', status: 'pending' },
      ]),
    );
    await box.commitAll('chore: two-batch backlog');

    // Scene: a01 FIX → a01 PASS → a02 PASS
    const runner = new FakeRunner([
      workerScene(box, 'v99-a01', true),
      reviewerFixScene(box, 'v99-a01'),
      workerScene(box, 'v99-a01', true),
      reviewerPassScene(box, 'v99-a01'),
      workerScene(box, 'v99-a02', true),
      reviewerPassScene(box, 'v99-a02'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '2'], runner);
    expect(code).toBe(0);

    // Check backlog: both batches passed.
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('| v99-a01 | 第一 | — | passed |');
    expect(backlog).toContain('| v99-a02 | 第二 | v99-a01 | passed |');

    // Check queue.finished event.
    const events = box.events();
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'limit' });
    const batches = finished[0]?.batches as
      { batch_id: string; run_id: string; verdict: string }[] | undefined;
    expect(batches).toHaveLength(3);
    expect(batches?.[0]?.verdict).toBe('FIX');
    expect(batches?.[1]?.verdict).toBe('PASS');
    expect(batches?.[2]?.verdict).toBe('PASS');

    // Check queue.batch_started why values.
    const batchStarted = events.filter((e) => e.event === 'queue.batch_started');
    expect(batchStarted).toHaveLength(3);
    expect(batchStarted[0]).toMatchObject({ why: 'new' });
    expect(batchStarted[1]).toMatchObject({ why: 'fix_retry' });
    expect(batchStarted[2]).toMatchObject({ why: 'new' });
  });

  it('--max 1, first batch FIX then PASS: stops after first batch, second still pending, 2 batches entries', async () => {
    box.write(
      'docs/backlog.md',
      makeBacklog([
        { priority: 1, id: 'v99-a01', title: '第一', depends: '—', status: 'pending' },
        { priority: 2, id: 'v99-a02', title: '第二', depends: 'v99-a01', status: 'pending' },
      ]),
    );
    await box.commitAll('chore: two-batch backlog');

    // Scene: a01 FIX → a01 PASS (a02 never reached)
    const runner = new FakeRunner([
      workerScene(box, 'v99-a01', true),
      reviewerFixScene(box, 'v99-a01'),
      workerScene(box, 'v99-a01', true),
      reviewerPassScene(box, 'v99-a01'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner);
    expect(code).toBe(0);

    // Check backlog: first passed, second still pending.
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('| v99-a01 | 第一 | — | passed |');
    expect(backlog).toContain('| v99-a02 | 第二 | v99-a01 | pending |');

    // Check queue.finished event.
    const events = box.events();
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'limit' });
    const batches = finished[0]?.batches as
      { batch_id: string; run_id: string; verdict: string }[] | undefined;
    expect(batches).toHaveLength(2);
    expect(batches?.[0]?.verdict).toBe('FIX');
    expect(batches?.[1]?.verdict).toBe('PASS');

    // Check queue.batch_started why values.
    const batchStarted = events.filter((e) => e.event === 'queue.batch_started');
    expect(batchStarted).toHaveLength(2);
    expect(batchStarted[0]).toMatchObject({ why: 'new' });
    expect(batchStarted[1]).toMatchObject({ why: 'fix_retry' });
  });

  it('--max 1, FIX exceeds fix_max: exit 20, escalated with reason fix_max', async () => {
    box.write(
      'docs/backlog.md',
      makeBacklog([{ priority: 1, id: 'v99-a01', title: '唯一', depends: '—', status: 'pending' }]),
    );
    await box.commitAll('chore: single-batch backlog');

    // fix_max defaults to 2 (from collie.toml). Scene: FIX × 3 → exceeds fix_max.
    const runner = new FakeRunner([
      workerScene(box, 'v99-a01', true),
      reviewerFixScene(box, 'v99-a01'),
      workerScene(box, 'v99-a01', true),
      reviewerFixScene(box, 'v99-a01'),
      workerScene(box, 'v99-a01', true),
      reviewerFixScene(box, 'v99-a01'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner);
    expect(code).toBe(20);

    // Check queue.finished event.
    const events = box.events();
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'fix_max' });

    // Check escalated event.
    const escalated = events.filter((e) => e.event === 'escalated' && e.reason === 'fix_max');
    expect(escalated).toHaveLength(1);

    // Backlog should show blocked.
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('| v99-a01 | 唯一 | — | blocked |');
  });

  it('no --max, two batches both one-shot PASS: exit 0, reason exhausted, both passed', async () => {
    box.write(
      'docs/backlog.md',
      makeBacklog([
        { priority: 1, id: 'v99-a01', title: '第一', depends: '—', status: 'pending' },
        { priority: 2, id: 'v99-a02', title: '第二', depends: 'v99-a01', status: 'pending' },
      ]),
    );
    await box.commitAll('chore: two-batch backlog');

    const runner = new FakeRunner([
      workerScene(box, 'v99-a01', true),
      reviewerPassScene(box, 'v99-a01'),
      workerScene(box, 'v99-a02', true),
      reviewerPassScene(box, 'v99-a02'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    // Check backlog: both passed.
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toContain('| v99-a01 | 第一 | — | passed |');
    expect(backlog).toContain('| v99-a02 | 第二 | v99-a01 | passed |');

    // Check queue.finished event.
    const events = box.events();
    const finished = events.filter((e) => e.event === 'queue.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ reason: 'exhausted' });
    const batches = finished[0]?.batches as
      { batch_id: string; run_id: string; verdict: string }[] | undefined;
    expect(batches).toHaveLength(2);
    expect(batches?.[0]?.verdict).toBe('PASS');
    expect(batches?.[1]?.verdict).toBe('PASS');
  });
});
