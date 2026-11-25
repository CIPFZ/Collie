// Acceptance tests for v046-b48 — [新] scenarios S1–S4.
// test_gaps: a new field on VerdictSchema and a new gateDecision condition.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FakeSceneContext } from '../../../src/runner/fake.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import { BATCH, honestClaims, Sandbox, TEST_CMD, workerScene } from '../../support/sandbox.js';

// Module paths for dynamic import (modules that may gain new behaviour).
const SCHEMA_MODULE = '../../../src/schema/index.js';
const GATE_MODULE = '../../../src/gate.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// S1: VerdictSchema parses a verdict with test_gaps
// ---------------------------------------------------------------------------

describe('S1: VerdictSchema parses verdict with test_gaps', () => {
  it('S1: parse succeeds and test_gaps is preserved verbatim', async () => {
    const mod = (await import(SCHEMA_MODULE)) as unknown as {
      VerdictSchema: { safeParse: (data: unknown) => { success: boolean; data?: unknown } };
    };

    const input = {
      schema_version: 1,
      batch_id: 'v99-b01',
      verdict: 'PASS',
      evidence: {
        commits_actual: [],
        verify_results: [{ cmd: 'sh run-tests.sh', exit_code: 0, summary: '1 passed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 0,
      },
      claim_mismatches: [],
      gaps: [],
      reason: 'looks good',
      test_gaps: ['S2 的用例只断言了不报错'],
    };

    const result = mod.VerdictSchema.safeParse(input);
    expect(result.success).toBe(true);

    const parsed = result.data as { test_gaps?: string[] };
    expect(parsed.test_gaps).toEqual(['S2 的用例只断言了不报错']);
  });
});

// ---------------------------------------------------------------------------
// S2: gateDecision with testGapsCount=1 blocks
// ---------------------------------------------------------------------------

describe('S2: gateDecision blocks when testGapsCount is 1', () => {
  it('S2: pass is false and reasons is exactly ["test_gaps"]', async () => {
    const mod = (await import(GATE_MODULE)) as unknown as {
      gateDecision: (input: unknown) => { pass: boolean; reasons: string[] };
    };

    // Build a passing input (all other conditions satisfied), then add testGapsCount.
    const input = {
      downgraded: false,
      claimMismatches: 0,
      ciConclusion: 'success',
      ciBranchMatched: true,
      depsDiffCount: 0,
      specDiffLines: 0,
      gapsCount: 0,
      testGapsCount: 1,
    } as unknown;

    const result = mod.gateDecision(input);
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual(['test_gaps']);
  });
});

// ---------------------------------------------------------------------------
// Helpers for queue-mode scenarios (S3, S4)
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

/** Reviewer: PASS with test_gaps (the new field). */
function reviewerWithTestGaps(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  // Build a Verdict-shaped object including test_gaps.
  // The type doesn't have test_gaps yet, so we construct it untyped.
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
    reason: 'pass with test_gaps',
    test_gaps: ['S2 的用例只断言了不报错'],
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过但有测试空白。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Worker scene for queue mode. */
function queueWorkerScene(box: Sandbox) {
  return workerScene(box, {
    passing: 47,
    failing: 0,
    push: true,
    claims: honestClaims(47, true),
  });
}

// ---------------------------------------------------------------------------
// S3: queue mode with test_gaps → exit 30, passed, queue.paused has test_gaps
// ---------------------------------------------------------------------------

describe('S3: queue run with test_gaps → exit 30 and queue.paused', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Set up backlog with BATCH as pending.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: BATCH, title: '示例功能', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: test_gaps queue backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: exit code is 30', async () => {
    const runner = new FakeRunner([queueWorkerScene(box), reviewerWithTestGaps(box, BATCH)]);
    const exitCode = await box.cli(['run', '--continue'], runner);
    expect(exitCode).toBe(30);
  });

  it('S3: backlog status becomes passed', async () => {
    const runner = new FakeRunner([queueWorkerScene(box), reviewerWithTestGaps(box, BATCH)]);
    await box.cli(['run', '--continue'], runner);
    const backlog = box.read('docs/backlog.md');
    expect(backlog).toMatch(new RegExp(`${BATCH}.*passed`));
  });

  it('S3: queue.paused event has reasons containing test_gaps', async () => {
    const runner = new FakeRunner([queueWorkerScene(box), reviewerWithTestGaps(box, BATCH)]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const paused = events.find((e) => e.event === 'queue.paused');
    expect(paused).toBeDefined();
    const reasons = (paused as unknown as { reasons: string[] }).reasons;
    expect(reasons).toContain('test_gaps');
  });
});

// ---------------------------------------------------------------------------
// S4: reviewer.verdict event carries test_gaps
// ---------------------------------------------------------------------------

describe('S4: reviewer.verdict event includes test_gaps', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: BATCH, title: '示例功能', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: test_gaps verdict event backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('S4: reviewer.verdict event has test_gaps array with one item', async () => {
    const runner = new FakeRunner([queueWorkerScene(box), reviewerWithTestGaps(box, BATCH)]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const verdictEvt = events.find((e) => e.event === 'reviewer.verdict');
    expect(verdictEvt).toBeDefined();
    const testGaps = (verdictEvt as unknown as { test_gaps: string[] }).test_gaps;
    expect(testGaps).toEqual(['S2 的用例只断言了不报错']);
  });
});
