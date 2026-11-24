// Acceptance tests for v046-b45 — [保持] scenarios K1–K3.
// K1: normal PASS run, formatWhy shows "reviewer: PASS" (not skipped, not assumed).
// K2: renderFixSection with claimMismatches formats correctly.
// K3: worker lies about test counts; first run exits 10 with claim.mismatch rule 6, field tests.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderFixSection, type FixInfo } from '../../../src/run.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from '../../support/sandbox.js';

const VIEW_MODULE = '../../../src/view.js';

// ---------------------------------------------------------------------------
// K1: normal PASS run → formatWhy shows reviewer: PASS, no skipped/assumed
// ---------------------------------------------------------------------------

describe('K1: normal PASS run, formatWhy output', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: formatWhy has reviewer: PASS line, no skipped, no (assumed); JSON has no reviewerSkipped nor assumed', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);

    const mod = (await import(VIEW_MODULE)) as unknown as {
      loadRuns: (root: string) => unknown[];
      projectWhy: (runDataList: unknown[], batchId: string) => unknown;
      formatWhy: (proj: unknown) => string;
    };
    const runs = mod.loadRuns(box.root);
    const proj = mod.projectWhy(runs, BATCH);
    const whyText = mod.formatWhy(proj);

    const lines = whyText.split('\n');

    // Has a line starting with "reviewer: PASS"
    const reviewerLine = lines.find((l) => l.startsWith('reviewer: PASS'));
    expect(reviewerLine).toBeDefined();

    // No "skipped"
    expect(whyText).not.toContain('skipped');

    // No "(assumed)"
    expect(whyText).not.toContain('(assumed)');

    // JSON.stringify of the projection doesn't contain reviewerSkipped or assumed
    const projJson = JSON.stringify(proj);
    expect(projJson).not.toContain('reviewerSkipped');
    expect(projJson).not.toContain('assumed');
  });
});

// ---------------------------------------------------------------------------
// K2: renderFixSection with claimMismatches field head_sha
// ---------------------------------------------------------------------------

describe('K2: renderFixSection with claimMismatches', () => {
  it('K2: output has line exactly "- head_sha：claimed `abc1234`，actual `unresolvable`"', () => {
    const info = {
      gaps: [],
      failedAcceptance: [],
      commits: [],
      claimMismatches: [{ field: 'head_sha', claimed: 'abc1234', actual: 'unresolvable' }],
    } as unknown as FixInfo;

    const result = renderFixSection(info);
    const lines = result.split('\n');
    const targetLine = lines.find(
      (l) => l === '- head_sha：claimed `abc1234`，actual `unresolvable`',
    );
    expect(targetLine).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// K3: worker lies about test counts; first run exits 10 with claim.mismatch
// ---------------------------------------------------------------------------

describe('K3: worker lies about test counts, claim.mismatch rule 6', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: first run exits 10, journal has claim.mismatch with rule 6 and field tests', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 44,
        failing: 3,
        push: true,
        claims: honestClaims(47, false),
      }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(10);

    const events = box.events();
    const mismatch = events.find((e) => e.event === 'claim.mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch).toMatchObject({
      rule: 6,
      field: 'tests',
    });
  });
});
