// Tests for output_tail: per-stream tail and fence width (SPEC 16.25).
// Nine scenarios: S1–S4, K1–K5 covering stdout/stderr split, separator,
// per-stream truncation, fence backtick escalation, redaction, and empty output.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderFixSection, type FixInfo } from '../src/run.js';
import { FakeRunner } from '../src/runner/fake.js';
import {
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  TEST_CMD,
  workerScene,
} from './support/sandbox.js';

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
// Tests
// ---------------------------------------------------------------------------

describe('output_tail: per-stream tail and fence width (SPEC 16.25)', () => {
  // =========================================================================
  // S1: stdout + stderr → separator between them in output_tail
  // =========================================================================
  describe('S1: stdout line then --- stderr --- separator', () => {
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

  // =========================================================================
  // S2: 25 stdout + 25 stderr → 20+1+20 = 41 lines
  // =========================================================================
  describe('S2: 25 stdout + 25 stderr → output_tail is exactly 41 lines', () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
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

    it('S2: 41 lines; line 1 is o6, line 21 is separator, line 22 is e6', async () => {
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

  // =========================================================================
  // S3: stderr only → separator as first line, then stderr lines
  // =========================================================================
  describe('S3: stderr only → output_tail starts with --- stderr ---', () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
      const script = [
        '#!/bin/sh',
        'echo "e1" >&2',
        'echo "e2" >&2',
        'echo "e3" >&2',
        'exit 1',
      ].join('\n');
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

  // =========================================================================
  // S4: renderFixSection fence escalation when output_tail contains ```
  // =========================================================================
  describe('S4: renderFixSection fence escalation for backtick content', () => {
    it('S4: output_tail with triple backticks renders with 4-backtick fences, closing matches opening', () => {
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
      const fenceOpenIdx = afterCmd.findIndex((l) => l.startsWith('`'));
      expect(fenceOpenIdx).toBeGreaterThanOrEqual(0);

      const openingFence = afterCmd[fenceOpenIdx];
      // Opening fence must be exactly 4 backticks
      expect(openingFence).toBe('````');

      // Closing fence: find the next line that is identical to the opening fence
      const fenceCloseIdx = afterCmd.findIndex((l, i) => i > fenceOpenIdx && l === openingFence);
      expect(fenceCloseIdx).toBeGreaterThan(fenceOpenIdx);

      // Closing fence must also be exactly 4 backticks
      expect(afterCmd[fenceCloseIdx]).toBe('````');

      // Content between fences must be before, ```, after
      const blockLines = afterCmd.slice(fenceOpenIdx + 1, fenceCloseIdx);
      expect(blockLines).toEqual(['before', '```', 'after']);
    });
  });

  // =========================================================================
  // K1: stdout only, 30 lines → last 20
  // =========================================================================
  describe('K1: stdout only, 30 lines → last 20, no separator', () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
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

    it('K1: exactly 20 lines, first is out 11, last is out 30, no separator', async () => {
      await box.run(honestRunner(box));

      const failed = findSplitFailed(box);
      const outputTail = failed.output_tail as string;
      expect(typeof outputTail).toBe('string');

      const lines = outputTail.split('\n');
      expect(lines).toHaveLength(20);
      expect(lines[0]).toBe('out 11');
      expect(lines[19]).toBe('out 30');
      // No separator present
      expect(lines).not.toContain('--- stderr ---');
    });
  });

  // =========================================================================
  // K2: same as S1 — check cmd, exit_code, expect, and tail content
  // =========================================================================
  describe('K2: S1 scenario event has cmd, exit_code, expect; tail has progress 30 but not progress 10', () => {
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

    it('K2: event has cmd, exit_code, expect; tail contains progress 30, not progress 10', async () => {
      await box.run(honestRunner(box));

      const failed = findSplitFailed(box);
      expect(failed.cmd).toBe('sh split.sh');
      expect(failed.exit_code).toBe(1);
      expect(failed.expect).toBeDefined();

      const outputTail = failed.output_tail as string;
      expect(typeof outputTail).toBe('string');

      const lines = outputTail.split('\n');
      // progress 30 is in the last 20 lines of stderr
      expect(lines).toContain('progress 30');
      // progress 10 is NOT in the last 20 lines of stderr (30 lines, keep last 20 = 11..30)
      const hasProgress10 = lines.some((l) => l === 'progress 10');
      expect(hasProgress10).toBe(false);
    });
  });

  // =========================================================================
  // K3: GITHUB_TOKEN redaction
  // =========================================================================
  describe('K3: GITHUB_TOKEN redacted from output_tail', () => {
    let box: Sandbox;
    let savedToken: string | undefined;

    beforeEach(async () => {
      box = await Sandbox.create();
      const script = ['#!/bin/sh', 'echo "token=tok-secret-12345" >&2', 'exit 1'].join('\n');
      await addSplitScript(box, script);
      savedToken = process.env.GITHUB_TOKEN;
      process.env.GITHUB_TOKEN = 'tok-secret-12345';
    });

    afterEach(() => {
      if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = savedToken;
      box.dispose();
    });

    it('K3: output_tail has token=***, no tok-secret-12345', async () => {
      await box.run(honestRunner(box));

      const failed = findSplitFailed(box);
      const outputTail = failed.output_tail as string;
      expect(typeof outputTail).toBe('string');
      expect(outputTail).toContain('token=***');
      expect(outputTail).not.toContain('tok-secret-12345');
    });
  });

  // =========================================================================
  // K4: renderFixSection with simple 2-line output_tail → 3-backtick fences
  // =========================================================================
  describe('K4: renderFixSection with simple content → 3-backtick fences', () => {
    it('K4: output_tail line A, line B → fenced with exactly 3 backticks', () => {
      const tail = 'line A\nline B';
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
      const fenceOpenIdx = afterCmd.findIndex((l) => l.startsWith('`'));
      expect(fenceOpenIdx).toBeGreaterThanOrEqual(0);

      const openingFence = afterCmd[fenceOpenIdx];
      // Opening fence must be exactly 3 backticks
      expect(openingFence).toBe('```');

      // Closing fence: find the next line identical to the opening fence
      const fenceCloseIdx = afterCmd.findIndex((l, i) => i > fenceOpenIdx && l === openingFence);
      expect(fenceCloseIdx).toBeGreaterThan(fenceOpenIdx);

      // Closing fence must also be exactly 3 backticks
      expect(afterCmd[fenceCloseIdx]).toBe('```');

      // Content between fences must be line A, line B
      const blockLines = afterCmd.slice(fenceOpenIdx + 1, fenceCloseIdx);
      expect(blockLines).toEqual(['line A', 'line B']);
    });
  });

  // =========================================================================
  // K5: no output at all → no output_tail key
  // =========================================================================
  describe('K5: empty output → no output_tail key', () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
      const script = ['#!/bin/sh', 'exit 1'].join('\n');
      await addSplitScript(box, script);
    });

    afterEach(() => {
      box.dispose();
    });

    it('K5: acceptance.failed event has no output_tail key', async () => {
      await box.run(honestRunner(box));

      const failed = findSplitFailed(box);
      expect('output_tail' in failed).toBe(false);
    });
  });
});
