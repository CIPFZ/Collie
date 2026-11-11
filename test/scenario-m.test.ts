// SPEC 13.9 scenario M: environment fault handling.
// Six groups:
//   1. token_file missing at startup → run exits 1, no task issued
//   2. rate-limited CI → single-batch FIX with evidence_unavailable cause
//   3. --continue with evidence_unavailable → one run, stops, backlog pending, exit 20
//   4. contrast: CI failure is a normal FIX that gets retried
//   5. smoke: token_file missing → exit 1 with token_file in stderr
//   6. smoke: CI query failure → exit 1 after runner succeeds
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, BATCH, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let workerSeq = 0;

/** Worker scene: commits code + tests, writes a report, optionally pushes. */
function mWorkerScene(
  box: Sandbox,
  batchId: string,
  push: boolean,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: push,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      if (push) {
        const { git: gitFn } = await import('../src/git.js');
        await gitFn(cwd, ['push', '-q', 'origin', 'main']);
      }
    },
    result: { exitCode: 0 },
  };
}

/** Reviewer scene: says PASS with CI evidence. */
function reviewerPass(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'PASS',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed, 0 failed' }],
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
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** A fetch that always rate-limits (HTTP 429). */
const rateLimitFetch: FetchLike = () =>
  Promise.resolve(
    new Response('{"message":"rate limit exceeded"}', {
      status: 429,
      headers: { 'x-ratelimit-remaining': '0' },
    }),
  );

/** A fetch that throws a network error. */
const networkErrorFetch: FetchLike = () => Promise.reject(new Error('connect ECONNREFUSED'));

/** A fetch that returns CI failure (completed, conclusion=failure). */
function ciFailureFetch(branch = 'main'): FetchLike {
  return (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    const run = {
      id: 42,
      workflow_id: 1,
      name: 'ci',
      event: 'push',
      head_branch: branch,
      head_sha: sha,
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/example/sandbox/actions/runs/42',
      created_at: '2026-10-19T12:00:00Z',
    };
    return Promise.resolve(new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })));
  };
}

/** Sets ci.token_file in the sandbox config to a given path. */
function setTokenFile(box: Sandbox, tokenPath: string): void {
  const toml = box.read('.collie/collie.toml');
  const updated = toml.includes('token_file')
    ? toml.replace(/^.*token_file.*$/m, `token_file = ${JSON.stringify(tokenPath)}`)
    : toml.replace(/^\[ci\]/m, `[ci]\ntoken_file = ${JSON.stringify(tokenPath)}`);
  box.write('.collie/collie.toml', updated);
}

// ---------------------------------------------------------------------------
// 1. token_file missing → startup failure, no task
// ---------------------------------------------------------------------------

describe('scenario M: token_file missing → startup failure', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('collie run exits 1 and stderr contains ci.token_file and path', async () => {
    const missingPath = join(box.dir, 'nonexistent-token');
    setTokenFile(box, missingPath);
    await box.commitAll('chore: set missing token_file');

    const runner = new FakeRunner([]);
    const code = await box.run(runner);
    expect(code).toBe(1);
    const output = box.output.join('');
    expect(output).toContain('ci.token_file');
    expect(output).toContain(missingPath);
    // No task should have been issued (no events at all).
    expect(box.events()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Rate-limited CI → single-batch FIX with evidence_unavailable cause
// ---------------------------------------------------------------------------

describe('scenario M: rate-limited CI → FIX with evidence_unavailable', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('single-batch FIX includes evidence_unavailable in summary line', async () => {
    const runner = new FakeRunner([mWorkerScene(box, BATCH, true), reviewerPass(box, BATCH)]);
    // Use rate-limiting fetch: CI queries fail with 429.
    const code = await box.run(runner, { fetch: rateLimitFetch });
    expect(code).toBe(10); // FIX exit code
    const output = box.output.join('');
    expect(output).toContain('evidence_unavailable');

    // The verdict.downgraded event should carry cause and detail.
    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded?.cause).toBe('evidence_unavailable');
    expect(downgraded?.detail).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 3. --continue with evidence_unavailable → one run, stops, backlog pending
// ---------------------------------------------------------------------------

describe(
  'scenario M: --continue evidence_unavailable → stops without rerun',
  { timeout: 60_000 },
  () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
    });

    afterEach(() => {
      box.dispose();
    });

    it('runs once, exits 20, backlog still pending, journal has escalated + queue.finished', async () => {
      // Override backlog to have batch as "pending" so --continue picks it up.
      const pendingBacklog = box.read('docs/backlog.md').replace(/running/, 'pending');
      box.write('docs/backlog.md', pendingBacklog);
      await box.commitAll('chore: set batch to pending');

      const runner = new FakeRunner([mWorkerScene(box, BATCH, true), reviewerPass(box, BATCH)]);
      // Use rate-limiting fetch: CI evidence is unavailable.
      const code = await box.cli(['run', '--continue'], runner, { fetch: rateLimitFetch });
      expect(code).toBe(20); // BLOCK exit code (SPEC 13.9 says exit 20)

      // Backlog status should still be "pending" (not moved to blocked).
      const backlog = box.read('docs/backlog.md');
      expect(backlog).not.toMatch(/v99-b01.*blocked/);

      // Journal should have escalated and queue.finished with reason evidence_unavailable.
      const events = box.events();
      const escalated = events.find(
        (e) => e.event === 'escalated' && e.reason === 'evidence_unavailable',
      );
      expect(escalated).toBeDefined();

      const queueFinished = events.find(
        (e) => e.event === 'queue.finished' && e.reason === 'evidence_unavailable',
      );
      expect(queueFinished).toBeDefined();

      // Output summary should contain evidence_unavailable.
      const output = box.output.join('');
      expect(output).toContain('evidence_unavailable');
    });
  },
);

// ---------------------------------------------------------------------------
// 4. Contrast: CI failure is normal FIX → gets retried in queue
// ---------------------------------------------------------------------------

describe('scenario M: CI failure → normal FIX, retried by queue', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('CI failure is retried (no evidence_unavailable), eventually fix_max', async () => {
    // Override backlog to have batch as "pending" so --continue picks it up.
    const pendingBacklog = box.read('docs/backlog.md').replace(/running/, 'pending');
    box.write('docs/backlog.md', pendingBacklog);
    await box.commitAll('chore: set batch to pending for CI failure test');

    // fix_max is 2 (from config). We need 3 worker+reviewer rounds (1 + 2 retries).
    const runner = new FakeRunner([
      // Round 1: worker pushes, reviewer says PASS, CI says failure → rule 9 FIX (no cause)
      mWorkerScene(box, BATCH, true),
      reviewerPass(box, BATCH),
      // Round 2: retry
      mWorkerScene(box, BATCH, true),
      reviewerPass(box, BATCH),
      // Round 3: retry (exceeds fix_max=2)
      mWorkerScene(box, BATCH, true),
      reviewerPass(box, BATCH),
    ]);
    const code = await box.cli(['run', '--continue'], runner, { fetch: ciFailureFetch() });
    // fix_max exceeded → BLOCK exit code 20.
    expect(code).toBe(20);

    const events = box.events();
    // Should have normal verdict.downgraded events without cause.
    const downgradedEvents = events.filter((e) => e.event === 'verdict.downgraded');
    expect(downgradedEvents.length).toBeGreaterThanOrEqual(1);
    for (const d of downgradedEvents) {
      expect(d.cause).toBeUndefined();
    }

    // Queue should finish with fix_max, not evidence_unavailable.
    const queueFinished = events.find((e) => e.event === 'queue.finished');
    expect(queueFinished).toBeDefined();
    expect(queueFinished?.reason).toBe('fix_max');
  });
});

// ---------------------------------------------------------------------------
// 5. Smoke: token_file missing → exit 1
// ---------------------------------------------------------------------------

describe('scenario M: smoke token_file failure', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('smoke exits 1 when token_file is configured but missing', async () => {
    const missingPath = join(box.dir, 'nonexistent-token');
    setTokenFile(box, missingPath);
    await box.commitAll('chore: set missing token_file for smoke');

    const runner = new FakeRunner([]);
    const code = await box.cli(['smoke', '--runner', 'fake'], runner);
    expect(code).toBe(1);
    const output = box.output.join('');
    expect(output).toContain('token_file');
  });
});

// ---------------------------------------------------------------------------
// 6. Smoke: CI query failure after runner succeeds → exit 1
// ---------------------------------------------------------------------------

describe('scenario M: smoke CI query failure', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('smoke exits 1 when CI query fails after runner succeeds', async () => {
    // Write a valid token file so readCiTokenChecked passes.
    const tokenPath = join(box.dir, 'test-token');
    writeFileSync(tokenPath, 'ghp_test123\n');
    setTokenFile(box, tokenPath);
    await box.commitAll('chore: set valid token_file for smoke');

    // The smoke command needs a scene for the runner (one turn).
    const runner = new FakeRunner([
      { expectRole: 'worker', result: { exitCode: 0, finalText: 'ok' } },
    ]);
    // Use networkErrorFetch so CI query fails after runner succeeds.
    // Don't use --runner fake: let deps.runner be the FakeRunner we pass.
    const code = await box.cli(['smoke'], runner, {
      fetch: networkErrorFetch,
    });
    expect(code).toBe(1);
    const output = box.output.join('');
    // Runner should have succeeded (smoke ok printed before CI fails).
    expect(output).toContain('smoke ok');
    // CI failure should be reported.
    expect(output).toContain('smoke ci check failed');
    // Token content must NOT appear in output (SPEC 13.9).
    expect(output).not.toContain('ghp_test123');
  });
});
