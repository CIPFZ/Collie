// SPEC 14.2: tests for `collie report` — queue run Markdown report.
// Two sandbox scenarios:
//   1. Two batches consecutive PASS.
//   2. First FIX then PASS (same batch).
// Plus: old journal without queue.preflight, exit codes, --json.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';
import { git } from '../src/git.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Multi-batch backlog helpers
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

function queueWorkerScene(
  box: Sandbox,
  batchId: string,
  push: boolean,
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
      if (push) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0, costUsd: 5.0, numTurns: 10, durationMs: 60_000 },
  };
}

function queueReviewerPassScene(
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

function queueReviewerFixScene(
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

// ===================================================================
// Group 1: Two batches consecutive PASS
// ===================================================================

describe('collie report: two batches consecutive PASS', () => {
  let box: Sandbox;
  let reportOutput: string;

  beforeEach(async () => {
    box = await Sandbox.create();
    box.write(
      'docs/backlog.md',
      makeBacklog([
        { priority: 1, id: 'v99-a01', title: '第一', depends: '—', status: 'pending' },
        { priority: 2, id: 'v99-a02', title: '第二', depends: 'v99-a01', status: 'pending' },
      ]),
    );
    await box.commitAll('chore: two-batch backlog');

    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-a01', true),
      queueReviewerPassScene(box, 'v99-a01'),
      queueWorkerScene(box, 'v99-a02', true),
      queueReviewerPassScene(box, 'v99-a02'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    // Now run the report command.
    box.output.length = 0;
    const reportCode = await box.cli(['report'], undefined);
    expect(reportCode).toBe(0);
    reportOutput = box.output.join('');
  });

  afterEach(() => {
    box.dispose();
  });

  it('all seven section headings present and in order', () => {
    const headings = [
      '# 队列运行',
      '## 开跑前检查',
      '## 实际经过',
      '## 放行与打扰',
      '## 每个批次',
      '## 队列 journal',
      '## 队列剩余',
    ];
    let pos = 0;
    for (const h of headings) {
      const idx = reportOutput.indexOf(h, pos);
      expect(idx, `heading "${h}" not found after position ${String(pos)}`).toBeGreaterThanOrEqual(
        pos,
      );
      pos = idx + h.length;
    }
  });

  it('实际经过 table has two data rows matching both batches', () => {
    // Two data rows (not counting header + separator + totals).
    const tableLines = reportOutput
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('|---') &&
          !line.includes('顺序') &&
          !line.includes('合计'),
      );
    expect(tableLines).toHaveLength(2);
    expect(tableLines[0]).toContain('v99-a01');
    expect(tableLines[1]).toContain('v99-a02');
    // Both PASS.
    expect(tableLines[0]).toContain('PASS');
    expect(tableLines[1]).toContain('PASS');
    // Both attempt 1.
    expect(tableLines[0]).toMatch(/\| 1 \| PASS/);
    expect(tableLines[1]).toMatch(/\| 1 \| PASS/);
  });

  it('打扰 line shows 0', () => {
    expect(reportOutput).toContain('打扰：0');
  });

  it('preflight section shows check items (not dash)', () => {
    // New journals from v045 have queue.preflight. Should have check items.
    const preflightSection = reportOutput.split('## 开跑前检查')[1]?.split('## 实际经过')[0] ?? '';
    // Should have ok lines like "ok   worktree_clean".
    expect(preflightSection).toContain('ok');
  });

  it('per-batch section contains why output for both batches', () => {
    const perBatchSection = reportOutput.split('## 每个批次')[1]?.split('## 队列 journal')[0] ?? '';
    expect(perBatchSection).toContain('v99-a01');
    expect(perBatchSection).toContain('v99-a02');
    // Both should have cost breakdown lines from why.
    expect(perBatchSection).toContain('cost:');
  });

  it('总花费 in table includes worker + reviewer', () => {
    // Each batch: worker $5.00, reviewer $1.00, total $6.00.
    const tableLines = reportOutput
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('|---') &&
          !line.includes('顺序') &&
          !line.includes('合计'),
      );
    for (const line of tableLines) {
      expect(line).toContain('$5.00');
      expect(line).toContain('$1.00');
      expect(line).toContain('$6.00');
    }
  });

  it('实际经过 table has a totals row summing the two batches', () => {
    const totalsLine = reportOutput.split('\n').find((line) => line.startsWith('| 合计')) ?? '';
    expect(totalsLine).not.toBe('');
    // Two batches: worker 5.00×2, reviewer 1.00×2, combined 6.00×2.
    expect(totalsLine).toContain('$10.00');
    expect(totalsLine).toContain('$2.00');
    expect(totalsLine).toContain('$12.00');
  });

  it('开始 / 墙钟 come from the queue journal itself, not a hand-written run.started', () => {
    // The sandbox clock ticks one second per run: the queue journal's first
    // event (queue.preflight) and queue.finished bound the wallclock.
    const started = /开始：(\S+)/.exec(reportOutput)?.[1] ?? '';
    const finished = /结束：(\S+)/.exec(reportOutput)?.[1] ?? '';
    expect(started).not.toBe('—');
    expect(finished).not.toBe('—');
    expect(reportOutput).not.toContain('墙钟：—');
    // The queue journal's first event is queue.preflight — never run.started.
    const queueJournal = box
      .events()
      .filter((e) => e.run_id.startsWith('q-'))
      .map((e) => e.event);
    expect(queueJournal[0]).toBe('queue.preflight');
    expect(queueJournal).not.toContain('run.started');
    // The report's start is the first journal event's timestamp.
    const first = box.events().find((e) => e.run_id.startsWith('q-'));
    expect(started).toBe(first?.ts);
  });

  it('放行与打扰 lists tool.denied and each batch.status transition', () => {
    const section = reportOutput.split('## 放行与打扰')[1]?.split('## 每个批次')[0] ?? '';
    expect(section).toMatch(/tool\.denied：\d+/);
    // Every batch that started got a status transition recorded.
    expect(section).toContain('batch.status: v99-a01');
    expect(section).toContain('batch.status: v99-a02');
    expect(section).toContain('→');
  });
});

// ===================================================================
// Group 2: First FIX then PASS (same batch, same queue run via fix_retry)
// ===================================================================

describe('collie report: FIX then PASS in same queue', () => {
  let box: Sandbox;
  let reportOutput: string;

  beforeEach(async () => {
    box = await Sandbox.create();
    box.write(
      'docs/backlog.md',
      makeBacklog([{ priority: 1, id: 'v99-b01', title: '唯一', depends: '—', status: 'pending' }]),
    );
    await box.commitAll('chore: single-batch backlog');

    // Single queue run: first attempt FIX, retry PASS (fix_max=2, so retry is allowed).
    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerFixScene(box, 'v99-b01'),
      queueWorkerScene(box, 'v99-b01', true),
      queueReviewerPassScene(box, 'v99-b01'),
    ]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    // Generate report.
    box.output.length = 0;
    const reportCode = await box.cli(['report'], undefined);
    expect(reportCode).toBe(0);
    reportOutput = box.output.join('');
  });

  afterEach(() => {
    box.dispose();
  });

  it('七个标题都在且顺序对', () => {
    const headings = [
      '# 队列运行',
      '## 开跑前检查',
      '## 实际经过',
      '## 放行与打扰',
      '## 每个批次',
      '## 队列 journal',
      '## 队列剩余',
    ];
    let pos = 0;
    for (const h of headings) {
      const idx = reportOutput.indexOf(h, pos);
      expect(idx, `heading "${h}" not found`).toBeGreaterThanOrEqual(pos);
      pos = idx + h.length;
    }
  });

  it('实际经过 table has two rows: FIX (attempt 1) and PASS (attempt 2)', () => {
    const tableLines = reportOutput
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('|---') &&
          !line.includes('顺序') &&
          !line.includes('合计'),
      );
    expect(tableLines).toHaveLength(2);
    // First row: FIX.
    expect(tableLines[0]).toContain('v99-b01');
    expect(tableLines[0]).toContain('FIX');
    // Second row: PASS.
    expect(tableLines[1]).toContain('v99-b01');
    expect(tableLines[1]).toContain('PASS');
  });

  it('打扰 is 0 (no paused, no BLOCK)', () => {
    expect(reportOutput).toContain('打扰：0');
  });

  it('per-batch why section shows both attempts', () => {
    const perBatch = reportOutput.split('## 每个批次')[1]?.split('## 队列 journal')[0] ?? '';
    expect(perBatch).toContain('attempt 1');
    expect(perBatch).toContain('attempt 2');
  });

  it('合计花费 in table includes worker + reviewer', () => {
    const tableLines = reportOutput
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('|---') &&
          !line.includes('顺序') &&
          !line.includes('合计'),
      );
    // Both rows should have worker $5.00 and total $6.00 (or $5.50 for the FIX with $0.50 reviewer).
    // FIX row: worker $5.00 + reviewer $0.50 = $5.50.
    expect(tableLines[0]).toContain('$5.00');
    expect(tableLines[0]).toContain('$0.50');
    expect(tableLines[0]).toContain('$5.50');
    // PASS row: worker $5.00 + reviewer $1.00 = $6.00.
    expect(tableLines[1]).toContain('$5.00');
    expect(tableLines[1]).toContain('$1.00');
    expect(tableLines[1]).toContain('$6.00');
  });
});

// ===================================================================
// Edge cases: old journal, exit codes, --json
// ===================================================================

describe('collie report: edge cases', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('exit code 2 when no queue runs exist', async () => {
    // No queue runs in a fresh sandbox.
    box.output.length = 0;
    const code = await box.cli(['report'], undefined);
    expect(code).toBe(2);
  });

  it('exit code 2 when specified queue run does not exist', async () => {
    box.output.length = 0;
    const code = await box.cli(['report', '--queue', 'q-nonexistent'], undefined);
    expect(code).toBe(2);
  });

  it('--json produces valid JSON', async () => {
    box.write(
      'docs/backlog.md',
      makeBacklog([{ priority: 1, id: 'v99-c01', title: '测试', depends: '—', status: 'pending' }]),
    );
    await box.commitAll('chore: json test backlog');

    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-c01', true),
      queueReviewerPassScene(box, 'v99-c01'),
    ]);
    await box.cli(['run', '--continue'], runner);

    box.output.length = 0;
    const code = await box.cli(['report', '--json'], undefined);
    expect(code).toBe(0);
    const raw = box.output.join('');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed).toHaveProperty('queueRunId');
    expect(parsed).toHaveProperty('batchRows');
    expect(Array.isArray(parsed.batchRows)).toBe(true);
  });

  it('old journal without queue.preflight shows — in §2', async () => {
    // Run a queue and then manually remove queue.preflight from the journal
    // to simulate an old journal. We can't easily remove the event, but we
    // can verify the code path by checking a queue run that does have it.
    // Instead, create a minimal queue scenario and verify that if preflight
    // is present it renders, and if absent it shows —.
    // For a real "old journal" test, we just check projectReport with empty
    // events (no queue.preflight).
    const { projectReport } = await import('../src/view.js');

    // Minimal events: just queue.batch_started and queue.finished
    // (no queue.preflight to simulate an old journal).
    const fakeEvents = [
      {
        ts: '2026-10-19T12:00:00.000Z',
        run_id: 'q-20261019120000',
        event: 'queue.batch_started' as const,
        batch_id: 'v01-b01',
      },
      {
        ts: '2026-10-19T12:10:00.000Z',
        run_id: 'q-20261019120000',
        event: 'queue.finished' as const,
        reason: 'exhausted',
      },
    ];
    const proj = projectReport([], fakeEvents, 'q-20261019120000');
    expect(proj.preflight).toBeNull();

    // formatReport with null preflight should produce —.
    const { formatReport } = await import('../src/view.js');
    const text = formatReport(proj, new Map(), '(no events)', '(none)');
    // The 开跑前检查 section should contain —.
    const preflightSection = text.split('## 开跑前检查')[1]?.split('## 实际经过')[0] ?? '';
    expect(preflightSection.trim()).toBe('—');
  });
});

// ===================================================================
// Group 4: Tester agent cost in report (SPEC 16.16)
// ===================================================================

describe('collie report: tester agent cost (SPEC 16.16)', () => {
  it('tester.finished cost included in total; tester column appears', async () => {
    const { projectReport, formatReport, formatWhy, projectWhy } = await import('../src/view.js');
    type Event = import('../src/schema/index.js').Event;
    type RunData = import('../src/view.js').RunData;

    // Build a batch run journal with tester.finished events.
    const batchRunId = 'r-20261120-100000';
    const batchEvents: Event[] = [
      {
        ts: '2026-11-20T10:00:00.000Z',
        run_id: batchRunId,
        event: 'run.started',
        batch_id: 'v99-t01',
      },
      {
        ts: '2026-11-20T10:00:01.000Z',
        run_id: batchRunId,
        event: 'tester.started',
        batch_id: 'v99-t01',
        attempt: 1,
      },
      {
        ts: '2026-11-20T10:00:30.000Z',
        run_id: batchRunId,
        event: 'tester.finished',
        batch_id: 'v99-t01',
        attempt: 1,
        exit_code: 0,
        num_turns: 6,
        cost_usd: 1.5,
        duration_ms: 29000,
      },
      {
        ts: '2026-11-20T10:01:00.000Z',
        run_id: batchRunId,
        event: 'worker.started',
        batch_id: 'v99-t01',
      },
      {
        ts: '2026-11-20T10:02:00.000Z',
        run_id: batchRunId,
        event: 'worker.finished',
        batch_id: 'v99-t01',
        exit_code: 0,
        num_turns: 10,
        cost_usd: 5.0,
        duration_ms: 60000,
      },
      {
        ts: '2026-11-20T10:02:30.000Z',
        run_id: batchRunId,
        event: 'reviewer.started',
        batch_id: 'v99-t01',
      },
      {
        ts: '2026-11-20T10:03:00.000Z',
        run_id: batchRunId,
        event: 'reviewer.finished',
        batch_id: 'v99-t01',
        exit_code: 0,
        num_turns: 4,
        cost_usd: 1.0,
      },
      {
        ts: '2026-11-20T10:03:01.000Z',
        run_id: batchRunId,
        event: 'reviewer.verdict',
        batch_id: 'v99-t01',
        verdict: 'PASS',
        gaps: [],
      },
      {
        ts: '2026-11-20T10:04:00.000Z',
        run_id: batchRunId,
        event: 'run.finished',
        batch_id: 'v99-t01',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'ok',
      },
    ];

    const allRunData: RunData[] = [{ runId: batchRunId, status: 'ok', events: batchEvents }];

    // Queue events referencing the batch run.
    const queueRunId = 'q-20261120100000';
    const queueEvents: Event[] = [
      {
        ts: '2026-11-20T09:59:00.000Z',
        run_id: queueRunId,
        event: 'queue.preflight',
        ok: true,
        checks: [{ name: 'worktree_clean', ok: true }],
      },
      {
        ts: '2026-11-20T10:00:00.000Z',
        run_id: queueRunId,
        event: 'queue.batch_started',
        batch_id: 'v99-t01',
        batch_run_id: batchRunId,
      },
      {
        ts: '2026-11-20T10:04:01.000Z',
        run_id: queueRunId,
        event: 'queue.finished',
        reason: 'exhausted',
      },
    ];

    const proj = projectReport(allRunData, queueEvents, queueRunId);

    // Batch row should include tester cost in total.
    expect(proj.batchRows).toHaveLength(1);
    const row = proj.batchRows[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(row.testerCost).toBe(1.5);
    expect(row.workerCost).toBe(5.0);
    expect(row.reviewerCost).toBe(1.0);
    // total = worker + reviewer + tester = 5.0 + 1.0 + 1.5 = 7.5
    expect(row.totalCost).toBeCloseTo(7.5);

    // Build why text for the per-batch section.
    const whyProj = projectWhy(allRunData, 'v99-t01');
    const whyText = whyProj !== null ? formatWhy(whyProj) : '';
    const whyTexts = new Map([['v99-t01', whyText]]);

    const text = formatReport(proj, whyTexts, '(queue events)', '(none)');

    // Table should have tester 花费 column.
    expect(text).toContain('tester 花费');

    // Per-batch why section should show tester cost breakdown.
    expect(text).toContain('tester=$1.50');

    // Total row should include tester cost.
    const totalsLine = text.split('\n').find((line) => line.startsWith('| 合计')) ?? '';
    expect(totalsLine).toContain('$1.50'); // tester total
    expect(totalsLine).toContain('$7.50'); // combined total
  });

  it('two tester invocations in one run: aggregated in total', async () => {
    const { projectReport } = await import('../src/view.js');
    type Event = import('../src/schema/index.js').Event;
    type RunData = import('../src/view.js').RunData;

    const batchRunId = 'r-20261120-110000';
    const batchEvents: Event[] = [
      {
        ts: '2026-11-20T11:00:00.000Z',
        run_id: batchRunId,
        event: 'run.started',
        batch_id: 'v99-t02',
      },
      {
        ts: '2026-11-20T11:00:10.000Z',
        run_id: batchRunId,
        event: 'tester.finished',
        batch_id: 'v99-t02',
        attempt: 1,
        exit_code: 0,
        num_turns: 4,
        cost_usd: 1.0,
        duration_ms: 10000,
      },
      {
        ts: '2026-11-20T11:00:30.000Z',
        run_id: batchRunId,
        event: 'tester.finished',
        batch_id: 'v99-t02',
        attempt: 2,
        exit_code: 0,
        num_turns: 3,
        cost_usd: 0.75,
        duration_ms: 8000,
      },
      {
        ts: '2026-11-20T11:01:00.000Z',
        run_id: batchRunId,
        event: 'worker.finished',
        batch_id: 'v99-t02',
        exit_code: 0,
        num_turns: 8,
        cost_usd: 4.0,
      },
      {
        ts: '2026-11-20T11:02:00.000Z',
        run_id: batchRunId,
        event: 'reviewer.finished',
        batch_id: 'v99-t02',
        exit_code: 0,
        num_turns: 3,
        cost_usd: 0.5,
      },
      {
        ts: '2026-11-20T11:03:00.000Z',
        run_id: batchRunId,
        event: 'run.finished',
        batch_id: 'v99-t02',
        verdict: 'PASS',
        exit_code: 0,
      },
    ];

    const allRunData: RunData[] = [{ runId: batchRunId, status: 'ok', events: batchEvents }];

    const queueRunId = 'q-20261120110000';
    const queueEvents: Event[] = [
      {
        ts: '2026-11-20T10:59:00.000Z',
        run_id: queueRunId,
        event: 'queue.batch_started',
        batch_id: 'v99-t02',
        batch_run_id: batchRunId,
      },
      {
        ts: '2026-11-20T11:03:01.000Z',
        run_id: queueRunId,
        event: 'queue.finished',
        reason: 'exhausted',
      },
    ];

    const proj = projectReport(allRunData, queueEvents, queueRunId);
    expect(proj.batchRows).toHaveLength(1);
    const row = proj.batchRows[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    // tester cost aggregated: 1.0 + 0.75 = 1.75
    expect(row.testerCost).toBeCloseTo(1.75);
    // total = 4.0 + 0.5 + 1.75 = 6.25
    expect(row.totalCost).toBeCloseTo(6.25);
  });

  it('no tester events: output byte-identical (no tester column)', async () => {
    const { projectReport, formatReport } = await import('../src/view.js');
    type Event = import('../src/schema/index.js').Event;
    type RunData = import('../src/view.js').RunData;

    const batchRunId = 'r-20261120-120000';
    const batchEvents: Event[] = [
      {
        ts: '2026-11-20T12:00:00.000Z',
        run_id: batchRunId,
        event: 'run.started',
        batch_id: 'v99-t03',
      },
      {
        ts: '2026-11-20T12:01:00.000Z',
        run_id: batchRunId,
        event: 'worker.finished',
        batch_id: 'v99-t03',
        exit_code: 0,
        num_turns: 10,
        cost_usd: 5.0,
      },
      {
        ts: '2026-11-20T12:02:00.000Z',
        run_id: batchRunId,
        event: 'reviewer.finished',
        batch_id: 'v99-t03',
        exit_code: 0,
        num_turns: 4,
        cost_usd: 1.0,
      },
      {
        ts: '2026-11-20T12:03:00.000Z',
        run_id: batchRunId,
        event: 'run.finished',
        batch_id: 'v99-t03',
        verdict: 'PASS',
        exit_code: 0,
      },
    ];

    const allRunData: RunData[] = [{ runId: batchRunId, status: 'ok', events: batchEvents }];

    const queueRunId = 'q-20261120120000';
    const queueEvents: Event[] = [
      {
        ts: '2026-11-20T11:59:00.000Z',
        run_id: queueRunId,
        event: 'queue.batch_started',
        batch_id: 'v99-t03',
        batch_run_id: batchRunId,
      },
      {
        ts: '2026-11-20T12:03:01.000Z',
        run_id: queueRunId,
        event: 'queue.finished',
        reason: 'exhausted',
      },
    ];

    const proj = projectReport(allRunData, queueEvents, queueRunId);
    expect(proj.batchRows).toHaveLength(1);
    const row = proj.batchRows[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(Object.prototype.hasOwnProperty.call(row, 'testerCost')).toBe(false);
    // total = worker + reviewer only
    expect(row.totalCost).toBeCloseTo(6.0);

    const text = formatReport(proj, new Map(), '(queue events)', '(none)');
    // No tester column.
    expect(text).not.toContain('tester 花费');
    // Original header intact.
    expect(text).toContain(
      '| 顺序 | 批次 | 运行 | attempt | 结论 | 规则 | 用时 | worker 花费 | reviewer 花费 | 合计 | worker 轮数 | head_sha | audit |',
    );
  });
});
