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

/** Why prepareAcceptance failed (SPEC 16.13). */
export type AcceptanceFailReason = 'red_check' | 'tester_failed' | 'misclassified';

/** Successful result: red check passed. */
export interface AcceptanceOk {
  ok: true;
  attempts: number;
  files: AcceptanceFile[];
  /** Final reply text from each tester invocation, in order. Empty string when none. */
  reports: string[];
}

/** Failed result: all attempts exhausted or tester crashed. */
export interface AcceptanceFail {
  ok: false;
  attempts: number;
  problems: string[];
  /** Why it failed (SPEC 16.13). */
  reason: AcceptanceFailReason;
  /** Final reply text from each tester invocation, in order. Empty string when none. */
  reports: string[];
  /** Category misclassifications declared by the tester (SPEC 16.14). String items verbatim; {id,why} items as `<id>：<why>`. Empty when none declared. */
  misclassified: string[];
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
  /** AbortSignal: when aborted, the next tester invocation is skipped and the loop ends with tester_failed (SPEC 16.14). */
  signal?: AbortSignal;
  /** Called for each tester event from every invocation (SPEC 16.14). First arg is the attempt number (1-based). */
  onTesterEvent?: (attempt: number, event: unknown) => void;
  /** Secret values to redact from tester event streams (SPEC 16.14). */
  redact?: readonly string[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const WORKTREE_PREFIX = 'collie-accept-';

/**
 * Extracts the `misclassified` array from the last JSON fence block in `text`.
 * Returns the array if it is non-empty, `undefined` otherwise.
 * Each item may be a string (kept verbatim) or `{ id, why }` (formatted as `<id>：<why>`).
 * Any parse failure (no fence, bad JSON, missing/wrong field) returns `undefined`.
 */
function extractMisclassified(text: string): string[] | undefined {
  // Find all ```json ... ``` fence blocks.
  const fenceRe = /```json\s*\n([\s\S]*?)```/g;
  let lastJsonBlock: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    lastJsonBlock = m[1];
  }
  if (lastJsonBlock === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(lastJsonBlock);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const obj = parsed as Record<string, unknown>;
    const arr = obj.misclassified;
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr.map((item: unknown) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        if (typeof o.id === 'string' && typeof o.why === 'string') {
          return `${o.id}：${o.why}`;
        }
      }
      return String(item);
    });
  } catch {
    return undefined;
  }
}

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

  try {
    await addWorktree(root, worktreeDir, headSha);
  } catch (err: unknown) {
    // SPEC 16.13: clean up directory AND git worktree registration on failure.
    try {
      await removeWorktree(root, worktreeDir);
    } catch {
      try {
        rmSync(worktreeDir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
    throw err;
  }
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
    /** Tracks last failure reason for the return value (SPEC 16.13). */
    let lastFailReason: AcceptanceFailReason = 'red_check';
    /** Collects final reply text from each tester invocation (SPEC 16.13). */
    const reports: string[] = [];
    /** Error limit for tester.finished error field (SPEC 16.15). */
    // eslint-disable-next-line no-restricted-syntax -- SPEC 16.15 hard-coded limit, not a tunable threshold
    const ERROR_CHAR_LIMIT = 500;

    const testerCfg = config.agent.tester;

    for (let i = 0; i < testerMax; i++) {
      // SPEC 16.14: if signal is already aborted, stop — do not start the next attempt.
      if (opts.signal?.aborted === true) {
        lastFailReason = 'tester_failed';
        lastProblems = ['signal aborted before attempt'];
        break;
      }

      attempts++;

      // Build tester input. The batch must have scenarios (caller ensured).
      const scenarios = batch.scenarios ?? [];
      const testerInput: TesterInput = {
        batch_id: batch.id,
        scenarios,
        interfaces: batch.interfaces ?? [],
        spec_paths: ['SPEC.md', 'CONSTRAINTS.md'],
        out_dir: outDir,
        ...(previousProblems.length > 0 ? { previous_problems: previousProblems } : {}),
      };

      record?.('tester.started', {
        attempt: attempts,
        ...(testerCfg !== undefined ? { model: testerCfg.model } : {}),
        ...(testerCfg !== undefined ? { max_turns: testerCfg.max_turns } : {}),
      });

      // SPEC 16.14: forward signal, onTesterEvent wrapper, and redact to runTester.
      // SPEC 16.15: runner errors are caught — two cases depending on signal state.
      const currentAttempt = attempts;
      const testerOnEvent = opts.onTesterEvent;
      let result: Awaited<ReturnType<typeof runTester>>;
      try {
        result = await runTester(runner, config, testerInput, worktreeDir, {
          ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
          ...(testerOnEvent !== undefined
            ? {
                onEvent: (event: unknown) => {
                  testerOnEvent(currentAttempt, event);
                },
              }
            : {}),
          ...(opts.redact !== undefined && opts.redact.length > 0 ? { redact: opts.redact } : {}),
        });
      } catch (runnerErr: unknown) {
        // SPEC 16.15: runner threw — record tester.finished with error.
        const errMsg = String(runnerErr instanceof Error ? runnerErr.message : runnerErr).slice(
          0,
          ERROR_CHAR_LIMIT,
        );
        record?.('tester.finished', { attempt: attempts, error: errMsg });
        reports.push('');

        // Re-read aborted: it may have flipped to true during the async call.
        if ((opts.signal?.aborted as boolean | undefined) === true) {
          // SPEC 16.15 case 1: signal already aborted — stop, no retry.
          lastProblems = [errMsg];
          lastFailReason = 'tester_failed';
          break;
        }
        // SPEC 16.15 case 2: signal not aborted — treat as failed attempt, carry error into next prompt.
        lastProblems = [errMsg];
        lastFailReason = 'tester_failed';
        previousProblems = [...previousProblems, errMsg];
        continue;
      }

      record?.('tester.finished', {
        attempt: attempts,
        exit_code: result.exitCode,
        ...(result.numTurns !== undefined ? { num_turns: result.numTurns } : {}),
        ...(result.costUsd !== undefined ? { cost_usd: result.costUsd } : {}),
        ...(result.durationMs !== undefined ? { duration_ms: result.durationMs } : {}),
        ...(result.usage !== undefined
          ? {
              usage: {
                input_tokens: result.usage.inputTokens,
                output_tokens: result.usage.outputTokens,
                ...(result.usage.cacheCreationInputTokens !== undefined
                  ? { cache_creation_input_tokens: result.usage.cacheCreationInputTokens }
                  : {}),
                ...(result.usage.cacheReadInputTokens !== undefined
                  ? { cache_read_input_tokens: result.usage.cacheReadInputTokens }
                  : {}),
              },
            }
          : {}),
      });

      // Collect report (final reply text; empty string when absent).
      reports.push(result.finalText ?? '');

      // Non-zero exit: this attempt failed, no red check.
      if (result.exitCode !== 0) {
        const exitMsg = `tester exited with code ${String(result.exitCode)}`;
        lastProblems = [exitMsg];
        lastFailReason = 'tester_failed';
        // SPEC 16.13: next attempt's previous_problems includes the exit code.
        previousProblems = [...previousProblems, exitMsg];
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
          lastFailReason = 'red_check';
          continue;
        }
        return { ok: true, attempts, files: collectResult.files, reports };
      }

      // Red check didn't pass — check for misclassified declaration (SPEC 16.13).
      const replyText = result.finalText ?? '';
      const misclassified = extractMisclassified(replyText);
      if (misclassified !== undefined) {
        // Tester declared misclassified items — stop early, don't retry.
        lastProblems = redResult.problems.map((p) => `[${p.file}] ${p.testName}: ${p.reason}`);
        return {
          ok: false,
          attempts,
          problems: lastProblems,
          reason: 'misclassified',
          reports,
          misclassified,
        };
      }

      // Format problems for next iteration.
      lastProblems = redResult.problems.map((p) => `[${p.file}] ${p.testName}: ${p.reason}`);
      previousProblems = lastProblems;
      lastFailReason = 'red_check';
    }

    return {
      ok: false,
      attempts,
      problems: lastProblems,
      reason: lastFailReason,
      reports,
      misclassified: [],
    };
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
