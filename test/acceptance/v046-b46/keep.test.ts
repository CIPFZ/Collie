// Acceptance tests for v046-b46 — [保持] scenarios K1–K4.
// K1: buildReviewerPrompt without evidence has no "## R2 的取证结果".
// K2: VerdictSchema parses verdict with evidence; spec_diff_lines preserved.
// K3: sandbox run exits 0; runner calls are worker then reviewer.
// K4: reviewer claims spec_diff_lines 99; evidence.collected event has 0.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildReviewerPrompt, type ReviewerInput } from '../../../src/roles/reviewer.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import { VerdictSchema } from '../../../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  TEST_CMD,
  workerScene,
} from '../../support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// K1: buildReviewerPrompt without evidence → no "## R2 的取证结果"
// ---------------------------------------------------------------------------

describe('K1: buildReviewerPrompt without evidence', () => {
  it('K1: prompt does not contain "## R2 的取证结果"', () => {
    const input: ReviewerInput = {
      batch_id: 'v01-b03',
      base_sha: '96d2c1c',
      head_sha: '080377c',
      items: ['item'],
      acceptance: [{ desc: 'tests', cmd: 'npm test', expect: 'exit_zero' }],
      spec_paths: ['SPEC.md'],
    };

    const prompt = buildReviewerPrompt(input);
    expect(prompt).not.toContain('## R2 的取证结果');
  });
});

// ---------------------------------------------------------------------------
// K2: VerdictSchema parses verdict with evidence; spec_diff_lines preserved
// ---------------------------------------------------------------------------

describe('K2: VerdictSchema with evidence', () => {
  it('K2: safeParse succeeds and evidence.spec_diff_lines is 42', () => {
    const verdict = {
      schema_version: 1,
      batch_id: 'v01-b03',
      verdict: 'FIX',
      evidence: {
        commits_actual: ['080377c'],
        verify_results: [{ cmd: 'npm test', exit_code: 1, summary: '44 passed, 3 failed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 42,
      },
      claim_mismatches: [],
      gaps: ['3 tests fail'],
      reason: 'tests do not pass',
    };
    const result = VerdictSchema.safeParse(verdict);
    expect(result.success).toBe(true);
    if (result.success) {
      const parsed = result.data as unknown as { evidence: { spec_diff_lines: number } };
      expect(parsed.evidence.spec_diff_lines).toBe(42);
    }
  });
});

// ---------------------------------------------------------------------------
// K3: sandbox run exits 0; runner calls are worker then reviewer
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

// ---------------------------------------------------------------------------
// K4: reviewer claims spec_diff_lines 99; evidence.collected has 0
// ---------------------------------------------------------------------------

describe('K4: reviewer spec_diff_lines overridden by R2 measurement', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K4: exit 0, evidence.collected spec_diff_lines is 0', async () => {
    // Custom reviewer scene with spec_diff_lines: 99 in its verdict
    const lyingBody = {
      schema_version: 1,
      batch_id: BATCH,
      verdict: 'PASS',
      evidence: {
        commits_actual: [],
        verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '47 passed, 0 failed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 99,
      },
      claim_mismatches: [],
      gaps: [],
      reason: 'the report looks complete',
    };
    const lyingReviewerScene: FakeScene = {
      expectRole: 'reviewer',
      effect: ({ cwd }: FakeSceneContext) => {
        box.reviewerCwd = cwd;
      },
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n看起来都对。\n\n${FENCE}json\n${JSON.stringify(lyingBody, null, 2)}\n${FENCE}\n`,
      },
    };

    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      lyingReviewerScene,
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    const events = box.events();
    const evidenceEvent = events.find((e) => e.event === 'evidence.collected');
    expect(evidenceEvent).toBeDefined();
    const specDiff = (evidenceEvent as unknown as { spec_diff_lines: number }).spec_diff_lines;
    expect(specDiff).toBe(0);
  });
});
