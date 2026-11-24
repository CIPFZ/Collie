// SPEC 8 scenario A, fake CI green: the worker claims CI passed, but the only
// run GitHub has for head_sha is on another branch (the master/main lesson).
// The reviewer is fooled and says PASS; Collie must still return FIX.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

function runner(): FakeRunner {
  // 47 real passing tests, pushed, and CI claimed green: every claim but CI is true.
  return new FakeRunner([
    workerScene(box, { passing: 47, failing: 0, push: true, claims: honestClaims(47, true) }),
    fooledReviewerScene(box),
  ]);
}

describe('scenario A: CI claimed green, CI actually ran on master', () => {
  it('exits 10 (FIX) although the reviewer said PASS', async () => {
    box.ciBranch = 'master';
    expect(await box.run(runner())).toBe(10);
  });

  it('records the ci_passed claim mismatch and the downgrade in the journal', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    const events = box.events();
    const mismatches = events.filter((e) => e.event === 'claim.mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      rule: 7,
      field: 'ci_passed',
      claimed: true,
      actual: { ci_conclusion: 'unknown', ci_branch_matched: false },
    });
    expect(events.find((e) => e.event === 'verdict.downgraded')).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 7,
    });
    expect(events.at(-1)).toMatchObject({ event: 'run.finished', verdict: 'FIX', exit_code: 10 });
  });

  it('caught it by evidence, not by anything else failing', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    const progress = box.read('docs/progress.md');
    expect(progress).toContain('sh run-tests.sh` → exit 0，47 passed, 0 failed');
    expect(progress).toContain('已推送：是');
    expect(progress).toContain('CI：unknown，监听分支不一致');
    expect(progress).toContain('声称与实测不符：ci_passed');
  });

  it('honest twin: the same claims with CI really green on main pass with exit 0', async () => {
    box.ciBranch = 'main';
    expect(await box.run(runner())).toBe(0);
    expect(box.eventTypes()).not.toContain('claim.mismatch');
  });

  it('reviewer skipped because rule 7 detected in pre-arbitration (SPEC 16.29)', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    const events = box.events();
    // Reviewer was not called (skipped by pre-arbitration).
    expect(events.filter((e) => e.event === 'reviewer.started')).toHaveLength(0);
    // reviewer.skipped event with rule 7.
    const skipped = events.find((e) => (e.event as string) === 'reviewer.skipped');
    expect(skipped).toBeDefined();
    expect((skipped as unknown as { rule: number }).rule).toBe(7);
  });

  it('collie show reconstructs the decision and its evidence chain', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    box.output.length = 0;
    expect(await box.cli(['show', BATCH], undefined)).toBe(0);
    const shown = box.output.join('');
    expect(shown).toContain('== task.md ==');
    expect(shown).toContain('"ci_passed": true'); // the claim, from report.md
    // SPEC 16.29: reviewer skipped, no verdict.md — check reviewer.skipped in journal.
    expect(shown).toMatch(/reviewer\.skipped rule=7/);
    expect(shown).toMatch(
      /claim\.mismatch rule=7 field=ci_passed claimed=true actual=\{"ci_conclusion":"unknown","ci_branch_matched":false\}/,
    );
    expect(shown).toMatch(/verdict\.downgraded from=PASS to=FIX rule=7/);
    expect(shown).toMatch(/run\.finished verdict=FIX exit_code=10/);
  });
});
