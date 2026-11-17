// Red-check for acceptance tests (SPEC 16.10, 16.2 step 3):
// Before the worker runs, verify that new-behavior tests all fail and
// keep-behavior tests all pass on the current codebase (no implementation yet).
//
// judgeRedCheck: pure function — takes vitest JSON reports, returns ok/problems.
// runRedCheck:   runs vitest on new.test.ts and optional keep.test.ts, returns judgment.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Vitest JSON report shape (only the fields we inspect). */
export interface VitestTestResult {
  status: string; // 'passed' | 'failed' | 'skipped' | 'todo'
  fullName: string;
}

export interface VitestTestFileResult {
  assertionResults: VitestTestResult[];
}

/** Subset of a vitest JSON report used by judgeRedCheck. */
export interface VitestJsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number; // skipped
  numTodoTests: number;
  testResults: VitestTestFileResult[];
}

export interface RedCheckProblem {
  file: 'new' | 'keep';
  testName: string;
  reason: string;
}

export interface RedCheckJudgment {
  ok: boolean;
  problems: RedCheckProblem[];
}

// ---------------------------------------------------------------------------
// judgeRedCheck — pure function (SPEC 16.10)
// ---------------------------------------------------------------------------

/**
 * Judges vitest JSON reports for the red check.
 *
 * Rules (SPEC 16.10):
 * - `new`: at least one test case executed, every one must have failed.
 *   Passed, skipped, or todo ⇒ not ok. Zero test cases (file load error) ⇒ not ok.
 * - `keep`: may be absent (null/undefined). If present, at least one test executed,
 *   all must pass.
 */
export function judgeRedCheck(reports: {
  newReport: VitestJsonReport | null;
  keepReport?: VitestJsonReport | null;
}): RedCheckJudgment {
  const problems: RedCheckProblem[] = [];

  // ── new report ──────────────────────────────────────────────────────
  const nr = reports.newReport;
  if (nr === null) {
    problems.push({ file: 'new', testName: '(file)', reason: 'file load failed: no report' });
  } else if (nr.numTotalTests === 0) {
    problems.push({
      file: 'new',
      testName: '(file)',
      reason: 'file load failed: zero test cases collected',
    });
  } else {
    // Walk individual results to find non-failing cases.
    for (const fileResult of nr.testResults) {
      for (const t of fileResult.assertionResults) {
        if (t.status === 'passed') {
          problems.push({
            file: 'new',
            testName: t.fullName,
            reason: 'expected to fail but passed',
          });
        } else if (t.status === 'skipped' || t.status === 'pending') {
          problems.push({
            file: 'new',
            testName: t.fullName,
            reason: 'skipped — must execute and fail',
          });
        } else if (t.status === 'todo') {
          problems.push({
            file: 'new',
            testName: t.fullName,
            reason: 'todo — must execute and fail',
          });
        }
        // 'failed' is the only acceptable status for new tests
      }
    }
  }

  // ── keep report (optional) ─────────────────────────────────────────
  const kr = reports.keepReport;
  if (kr !== undefined && kr !== null) {
    if (kr.numTotalTests === 0) {
      problems.push({
        file: 'keep',
        testName: '(file)',
        reason: 'zero test cases collected',
      });
    } else {
      for (const fileResult of kr.testResults) {
        for (const t of fileResult.assertionResults) {
          if (t.status !== 'passed') {
            problems.push({
              file: 'keep',
              testName: t.fullName,
              reason: `expected to pass but ${t.status}`,
            });
          }
        }
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// runRedCheck — runs vitest, collects JSON reports, delegates to judgeRedCheck
// ---------------------------------------------------------------------------

type ExecFileFn = typeof import('node:child_process').execFile;
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-magic-numbers -- type-level index */
type ExecFileOptions = Parameters<ExecFileFn>[2];
/* eslint-enable no-restricted-syntax, @typescript-eslint/no-magic-numbers */

/** Options for runRedCheck: timeout and subprocess launcher are caller-provided. */
export interface RunRedCheckOpts {
  /** Timeout in milliseconds for each vitest invocation. */
  timeoutMs: number;
  /** Function to spawn a child process — allows injection for tests. */
  spawn: ExecFileFn;
}

export interface RunRedCheckResult extends RedCheckJudgment {
  newTestCount: number;
  keepTestCount: number;
}

/** Read and parse a vitest JSON report from disk; null if unreadable. */
function readJsonReport(path: string): VitestJsonReport | null {
  try {
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      numTotalTests: typeof data.numTotalTests === 'number' ? data.numTotalTests : 0,
      numPassedTests: typeof data.numPassedTests === 'number' ? data.numPassedTests : 0,
      numFailedTests: typeof data.numFailedTests === 'number' ? data.numFailedTests : 0,
      numPendingTests: typeof data.numPendingTests === 'number' ? data.numPendingTests : 0,
      numTodoTests: typeof data.numTodoTests === 'number' ? data.numTodoTests : 0,
      testResults: Array.isArray(data.testResults)
        ? (data.testResults as VitestTestFileResult[])
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Runs vitest on a single test file inside `tree`, writing the JSON report to
 * a temp file outside the tree (SPEC 15.5), reads it, then cleans up.
 *
 * Returns the parsed report (null on file-load error) and the vitest exit code.
 */
async function runOneFile(
  testFilePath: string,
  tree: string,
  reportDir: string,
  opts: RunRedCheckOpts,
): Promise<{ report: VitestJsonReport | null; exitCode: number; timedOut: boolean }> {
  const reportPath = join(reportDir, `report-${String(Date.now())}.json`);

  return new Promise((resolve) => {
    const child = opts.spawn(
      'npx',
      ['vitest', 'run', '--reporter=json', `--outputFile=${reportPath}`, testFilePath],
      { cwd: tree, timeout: opts.timeoutMs, stdio: 'pipe' } as ExecFileOptions,
      (error: Error | null) => {
        let exitCode = 0;
        let timedOut = false;
        if (error !== null) {
          const e = error as NodeJS.ErrnoException & { killed?: boolean; code?: number | string };
          timedOut = e.killed === true;
          exitCode = typeof e.code === 'number' ? e.code : 1;
        }
        const report = readJsonReport(reportPath);
        try {
          rmSync(reportPath, { force: true });
        } catch {
          /* cleanup best-effort */
        }
        resolve({ report, exitCode, timedOut });
      },
    );
    // Ensure we don't leave zombie processes — ignore errors if already dead.
    child.unref();
  });
}

/**
 * Runs the red check on `<outDir>/new.test.ts` and (if it exists)
 * `<outDir>/keep.test.ts` inside directory `tree`.
 *
 * JSON reports are written to a system temp directory (prefix `collie-redcheck-`),
 * read, and deleted (SPEC 15.5). If new.test.ts does not exist, the check fails.
 * Timeout is treated as failure with a clear reason.
 */
export async function runRedCheck(
  tree: string,
  outDir: string,
  opts: RunRedCheckOpts,
): Promise<RunRedCheckResult> {
  const newFile = join(outDir, 'new.test.ts');
  const keepFile = join(outDir, 'keep.test.ts');

  // new.test.ts must exist
  if (!existsSync(join(tree, newFile))) {
    return {
      ok: false,
      problems: [{ file: 'new', testName: '(file)', reason: 'new.test.ts does not exist' }],
      newTestCount: 0,
      keepTestCount: 0,
    };
  }

  // Create a temp dir for JSON reports *outside* tree (SPEC 15.5).
  const reportDir = mkdtempSync(join(tmpdir(), 'collie-redcheck-'));
  try {
    // Run new.test.ts
    const newResult = await runOneFile(newFile, tree, reportDir, opts);
    if (newResult.timedOut) {
      return {
        ok: false,
        problems: [{ file: 'new', testName: '(file)', reason: 'timeout' }],
        newTestCount: 0,
        keepTestCount: 0,
      };
    }

    // Run keep.test.ts if it exists
    let keepResult: { report: VitestJsonReport | null; timedOut: boolean } | undefined;
    if (existsSync(join(tree, keepFile))) {
      keepResult = await runOneFile(keepFile, tree, reportDir, opts);
      if (keepResult.timedOut) {
        return {
          ok: false,
          problems: [{ file: 'keep', testName: '(file)', reason: 'timeout' }],
          newTestCount: newResult.report?.numTotalTests ?? 0,
          keepTestCount: 0,
        };
      }
    }

    // Delegate to pure judge function
    const judgment = judgeRedCheck({
      newReport: newResult.report,
      keepReport: keepResult?.report ?? null,
    });

    return {
      ...judgment,
      newTestCount: newResult.report?.numTotalTests ?? 0,
      keepTestCount: keepResult?.report?.numTotalTests ?? 0,
    };
  } finally {
    // Always clean up the temp report directory
    try {
      rmSync(reportDir, { recursive: true, force: true });
    } catch {
      /* cleanup best-effort */
    }
  }
}
