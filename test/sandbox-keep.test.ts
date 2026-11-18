// Tests for the COLLIE_TEST_KEEP_RUNS sandbox feature (SPEC 16.13).
//
// When the env var is set, Sandbox.dispose() copies .collie/runs/ and writes
// TEST_NAME before deleting the sandbox. When unset, nothing is kept.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import { git } from '../src/git.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, BATCH, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers (same pattern as queue-limit.test.ts / scenario tests)
// ---------------------------------------------------------------------------

function workerScene(box: Sandbox): {
  expectRole: 'worker';
  effect: (ctx: { cwd: string }) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: true,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: BATCH,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

function reviewerPassScene(box: Sandbox): {
  expectRole: 'reviewer';
  effect: (ctx: { cwd: string }) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: BATCH,
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
    effect: ({ cwd }) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sandbox: COLLIE_TEST_KEEP_RUNS', () => {
  let keepDir: string | undefined;
  let savedKeep: string | undefined;

  afterEach(() => {
    // Restore the env var.
    if (savedKeep === undefined) delete process.env.COLLIE_TEST_KEEP_RUNS;
    else process.env.COLLIE_TEST_KEEP_RUNS = savedKeep;
    // Clean up the keep directory.
    if (keepDir && existsSync(keepDir)) rmSync(keepDir, { recursive: true, force: true });
  });

  it('copies events.ndjson and writes TEST_NAME when env var is set', async () => {
    savedKeep = process.env.COLLIE_TEST_KEEP_RUNS;
    keepDir = mkdtempSync(join(tmpdir(), 'collie-keep-test-'));
    process.env.COLLIE_TEST_KEEP_RUNS = keepDir;

    const box = await Sandbox.create();
    const runner = new FakeRunner([workerScene(box), reviewerPassScene(box)]);
    await box.run(runner);
    box.dispose();

    // keepDir should now contain a subdirectory with runs/ and TEST_NAME.
    const entries = readdirSync(keepDir);
    expect(entries.length).toBeGreaterThanOrEqual(1);

    // Find the sandbox subdirectory (name starts with collie-sandbox-).
    const sbDir = entries.find((e) => e.startsWith('collie-sandbox-'));
    expect(sbDir, 'expected a collie-sandbox-* dir in keep dir').toBeDefined();
    const dest = join(keepDir, sbDir ?? '');

    // events.ndjson must exist somewhere under runs/.
    const runsDir = join(dest, 'runs');
    expect(existsSync(runsDir), 'runs/ should exist').toBe(true);
    const runIds = readdirSync(runsDir);
    expect(runIds.length).toBeGreaterThanOrEqual(1);
    const firstRunId = runIds[0] ?? '';
    const eventsFile = join(runsDir, firstRunId, 'events.ndjson');
    expect(existsSync(eventsFile), 'events.ndjson should exist').toBe(true);

    // TEST_NAME must exist.
    const testNameFile = join(dest, 'TEST_NAME');
    expect(existsSync(testNameFile), 'TEST_NAME should exist').toBe(true);
    // The content should be non-empty (vitest should provide the test name).
    const testNameContent = readFileSync(testNameFile, 'utf8');
    expect(testNameContent.length).toBeGreaterThan(0);
  });

  it('does not leave anything when env var is not set', async () => {
    savedKeep = process.env.COLLIE_TEST_KEEP_RUNS;
    delete process.env.COLLIE_TEST_KEEP_RUNS;

    keepDir = mkdtempSync(join(tmpdir(), 'collie-keep-test-'));
    // We don't set the env var — keepDir is just for cleanup safety.

    const box = await Sandbox.create();
    const runner = new FakeRunner([workerScene(box), reviewerPassScene(box)]);
    await box.run(runner);
    const sandboxDir = box.dir;
    box.dispose();

    // The sandbox directory should be gone.
    expect(existsSync(sandboxDir)).toBe(false);

    // keepDir should still be empty (nothing was written to it).
    const entries = readdirSync(keepDir);
    expect(entries).toHaveLength(0);
  });
});
