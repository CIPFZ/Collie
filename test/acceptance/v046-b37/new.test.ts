// Acceptance tests for v046-b37 — [新] scenarios S1–S4.
// output_tail: stdout/stderr split by a `--- stderr ---` separator line;
// renderFixSection: backtick fence escalation when output_tail contains triple backticks.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderFixSection, type FixInfo } from '../../../src/run.js';
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

/** Adds `sh split.sh` to global verify commands and writes `split.sh`. */
async function addSplitScript(box: Sandbox, script: string): Promise<void> {
  const toml = box.read('.collie/collie.toml');
  const newToml = toml.replace(
    `commands = ["${TEST_CMD}"]`,
    `commands = ["${TEST_CMD}", "sh split.sh"]`,
  );
  box.write('.collie/collie.toml', newToml);
  box.write('split.sh', script);
  await box.commitAll('add split.sh to verify commands');
}

/** An honest worker + fooled reviewer that judges PASS. */
function honestRunner(box: Sandbox): FakeRunner {
  return new FakeRunner([
    workerScene(box, {
      passing: 47,
      failing: 0,
      push: true,
      claims: honestClaims(47),
    }),
    fooledReviewerScene(box),
  ]);
}

/** Finds the acceptance.failed event for `sh split.sh` from sandbox events. */
function findSplitFailed(box: Sandbox): Record<string, unknown> {
  const events = box.events();
  const ev = events.find((e) => e.event === 'acceptance.failed' && e.cmd === 'sh split.sh');
  expect(ev).toBeDefined();
  return ev as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// S1: stdout + stderr → separator between them in output_tail
// ---------------------------------------------------------------------------

describe('S1: stdout/stderr split by --- stderr --- separator', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: 1 stdout line, 30 stderr lines, exit 1
    const script = [
      '#!/bin/sh',
      'echo "result: 1 survived"',
      'i=1',
      'while [ "$i" -le 30 ]; do',
      '  echo "progress $i" >&2',
      '  i=$((i + 1))',
      'done',
      'exit 1',
    ].join('\n');
    await addSplitScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S1: output_tail first line is stdout content, second line is --- stderr ---', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    const outputTail = failed.output_tail as string;
    expect(typeof outputTail).toBe('string');

    const lines = outputTail.split('\n');
    expect(lines[0]).toBe('result: 1 survived');
    expect(lines[1]).toBe('--- stderr ---');
  });
});

// ---------------------------------------------------------------------------
// S2: 25 stdout + 25 stderr → 20+1+20 = 41 lines
// ---------------------------------------------------------------------------

describe('S2: 25 stdout + 25 stderr → output_tail is exactly 41 lines', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: 25 stdout lines (o1–o25), 25 stderr lines (e1–e25), exit 1
    const script = [
      '#!/bin/sh',
      'i=1',
      'while [ "$i" -le 25 ]; do',
      '  echo "o$i"',
      '  i=$((i + 1))',
      'done',
      'i=1',
      'while [ "$i" -le 25 ]; do',
      '  echo "e$i" >&2',
      '  i=$((i + 1))',
      'done',
      'exit 1',
    ].join('\n');
    await addSplitScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S2: output_tail has 41 lines; line 1 is o6, line 21 is separator, line 22 is e6', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    const outputTail = failed.output_tail as string;
    expect(typeof outputTail).toBe('string');

    const lines = outputTail.split('\n');
    expect(lines).toHaveLength(41);
    expect(lines[0]).toBe('o6');
    expect(lines[20]).toBe('--- stderr ---');
    expect(lines[21]).toBe('e6');
  });
});

// ---------------------------------------------------------------------------
// S3: stderr only → separator as first line, then stderr lines
// ---------------------------------------------------------------------------

describe('S3: stderr only → output_tail starts with --- stderr ---', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: 3 stderr lines only, exit 1
    const script = ['#!/bin/sh', 'echo "e1" >&2', 'echo "e2" >&2', 'echo "e3" >&2', 'exit 1'].join(
      '\n',
    );
    await addSplitScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: output_tail is exactly 4 lines; line 1 is separator, line 2 is e1', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    const outputTail = failed.output_tail as string;
    expect(typeof outputTail).toBe('string');

    const lines = outputTail.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('--- stderr ---');
    expect(lines[1]).toBe('e1');
  });
});

// ---------------------------------------------------------------------------
// S4: renderFixSection fence escalation when output_tail contains ```
// ---------------------------------------------------------------------------

describe('S4: renderFixSection fence escalation for backtick content', () => {
  it('S4: output_tail with triple backticks renders with 4-backtick fences', () => {
    const tail = 'before\n```\nafter';
    const failedItem = { cmd: 'sh split.sh', exit_code: 1, output_tail: tail };
    const info = {
      gaps: [],
      failedAcceptance: [failedItem],
      commits: [],
    } as unknown as FixInfo;

    const result = renderFixSection(info);
    const lines = result.split('\n');

    // Find the command line
    const cmdLineIdx = lines.findIndex((l) => l.includes('`sh split.sh`'));
    expect(cmdLineIdx).toBeGreaterThanOrEqual(0);

    // After the command line, locate the code block fences
    const afterCmd = lines.slice(cmdLineIdx + 1);
    const fenceOpenIdx = afterCmd.findIndex((l) => /^`{3,}/.test(l));
    expect(fenceOpenIdx).toBeGreaterThanOrEqual(0);

    const fenceCloseIdx = afterCmd.findIndex((l, i) => i > fenceOpenIdx && /^`{3,}/.test(l));
    expect(fenceCloseIdx).toBeGreaterThan(fenceOpenIdx);

    // Opening and closing fences must be exactly 4 backticks
    expect(afterCmd[fenceOpenIdx]).toBe('````');
    expect(afterCmd[fenceCloseIdx]).toBe('````');

    // Content between fences must be before, ```, after
    const blockLines = afterCmd.slice(fenceOpenIdx + 1, fenceCloseIdx);
    expect(blockLines).toEqual(['before', '```', 'after']);
  });
});
