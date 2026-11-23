// Acceptance tests for v046-b35 — [保持] scenarios K1–K3.
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
// K1: renderFixSection without output_tail → no fenced code block
// ---------------------------------------------------------------------------

describe('K1: renderFixSection without output_tail has no fenced code block', () => {
  it('K1: output contains the command line and no fenced code block in the acceptance section', () => {
    const info: FixInfo = {
      gaps: [],
      failedAcceptance: [{ cmd: 'sh noisy.sh', exit_code: 1 }],
      commits: [],
    };

    const result = renderFixSection(info);

    // The command line should be present
    expect(result).toContain('- `sh noisy.sh` → exit 1');

    // The "未通过的验收命令" section should exist
    expect(result).toContain('### 未通过的验收命令');

    // Extract the acceptance section and check there's no fenced code block in it
    const sectionStart = result.indexOf('### 未通过的验收命令');
    // Find next section or end of string
    const nextSectionMatch = result.slice(sectionStart + 1).search(/^### /m);
    const sectionEnd = nextSectionMatch >= 0 ? sectionStart + 1 + nextSectionMatch : result.length;
    const section = result.slice(sectionStart, sectionEnd);
    expect(section).not.toContain('```');
  });
});

// ---------------------------------------------------------------------------
// K2: acceptance.failed event retains cmd, exit_code, expect; FIX rule 8 exit 10
// ---------------------------------------------------------------------------

describe('K2: acceptance.failed event fields and FIX verdict on failing acceptance', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Add sh noisy.sh to global verify commands (same as S2 setup)
    const toml = box.read('.collie/collie.toml');
    const newToml = toml.replace(
      `commands = ["${TEST_CMD}"]`,
      `commands = ["${TEST_CMD}", "sh noisy.sh"]`,
    );
    box.write('.collie/collie.toml', newToml);
    // noisy.sh prints a line and exits 1
    box.write('noisy.sh', '#!/bin/sh\necho "hello"\nexit 1\n');
    await box.commitAll('add noisy.sh to verify commands');
  });

  afterEach(() => {
    box.dispose();
  });

  it('K2: acceptance.failed has cmd, exit_code, expect; verdict is FIX rule 8 exit 10', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47),
      }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(10);

    const events = box.events();

    // acceptance.failed event for sh noisy.sh has cmd, exit_code, expect
    const failedEvents = events.filter(
      (e) => e.event === 'acceptance.failed' && e.cmd === 'sh noisy.sh',
    );
    expect(failedEvents).toHaveLength(1);
    const failed = failedEvents[0];
    expect(failed).toBeDefined();
    expect(failed).toMatchObject({
      cmd: 'sh noisy.sh',
      exit_code: 1,
      expect: 'exit_zero',
    });

    // Verdict is FIX, rule 8
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toMatchObject({
      from: 'PASS',
      to: 'FIX',
      rule: 8,
    });

    // run.finished: FIX exit 10
    const finished = events.find((e) => e.event === 'run.finished');
    expect(finished).toMatchObject({
      verdict: 'FIX',
      exit_code: 10,
    });
  });
});

// ---------------------------------------------------------------------------
// K3: all acceptance passes → no acceptance.failed event
// ---------------------------------------------------------------------------

describe('K3: all acceptance commands pass → no acceptance.failed event', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: journal has no acceptance.failed event when all commands pass', async () => {
    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47),
      }),
      fooledReviewerScene(box),
    ]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(0);

    const events = box.events();
    const failedEvents = events.filter((e) => e.event === 'acceptance.failed');
    expect(failedEvents).toEqual([]);
  });
});
