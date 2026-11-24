// R2's own evidence (SPEC 8, CONSTRAINTS 铁律 4): what verify.ts, git.ts and
// ci.ts measure, in the SPEC 3.5 evidence shape. The arbiter judges claims
// against this, not against the reviewer's account of the same facts.
import {
  isEnvelopeOnlyDiff,
  queryCi,
  waitForCi,
  type CiResult,
  type CiWait,
  type Clock,
  type FetchLike,
} from './ci.js';
import { diffNameOnly, diffStat, log, remoteContains, revParse, showFile } from './git.js';
import {
  EvidenceSchema,
  PackageJsonSchema,
  PackageLockSchema,
  type Acceptance,
  type CiConclusion,
  type CollieConfig,
} from './schema/index.js';
import type { z } from 'zod';
import { runAcceptance, type VerifyResult } from './verify.js';

/** R2's own evidence — always has all fields (SPEC 16.30). */
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Files the worker must not change (CONSTRAINTS 铁律 1, AGENT-worker.md 2).
 * Counted into spec_diff_lines for arbiter rule 2.
 */
export const PROTECTED_PATHS: readonly string[] = [
  'SPEC.md',
  'CONSTRAINTS.md',
  'ROADMAP.md',
  'ROLES.md',
  ':(glob)AGENT-*.md',
  'docs/backlog.md',
  'docs/backlog-archive.md',
  'docs/decisions',
  'docs/progress.md',
  '.collie/collie.toml',
  'test/acceptance',
  '.github',
  'eslint.config.js',
  'vitest.config.ts',
];

/**
 * SPEC 11.7 (v03-b03-fix): commit-message prefixes of R2/operator envelope
 * commits. These are not worker output and must be skipped in commits_actual
 * and per-commit diffs for arbiter rules 2 and 3.
 */
export const R2_COMMIT_PREFIXES: readonly string[] = [
  'docs: issue ',
  'progress: ',
  'report(collie): ',
  'ops: ',
];

/** True when the commit subject starts with an R2/operator prefix (SPEC 11.7 v03-b03-fix). */
export function isR2Commit(subject: string): boolean {
  return R2_COMMIT_PREFIXES.some((prefix) => subject.startsWith(prefix));
}

// eslint-disable-next-line no-restricted-syntax -- unit conversion, not a threshold
const MS_PER_SECOND = 1000;
const STRONG_COPYLEFT = /\b(?:A?GPL|SSPL)\b/i;
const LOCK_PACKAGE_PREFIX = 'node_modules/';

export interface EvidenceInput {
  /** Main repository: git history, remote and manifests are read here. */
  root: string;
  /** Where acceptance commands run; defaults to root. R2 passes a head_sha worktree. */
  verifyCwd?: string;
  remote: string;
  /**
   * SPEC 11.7 (v02-e-fix): base for commits_actual — the first run's base_sha
   * so that attempt ≥ 2 evidence includes prior attempt commits.
   */
  baseSha: string;
  /**
   * SPEC 11.7 (v02-e-fix): base for protected-path diff and dependency diff.
   * Uses the current run's task commit so R2's own progress commits (between
   * baseSha and taskSha) do not trigger arbiter rule 2.  Falls back to baseSha
   * when omitted (single-attempt runs where baseSha === taskSha).
   */
  taskSha?: string;
  headSha: string;
  /** Global verify commands first, then the batch acceptance (SPEC 3.1 [verify]). */
  commands: readonly Acceptance[];
  config: CollieConfig;
  fetch: FetchLike;
  signal?: AbortSignal;
  /** Time source for the CI wait; tests pass a fake one. */
  clock?: Clock;
  /** SPEC 13.9: pre-resolved CI token; run.ts reads it from token_file and passes it here. */
  ciToken?: string;
  /**
   * SPEC 16.14: shas of commits R2 made itself, collected from journal events.
   * Protected-path diff skips these instead of using commit-message prefixes.
   * When omitted, falls back to prefix-based filtering (backward compat).
   */
  r2Shas?: ReadonlySet<string>;
  /**
   * SPEC 16.21 (v046-b32): paths authorised by the batch's 「可改的受保护路径」
   * section. Changes to these paths are excluded from spec_diff_lines and
   * counted separately as authorized_diff_lines.
   */
  allowedProtected?: readonly string[];
}

export interface CollectedEvidence {
  evidence: Evidence;
  verify: VerifyResult[];
  /** Command whose test counts arbiter rule 6 compares, if any produced counts. */
  testCommand: string | undefined;
  ci: CiResult | { error: string };
  /** Set when R2 waited for CI to settle (head_sha was on the remote). */
  ciWait?: CiWait;
  /** Why remote_has_head is false when the remote could not be read. */
  remoteError?: string;
  /**
   * SPEC 16.21 (v046-b32): diff lines on authorised protected paths, counted
   * separately from spec_diff_lines. Only present when the batch has
   * allowed_protected paths. Used to populate evidence.collected event.
   */
  authorizedDiffLines?: number;
}

/** "Name@range" entries for direct dependencies added or changed between two manifests. */
function directChanges(base: string | undefined, head: string | undefined): string[] {
  const parse = (text: string | undefined): Record<string, string> => {
    if (text === undefined) return {};
    const manifest = PackageJsonSchema.parse(JSON.parse(text));
    return { ...manifest.devDependencies, ...manifest.dependencies };
  };
  const before = parse(base);
  const after = parse(head);
  return Object.entries(after)
    .filter(([name, range]) => before[name] !== range)
    .map(([name, range]) => `${name}@${range}`)
    .sort();
}

/** Packages new in the lockfile whose licence is strong copyleft, in any part of the tree (ADR-003). */
function copyleftAdditions(base: string | undefined, head: string | undefined): string[] {
  const parse = (text: string | undefined): Map<string, { version: string; license: string }> => {
    const packages =
      text === undefined ? {} : (PackageLockSchema.parse(JSON.parse(text)).packages ?? {});
    const out = new Map<string, { version: string; license: string }>();
    for (const [path, info] of Object.entries(packages)) {
      if (!path.startsWith(LOCK_PACKAGE_PREFIX)) continue;
      const name = path.slice(path.lastIndexOf(LOCK_PACKAGE_PREFIX) + LOCK_PACKAGE_PREFIX.length);
      out.set(`${name}@${info.version ?? ''}`, {
        version: info.version ?? '',
        license: info.license ?? '',
      });
    }
    return out;
  };
  const before = parse(base);
  return [...parse(head).entries()]
    .filter(([key, info]) => !before.has(key) && STRONG_COPYLEFT.test(info.license))
    .map(([key, info]) => `${key} (${info.license})`)
    .sort();
}

async function dependencyDiff(root: string, base: string, head: string): Promise<string[]> {
  const [pkgBase, pkgHead, lockBase, lockHead] = await Promise.all([
    showFile(root, base, 'package.json'),
    showFile(root, head, 'package.json'),
    showFile(root, base, 'package-lock.json'),
    showFile(root, head, 'package-lock.json'),
  ]);
  return [...directChanges(pkgBase, pkgHead), ...copyleftAdditions(lockBase, lockHead)];
}

/** Folds GitHub's conclusions into the four of SPEC 3.5. */
function foldConclusion(ci: CiResult): CiConclusion {
  if (ci.state !== 'completed') return 'unknown';
  switch (ci.conclusion) {
    case 'success':
      return 'success';
    case 'cancelled':
      return 'cancelled';
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return 'failure';
    default:
      return 'unknown';
  }
}

function dedupe(commands: readonly Acceptance[]): Acceptance[] {
  const seen = new Set<string>();
  return commands.filter((c) => !seen.has(c.cmd) && seen.add(c.cmd));
}

/** Measures everything arbiter rules 2-3 and 5-7 need. */
export async function collectEvidence(input: EvidenceInput): Promise<CollectedEvidence> {
  const { root, baseSha, config } = input;
  const signalOpt = input.signal === undefined ? {} : { signal: input.signal };

  // SPEC 3.5 (v02-b04-fix4): expand short shas to 40 chars before CI queries.
  // GitHub Actions API's head_sha filter only matches full shas; a short sha
  // query returns 0 runs, causing ci_wait_secs timeout with "still pending".
  const headSha = await revParse(root, input.headSha);

  const commits = await log(root, baseSha, headSha);

  // SPEC 11.7 (v03-b03-fix): filter out R2/operator commits from commits_actual
  // and from the per-commit diffs for arbiter rules 2 and 3.
  const workerCommits = commits.filter((c) => !isR2Commit(c.subject));

  // SPEC 16.14: protected-path diff skips commits whose sha is in r2Shas
  // (collected from journal events). Falls back to prefix-based filtering
  // when r2Shas is not provided (backward compat for direct callers).
  const r2ShaSet = input.r2Shas;
  const isR2ForDiff =
    r2ShaSet !== undefined
      ? (sha: string): boolean => r2ShaSet.has(sha)
      : (_sha: string, subject: string): boolean => isR2Commit(subject);
  const commitsForDiff = commits.filter((c) => !isR2ForDiff(c.sha, c.subject));

  // SPEC 11.7 (v03-b03-fix): protected-path diff is computed per worker commit,
  // skipping R2 commits entirely. This replaces the prior two-range approach
  // (baseSha..taskSha with PROTECTED_MINUS_R2, then taskSha..headSha with
  // PROTECTED_PATHS) because it is both simpler and more correct: any R2 commit
  // (not just progress) is excluded, and rescue-committed SPEC.md changes still
  // count because rescue commits have the "wip(collie):" prefix, not an R2 prefix.
  // SPEC 16.14: protected-path diff uses commitsForDiff (sha-based when
  // r2Shas provided, prefix-based otherwise). commits_actual still uses
  // workerCommits (prefix-based) — the listing is unchanged per SPEC.
  let specDiffLines = 0;
  let authorizedDiffLines = 0;
  const allowedPaths = input.allowedProtected;
  const hasAuthorized = allowedPaths !== undefined && allowedPaths.length > 0;
  for (const c of commitsForDiff) {
    const stat = await diffStat(root, `${c.sha}^`, c.sha, PROTECTED_PATHS);
    const totalLines = stat.added + stat.deleted;
    // SPEC 16.21 (v046-b32): subtract diff lines on authorised paths.
    if (hasAuthorized && totalLines > 0) {
      const authStat = await diffStat(root, `${c.sha}^`, c.sha, [...allowedPaths]);
      const authLines = authStat.added + authStat.deleted;
      authorizedDiffLines += authLines;
      specDiffLines += totalLines - authLines;
    } else {
      specDiffLines += totalLines;
    }
  }

  const deps = await dependencyDiff(root, baseSha, headSha);

  let remoteHasHead = false;
  let remoteError: string | undefined;
  try {
    remoteHasHead = await remoteContains(root, input.remote, config.ci.expected_branch, headSha);
  } catch (error) {
    // Not established counts as not pushed (rule 5 is a claim check, so be conservative).
    remoteError = error instanceof Error ? error.message : String(error);
  }

  // Wait for head_sha's CI to settle before measuring it (v01-b05 2c). A commit
  // that is not on the remote will never get CI, so it is queried once, not awaited.

  // SPEC 13.9: CI token is now passed in by the caller (run.ts) after being read in one place.
  const ciToken = input.ciToken;

  const ciQuery = {
    repo: config.project.repo,
    sha: headSha,
    expectedBranch: config.ci.expected_branch,
    ...(ciToken !== undefined ? { token: ciToken } : {}),
    ...signalOpt,
  };
  let ci: CollectedEvidence['ci'];
  let ciWait: CiWait | undefined;
  try {
    if (remoteHasHead) {
      ciWait = await waitForCi(
        ciQuery,
        input.fetch,
        {
          timeoutMs: config.limits.ci_wait_secs * MS_PER_SECOND,
          pollMs: config.limits.ci_poll_secs * MS_PER_SECOND,
        },
        input.clock,
      );
      ci = ciWait.result ?? {
        error: `CI did not settle within ci_wait_secs (${String(config.limits.ci_wait_secs)}s; last state ${ciWait.lastState})`,
      };
    } else {
      ci = await queryCi(ciQuery, input.fetch);
    }
  } catch (error) {
    ci = { error: error instanceof Error ? error.message : String(error) };
  }

  // SPEC 3.5 "CI 运行的归属": when head_sha has no CI runs of its own, try
  // descendant commits on the expected branch whose diff is envelope-only.
  // We already know head_sha's CI result (from waitForCi or queryCi above),
  // so we only query descendants directly—no redundant head_sha re-query.
  if (remoteHasHead) {
    const noRuns = 'error' in ci ? true : ci.runs.length === 0;
    if (noRuns) {
      try {
        const branchRef = `refs/remotes/${input.remote}/${config.ci.expected_branch}`;
        const descendants = await log(root, headSha, branchRef);
        for (const d of descendants) {
          const files = await diffNameOnly(root, headSha, d.sha);
          if (!isEnvelopeOnlyDiff(files)) continue;
          const descResult = await queryCi({ ...ciQuery, sha: d.sha }, input.fetch);
          if (descResult.state === 'completed') {
            // Attribute the descendant's completed run to head_sha (SPEC 3.5).
            ci = { ...descResult, sha: headSha };
            break;
          }
        }
      } catch {
        // Descendant resolution is best-effort; keep the original ci result.
      }
    }
  }

  const verify = await runAcceptance(dedupe(input.commands), {
    cwd: input.verifyCwd ?? root,
    ...signalOpt,
  });
  const testCommand = verify.find((r) => r.tests !== undefined)?.cmd;

  const evidence: Evidence = {
    // SPEC 11.7 (v03-b03-fix): only worker commits, R2/operator commits excluded.
    commits_actual: workerCommits.map((c) => c.sha),
    verify_results: verify.map((r) => ({ cmd: r.cmd, exit_code: r.exit_code, summary: r.summary })),
    remote_has_head: remoteHasHead,
    ci_conclusion: 'error' in ci ? 'unknown' : foldConclusion(ci),
    // SPEC 3.5 (v02-b05-fix): when head_sha is not on the remote, CI evidence
    // is not meaningful — set ci_run_url to empty and ci_branch_matched to null
    // ("未能取证"), not false ("监听分支不一致").
    ci_run_url: !remoteHasHead || 'error' in ci ? '' : (ci.runUrl ?? ''),
    ci_branch_matched: !remoteHasHead || 'error' in ci ? null : ci.branchMatched,
    deps_diff: deps,
    spec_diff_lines: specDiffLines,
  };
  return {
    evidence,
    verify,
    testCommand,
    ci,
    ...(ciWait === undefined ? {} : { ciWait }),
    ...(remoteError === undefined ? {} : { remoteError }),
    ...(hasAuthorized ? { authorizedDiffLines } : {}),
  };
}
