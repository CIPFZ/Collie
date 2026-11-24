// Acceptance tests for v046-b42 — [新] scenarios S1–S3.
// preflight --smoke runner check should fail when elapsed time exceeds
// smoke_max_secs (default 60), even if exitCode is 0; configurable via
// collie.toml [limits] smoke_max_secs.
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
  // Drop empty trailing entries caused by the final newline.
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
// S1: exitCode=0 but 61 s (> default 60) → FAIL runner
// ---------------------------------------------------------------------------

describe('S1: runner exitCode=0 but exceeds default smoke_max_secs', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S1: exit code is not 0, output has FAIL runner line, last line is preflight: failed (runner)', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    // 61 000 ms between the two clock reads → 61 seconds.
    const clock = makeStepClock(61_000);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });

    expect(code).not.toBe(0);

    const out = allOutput(box);
    expect(hasLineStartingWith(out, 'FAIL runner: exitCode=0 secs=61')).toBe(true);
    expect(lastLine(box)).toBe('preflight: failed (runner)');
  });
});

// ---------------------------------------------------------------------------
// S2: exitCode=0, 61 s, smoke_max_secs=120 → ok runner
// ---------------------------------------------------------------------------

describe('S2: runner exitCode=0 within custom smoke_max_secs=120', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Add smoke_max_secs = 120 to [limits] in collie.toml and commit.
    const toml = box.read('.collie/collie.toml');
    const updated = toml.replace('[limits]\n', '[limits]\nsmoke_max_secs = 120\n');
    box.write('.collie/collie.toml', updated);
    await box.commitAll('chore: set smoke_max_secs = 120');
  });

  afterEach(() => {
    box.dispose();
  });

  it('S2: exit code is 0 and output has ok runner line', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    const clock = makeStepClock(61_000);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });

    expect(code).toBe(0);

    const out = allOutput(box);
    expect(hasLineStartingWith(out, 'ok   runner: exitCode=0 secs=61')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S3: exitCode=0, 61 s, --json → runner check ok=false, top-level ok=false
// ---------------------------------------------------------------------------

describe('S3: --json output for runner exceeding default smoke_max_secs', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: JSON checks.runner.ok is false and top-level ok is false', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    const clock = makeStepClock(61_000);
    const code = await box.cli(['preflight', '--smoke', '--json', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });

    // We don't assert exit code here (S1 covers that); just parse JSON.
    expect(code).not.toBe(0);

    const out = allOutput(box);
    const parsed = JSON.parse(out) as {
      ok: boolean;
      checks: { name: string; ok: boolean; detail?: string }[];
    };
    const runnerCheck = parsed.checks.find((c) => c.name === 'runner');
    expect(runnerCheck).toBeDefined();
    expect(runnerCheck?.ok).toBe(false);
    expect(parsed.ok).toBe(false);
  });
});
