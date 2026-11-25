// Acceptance tests for v046-b47 — [新] scenarios S1–S3.
// S1: buildReviewerPrompt with evidence → no "逐条原样实跑", has "R2 已经实跑过" line.
// S2: same input → prompt contains "JSON 块里不要写".
// S3: sandbox run, reviewer prompt has no "逐条原样实跑".
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReviewerPrompt, type ReviewerInput } from '../../../src/roles/reviewer.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import { fooledReviewerScene, honestClaims, Sandbox, workerScene } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Shared evidence-bearing input for S1 and S2
// ---------------------------------------------------------------------------

function inputWithEvidence(): unknown {
  return {
    batch_id: 'v01-b03',
    base_sha: '96d2c1c',
    head_sha: '080377c',
    items: ['item'],
    acceptance: [{ desc: 'tests', cmd: 'npm test', expect: 'exit_zero' }],
    spec_paths: ['SPEC.md'],
    evidence: {
      commits_actual: ['080377c'],
      verify_results: [{ cmd: 'npm test', exit_code: 0, summary: 'Tests 12 passed (12)' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// S1: with evidence, prompt has no "逐条原样实跑" and has the R2-ran notice
// ---------------------------------------------------------------------------

describe('S1: buildReviewerPrompt with evidence omits 逐条原样实跑', () => {
  it('S1: prompt does not contain "逐条原样实跑" and has exact R2-ran notice line', () => {
    const input = inputWithEvidence() as ReviewerInput;
    const prompt = buildReviewerPrompt(input);

    // Must NOT have the old "run them yourself" instruction
    expect(prompt).not.toContain('逐条原样实跑');

    // Must have this exact line
    const lines = prompt.split('\n');
    const noticeLine = lines.find(
      (l) => l === '以下命令 R2 已经实跑过，结果在下面「R2 的取证结果」一节，不用重跑。',
    );
    expect(noticeLine).toBe('以下命令 R2 已经实跑过，结果在下面「R2 的取证结果」一节，不用重跑。');
  });
});

// ---------------------------------------------------------------------------
// S2: with evidence, prompt contains "JSON 块里不要写"
// ---------------------------------------------------------------------------

describe('S2: buildReviewerPrompt with evidence includes JSON block instruction', () => {
  it('S2: prompt contains "JSON 块里不要写"', () => {
    const input = inputWithEvidence() as ReviewerInput;
    const prompt = buildReviewerPrompt(input);

    expect(prompt).toContain('JSON 块里不要写');
  });
});

// ---------------------------------------------------------------------------
// S3: sandbox run, reviewer prompt has no "逐条原样实跑"
// ---------------------------------------------------------------------------

describe('S3: sandbox reviewer prompt omits 逐条原样实跑', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: reviewer (2nd call) prompt does not contain "逐条原样实跑"', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);

    // The 2nd call (index 1) is the reviewer
    expect(runner.calls.length).toBeGreaterThanOrEqual(2);
    expect(runner.calls[1]?.role).toBe('reviewer');

    const prompt = runner.calls[1]?.prompt ?? '';
    expect(prompt).not.toContain('逐条原样实跑');
  });
});
