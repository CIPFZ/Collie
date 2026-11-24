// Acceptance tests for v046-b42 — [保持] scenarios K1–K3.
// These behaviours must continue to work after the smoke_max_secs feature is added.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import { Sandbox } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allOutput(box: Sandbox): string {
  return box.output.join('');
}

/** Returns the last non-empty line of the output (trailing newline stripped). */
function lastLine(box: Sandbox): string {
  const lines = allOutput(box).split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines[lines.length - 1] ?? '';
}

/** Build a preflightNow clock that advances by `stepMs` on each call. */
function makeStepClock(stepMs: number): () => number {
  let tick = 0;
  return (): number => {
    const v = tick;
    tick += stepMs;
    return v;
  };
}

/** Returns true if any line in `text` starts with `prefix`. */
function hasLineStartingWith(text: string, prefix: string): boolean {
  return text.split('\n').some((line) => line.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// K1: exitCode=0, exactly 60 s (default limit) → ok runner
// ---------------------------------------------------------------------------

describe('K1: runner exitCode=0 at exactly default smoke_max_secs boundary', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: exit code is 0 and output has ok runner line with secs=60', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    const clock = makeStepClock(60_000);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });

    expect(code).toBe(0);

    const out = allOutput(box);
    expect(hasLineStartingWith(out, 'ok   runner: exitCode=0 secs=60')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// K2: exitCode=1, 3 s → FAIL runner
// ---------------------------------------------------------------------------

describe('K2: runner exitCode=1 fails regardless of time', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K2: output has FAIL runner with exitCode=1 and last line is preflight: failed (runner)', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 1 } }]);
    const clock = makeStepClock(3_000);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });

    expect(code).not.toBe(0);

    const out = allOutput(box);
    expect(hasLineStartingWith(out, 'FAIL runner: exitCode=1')).toBe(true);
    expect(lastLine(box)).toBe('preflight: failed (runner)');
  });
});

// ---------------------------------------------------------------------------
// K3: no --smoke → no runner check output
// ---------------------------------------------------------------------------

describe('K3: without --smoke, no runner check lines appear', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exit code is 0 and output has no ok runner or FAIL runner lines', async () => {
    const code = await box.cli(['preflight'], undefined);

    expect(code).toBe(0);

    const out = allOutput(box);
    expect(hasLineStartingWith(out, 'ok   runner')).toBe(false);
    expect(hasLineStartingWith(out, 'FAIL runner')).toBe(false);
  });
});
