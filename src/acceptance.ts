// Prepare acceptance tests for a batch (SPEC 16.12, v046-b08):
// Checks out a worktree, runs the tester agent up to testerMax times,
// does a red check after each run, collects the files if it passes.
// Does NOT write to the main repository or commit anything.

import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addWorktree, removeWorktree } from './git.js';
import type { RunRedCheckResult } from './redcheck.js';
import { runRedCheck, type RunRedCheckOpts } from './redcheck.js';
import type { AgentRunner } from './runner/index.js';
import { runTester, type TesterInput } from './roles/tester.js';
import type { Batch, CollieConfig } from './schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A file taken from the acceptance test output. */
export interface AcceptanceFile {
  /** Path relative to the repository root (e.g. `test/acceptance/v01-b01/new.test.ts`). */
  path: string;
  /** File content (UTF-8). */
  content: string;
}

/** Successful result: red check passed. */
export interface AcceptanceOk {
  ok: true;
  attempts: number;
  files: AcceptanceFile[];
}

/** Failed result: all attempts exhausted or tester crashed. */
export interface AcceptanceFail {
  ok: false;
  attempts: number;
  problems: string[];
}

export type AcceptanceResult = AcceptanceOk | AcceptanceFail;

/** Record function for journal events. */
export type RecordFn = (event: string, fields: Record<string, unknown>) => void;

/** Red-check function signature (defaults to the real `runRedCheck`). */
export type RedCheckFn = (
  tree: string,
  outDir: string,
  opts: RunRedCheckOpts,
) => Promise<RunRedCheckResult>;

export interface PrepareAcceptanceOpts {
  root: string;
  headSha: string;
  batch: Batch;
  config: CollieConfig;
  runner: AgentRunner;
  testerMax: number;
  redCheckOpts: RunRedCheckOpts;
  record?: RecordFn;
  redCheck?: RedCheckFn;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const WORKTREE_PREFIX = 'collie-accept-';

/**
 * Runs the tester agent and red check loop in a temporary worktree.
 *
 * Returns the accepted files or the problems from the last attempt.
 * Never writes to `opts.root`; always cleans up the worktree.
 */
export async function prepareAcceptance(opts: PrepareAcceptanceOpts): Promise<AcceptanceResult> {
  const { root, headSha, batch, config, runner, testerMax, redCheckOpts, record } = opts;
  const doRedCheck: RedCheckFn = opts.redCheck ?? runRedCheck;

  // Create a temporary worktree checked out at headSha.
  const worktreeDir = mkdtempSync(join(tmpdir(), WORKTREE_PREFIX));
  // mkdtempSync creates the directory; git worktree add needs it not to exist.
  rmSync(worktreeDir, { recursive: true, force: true });

  await addWorktree(root, worktreeDir, headSha);
  try {
    // If the main repo has node_modules, symlink them into the worktree
    // (unless the worktree already has them, e.g. from a symlink in the repo).
    const mainNodeModules = join(root, 'node_modules');
    const worktreeNodeModules = join(worktreeDir, 'node_modules');
    if (existsSync(mainNodeModules) && !existsSync(worktreeNodeModules)) {
      symlinkSync(mainNodeModules, worktreeNodeModules);
    }

    const outDir = `test/acceptance/${batch.id}`;
    const hasKeep = (batch.scenarios ?? []).some((s) => s.kind === 'keep');
    let previousProblems: string[] = [];
    let lastProblems: string[] = [];
    let attempts = 0;

    for (let i = 0; i < testerMax; i++) {
      attempts++;

      // Build tester input. The batch must have scenarios (caller ensured).
      const scenarios = batch.scenarios ?? [];
      const testerInput: TesterInput = {
        batch_id: batch.id,
        scenarios,
        interfaces: batch.interfaces ?? [],
        spec_paths: ['SPEC.md'],
        out_dir: outDir,
        ...(previousProblems.length > 0 ? { previous_problems: previousProblems } : {}),
      };

      record?.('tester.started', { attempt: attempts });

      const result = await runTester(runner, config, testerInput, worktreeDir);

      record?.('tester.finished', { attempt: attempts, exitCode: result.exitCode });

      // Non-zero exit: this attempt failed, no red check.
      if (result.exitCode !== 0) {
        lastProblems = [`tester exited with code ${String(result.exitCode)}`];
        // Non-zero exit: skip red check, go to next iteration (or finish).
        continue;
      }

      // Run red check — if it throws, let the error propagate (not a tester failure).
      const redResult = await doRedCheck(worktreeDir, outDir, redCheckOpts);

      record?.('redcheck.result', {
        attempt: attempts,
        ok: redResult.ok,
        problems: redResult.problems,
        new_tests: redResult.newTestCount,
        keep_tests: redResult.keepTestCount,
      });

      if (redResult.ok) {
        // Red check passed — verify required files exist and collect them.
        const collectResult = collectFiles(worktreeDir, outDir, hasKeep);
        if (!collectResult.ok) {
          lastProblems = collectResult.problems;
          previousProblems = collectResult.problems;
          continue;
        }
        return { ok: true, attempts, files: collectResult.files };
      }

      // Red check didn't pass — format problems for next iteration.
      lastProblems = redResult.problems.map((p) => `[${p.file}] ${p.testName}: ${p.reason}`);
      previousProblems = lastProblems;
    }

    return { ok: false, attempts, problems: lastProblems };
  } finally {
    // Always remove the worktree, even on error.
    try {
      await removeWorktree(root, worktreeDir);
    } catch {
      // Best-effort cleanup: if removeWorktree fails, try rm.
      try {
        rmSync(worktreeDir, { recursive: true, force: true });
      } catch {
        /* cleanup best-effort */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

interface CollectOk {
  ok: true;
  files: AcceptanceFile[];
}

interface CollectFail {
  ok: false;
  problems: string[];
}

function collectFiles(
  worktreeDir: string,
  outDir: string,
  hasKeep: boolean,
): CollectOk | CollectFail {
  const absOutDir = join(worktreeDir, outDir);
  const problems: string[] = [];

  // MAP.md is always required.
  const mapPath = join(absOutDir, 'MAP.md');
  if (!existsSync(mapPath)) {
    problems.push('MAP.md not found in output directory');
  }

  // new.test.ts is always required (red check passing implies it exists, but be safe).
  const newTestPath = join(absOutDir, 'new.test.ts');
  if (!existsSync(newTestPath)) {
    problems.push('new.test.ts not found in output directory');
  }

  // keep.test.ts is required when the batch has keep scenarios.
  const keepTestPath = join(absOutDir, 'keep.test.ts');
  if (hasKeep && !existsSync(keepTestPath)) {
    problems.push('batch has [保持] scenarios but keep.test.ts not found');
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  // Collect only the named files.
  const files: AcceptanceFile[] = [];

  files.push({
    path: `${outDir}/new.test.ts`,
    content: readFileSync(newTestPath, 'utf8'),
  });

  files.push({
    path: `${outDir}/MAP.md`,
    content: readFileSync(mapPath, 'utf8'),
  });

  if (hasKeep && existsSync(keepTestPath)) {
    files.push({
      path: `${outDir}/keep.test.ts`,
      content: readFileSync(keepTestPath, 'utf8'),
    });
  }

  return { ok: true, files };
}
