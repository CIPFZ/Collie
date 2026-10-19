// SPEC 5: collie run exits 0 PASS / 10 FIX / 20 BLOCK / 1 Collie error.
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

const honest = (b: Sandbox): FakeRunner =>
  new FakeRunner([
    workerScene(b, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
    fooledReviewerScene(b),
  ]);

describe('exit-codes: verdicts', () => {
  it('0 for PASS', async () => {
    expect(await box.run(honest(box))).toBe(0);
  });

  it('10 for FIX (a false claim)', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: false, claims: honestClaims(5, false) }),
      fooledReviewerScene(box),
    ]);
    // Claims pushed=true but never pushed: rule 5.
    expect(await box.run(r)).toBe(10);
    expect(box.events().find((e) => e.event === 'claim.mismatch')).toMatchObject({
      rule: 5,
      field: 'pushed',
    });
  });

  it('10 for an honest reviewer FIX', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box, 'FIX'),
    ]);
    expect(await box.run(r)).toBe(10);
  });

  it('20 for BLOCK when the reviewer reply has no verdict block (rule 1)', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      { expectRole: 'reviewer', result: { exitCode: 0, finalText: 'I think it is fine.' } },
    ]);
    expect(await box.run(r)).toBe(20);
  });

  it('20 for BLOCK when the reviewer returns no text at all', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      { expectRole: 'reviewer', result: { exitCode: 0 } },
    ]);
    expect(await box.run(r)).toBe(20);
  });
});

describe('exit-codes: escalations (SPEC 6) are BLOCK', () => {
  it('20 when the worker writes no report, without launching the reviewer', async () => {
    const r = new FakeRunner([
      workerScene(box, {
        passing: 5,
        failing: 0,
        push: true,
        noReport: true,
        claims: honestClaims(5, true),
      }),
    ]);
    expect(await box.run(r)).toBe(20);
    expect(r.calls.map((c) => c.role)).toEqual(['worker']);
    expect(box.eventTypes()).toContain('escalated');
  });

  it('20 when the worker crashes', async () => {
    const r = new FakeRunner([{ expectRole: 'worker', error: new Error('agent crashed') }]);
    expect(await box.run(r)).toBe(20);
    expect(box.events().find((e) => e.event === 'worker.crashed')).toMatchObject({
      error: 'agent crashed',
      timed_out: false,
    });
  });

  it('20 when the wall clock runs out, recorded as worker.crashed (SPEC 3.3)', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
    ]);
    const expired = AbortSignal.abort(new Error('wallclock_secs exceeded'));
    expect(await box.run(r, { workerSignal: expired })).toBe(20);
    expect(box.events().find((e) => e.event === 'worker.crashed')).toMatchObject({
      timed_out: true,
    });
  });
});

describe('exit-codes: Collie errors are 1', () => {
  it('1 for an unknown batch', async () => {
    expect(await box.cli(['run', 'v99-b99'], honest(box))).toBe(1);
    expect(box.output.join('')).toContain('batch v99-b99 is not in docs/backlog.md');
  });

  it('1 when no agent runner is available', async () => {
    expect(await box.cli(['run', BATCH], undefined)).toBe(1);
    expect(box.output.join('')).toContain('no agent runner is available');
  });

  it('1 for a broken collie.toml', async () => {
    box.write('.collie/collie.toml', 'schema_version = 1\n');
    expect(await box.run(honest(box))).toBe(1);
    expect(box.output.join('')).toContain('Invalid config');
  });

  it('1 for usage errors', async () => {
    expect(await box.cli(['run'], honest(box))).toBe(1);
    expect(await box.cli(['bogus'], honest(box))).toBe(1);
  });
});

describe('exit-codes: the journal of a full run (SPEC 3.6)', () => {
  it('records the v0.1 event sequence in order', async () => {
    await box.run(honest(box));
    expect(box.eventTypes()).toEqual([
      'run.started',
      'batch.selected',
      'batch.task_written',
      'worker.started',
      'worker.finished',
      'reviewer.started',
      'reviewer.verdict',
      'run.finished',
    ]);
  });
});
