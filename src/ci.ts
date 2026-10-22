// Queries the actual GitHub Actions result for a commit and checks that it ran
// on the expected branch (SPEC 3.5 evidence, CONSTRAINTS 铁律 5): a green run on
// the wrong branch is not evidence of anything.
import { GitHubWorkflowRunsSchema, type GitHubWorkflowRun } from './schema/index.js';

const API_ROOT = 'https://api.github.com';
const API_VERSION = '2022-11-28';
/* eslint-disable no-restricted-syntax -- HTTP status codes and unit conversion, not thresholds */
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;
/* eslint-enable no-restricted-syntax */

/** The subset of fetch that ci.ts needs; injected so tests never touch the network. */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal?: AbortSignal },
) => Promise<Response>;

export interface CiQuery {
  /** Repository URL as in collie.toml `project.repo`. */
  repo: string;
  sha: string;
  /** collie.toml `ci.expected_branch`. */
  expectedBranch: string;
  /** Falls back to the GITHUB_TOKEN environment variable. */
  token?: string;
  signal?: AbortSignal;
}

export interface CiRun {
  id: number;
  workflowId: number;
  name: string | null;
  event: string;
  headBranch: string | null;
  status: string | null;
  conclusion: string | null;
  url: string;
}

export interface CiResult {
  sha: string;
  /** Every run GitHub reports for the sha, on any branch. */
  runs: CiRun[];
  /**
   * none: no run on the expected branch; pending: a run there has not finished;
   * completed: the latest run of every workflow there has finished.
   */
  state: 'none' | 'pending' | 'completed';
  /**
   * 'success' only if the latest run of every workflow on the expected branch
   * succeeded; otherwise the first non-success conclusion. null unless completed.
   * Runs on other branches never contribute.
   */
  conclusion: string | null;
  runUrl: string | null;
  branchMatched: boolean;
}

export class CiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CiError';
  }
}

/** Thrown instead of returning an empty or null result when GitHub rate-limits the query. */
export class CiRateLimitError extends CiError {
  readonly resetAt: Date | undefined;
  readonly authenticated: boolean;

  constructor(resetAt: Date | undefined, authenticated: boolean, detail: string) {
    const when = resetAt === undefined ? 'unknown' : resetAt.toISOString();
    const hint = authenticated ? '' : '; set GITHUB_TOKEN to raise the limit';
    super(`GitHub API rate limit exceeded (resets ${when})${hint}: ${detail}`);
    this.name = 'CiRateLimitError';
    this.resetAt = resetAt;
    this.authenticated = authenticated;
  }
}

const REPO_URL =
  /^(?:https:\/\/github\.com\/|git@github\.com:)(?<owner>[^/\s]+)\/(?<name>[^/\s]+?)(?:\.git)?\/?$/;

export function parseGitHubRepo(url: string): { owner: string; name: string } {
  const groups = REPO_URL.exec(url.trim())?.groups;
  if (groups?.owner === undefined || groups.name === undefined) {
    throw new CiError(`not a GitHub repository URL: ${JSON.stringify(url)}`);
  }
  return { owner: groups.owner, name: groups.name };
}

function toRun(run: GitHubWorkflowRun): CiRun {
  return {
    id: run.id,
    workflowId: run.workflow_id,
    name: run.name,
    event: run.event,
    headBranch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    url: run.html_url,
  };
}

async function errorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  try {
    const body: unknown = JSON.parse(text);
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return body.message;
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return text.trim() === '' ? `HTTP ${String(response.status)}` : text.trim();
}

function isRateLimited(response: Response, detail: string): boolean {
  if (response.status === HTTP_TOO_MANY_REQUESTS) return true;
  return (
    response.status === HTTP_FORBIDDEN &&
    (response.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(detail))
  );
}

function resetTime(response: Response): Date | undefined {
  const reset = response.headers.get('x-ratelimit-reset');
  if (reset !== null && /^\d+$/.test(reset)) return new Date(Number(reset) * MS_PER_SECOND);
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
    return new Date(Date.now() + Number(retryAfter) * MS_PER_SECOND);
  }
  return undefined;
}

/** Latest run per workflow among `runs`. */
function latestPerWorkflow(runs: readonly CiRun[]): CiRun[] {
  const latest = new Map<number, CiRun>();
  for (const run of runs) {
    const seen = latest.get(run.workflowId);
    if (seen === undefined || run.id > seen.id) latest.set(run.workflowId, run);
  }
  return [...latest.values()];
}

function assess(sha: string, runs: CiRun[], expectedBranch: string): CiResult {
  const onBranch = latestPerWorkflow(runs.filter((r) => r.headBranch === expectedBranch));
  if (onBranch.length === 0) {
    return { sha, runs, state: 'none', conclusion: null, runUrl: null, branchMatched: false };
  }
  const pending = onBranch.find((r) => r.status !== 'completed');
  if (pending !== undefined) {
    return {
      sha,
      runs,
      state: 'pending',
      conclusion: null,
      runUrl: pending.url,
      branchMatched: true,
    };
  }
  const failed = onBranch.find((r) => r.conclusion !== 'success');
  const shown = failed ?? onBranch.reduce((a, b) => (b.id > a.id ? b : a));
  return {
    sha,
    runs,
    state: 'completed',
    conclusion: failed?.conclusion ?? 'success',
    runUrl: shown.url,
    branchMatched: true,
  };
}

/**
 * Fetches all Actions runs for `query.sha` and assesses them against the
 * expected branch. Never resolves with a partial or empty answer when GitHub
 * refuses: rate limits, HTTP errors and malformed bodies all reject.
 */
export async function queryCi(query: CiQuery, fetchImpl: FetchLike): Promise<CiResult> {
  const { owner, name } = parseGitHubRepo(query.repo);
  const token = query.token ?? process.env.GITHUB_TOKEN;
  const authenticated = token !== undefined && token !== '';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'collie',
  };
  if (authenticated) headers.Authorization = `Bearer ${token}`;

  const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/actions/runs?head_sha=${encodeURIComponent(query.sha)}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers,
      ...(query.signal === undefined ? {} : { signal: query.signal }),
    });
  } catch (error) {
    throw new CiError(
      `cannot reach GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }

  if (!response.ok) {
    const detail = await errorDetail(response);
    if (isRateLimited(response, detail))
      throw new CiRateLimitError(resetTime(response), authenticated, detail);
    if (response.status === HTTP_NOT_FOUND) {
      throw new CiError(
        `repository ${owner}/${name} not found (private repositories need GITHUB_TOKEN): ${detail}`,
      );
    }
    throw new CiError(`GitHub API returned HTTP ${String(response.status)}: ${detail}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new CiError('GitHub API returned a body that is not JSON', { cause: error });
  }
  const parsed = GitHubWorkflowRunsSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new CiError(`unexpected GitHub API response: ${issues.join('; ')}`);
  }
  const { total_count: total, workflow_runs: page } = parsed.data;
  if (total > page.length) {
    // Silently assessing a partial list could miss a failing run.
    throw new CiError(
      `${String(total)} runs for ${query.sha} exceed one page (${String(page.length)}); pagination is not supported`,
    );
  }
  const foreign = page.find((r) => r.head_sha !== query.sha);
  if (foreign !== undefined) {
    throw new CiError(
      `GitHub returned run ${String(foreign.id)} for ${foreign.head_sha}, not ${query.sha}`,
    );
  }
  return assess(query.sha, page.map(toRun), query.expectedBranch);
}

/** Time source for waitForCi; injected so tests advance a fake clock instead of sleeping. */
export interface Clock {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted === true) {
        reject(signal.reason instanceof Error ? signal.reason : new CiError('aborted'));
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason instanceof Error ? signal.reason : new CiError('aborted'));
        },
        { once: true },
      );
    }),
};

export interface CiWait {
  /** Settled result, or undefined when the wait timed out. */
  result: CiResult | undefined;
  timedOut: boolean;
  waitedMs: number;
  polls: number;
  /** What the last poll saw: a CiResult state, 'no_runs' or 'rate_limited'. */
  lastState: CiResult['state'] | 'no_runs' | 'rate_limited';
}

/**
 * Not yet settled: a run on the expected branch is still going, or GitHub has
 * no run for the sha at all (just after a push it may not have created one).
 * Runs that exist only on other branches are settled: waiting cannot fix the
 * branch (the master/main lesson), so the arbiter must see the mismatch now.
 */
function unsettled(result: CiResult): 'pending' | 'no_runs' | undefined {
  if (result.state === 'pending') return 'pending';
  if (result.runs.length === 0) return 'no_runs';
  return undefined;
}

/**
 * Polls queryCi until head_sha's CI settles or `timeoutMs` passes (v01-b05 2c).
 * Rate limits are waited out within the deadline. Other errors reject, as in queryCi.
 */
export async function waitForCi(
  query: CiQuery,
  fetchImpl: FetchLike,
  limits: { timeoutMs: number; pollMs: number },
  clock: Clock = realClock,
): Promise<CiWait> {
  const start = clock.now();
  const deadline = start + limits.timeoutMs;
  let polls = 0;
  let lastState: CiWait['lastState'];
  for (;;) {
    polls++;
    let delay = limits.pollMs;
    try {
      const result = await queryCi(query, fetchImpl);
      const waiting = unsettled(result);
      if (waiting === undefined) {
        return {
          result,
          timedOut: false,
          waitedMs: clock.now() - start,
          polls,
          lastState: result.state,
        };
      }
      lastState = waiting;
    } catch (error) {
      if (!(error instanceof CiRateLimitError)) throw error;
      lastState = 'rate_limited';
      // SPEC 3.1: unauthenticated and first poll already rate_limited → no point
      // waiting ci_wait_secs; return immediately as unknown with waited_secs=0.
      if (!error.authenticated && polls === 1) {
        return {
          result: undefined,
          timedOut: true,
          waitedMs: clock.now() - start,
          polls,
          lastState,
        };
      }
      if (error.resetAt !== undefined)
        delay = Math.max(delay, error.resetAt.getTime() - clock.now());
    }
    const remaining = deadline - clock.now();
    if (remaining <= 0) {
      return { result: undefined, timedOut: true, waitedMs: clock.now() - start, polls, lastState };
    }
    await clock.sleep(Math.min(delay, remaining), query.signal);
  }
}

// ---------------------------------------------------------------------------
// Descendant attribution (SPEC 3.5 "CI 运行的归属")
// ---------------------------------------------------------------------------

/**
 * Pre-resolved descendant candidate for CI attribution (SPEC 3.5).
 * evidence.ts resolves these from git log / diff before calling here.
 */
export interface DescendantCandidate {
  sha: string;
  /** Files changed between head_sha and this descendant (git diff --name-only). */
  changedFiles: readonly string[];
}

/**
 * True when every changed file is under `.collie/` or is `docs/progress.md`
 * (SPEC 3.5: "只含 `.collie/**` 与 `docs/progress.md`").
 * An empty diff is trivially envelope-only.
 */
export function isEnvelopeOnlyDiff(files: readonly string[]): boolean {
  const ENVELOPE_PREFIX = '.collie/';
  const ENVELOPE_EXACT = 'docs/progress.md';
  return files.every((f) => f.startsWith(ENVELOPE_PREFIX) || f === ENVELOPE_EXACT);
}

/**
 * Extended CiResult that tracks whether the run was attributed from a
 * descendant commit rather than from head_sha itself.
 */
export interface AttributedCiResult extends CiResult {
  /** Set when the result came from a descendant commit, not head_sha itself. */
  attributedSha?: string;
}

/**
 * Queries CI for `query.sha` (head_sha); if it has no runs, tries qualifying
 * descendants in order (SPEC 3.5 "CI 运行的归属"). A descendant qualifies when
 * its diff from head_sha contains only `.collie/**` and `docs/progress.md`
 * (i.e. only envelope commits, code identical to head_sha). Descendants that
 * change any code file are never adopted.
 *
 * The first qualifying descendant with a completed CI result wins. Its result
 * is returned with `sha` set to the original head_sha and `attributedSha` set
 * to the descendant so that callers can see where the run actually came from.
 * Pending or no-branch runs from descendants are never adopted—only a completed
 * result is useful evidence.
 */
export async function queryCiWithAttribution(
  query: CiQuery,
  fetchImpl: FetchLike,
  descendants: readonly DescendantCandidate[],
): Promise<AttributedCiResult> {
  const direct = await queryCi(query, fetchImpl);
  if (direct.runs.length > 0) return direct;

  for (const desc of descendants) {
    if (!isEnvelopeOnlyDiff(desc.changedFiles)) continue;
    const descResult = await queryCi({ ...query, sha: desc.sha }, fetchImpl);
    if (descResult.state === 'completed') {
      // Attribute the descendant's runs to the original head_sha (SPEC 3.5).
      return { ...descResult, sha: query.sha, attributedSha: desc.sha };
    }
  }

  return direct;
}
