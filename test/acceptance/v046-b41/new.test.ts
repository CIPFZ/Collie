// Acceptance tests for v046-b41 — [新] scenarios S1–S4.
// CLI commands must detect and report broken dependencies in docs/backlog.md
// (dependency references a batch id that does not exist).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sandbox } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Modifies the sandbox's docs/backlog.md so that v99-b01's dependency is
 * changed from "none" to the non-existent batch id v00-x99 — both in the
 * overview table (the 依赖 cell) and in the section meta line (依赖：…).
 */
function breakDependency(box: Sandbox): void {
  const original = box.read('docs/backlog.md');
  const updated = original.replace('| — |', '| v00-x99 |').replace('依赖：无', '依赖：v00-x99');
  box.write('docs/backlog.md', updated);
}

function allOutput(box: Sandbox): string {
  return box.output.join('');
}

// ---------------------------------------------------------------------------
// S1: status with broken dependency → exit 1, output mentions v00-x99
// ---------------------------------------------------------------------------

describe('S1: status with broken dependency', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    breakDependency(box);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S1: exits 1 and output contains v00-x99', async () => {
    const exitCode = await box.cli(['status'], undefined);
    expect(exitCode).toBe(1);
    expect(allOutput(box)).toContain('v00-x99');
  });
});

// ---------------------------------------------------------------------------
// S2: status --json with broken dependency → exit 1, output mentions v00-x99
// ---------------------------------------------------------------------------

describe('S2: status --json with broken dependency', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    breakDependency(box);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S2: exits 1 and output contains v00-x99', async () => {
    const exitCode = await box.cli(['status', '--json'], undefined);
    expect(exitCode).toBe(1);
    expect(allOutput(box)).toContain('v00-x99');
  });
});

// ---------------------------------------------------------------------------
// S3: why v99-b01 with broken dependency → output has v00-x99,
//     does NOT have "is not in docs/backlog.md"
// ---------------------------------------------------------------------------

describe('S3: why with broken dependency', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    breakDependency(box);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: output contains v00-x99 and does not contain "is not in docs/backlog.md"', async () => {
    await box.cli(['why', 'v99-b01'], undefined);
    const output = allOutput(box);
    expect(output).toContain('v00-x99');
    expect(output).not.toContain('is not in docs/backlog.md');
  });
});

// ---------------------------------------------------------------------------
// S4: report with broken dependency → exit 1, output mentions v00-x99
// ---------------------------------------------------------------------------

describe('S4: report with broken dependency', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    breakDependency(box);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S4: exits 1 and output contains v00-x99', async () => {
    const exitCode = await box.cli(['report'], undefined);
    expect(exitCode).toBe(1);
    expect(allOutput(box)).toContain('v00-x99');
  });
});
