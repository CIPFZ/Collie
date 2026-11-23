// Acceptance tests for v046-b35 — [新] scenarios S1–S5.
// output_tail: acceptance.failed events carry truncated, redacted command output;
// renderFixSection renders it as a fenced code block; task.md includes it on FIX reruns.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderFixSection, type FixInfo } from '../../../src/run.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  TEST_CMD,
  workerScene,
} from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Modifies the sandbox: adds `sh noisy.sh` to global verify commands and commits `noisy.sh`. */
async function addNoisyScript(box: Sandbox, script: string): Promise<void> {
  const toml = box.read('.collie/collie.toml');
  const newToml = toml.replace(
    `commands = ["${TEST_CMD}"]`,
    `commands = ["${TEST_CMD}", "sh noisy.sh"]`,
  );
  box.write('.collie/collie.toml', newToml);
  box.write('noisy.sh', script);
  await box.commitAll('add noisy.sh to verify commands');
}

/** An honest worker with all tests green, plus a fooled reviewer that says PASS. */
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

// ---------------------------------------------------------------------------
// S1: renderFixSection with output_tail → fenced code block
// ---------------------------------------------------------------------------

describe('S1: renderFixSection with output_tail renders fenced code block', () => {
  it('S1: fenced code block after the command line contains line A and line B in order', () => {
    // output_tail is a new optional field — bypass type check with as unknown as.
    const failedItem = { cmd: 'sh noisy.sh', exit_code: 1, output_tail: 'line A\nline B' };
    const info = {
      gaps: [],
      failedAcceptance: [failedItem],
      commits: [],
    } as unknown as FixInfo;

    const result = renderFixSection(info);
    const lines = result.split('\n');

    // Find the command line
    const cmdLineIdx = lines.findIndex((l) => l.includes('`sh noisy.sh`'));
    expect(cmdLineIdx).toBeGreaterThanOrEqual(0);

    // After the command line, there should be a fenced code block
    const afterCmd = lines.slice(cmdLineIdx + 1);
    const fenceOpenIdx = afterCmd.findIndex((l) => l.startsWith('```'));
    expect(fenceOpenIdx).toBeGreaterThanOrEqual(0);

    // Inside the fence, find lines
    const fenceCloseIdx = afterCmd.findIndex((l, i) => i > fenceOpenIdx && l.startsWith('```'));
    expect(fenceCloseIdx).toBeGreaterThan(fenceOpenIdx);

    const blockLines = afterCmd.slice(fenceOpenIdx + 1, fenceCloseIdx);
    expect(blockLines).toEqual(['line A', 'line B']);
  });
});

// ---------------------------------------------------------------------------
// S2: acceptance.failed event carries output_tail with last 20 of 30 lines
// ---------------------------------------------------------------------------

describe('S2: noisy.sh prints 30 lines, output_tail keeps last 20', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // noisy.sh prints "out 1" through "out 30" and exits 1
    const script = [
      '#!/bin/sh',
      'i=1',
      'while [ "$i" -le 30 ]; do',
      '  echo "out $i"',
      '  i=$((i + 1))',
      'done',
      'exit 1',
    ].join('\n');
    await addNoisyScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S2: acceptance.failed for sh noisy.sh has output_tail of exactly 20 lines, out 11 to out 30', async () => {
    const exitCode = await box.run(honestRunner(box));
    expect(exitCode).toBe(10); // FIX

    const events = box.events();
    const failedEvent = events.find(
      (e) => e.event === 'acceptance.failed' && e.cmd === 'sh noisy.sh',
    );
    expect(failedEvent).toBeDefined();

    // output_tail is a new field — read it via shape assertion
    const withTail = failedEvent as unknown as { output_tail: string };
    expect(typeof withTail.output_tail).toBe('string');

    const tailLines = withTail.output_tail.split('\n');
    expect(tailLines).toHaveLength(20);
    expect(tailLines[0]).toBe('out 11');
    expect(tailLines[19]).toBe('out 30');
  });
});

// ---------------------------------------------------------------------------
// S3: 500-char line truncated to 300 chars per line
// ---------------------------------------------------------------------------

describe('S3: 500 x chars truncated to 300', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // noisy.sh prints a single line of 500 'x' chars and exits 1
    const script = [
      '#!/bin/sh',
      "line=$(printf '%500s' '' | tr ' ' 'x')",
      'echo "$line"',
      'exit 1',
    ].join('\n');
    await addNoisyScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S3: output_tail line is exactly 300 x characters', async () => {
    await box.run(honestRunner(box));

    const events = box.events();
    const failedEvent = events.find(
      (e) => e.event === 'acceptance.failed' && e.cmd === 'sh noisy.sh',
    );
    expect(failedEvent).toBeDefined();

    const withTail = failedEvent as unknown as { output_tail: string };
    expect(typeof withTail.output_tail).toBe('string');

    // Single line of exactly 300 x's
    const tailLines = withTail.output_tail.split('\n');
    expect(tailLines).toHaveLength(1);
    expect(tailLines[0]).toBe('x'.repeat(300));
  });
});

// ---------------------------------------------------------------------------
// S4: GITHUB_TOKEN redacted from output_tail
// ---------------------------------------------------------------------------

describe('S4: secret redaction in output_tail', () => {
  let box: Sandbox;
  let savedToken: string | undefined;

  beforeEach(async () => {
    box = await Sandbox.create();
    // noisy.sh prints a line containing the secret token value
    const script = ['#!/bin/sh', 'echo "token=tok-secret-12345"', 'exit 1'].join('\n');
    await addNoisyScript(box, script);
    // Set GITHUB_TOKEN before the run so R2 adds it to the redact list
    savedToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'tok-secret-12345';
  });

  afterEach(() => {
    // Restore GITHUB_TOKEN
    if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = savedToken;
    box.dispose();
  });

  it('S4: output_tail is exactly "token=***"', async () => {
    await box.run(honestRunner(box));

    const events = box.events();
    const failedEvent = events.find(
      (e) => e.event === 'acceptance.failed' && e.cmd === 'sh noisy.sh',
    );
    expect(failedEvent).toBeDefined();

    const withTail = failedEvent as unknown as { output_tail: string };
    expect(typeof withTail.output_tail).toBe('string');
    expect(withTail.output_tail).toBe('token=***');
  });
});

// ---------------------------------------------------------------------------
// S5: second run (FIX rerun) task.md contains output_tail lines
// ---------------------------------------------------------------------------

describe('S5: FIX rerun task.md includes output from previous acceptance failure', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Same noisy.sh as S2: prints 30 lines, exits 1
    const script = [
      '#!/bin/sh',
      'i=1',
      'while [ "$i" -le 30 ]; do',
      '  echo "out $i"',
      '  i=$((i + 1))',
      'done',
      'exit 1',
    ].join('\n');
    await addNoisyScript(box, script);
  });

  afterEach(() => {
    box.dispose();
  });

  it('S5: second run worker task.md contains standalone lines out 11 and out 30', async () => {
    // First run → FIX
    const firstExit = await box.run(honestRunner(box));
    expect(firstExit).toBe(10);

    // Second run: a custom worker that captures task.md, then returns without report.
    // R2 will escalate ("no valid report"), but we have the data we need.
    let capturedTaskMd = '';
    const secondWorkerScene: FakeScene = {
      expectRole: 'worker',
      effect: ({ cwd }: FakeSceneContext) => {
        capturedTaskMd = readFileSync(join(cwd, '.collie', 'batches', BATCH, 'task.md'), 'utf8');
      },
      result: { exitCode: 0 },
    };
    const secondRunner = new FakeRunner([secondWorkerScene]);
    await box.run(secondRunner);

    // task.md should contain the output lines from the previous acceptance failure
    expect(capturedTaskMd).not.toBe('');
    const taskLines = capturedTaskMd.split('\n');
    // out 11 appears as a standalone line (the first kept line)
    expect(taskLines).toContain('out 11');
    // out 30 appears as a standalone line (the last kept line)
    expect(taskLines).toContain('out 30');
  });
});
