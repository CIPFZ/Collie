// Acceptance tests for v046-b43 — [保持] scenarios K1–K4.
// These behaviours must continue to work after the reviewer-skip optimisation.
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
// K1: fail.sh acceptance → exit 10, verdict downgraded, acceptance.failed
// ---------------------------------------------------------------------------

describe('K1: fail.sh acceptance failure', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    await addFailScript(box);
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: exit 10, verdict.downgraded PASS to FIX rule 8, acceptance.failed sh fail.sh, run.finished FIX', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(10);

    const events = box.events();

    // verdict.downgraded from PASS to FIX rule 8
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 8,
    });

    // acceptance.failed with cmd sh fail.sh
    const failed = events.find((e) => e.event === 'acceptance.failed' && e.cmd === 'sh fail.sh');
    expect(failed).toBeDefined();

    // run.finished verdict FIX
    const finished = events.find((e) => e.event === 'run.finished');
    expect(finished).toBeDefined();
    expect(finished).toMatchObject({ verdict: 'FIX' });
  });
});

// ---------------------------------------------------------------------------
// K2: worker edits SPEC.md → exit 20, evidence spec_diff_lines > 0, BLOCK
// ---------------------------------------------------------------------------

describe('K2: worker edits SPEC.md results in BLOCK', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K2: exit 20, evidence.collected spec_diff_lines > 0, run.finished BLOCK rule 2', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47),
        editSpec: true,
      }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(20);

    const events = box.events();

    // evidence.collected with spec_diff_lines > 0
    const evidence = events.find((e) => e.event === 'evidence.collected');
    expect(evidence).toBeDefined();
    const specDiff = (evidence as unknown as { spec_diff_lines: number }).spec_diff_lines;
    expect(specDiff).toBeGreaterThan(0);

    // run.finished verdict BLOCK rule 2
    const finished = events.find((e) => e.event === 'run.finished');
    expect(finished).toBeDefined();
    expect(finished).toMatchObject({ verdict: 'BLOCK' });
    const finishedRule = (finished as unknown as { rule: number }).rule;
    expect(finishedRule).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// K3: normal PASS run → exit 0, worker then reviewer, no skipped/downgraded
// ---------------------------------------------------------------------------

describe('K3: normal PASS run', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exit 0, runner calls worker then reviewer, no reviewer.skipped, no verdict.downgraded', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    // Runner called twice: worker, then reviewer
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]?.role).toBe('worker');
    expect(runner.calls[1]?.role).toBe('reviewer');

    const events = box.events();

    // No reviewer.skipped (new event type, cast to string)
    const skipped = events.filter((e) => (e.event as string) === 'reviewer.skipped');
    expect(skipped).toHaveLength(0);

    // No verdict.downgraded
    const downgraded = events.filter((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// K4: reviewer says FIX → exit 10, run.finished rule 10
// ---------------------------------------------------------------------------

describe('K4: reviewer says FIX', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K4: exit 10, run.finished rule 10', async () => {
    const runner = new FakeRunner([
      workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47) }),
      fooledReviewerScene(box, 'FIX'),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(10);

    const events = box.events();
    const finished = events.find((e) => e.event === 'run.finished');
    expect(finished).toBeDefined();
    const rule = (finished as unknown as { rule: number }).rule;
    expect(rule).toBe(10);
  });
});
