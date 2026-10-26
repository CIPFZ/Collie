// SPEC 12.1 scenario H: rule 9 regression test. The worker honestly reports
// pushed=false and the remote has no head_sha. The reviewer is fooled and says
// PASS. The arbiter must cap it at FIX because evidence.remote_has_head=false
// (rule 9: "evidence missing", not "claim mismatch").
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import { fooledReviewerScene, Sandbox, workerScene } from './support/sandbox.js';
import type { Claims } from '../src/schema/index.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

/** Claims where pushed=false and ci_passed=false (honest about not pushing). */
function unpushedClaims(passing: number): Omit<Claims, 'commits'> {
  return {
    tests_passed: passing,
    tests_failed: 0,
    pushed: false,
    ci_passed: false,
    new_deps: [],
    spec_touched: false,
  };
}

function runner(): FakeRunner {
  // Worker commits code and tests but does NOT push to remote.
  // Claims are honest: pushed=false, ci_passed=false.
  return new FakeRunner([
    workerScene(box, {
      passing: 47,
      failing: 0,
      push: false,
      claims: unpushedClaims(47),
    }),
    fooledReviewerScene(box),
  ]);
}

describe('scenario H: rule 9 — unpushed worker, reviewer PASS, arbiter FIX', () => {
  it('exits 10 (FIX) although the reviewer said PASS', async () => {
    expect(await box.run(runner())).toBe(10);
  });

  it('records verdict.downgraded with rule=9 in the journal', async () => {
    await box.run(runner());
    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 9,
    });
    // Rule 9 is "evidence missing", NOT "claim mismatch" (SPEC 4.3).
    const mismatches = events.filter((e) => e.event === 'claim.mismatch');
    expect(mismatches).toHaveLength(0);
  });

  it('run.finished carries verdict=FIX and exit_code=10', async () => {
    await box.run(runner());
    const finished = box.events().findLast((e) => e.event === 'run.finished');
    expect(finished).toMatchObject({ verdict: 'FIX', exit_code: 10 });
  });

  it('progress shows remote_has_head=false', async () => {
    await box.run(runner());
    const progress = box.read('docs/progress.md');
    expect(progress).toContain('已推送：否');
  });
});
