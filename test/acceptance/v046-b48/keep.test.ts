// Acceptance tests for v046-b48 — [保持] scenarios K1–K4.
// Existing behaviour that must continue to hold after test_gaps is added.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VerdictSchema } from '../../../src/schema/index.js';
import { gateDecision, type GateInput } from '../../../src/gate.js';
import type { FakeSceneContext } from '../../../src/runner/fake.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { Verdict } from '../../../src/schema/index.js';
import { BATCH, honestClaims, Sandbox, TEST_CMD, workerScene } from '../../support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// K1: VerdictSchema parses a verdict without test_gaps
// ---------------------------------------------------------------------------

describe('K1: VerdictSchema parses verdict without test_gaps', () => {
  it('K1: parse succeeds for a valid verdict with no test_gaps field', () => {
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
      reason: 'all good',
    };

    const result = VerdictSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// K2: gateDecision passes when all values are good and testGapsCount is 0
// ---------------------------------------------------------------------------

describe('K2: gateDecision passes with all good values and testGapsCount=0', () => {
  it('K2: pass is true and reasons is empty', () => {
    const input: GateInput = {
      downgraded: false,
      claimMismatches: 0,
      ciConclusion: 'success',
      ciBranchMatched: true,
      depsDiffCount: 0,
      specDiffLines: 0,
      gapsCount: 0,
    };

    const result = gateDecision(input);
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helpers for queue-mode scenarios (K3, K4)
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

/** Reviewer: PASS cleanly (no gaps, no test_gaps). */
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

/** Reviewer: PASS with gaps (non-empty gaps, no test_gaps). */
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
    gaps: ['少了一个边界'],
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

// ---------------------------------------------------------------------------
// K3: queue run without test_gaps → exit 0, no queue.paused, no test_gaps key
// ---------------------------------------------------------------------------

describe('K3: queue run without test_gaps → clean pass', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: BATCH, title: '示例功能', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: keep test_gaps clean');
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exit code is 0', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      reviewerClean(box, BATCH),
    ]);
    const exitCode = await box.cli(['run', '--continue'], runner);
    expect(exitCode).toBe(0);
  });

  it('K3: no queue.paused event in journal', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      reviewerClean(box, BATCH),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const paused = events.find((e) => e.event === 'queue.paused');
    expect(paused).toBeUndefined();
  });

  it('K3: reviewer.verdict event has no test_gaps key', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      reviewerClean(box, BATCH),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const verdictEvt = events.find((e) => e.event === 'reviewer.verdict');
    expect(verdictEvt).toBeDefined();
    expect('test_gaps' in (verdictEvt as Record<string, unknown>)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// K4: queue run with gaps (no test_gaps) → exit 30, queue.paused has gaps only
// ---------------------------------------------------------------------------

describe('K4: queue run with gaps only → exit 30 and queue.paused has gaps', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: BATCH, title: '示例功能', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: keep gaps only');
  });

  afterEach(() => {
    box.dispose();
  });

  it('K4: exit code is 30', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      reviewerWithGaps(box, BATCH),
    ]);
    const exitCode = await box.cli(['run', '--continue'], runner);
    expect(exitCode).toBe(30);
  });

  it('K4: queue.paused reasons contain gaps but not test_gaps', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      reviewerWithGaps(box, BATCH),
    ]);
    await box.cli(['run', '--continue'], runner);
    const events = box.events();
    const paused = events.find((e) => e.event === 'queue.paused');
    expect(paused).toBeDefined();
    const reasons = (paused as unknown as { reasons: string[] }).reasons;
    expect(reasons).toContain('gaps');
    expect(reasons).not.toContain('test_gaps');
  });
});
