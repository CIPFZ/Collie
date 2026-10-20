// R2's own evidence (SPEC 8, CONSTRAINTS 铁律 4): what verify.ts, git.ts and
// ci.ts measure, in the SPEC 3.5 evidence shape. The arbiter judges claims
// against this, not against the reviewer's account of the same facts.
import {
  queryCi,
  waitForCi,
  type CiResult,
  type CiWait,
  type Clock,
  type FetchLike,
} from './ci.js';
import { diffStat, log, remoteContains, showFile } from './git.js';
import {
  PackageJsonSchema,
  PackageLockSchema,
  type Acceptance,
  type CiConclusion,
  type CollieConfig,
  type Verdict,
} from './schema/index.js';
import { runAcceptance, type VerifyResult } from './verify.js';

export type Evidence = Verdict['evidence'];

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
  'docs/decisions',
  'docs/progress.md',
  '.collie/collie.toml',
];

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
  baseSha: string;
  headSha: string;
  /** Global verify commands first, then the batch acceptance (SPEC 3.1 [verify]). */
  commands: readonly Acceptance[];
  config: CollieConfig;
  fetch: FetchLike;
  signal?: AbortSignal;
  /** Time source for the CI wait; tests pass a fake one. */
  clock?: Clock;
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
  const { root, baseSha, headSha, config } = input;
  const signalOpt = input.signal === undefined ? {} : { signal: input.signal };

  const commits = await log(root, baseSha, headSha);
  const protectedDiff = await diffStat(root, baseSha, headSha, PROTECTED_PATHS);
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
  const ciQuery = {
    repo: config.project.repo,
    sha: headSha,
    expectedBranch: config.ci.expected_branch,
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

  const verify = await runAcceptance(dedupe(input.commands), {
    cwd: input.verifyCwd ?? root,
    ...signalOpt,
  });
  const testCommand = verify.find((r) => r.tests !== undefined)?.cmd;

  const evidence: Evidence = {
    commits_actual: commits.map((c) => c.sha),
    verify_results: verify.map((r) => ({ cmd: r.cmd, exit_code: r.exit_code, summary: r.summary })),
    remote_has_head: remoteHasHead,
    ci_conclusion: 'error' in ci ? 'unknown' : foldConclusion(ci),
    ci_run_url: 'error' in ci ? '' : (ci.runUrl ?? ''),
    // null: the CI query itself failed, so the branch could not be established (SPEC 3.5).
    ci_branch_matched: 'error' in ci ? null : ci.branchMatched,
    deps_diff: deps,
    spec_diff_lines: protectedDiff.added + protectedDiff.deleted,
  };
  return {
    evidence,
    verify,
    testCommand,
    ci,
    ...(ciWait === undefined ? {} : { ciWait }),
    ...(remoteError === undefined ? {} : { remoteError }),
  };
}
