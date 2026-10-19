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

  it('ran the reviewer in a head_sha worktree that holds no report.md (SPEC 3.5)', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    expect(box.reviewerSawReport).toBe(false);
    expect(box.reviewerCwd).not.toBe(box.root);
  });

  it('collie show reconstructs the decision and its evidence chain', async () => {
    box.ciBranch = 'master';
    await box.run(runner());
    box.output.length = 0;
    expect(await box.cli(['show', BATCH], undefined)).toBe(0);
    const shown = box.output.join('');
    expect(shown).toContain('== task.md ==');
    expect(shown).toContain('"ci_passed": true'); // the claim, from report.md
    expect(shown).toContain('"verdict": "PASS"'); // the fooled reviewer, from verdict.md
    expect(shown).toMatch(
      /claim\.mismatch rule=7 field=ci_passed claimed=true actual=\{"ci_conclusion":"unknown","ci_branch_matched":false\}/,
    );
    expect(shown).toMatch(/verdict\.downgraded from=PASS to=FIX rule=7/);
    expect(shown).toMatch(/run\.finished verdict=FIX exit_code=10/);
  });
});
