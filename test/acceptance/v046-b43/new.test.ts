// Acceptance tests for v046-b43 — [新] scenarios S1–S4.
// reviewer.skipped: when evidence alone determines the verdict (rule 8 acceptance
// failure, rule 2 spec touched), the reviewer is skipped; evidence.collected is
// emitted before reviewer.started in every run.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import {
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  TEST_CMD,
  workerScene,
} from '../../support/sandbox.js';

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
// S1 & S2: fail.sh in acceptance → reviewer skipped (rule 8)
// ---------------------------------------------------------------------------

describe('S1/S2: fail.sh acceptance failure skips reviewer', () => {
  let box: Sandbox;
  let runner: FakeRunner;

  beforeEach(async () => {
    box = await Sandbox.create();
    await addFailScript(box);
    runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S1: runner called once as worker, reviewer.skipped rule 8, no reviewer.started', () => {
    // Runner called only once, as worker
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.role).toBe('worker');

    const events = box.events();

    // reviewer.skipped event with rule 8 (new event type, cast to string)
    const skipped = events.find((e) => (e.event as string) === 'reviewer.skipped');
    expect(skipped).toBeDefined();
    const skippedRule = (skipped as unknown as { rule: number }).rule;
    expect(skippedRule).toBe(8);

    // No reviewer.started
    const started = events.filter((e) => e.event === 'reviewer.started');
    expect(started).toHaveLength(0);
  });

  it('S2: verdict.downgraded has assumed true', () => {
    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    const assumed = (downgraded as unknown as { assumed: boolean }).assumed;
    expect(assumed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S3: worker edits SPEC.md → reviewer skipped (rule 2)
// ---------------------------------------------------------------------------

describe('S3: worker edits SPEC.md, reviewer skipped', () => {
  let box: Sandbox;
  let runner: FakeRunner;

  beforeEach(async () => {
    box = await Sandbox.create();
    runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47),
        editSpec: true,
      }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: runner called once, reviewer.skipped rule 2', () => {
    // Runner called only once
    expect(runner.calls).toHaveLength(1);

    const events = box.events();

    // reviewer.skipped event with rule 2 (new event type, cast to string)
    const skipped = events.find((e) => (e.event as string) === 'reviewer.skipped');
    expect(skipped).toBeDefined();
    const skippedRule = (skipped as unknown as { rule: number }).rule;
    expect(skippedRule).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// S4: normal run → evidence.collected before reviewer.started
// ---------------------------------------------------------------------------

describe('S4: evidence.collected before reviewer.started', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S4: evidence.collected index is less than reviewer.started index', () => {
    const events = box.events();
    const evidenceIdx = events.findIndex((e) => e.event === 'evidence.collected');
    const reviewerIdx = events.findIndex((e) => e.event === 'reviewer.started');

    expect(evidenceIdx).toBeGreaterThanOrEqual(0);
    expect(reviewerIdx).toBeGreaterThanOrEqual(0);
    expect(evidenceIdx).toBeLessThan(reviewerIdx);
  });
});
