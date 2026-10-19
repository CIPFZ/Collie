// SPEC 8 scenario B, fake test count: the worker claims 47 passed / 0 failed,
// but the tests it committed really give 44 passed / 3 failed when Collie runs
// them. The reviewer is fooled and says PASS; Collie must still return FIX.
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

/** The worker always claims 47/0; only what it actually committed differs. */
function runner(failing: number): FakeRunner {
  return new FakeRunner([
    workerScene(box, {
      passing: 47 - failing,
      failing,
      push: true,
      // CI is not claimed, so only the test-count claim is under test.
      claims: honestClaims(47, false),
    }),
    fooledReviewerScene(box),
  ]);
}

describe('scenario B: 47 passed claimed, 44 passed / 3 failed measured', () => {
  it('exits 10 (FIX) although the reviewer said PASS', async () => {
    expect(await box.run(runner(3))).toBe(10);
  });

  it('records the test-count mismatch with the measured numbers', async () => {
    await box.run(runner(3));
    const events = box.events();
    const mismatches = events.filter((e) => e.event === 'claim.mismatch');
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({
      rule: 6,
      field: 'tests',
      claimed: { passed: 47, failed: 0 },
      actual: { passed: 44, failed: 3, exitCode: 1 },
    });
    expect(events.find((e) => e.event === 'verdict.downgraded')).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 6,
    });
    expect(events.at(-1)).toMatchObject({ event: 'run.finished', verdict: 'FIX', exit_code: 10 });
  });

  it('measured the counts by actually running the committed tests', async () => {
    await box.run(runner(3));
    expect(box.read('docs/progress.md')).toContain(
      '`sh run-tests.sh` → exit 1，44 passed, 3 failed',
    );
  });

  it('honest twin: the same 47/0 claim with 47 really passing exits 0', async () => {
    expect(await box.run(runner(0))).toBe(0);
    expect(box.eventTypes()).not.toContain('claim.mismatch');
  });

  it('collie show reconstructs the claim, the measurement and the decision', async () => {
    await box.run(runner(3));
    box.output.length = 0;
    expect(await box.cli(['show', BATCH], undefined)).toBe(0);
    const shown = box.output.join('');
    expect(shown).toContain('"tests_passed": 47');
    expect(shown).toMatch(
      /claim\.mismatch rule=6 field=tests claimed=\{"passed":47,"failed":0\} actual=\{"passed":44,"failed":3,"exitCode":1\}/,
    );
    expect(shown).toMatch(/run\.finished verdict=FIX exit_code=10/);
  });
});
