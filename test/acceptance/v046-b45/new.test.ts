// Acceptance tests for v046-b45 — [新] scenarios S1–S3.
// S1 & S2: when the reviewer is skipped (rule 8), formatWhy shows
// "reviewer: skipped (rule 8)" and the verdict.downgraded line shows
// "PASS (assumed) → FIX".
// S3: worker lies about test counts; second run's task.md contains the lie
// and the actual measured value.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  TEST_CMD,
  workerScene,
} from '../../support/sandbox.js';

const VIEW_MODULE = '../../../src/view.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Adds `sh fail.sh` (silent, exit 1) to global acceptance commands. */
async function addFailScript(box: Sandbox): Promise<void> {
  const toml = box.read('.collie/collie.toml');
  const newToml = toml.replace(
    `commands = ["${TEST_CMD}"]`,
    `commands = ["${TEST_CMD}", "sh fail.sh"]`,
  );
  box.write('.collie/collie.toml', newToml);
  box.write('fail.sh', '#!/bin/sh\nexit 1\n');
  await box.commitAll('add fail.sh to verify commands');
}

// ---------------------------------------------------------------------------
// S1 & S2: fail.sh in acceptance → reviewer skipped → formatWhy output
// ---------------------------------------------------------------------------

describe('S1 & S2: reviewer skipped, formatWhy text', () => {
  let box: Sandbox;
  let whyText: string;

  beforeEach(async () => {
    box = await Sandbox.create();
    await addFailScript(box);
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);

    // Build formatWhy text from the sandbox runs
    const mod = (await import(VIEW_MODULE)) as unknown as {
      loadRuns: (root: string) => unknown[];
      projectWhy: (runDataList: unknown[], batchId: string) => unknown;
      formatWhy: (proj: unknown) => string;
    };
    const runs = mod.loadRuns(box.root);
    const proj = mod.projectWhy(runs, BATCH);
    whyText = mod.formatWhy(proj);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S1: formatWhy has a line "reviewer: skipped (rule 8)" and no line "reviewer: —"', () => {
    const lines = whyText.split('\n');
    const reviewerSkippedLine = lines.find((l) => l === 'reviewer: skipped (rule 8)');
    expect(reviewerSkippedLine).toBeDefined();

    const reviewerDashLine = lines.find((l) => l === 'reviewer: —');
    expect(reviewerDashLine).toBeUndefined();
  });

  it('S2: verdict.downgraded line contains "PASS (assumed) → FIX"', () => {
    const lines = whyText.split('\n');
    const downgradedLine = lines.find((l) => l.startsWith('verdict.downgraded:'));
    expect(downgradedLine).toBeDefined();
    expect(downgradedLine).toContain('PASS (assumed) → FIX');
  });
});

// ---------------------------------------------------------------------------
// S3: worker lies about test counts; second run task.md has claim and actual
// ---------------------------------------------------------------------------

describe('S3: worker lies about test counts, two runs', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: first run exits 10; second run task.md has {"passed":47,"failed":0} and "failed":3', async () => {
    // First run: worker claims 47/0, actually 44/3 (scenario B style)
    const firstRunner = new FakeRunner([
      workerScene(box, {
        passing: 44,
        failing: 3,
        push: true,
        claims: honestClaims(47, false),
      }),
      fooledReviewerScene(box),
    ]);
    const firstExit = await box.run(firstRunner);
    expect(firstExit).toBe(10);

    // Second run: a custom worker that captures task.md
    let capturedTaskMd = '';
    const secondWorkerScene: FakeScene = {
      expectRole: 'worker',
      effect: ({ cwd }: FakeSceneContext) => {
        capturedTaskMd = readFileSync(join(cwd, '.collie', 'batches', BATCH, 'task.md'), 'utf8');
      },
      result: { exitCode: 0 },
    };
    const secondRunner = new FakeRunner([secondWorkerScene]);
    await box.run(secondRunner);

    expect(capturedTaskMd).not.toBe('');
    // task.md contains the original claim: {"passed":47,"failed":0}
    expect(capturedTaskMd).toContain('{"passed":47,"failed":0}');
    // task.md contains the actual measured failure count
    expect(capturedTaskMd).toContain('"failed":3');
  });
});
