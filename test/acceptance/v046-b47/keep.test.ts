// Acceptance tests for v046-b47 — [保持] scenarios K1–K3.
// K1: buildReviewerPrompt without evidence → has "逐条原样实跑", no "R2 已经实跑过", no "JSON 块里不要写".
// K2: with evidence and specific cmd → prompt has that cmd, "## 验收命令", "## R2 的取证结果".
// K3: sandbox run → exit 0, calls are worker then reviewer.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReviewerPrompt, type ReviewerInput } from '../../../src/roles/reviewer.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import { fooledReviewerScene, honestClaims, Sandbox, workerScene } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// K1: without evidence → has "逐条原样实跑", no "R2 已经实跑过", no "JSON 块里不要写"
// ---------------------------------------------------------------------------

describe('K1: buildReviewerPrompt without evidence keeps original instructions', () => {
  it('K1: has "逐条原样实跑", no "R2 已经实跑过", no "JSON 块里不要写"', () => {
    const input: ReviewerInput = {
      batch_id: 'v01-b03',
      base_sha: '96d2c1c',
      head_sha: '080377c',
      items: ['item'],
      acceptance: [{ desc: 'tests', cmd: 'npm test', expect: 'exit_zero' }],
      spec_paths: ['SPEC.md'],
    };

    const prompt = buildReviewerPrompt(input);

    expect(prompt).toContain('逐条原样实跑');
    expect(prompt).not.toContain('R2 已经实跑过');
    expect(prompt).not.toContain('JSON 块里不要写');
  });
});

// ---------------------------------------------------------------------------
// K2: with evidence and specific cmd → prompt has cmd, "## 验收命令", "## R2 的取证结果"
// ---------------------------------------------------------------------------

describe('K2: buildReviewerPrompt with evidence retains acceptance commands and evidence heading', () => {
  it('K2: prompt has "npm test -- test/x.test.ts", "## 验收命令" line, and "## R2 的取证结果" line', () => {
    const input = {
      batch_id: 'v01-b03',
      base_sha: '96d2c1c',
      head_sha: '080377c',
      items: ['item'],
      acceptance: [
        { desc: 'run x tests', cmd: 'npm test -- test/x.test.ts', expect: 'exit_zero' as const },
      ],
      spec_paths: ['SPEC.md'],
      evidence: {
        commits_actual: ['080377c'],
        verify_results: [
          { cmd: 'npm test -- test/x.test.ts', exit_code: 0, summary: 'Tests 5 passed (5)' },
        ],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 0,
      },
    } as unknown as ReviewerInput;

    const prompt = buildReviewerPrompt(input);
    const lines = prompt.split('\n');

    // Must have the specific command text
    expect(prompt).toContain('npm test -- test/x.test.ts');

    // Must have exact heading lines
    const acceptanceLine = lines.find((l) => l === '## 验收命令');
    expect(acceptanceLine).toBe('## 验收命令');

    const evidenceLine = lines.find((l) => l === '## R2 的取证结果');
    expect(evidenceLine).toBe('## R2 的取证结果');
  });
});

// ---------------------------------------------------------------------------
// K3: sandbox run → exit 0, calls are worker then reviewer
// ---------------------------------------------------------------------------

describe('K3: sandbox run order and exit code', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exit 0, calls are worker then reviewer', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);
    expect(runner.calls.length).toBeGreaterThanOrEqual(2);
    expect(runner.calls[0]?.role).toBe('worker');
    expect(runner.calls[1]?.role).toBe('reviewer');
  });
});
