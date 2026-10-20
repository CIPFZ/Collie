// Scenario D (SPEC 4.3 rule 8, v01-b05-smoke): the worker is honest. It
// reports exactly the failures that exist, so no claim rule (5-7) fires. An
// acceptance command still fails when Collie runs it, and the reviewer, talked
// round by "these failures pre-exist", says PASS. Collie must return FIX:
// acceptance is a precondition of PASS that no explanation waives.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import { BATCH, fooledReviewerScene, Sandbox, TEST_CMD, workerScene } from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

/** An honest worker: it claims exactly what it committed, failures included. */
function runner(passing: number, failing: number): FakeRunner {
  return new FakeRunner([
    workerScene(box, {
      passing,
      failing,
      push: true,
      claims: {
        tests_passed: passing,
        tests_failed: failing,
        pushed: true,
        ci_passed: true,
        new_deps: [],
        spec_touched: false,
      },
    }),
    fooledReviewerScene(box),
  ]);
}

describe('scenario D: honest worker, failing acceptance, reviewer PASS', () => {
  it('exits 10 (FIX) although every claim is true and the reviewer said PASS', async () => {
    expect(await box.run(runner(44, 3))).toBe(10);
  });

  it('is caught by rule 8, with no claim mismatch at all', async () => {
    await box.run(runner(44, 3));
    const events = box.events();
    expect(events.filter((e) => e.event === 'claim.mismatch')).toEqual([]);
    expect(events.filter((e) => e.event === 'acceptance.failed')).toEqual([
      expect.objectContaining({ cmd: TEST_CMD, exit_code: 1, expect: 'exit_zero' }),
    ]);
    expect(events.find((e) => e.event === 'verdict.downgraded')).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 8,
    });
    expect(events.at(-1)).toMatchObject({ event: 'run.finished', verdict: 'FIX', exit_code: 10 });
  });

  it('honest twin: the same honest worker with all tests green passes with exit 0', async () => {
    expect(await box.run(runner(47, 0))).toBe(0);
    expect(box.eventTypes()).not.toContain('acceptance.failed');
  });

  it('collie show reconstructs the failed command and the downgrade', async () => {
    await box.run(runner(44, 3));
    box.output.length = 0;
    expect(await box.cli(['show', BATCH], undefined)).toBe(0);
    const shown = box.output.join('');
    expect(shown).toContain('"tests_failed": 3'); // the honest claim, from report.md
    expect(shown).toContain('"verdict": "PASS"'); // the reviewer, from verdict.md
    expect(shown).toMatch(/acceptance\.failed cmd=sh run-tests\.sh exit_code=1 expect=exit_zero/);
    expect(shown).toMatch(/verdict\.downgraded from=PASS to=FIX rule=8/);
    expect(shown).toMatch(/run\.finished verdict=FIX exit_code=10/);
  });
});
