// SPEC 14.1: `collie preflight [--smoke] [--json]`. Checks environment
// readiness before a queue run. Each check is independent; all results are
// collected and returned together.
import { existsSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike } from './ci.js';
import { queryCi } from './ci.js';
import { git, isAncestor, status as gitStatus } from './git.js';
import { HEARTBEAT_RELATIVE_PATH } from './heartbeat.js';
import { readCiTokenChecked } from './run.js';
import type { AgentRunner } from './runner/index.js';
import type { CollieConfig } from './schema/index.js';

// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-magic-numbers -- byte-to-MB conversion factor, not a threshold
const BYTES_PER_MB = 1024 * 1024;

/** Result of a single preflight check (SPEC 14.1). */
export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Aggregated preflight result (SPEC 14.1). */
export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
}

/** Dependencies for the preflight check (SPEC 14.1). */
export interface PreflightOpts {
  root: string;
  remote: string;
  config: CollieConfig;
  /** Injected disk-free reader; defaults to statfsSync (SPEC 14.1). */
  diskFreeMb?: (root: string) => number;
  /** When set, adds runner + ci_query smoke checks (SPEC 14.1 --smoke). */
  smoke?: {
    runner: AgentRunner;
    fetch: FetchLike;
  };
}

/** Default disk-free reader using Node.js statfsSync (SPEC 14.1). */
export function realDiskFreeMb(root: string): number {
  const stats = statfsSync(root);
  return Math.floor((stats.bavail * stats.bsize) / BYTES_PER_MB);
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * SPEC 14.1 worktree_clean: git status --porcelain must be empty.
 * Exception: heartbeat.json present → ok with detail "orphaned run present".
 */
async function checkWorktreeClean(root: string): Promise<PreflightCheck> {
  const name = 'worktree_clean';
  try {
    const ws = await gitStatus(root);
    if (ws.clean) return { name, ok: true };
    // Exception: heartbeat.json exists (orphaned run, 11.3/11.4 rescue handles it).
    if (existsSync(join(root, HEARTBEAT_RELATIVE_PATH))) {
      return { name, ok: true, detail: 'orphaned run present' };
    }
    const fileList = ws.entries.map((e) => e.path).join(', ');
    return { name, ok: false, detail: `dirty: ${fileList}` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * SPEC 14.1 remote_in_sync: fetch succeeds and remote/branch is an ancestor
 * of (or equal to) HEAD — local is not behind and has not diverged.
 */
async function checkRemoteInSync(
  root: string,
  remote: string,
  expectedBranch: string,
): Promise<PreflightCheck> {
  const name = 'remote_in_sync';
  try {
    await git(root, [
      'fetch',
      '--quiet',
      '--end-of-options',
      remote,
      `+refs/heads/${expectedBranch}:refs/remotes/${remote}/${expectedBranch}`,
    ]);
    const ref = `refs/remotes/${remote}/${expectedBranch}`;
    const ancestor = await isAncestor(root, ref, 'HEAD');
    if (ancestor) return { name, ok: true };
    return { name, ok: false, detail: `local behind or diverged from ${remote}/${expectedBranch}` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * SPEC 14.1 ci_token: reuses readCiTokenChecked from run.ts.
 * Not configured → ok "not configured"; configured but unreadable → fail.
 */
function checkCiToken(config: CollieConfig, root: string): PreflightCheck {
  const name = 'ci_token';
  try {
    const token = readCiTokenChecked(config, root);
    if (token === undefined) return { name, ok: true, detail: 'not configured' };
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * SPEC 14.1 disk_free: available space >= limits.min_free_mb.
 */
function checkDiskFree(
  root: string,
  minFreeMb: number,
  diskFreeMb: (root: string) => number,
): PreflightCheck {
  const name = 'disk_free';
  try {
    const freeMb = diskFreeMb(root);
    if (freeMb >= minFreeMb) return { name, ok: true, detail: `${String(freeMb)} MB free` };
    return {
      name,
      ok: false,
      detail: `${String(freeMb)} MB free, need ${String(minFreeMb)} MB`,
    };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

const SMOKE_MAX_TURNS = 1; // SPEC 14.1: same as collie smoke
const SMOKE_PROMPT = 'Reply with the single word ok.';

/** SPEC 14.1 --smoke runner check: fire a trivial prompt with no tools. */
async function checkRunner(runner: AgentRunner, root: string): Promise<PreflightCheck> {
  const name = 'runner';
  try {
    const result = await runner.run({
      role: 'worker',
      prompt: SMOKE_PROMPT,
      systemPrompt: '',
      allowedTools: [],
      cwd: root,
      maxTurns: SMOKE_MAX_TURNS,
    });
    return { name, ok: true, detail: `exitCode=${String(result.exitCode)}` };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

/** SPEC 14.1 --smoke ci_query check: query CI for current HEAD with token. */
async function checkCiQuery(
  config: CollieConfig,
  root: string,
  fetch: FetchLike,
): Promise<PreflightCheck> {
  const name = 'ci_query';
  let ciToken: string | undefined;
  try {
    ciToken = readCiTokenChecked(config, root);
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
  if (ciToken === undefined) {
    return { name, ok: true, detail: 'no token configured, skipped' };
  }
  try {
    const headSha = (await git(root, ['rev-parse', 'HEAD'])).trim();
    await queryCi(
      {
        repo: config.project.repo,
        sha: headSha,
        expectedBranch: config.ci.expected_branch,
        token: ciToken,
      },
      fetch,
    );
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** SPEC 14.1: runs all preflight checks and returns the aggregated result. */
export async function runPreflight(opts: PreflightOpts): Promise<PreflightResult> {
  const diskFn = opts.diskFreeMb ?? realDiskFreeMb;
  const checks: PreflightCheck[] = [];

  // Base checks (always run).
  checks.push(await checkWorktreeClean(opts.root));
  checks.push(await checkRemoteInSync(opts.root, opts.remote, opts.config.ci.expected_branch));
  checks.push(checkCiToken(opts.config, opts.root));
  checks.push(checkDiskFree(opts.root, opts.config.limits.min_free_mb, diskFn));

  // Smoke checks (SPEC 14.1 --smoke).
  if (opts.smoke !== undefined) {
    checks.push(await checkRunner(opts.smoke.runner, opts.root));
    checks.push(await checkCiQuery(opts.config, opts.root, opts.smoke.fetch));
  }

  return { ok: checks.every((c) => c.ok), checks };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** SPEC 14.1: text output — one line per check, summary at end. */
export function formatPreflight(result: PreflightResult): string {
  const lines = result.checks.map((c) => {
    if (c.ok) {
      const detail = c.detail !== undefined ? `: ${c.detail}` : '';
      return `ok   ${c.name}${detail}`;
    }
    return `FAIL ${c.name}: ${c.detail ?? 'unknown'}`;
  });
  if (result.ok) {
    lines.push('preflight: ok');
  } else {
    const failed = result.checks
      .filter((c) => !c.ok)
      .map((c) => c.name)
      .join(', ');
    lines.push(`preflight: failed (${failed})`);
  }
  return lines.join('\n') + '\n';
}
