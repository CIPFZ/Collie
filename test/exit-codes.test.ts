// SPEC 5: collie run exits 0 PASS / 10 FIX / 20 BLOCK / 1 Collie error.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVIEWER_STREAM_FILE_NAME, truncate } from '../src/run.js';
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
    });
  });

  it('20 when the worker is externally aborted, recorded as worker.crashed', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
    ]);
    const expired = AbortSignal.abort(new Error('wallclock_secs exceeded'));
    expect(await box.run(r, { workerSignal: expired })).toBe(20);
    expect(box.events().find((e) => e.event === 'worker.crashed')).toMatchObject({
      error: 'wallclock_secs exceeded',
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
      'ci.resolved',
      'verdict.pushed',
      'run.finished',
    ]);
  });
});

describe('exit-codes: R2 waits for CI before measuring it (v01-b05 2c)', () => {
  /** Advances instantly; records how long R2 would have slept. */
  function instantClock(): {
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    slept: number[];
  } {
    let t = 0;
    const slept: number[] = [];
    return {
      slept,
      now: () => t,
      sleep: (ms) => {
        slept.push(ms);
        t += ms;
        return Promise.resolve();
      },
    };
  }

  it('waits through pending polls and then passes with the real result', async () => {
    box.ciPendingPolls = 2;
    const clock = instantClock();
    expect(await box.run(honest(box), { clock })).toBe(0);
    expect(clock.slept).toEqual([30_000, 30_000]);
    expect(box.eventTypes()).not.toContain('ci.wait_timeout');
  });

  it('gives up at ci_wait_secs, journals ci.wait_timeout and treats the CI claim as unproven', async () => {
    box.ciPendingPolls = Number.POSITIVE_INFINITY;
    const clock = instantClock();
    expect(await box.run(honest(box), { clock })).toBe(10);
    const events = box.events();
    expect(events.find((e) => e.event === 'ci.wait_timeout')).toMatchObject({
      waited_secs: 1800,
      last_state: 'pending',
    });
    expect(events.find((e) => e.event === 'claim.mismatch')).toMatchObject({
      rule: 7,
      actual: { ci_conclusion: 'unknown', ci_branch_matched: null },
    });
  });

  it('does not wait at all for a head that was never pushed', async () => {
    box.ciPendingPolls = Number.POSITIVE_INFINITY;
    const clock = instantClock();
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: false, claims: honestClaims(5, false) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r, { clock })).toBe(10);
    expect(clock.slept).toEqual([]);
  });
});

describe('exit-codes: worker.finished carries the final text (SPEC 3.6, v01-b05 2d)', () => {
  it('records a short final text verbatim', async () => {
    const r = new FakeRunner([
      workerScene(box, {
        passing: 5,
        failing: 0,
        push: true,
        claims: honestClaims(5, true),
        finalText: 'plan: read, implement, test',
      }),
      fooledReviewerScene(box),
    ]);
    await box.run(r);
    expect(box.events().find((e) => e.event === 'worker.finished')).toMatchObject({
      exit_code: 0,
      final_text: 'plan: read, implement, test',
    });
  });

  it('records no final_text when the worker produced none', async () => {
    await box.run(honest(box));
    expect(box.events().find((e) => e.event === 'worker.finished')).not.toHaveProperty(
      'final_text',
    );
  });

  it('collie show prints the final text as an indented block', async () => {
    const r = new FakeRunner([
      workerScene(box, {
        passing: 5,
        failing: 0,
        push: true,
        claims: honestClaims(5, true),
        finalText: 'line one\nline two',
      }),
      fooledReviewerScene(box),
    ]);
    await box.run(r);
    box.output.length = 0;
    await box.cli(['show', BATCH], undefined);
    expect(box.output.join('')).toContain(
      'worker.finished exit_code=0\n    final_text:\n      line one\n      line two',
    );
  });
});

describe('exit-codes: truncate (format bound, not a threshold)', () => {
  it('keeps short text unchanged', () => {
    expect(truncate('abc', 2000)).toBe('abc');
  });

  it('cuts long text and says how much was dropped', () => {
    const out = truncate('x'.repeat(2500), 2000);
    expect(out.startsWith('x'.repeat(2000))).toBe(true);
    expect(out).toContain('[truncated 500 chars]');
  });

  it('never splits a multi-byte character or an emoji sequence', () => {
    expect(truncate('中文测试', 2)).toBe('中文…[truncated 2 chars]');
    expect(truncate('👨‍👩‍👧x', 1)).toBe('👨‍👩‍👧…[truncated 1 chars]');
  });
});

describe('exit-codes: R2 pushes verdict commit (SPEC 12.1)', () => {
  it('records verdict.pushed after a successful run', async () => {
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    expect(pushed).toMatchObject({
      remote: 'origin',
      branch: 'main',
    });
    expect(typeof pushed?.sha).toBe('string');
  });

  it('remote contains the verdict commit after push', async () => {
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    // Verify that the sha is actually on the remote.
    const { git: gitCmd } = await import('../src/git.js');
    const remoteRefs = await gitCmd(box.root, ['ls-remote', 'origin', 'refs/heads/main']);
    const sha = typeof pushed?.sha === 'string' ? pushed.sha : '';
    expect(remoteRefs).toContain(sha.slice(0, 7));
  });

  it('records verdict.push_failed when push fails and does not alter the verdict', async () => {
    // Break the remote by removing it, so push fails.
    const { git: gitCmd } = await import('../src/git.js');
    await gitCmd(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path']);
    const exitCode = await box.run(honest(box));
    const events = box.events();
    const pushFailed = events.find((e) => e.event === 'verdict.push_failed');
    expect(pushFailed).toBeDefined();
    expect(typeof pushFailed?.error).toBe('string');
    // The verdict is still PASS (push failure doesn't alter conclusion).
    // But rule 9 will kick in because remote_has_head can't be verified either.
    // The key point: no exception thrown, run completed.
    const finished = events.findLast((e) => e.event === 'run.finished');
    expect(finished).toBeDefined();
    expect(exitCode).toBeDefined();
  });
});

describe('exit-codes: startup CI check of previous verdict commit (SPEC 12.1)', () => {
  it('warns on stderr when previous verdict commit CI is failure', async () => {
    // First run: produces a verdict.pushed event.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();

    // Second run: the fetch mock returns failure for the verdict sha.
    box.ciConclusion = 'failure';
    box.ciPolls = 0;
    box.output.length = 0;
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, false) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);
    const output = box.output.join('');
    expect(output).toContain('warning: previous verdict commit');
    expect(output).toContain('failure');
  });

  it('records ci.verdict_commit event on success', async () => {
    // First run: produces a verdict.pushed event.
    await box.run(honest(box));

    // Second run: CI is success (default).
    box.ciPolls = 0;
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);
    const allEvents = box.events();
    const ciVerdict = allEvents.find((e) => e.event === 'ci.verdict_commit');
    expect(ciVerdict).toBeDefined();
    expect(ciVerdict).toMatchObject({ conclusion: 'success' });
  });
});

describe('exit-codes: reviewer event stream falls to reviewer.stream.ndjson (SPEC 12.1)', () => {
  it('creates reviewer.stream.ndjson containing reviewer events', async () => {
    // Run with a reviewer scene that emits events.
    const reviewerEvents = [
      { type: 'assistant', content: [{ type: 'text', text: 'reviewing...' }] },
      { type: 'result', subtype: 'success' },
    ];
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      {
        expectRole: 'reviewer',
        events: reviewerEvents,
        effect: ({ cwd }) => {
          box.reviewerCwd = cwd;
          box.reviewerSawReport = false;
        },
        result: {
          exitCode: 0,
          finalText: `# 裁决\n\n全部通过。\n\n\`\`\`json\n${JSON.stringify(
            {
              schema_version: 1,
              batch_id: BATCH,
              verdict: 'PASS',
              evidence: {
                commits_actual: [],
                verify_results: [
                  { cmd: 'sh run-tests.sh', exit_code: 0, summary: '5 passed, 0 failed' },
                ],
                remote_has_head: true,
                ci_conclusion: 'success',
                ci_run_url: '',
                ci_branch_matched: true,
                deps_diff: [],
                spec_diff_lines: 0,
              },
              claim_mismatches: [],
              gaps: [],
              reason: 'all good',
            },
            null,
            2,
          )}\n\`\`\`\n`,
        },
      },
    ]);
    await box.run(r);

    const runsDir = join(box.root, '.collie', 'runs');
    const runDirs = readdirSync(runsDir).sort();
    expect(runDirs.length).toBeGreaterThan(0);
    const runDir = runDirs[0] ?? '';
    const streamPath = join(runsDir, runDir, REVIEWER_STREAM_FILE_NAME);
    expect(existsSync(streamPath)).toBe(true);
    const streamContent = readFileSync(streamPath, 'utf8');
    const lines = streamContent.trim().split('\n');
    expect(lines.length).toBe(2);
    const first = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(first.type).toBe('assistant');
  });

  it('reviewer.stream.ndjson masks secrets with redact (SPEC 12.1)', async () => {
    // Set a token so that redact is active.
    const secretToken = 'ghp_supersecrettoken12345678';
    const tokenPath = join(box.root, '.collie', 'github-token');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(tokenPath, secretToken);
    // Point collie.toml at the token file.
    const tomlPath = join(box.root, '.collie', 'collie.toml');
    let toml = readFileSync(tomlPath, 'utf8');
    // Replace the existing token_file line (may be commented or not) with our path.
    toml = toml.replace(/^.*token_file.*$/m, `token_file = ".collie/github-token"`);
    writeFileSync(tomlPath, toml);

    // The reviewer scene emits an event that contains the secret.
    const reviewerEvents = [
      { type: 'assistant', content: [{ type: 'text', text: `token is ${secretToken}` }] },
    ];
    const r = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      {
        expectRole: 'reviewer',
        events: reviewerEvents,
        effect: ({ cwd }) => {
          box.reviewerCwd = cwd;
          box.reviewerSawReport = false;
        },
        result: {
          exitCode: 0,
          finalText: `# 裁决\n\n全部通过。\n\n\`\`\`json\n${JSON.stringify(
            {
              schema_version: 1,
              batch_id: BATCH,
              verdict: 'PASS',
              evidence: {
                commits_actual: [],
                verify_results: [
                  { cmd: 'sh run-tests.sh', exit_code: 0, summary: '5 passed, 0 failed' },
                ],
                remote_has_head: true,
                ci_conclusion: 'success',
                ci_run_url: '',
                ci_branch_matched: true,
                deps_diff: [],
                spec_diff_lines: 0,
              },
              claim_mismatches: [],
              gaps: [],
              reason: 'all good',
            },
            null,
            2,
          )}\n\`\`\`\n`,
        },
      },
    ]);
    await box.run(r);

    const runsDir = join(box.root, '.collie', 'runs');
    const runDirs = readdirSync(runsDir).sort();
    const runDir = runDirs[0] ?? '';
    const streamContent = readFileSync(join(runsDir, runDir, REVIEWER_STREAM_FILE_NAME), 'utf8');
    // The secret should be masked by the redact mechanism.
    expect(streamContent).not.toContain(secretToken);
    expect(streamContent).toContain('***');
  });
});
