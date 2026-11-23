// Acceptance tests for v046-b37 — [保持] scenarios K1–K5.
// These behaviours must continue to work after the implementation change.
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
// K1: stdout only, 30 lines → last 20, no stderr separator
// ---------------------------------------------------------------------------

describe('K1: stdout only 30 lines → output_tail is last 20, no separator', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: prints "out 1" to "out 30" to stdout, exit 1
    const script = [
      '#!/bin/sh',
      'i=1',
      'while [ "$i" -le 30 ]; do',
      '  echo "out $i"',
      '  i=$((i + 1))',
      'done',
      'exit 1',
    ].join('\n');
    await addSplitScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: output_tail is exactly 20 lines from out 11 to out 30, no --- stderr ---', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    const outputTail = failed.output_tail as string;
    expect(typeof outputTail).toBe('string');

    const lines = outputTail.split('\n');
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('out 11');
    expect(lines[19]).toBe('out 30');
    expect(lines).not.toContain('--- stderr ---');
  });
});

// ---------------------------------------------------------------------------
// K2: S1's run retains cmd, exit_code, expect; stderr truncation
// ---------------------------------------------------------------------------

describe('K2: acceptance.failed event fields and stderr truncation', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Same script as S1: 1 stdout line, 30 stderr lines, exit 1
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

  it('K2: output_tail has progress 30 but not progress 10; cmd, exit_code, expect all present', async () => {
    await box.run(honestRunner(box));

    const events = box.events();
    const failedEvent = events.find(
      (e) => e.event === 'acceptance.failed' && e.cmd === 'sh split.sh',
    );
    expect(failedEvent).toBeDefined();

    // cmd, exit_code, expect fields must be present
    expect(failedEvent).toMatchObject({
      cmd: 'sh split.sh',
      exit_code: 1,
      expect: 'exit_zero',
    });

    // output_tail content checks
    const withTail = failedEvent as unknown as { output_tail: string };
    expect(typeof withTail.output_tail).toBe('string');

    const lines = withTail.output_tail.split('\n');
    expect(lines).toContain('progress 30');
    expect(lines).not.toContain('progress 10');
  });
});

// ---------------------------------------------------------------------------
// K3: GITHUB_TOKEN redacted from output_tail
// ---------------------------------------------------------------------------

describe('K3: secret redaction in output_tail', () => {
  let box: Sandbox;
  let savedToken: string | undefined;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: prints one line to stderr containing the secret, exit 1
    const script = ['#!/bin/sh', 'echo "token=tok-secret-12345" >&2', 'exit 1'].join('\n');
    await addSplitScript(box, script);
    // Set GITHUB_TOKEN before the run so R2 adds it to the redact list
    savedToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'tok-secret-12345';
  });

  afterEach(() => {
    if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = savedToken;
    box.dispose();
  });

  it('K3: output_tail contains token=*** and not the actual secret', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    const outputTail = failed.output_tail as string;
    expect(typeof outputTail).toBe('string');
    expect(outputTail).toContain('token=***');
    expect(outputTail).not.toContain('tok-secret-12345');
  });
});

// ---------------------------------------------------------------------------
// K4: renderFixSection with simple output_tail → triple backtick fences
// ---------------------------------------------------------------------------

describe('K4: renderFixSection with simple output_tail uses triple backtick fences', () => {
  it('K4: code block opens and closes with exactly three backticks, containing line A and line B', () => {
    const failedItem = { cmd: 'sh split.sh', exit_code: 1, output_tail: 'line A\nline B' };
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

    // Opening and closing fences must be exactly 3 backticks
    expect(afterCmd[fenceOpenIdx]).toBe('```');
    expect(afterCmd[fenceCloseIdx]).toBe('```');

    // Content between fences
    const blockLines = afterCmd.slice(fenceOpenIdx + 1, fenceCloseIdx);
    expect(blockLines).toEqual(['line A', 'line B']);
  });
});

// ---------------------------------------------------------------------------
// K5: empty output → no output_tail key
// ---------------------------------------------------------------------------

describe('K5: empty output → acceptance.failed has no output_tail', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // split.sh: nothing printed, exit 1
    const script = ['#!/bin/sh', 'exit 1'].join('\n');
    await addSplitScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('K5: acceptance.failed for sh split.sh does not have output_tail key', async () => {
    await box.run(honestRunner(box));

    const failed = findSplitFailed(box);
    expect('output_tail' in failed).toBe(false);
  });
});
