// Acceptance tests for v046-b46 — [新] scenarios S1–S4.
// S1: buildReviewerPrompt with evidence in input includes "## R2 的取证结果" section.
// S2: VerdictSchema parses a verdict without evidence key.
// S3: sandbox run with no-evidence reviewer verdict → exit 0, verdict PASS.
// S4: sandbox run, reviewer prompt includes R2 evidence section.
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
  workerScene,
} from '../../support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// S1: buildReviewerPrompt with evidence → prompt includes evidence section
// ---------------------------------------------------------------------------

describe('S1: buildReviewerPrompt with evidence', () => {
  it('S1: prompt has a line "## R2 的取证结果" and contains "Tests 12 passed (12)"', () => {
    const baseInput = {
      batch_id: 'v01-b03',
      base_sha: '96d2c1c',
      head_sha: '080377c',
      items: ['item'],
      acceptance: [{ desc: 'tests', cmd: 'npm test', expect: 'exit_zero' as const }],
      spec_paths: ['SPEC.md'],
    };
    const evidence = {
      commits_actual: ['080377c'],
      verify_results: [{ cmd: 'npm test', exit_code: 0, summary: 'Tests 12 passed (12)' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    };
    const inputWithEvidence = { ...baseInput, evidence } as unknown as ReviewerInput;

    const prompt = buildReviewerPrompt(inputWithEvidence);
    const lines = prompt.split('\n');

    // Must have an exact line "## R2 的取证结果"
    const headingLine = lines.find((l) => l === '## R2 的取证结果');
    expect(headingLine).toBe('## R2 的取证结果');

    // Must contain the test summary
    expect(prompt).toContain('Tests 12 passed (12)');
  });
});

// ---------------------------------------------------------------------------
// S2: VerdictSchema parses verdict without evidence
// ---------------------------------------------------------------------------

describe('S2: VerdictSchema parses verdict without evidence key', () => {
  it('S2: safeParse succeeds for a verdict with no evidence, verdict PASS, gaps []', () => {
    const noEvidenceVerdict = {
      schema_version: 1,
      batch_id: 'v01-b03',
      verdict: 'PASS',
      claim_mismatches: [],
      gaps: [],
      reason: 'looks good',
    };
    const result = VerdictSchema.safeParse(noEvidenceVerdict);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S3: sandbox run with no-evidence reviewer verdict → exit 0, verdict PASS
// ---------------------------------------------------------------------------

describe('S3: sandbox run, reviewer verdict has no evidence key', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: exit 0, run.finished verdict is PASS', async () => {
    // A custom reviewer scene with no evidence in the verdict JSON
    const noEvidenceBody = {
      schema_version: 1,
      batch_id: BATCH,
      verdict: 'PASS',
      claim_mismatches: [],
      gaps: [],
      reason: 'the report looks complete',
    };
    const noEvidenceReviewerScene: FakeScene = {
      expectRole: 'reviewer',
      effect: ({ cwd }: FakeSceneContext) => {
        box.reviewerCwd = cwd;
      },
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n看起来都对。\n\n${FENCE}json\n${JSON.stringify(noEvidenceBody, null, 2)}\n${FENCE}\n`,
      },
    };

    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      noEvidenceReviewerScene,
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    const events = box.events();
    const finished = events.find((e) => e.event === 'run.finished');
    expect(finished).toBeDefined();
    expect((finished as unknown as { verdict: string }).verdict).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// S4: sandbox run, reviewer prompt includes R2 evidence section
// ---------------------------------------------------------------------------

describe('S4: reviewer prompt has R2 evidence section', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S4: reviewer prompt has line "## R2 的取证结果" and contains "受保护文件改动行数：0"', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);

    // The 2nd call (index 1) is the reviewer
    expect(runner.calls.length).toBeGreaterThanOrEqual(2);
    expect(runner.calls[1]?.role).toBe('reviewer');

    const prompt = runner.calls[1]?.prompt ?? '';
    const lines = prompt.split('\n');

    // Must have an exact line "## R2 的取证结果"
    const headingLine = lines.find((l) => l === '## R2 的取证结果');
    expect(headingLine).toBe('## R2 的取证结果');

    // Must contain the protected file diff lines info
    expect(prompt).toContain('受保护文件改动行数：0');
  });
});
