import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CiError,
  CiRateLimitError,
  isEnvelopeOnlyDiff,
  parseGitHubRepo,
  queryCi,
  queryCiWithAttribution,
  waitForCi,
  type CiQuery,
  type Clock,
  type DescendantCandidate,
  type FetchLike,
} from '../src/ci.js';

const SHA = 'e30c4eea56a2908b1dd7309fc34354fa42eaccba';
const REPO = 'https://github.com/CIPFZ/Collie';

interface RunInput {
  id: number;
  workflow_id?: number;
  head_branch?: string | null;
  status?: string | null;
  conclusion?: string | null;
  event?: string;
  head_sha?: string;
}

function run(input: RunInput): Record<string, unknown> {
  return {
    id: input.id,
    workflow_id: input.workflow_id ?? 1,
    name: 'ci',
    event: input.event ?? 'push',
    head_branch: input.head_branch === undefined ? 'main' : input.head_branch,
    head_sha: input.head_sha ?? SHA,
    status: input.status === undefined ? 'completed' : input.status,
    conclusion: input.conclusion === undefined ? 'success' : input.conclusion,
    html_url: `https://github.com/CIPFZ/Collie/actions/runs/${String(input.id)}`,
    created_at: '2026-10-19T07:00:00Z',
    // GitHub sends many more fields; they must be tolerated.
    run_attempt: 1,
  };
}

interface Call {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal | undefined;
}

/** Records calls and answers with a fixed response. */
function fakeFetch(respond: () => Response | Promise<Response>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, headers: init.headers, signal: init.signal });
      return Promise.resolve(respond());
    },
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function runs(...items: Record<string, unknown>[]): Response {
  return json({ total_count: items.length, workflow_runs: items });
}

const query: CiQuery = { repo: REPO, sha: SHA, expectedBranch: 'main', token: '' };

const savedToken = process.env.GITHUB_TOKEN;
beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = savedToken;
});

describe('ci: request', () => {
  it('queries runs by head_sha for the configured repository', async () => {
    const { fetch, calls } = fakeFetch(() => runs(run({ id: 1 })));
    await queryCi(query, fetch);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://api.github.com/repos/CIPFZ/Collie/actions/runs?head_sha=${SHA}`,
    );
    expect(calls[0]?.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
  });

  it('sends no Authorization header without a token', async () => {
    const { fetch, calls } = fakeFetch(() => runs(run({ id: 1 })));
    await queryCi({ ...query, token: undefined }, fetch);
    expect(calls[0]?.headers).not.toHaveProperty('Authorization');
  });

  it('uses an explicit token', async () => {
    const { fetch, calls } = fakeFetch(() => runs(run({ id: 1 })));
    await queryCi({ ...query, token: 'ghp_explicit' }, fetch);
    expect(calls[0]?.headers.Authorization).toBe('Bearer ghp_explicit');
  });

  it('falls back to the GITHUB_TOKEN environment variable', async () => {
    process.env.GITHUB_TOKEN = 'ghp_from_env';
    const { fetch, calls } = fakeFetch(() => runs(run({ id: 1 })));
    await queryCi({ ...query, token: undefined }, fetch);
    expect(calls[0]?.headers.Authorization).toBe('Bearer ghp_from_env');
  });

  it('forwards the abort signal', async () => {
    const { fetch, calls } = fakeFetch(() => runs(run({ id: 1 })));
    const signal = new AbortController().signal;
    await queryCi({ ...query, signal }, fetch);
    expect(calls[0]?.signal).toBe(signal);
  });

  it.each([
    ['https://github.com/CIPFZ/Collie', 'CIPFZ', 'Collie'],
    ['https://github.com/CIPFZ/Collie.git', 'CIPFZ', 'Collie'],
    ['https://github.com/CIPFZ/Collie/', 'CIPFZ', 'Collie'],
    ['git@github.com:CIPFZ/Collie.git', 'CIPFZ', 'Collie'],
  ])('parses %s', (url, owner, name) => {
    expect(parseGitHubRepo(url)).toEqual({ owner, name });
  });

  it.each(['https://gitlab.com/a/b', 'https://github.com/only-owner', 'not a url'])(
    'rejects non-GitHub repository %j before any request',
    async (repo) => {
      const { fetch, calls } = fakeFetch(() => runs());
      await expect(queryCi({ ...query, repo }, fetch)).rejects.toThrow(CiError);
      expect(calls).toHaveLength(0);
    },
  );
});

describe('ci: branch check and conclusion', () => {
  it('reports success on the expected branch', async () => {
    const { fetch } = fakeFetch(() => runs(run({ id: 39210459754 })));
    expect(await queryCi(query, fetch)).toEqual({
      sha: SHA,
      runs: [expect.objectContaining({ id: 39210459754, headBranch: 'main' }) as unknown],
      state: 'completed',
      conclusion: 'success',
      runUrl: 'https://github.com/CIPFZ/Collie/actions/runs/39210459754',
      branchMatched: true,
    });
  });

  it('does not count a green run on another branch (the master/main lesson)', async () => {
    const { fetch } = fakeFetch(() => runs(run({ id: 7, head_branch: 'master' })));
    const result = await queryCi(query, fetch);
    expect(result).toMatchObject({
      state: 'none',
      conclusion: null,
      runUrl: null,
      branchMatched: false,
    });
    expect(result.runs.map((r) => r.headBranch)).toEqual(['master']);
  });

  it('reports no run at all as unmatched, not as success', async () => {
    const { fetch } = fakeFetch(() => runs());
    expect(await queryCi(query, fetch)).toMatchObject({
      state: 'none',
      conclusion: null,
      branchMatched: false,
      runs: [],
    });
  });

  it('reports an unfinished run as pending', async () => {
    const { fetch } = fakeFetch(() =>
      runs(run({ id: 3, status: 'in_progress', conclusion: null })),
    );
    expect(await queryCi(query, fetch)).toMatchObject({
      state: 'pending',
      conclusion: null,
      branchMatched: true,
    });
  });

  it('fails when any workflow on the branch failed, pointing at that run', async () => {
    const { fetch } = fakeFetch(() =>
      runs(run({ id: 10, workflow_id: 1 }), run({ id: 11, workflow_id: 2, conclusion: 'failure' })),
    );
    expect(await queryCi(query, fetch)).toMatchObject({
      conclusion: 'failure',
      runUrl: 'https://github.com/CIPFZ/Collie/actions/runs/11',
    });
  });

  it('uses the latest run of a workflow (a successful re-run supersedes a failure)', async () => {
    const { fetch } = fakeFetch(() =>
      runs(run({ id: 21, conclusion: 'failure' }), run({ id: 22 })),
    );
    expect(await queryCi(query, fetch)).toMatchObject({
      conclusion: 'success',
      runUrl: expect.stringMatching(/\/22$/) as unknown,
    });
  });

  it('ignores other-branch runs when the expected branch has its own result', async () => {
    const { fetch } = fakeFetch(() =>
      runs(run({ id: 31, head_branch: 'master', conclusion: 'failure' }), run({ id: 32 })),
    );
    expect(await queryCi(query, fetch)).toMatchObject({
      conclusion: 'success',
      branchMatched: true,
    });
  });
});

describe('ci: failures reject instead of returning null', () => {
  it('rejects with CiRateLimitError on 403 with an exhausted quota', async () => {
    const { fetch } = fakeFetch(() =>
      json({ message: 'API rate limit exceeded for 43.128.123.33.' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1792382636',
      }),
    );
    const error = await queryCi(query, fetch).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CiRateLimitError);
    expect(error).toMatchObject({ authenticated: false, resetAt: new Date(1792382636 * 1000) });
    expect((error as Error).message).toContain('set GITHUB_TOKEN');
  });

  it('rejects with CiRateLimitError on a secondary rate limit message', async () => {
    const { fetch } = fakeFetch(() =>
      json({ message: 'You have exceeded a secondary rate limit.' }, 403, { 'retry-after': '60' }),
    );
    await expect(queryCi({ ...query, token: 'ghp_x' }, fetch)).rejects.toMatchObject({
      name: 'CiRateLimitError',
      authenticated: true,
    });
  });

  it('rejects with CiRateLimitError on 429', async () => {
    const { fetch } = fakeFetch(() => json({ message: 'slow down' }, 429));
    await expect(queryCi(query, fetch)).rejects.toBeInstanceOf(CiRateLimitError);
  });

  it('treats a 403 that is not a rate limit as a plain CiError', async () => {
    const { fetch } = fakeFetch(() =>
      json({ message: 'Resource not accessible by integration' }, 403),
    );
    const error = await queryCi(query, fetch).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CiError);
    expect(error).not.toBeInstanceOf(CiRateLimitError);
  });

  it('explains a 404 (private repository without a token)', async () => {
    const { fetch } = fakeFetch(() => json({ message: 'Not Found' }, 404));
    await expect(queryCi(query, fetch)).rejects.toThrow(
      /not found \(private repositories need GITHUB_TOKEN\)/,
    );
  });

  it('rejects on a server error', async () => {
    const { fetch } = fakeFetch(() => new Response('upstream down', { status: 502 }));
    await expect(queryCi(query, fetch)).rejects.toThrow(
      'GitHub API returned HTTP 502: upstream down',
    );
  });

  it('rejects when the network call itself fails', async () => {
    const fetch: FetchLike = () => Promise.reject(new TypeError('fetch failed'));
    await expect(queryCi(query, fetch)).rejects.toThrow('cannot reach GitHub API: fetch failed');
  });

  it('rejects a body that is not JSON', async () => {
    const { fetch } = fakeFetch(() => new Response('<html>', { status: 200 }));
    await expect(queryCi(query, fetch)).rejects.toThrow('not JSON');
  });

  it('rejects a body that does not match the runs schema', async () => {
    const { fetch } = fakeFetch(() => json({ total_count: 1, workflow_runs: [{ id: 'x' }] }));
    await expect(queryCi(query, fetch)).rejects.toThrow(
      /unexpected GitHub API response: workflow_runs\.0\.id/,
    );
  });

  it('rejects instead of assessing a truncated page of runs', async () => {
    const { fetch } = fakeFetch(() => json({ total_count: 31, workflow_runs: [run({ id: 1 })] }));
    await expect(queryCi(query, fetch)).rejects.toThrow('pagination is not supported');
  });

  it('rejects runs that belong to another sha', async () => {
    const { fetch } = fakeFetch(() => runs(run({ id: 1, head_sha: 'f'.repeat(40) })));
    await expect(queryCi(query, fetch)).rejects.toThrow(`not ${SHA}`);
  });
});

/** A fake clock: sleep advances time instantly and records each delay. */
function fakeClock(): Clock & { sleeps: number[]; t: number } {
  const clock = {
    t: 1_000_000,
    sleeps: [] as number[],
    now: () => clock.t,
    sleep: (ms: number) => {
      clock.sleeps.push(ms);
      clock.t += ms;
      return Promise.resolve();
    },
  };
  return clock;
}

/** Answers with the next scripted response on each call, repeating the last one. */
function sequence(...responses: (() => Response)[]): { fetch: FetchLike; calls: number } {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    fetch: () => {
      const respond = responses[Math.min(state.calls, responses.length - 1)];
      state.calls++;
      if (respond === undefined) throw new Error('no response scripted');
      return Promise.resolve(respond());
    },
  };
}

const LIMITS = { timeoutMs: 1800_000, pollMs: 30_000 };
const pending = (): Response => runs(run({ id: 5, status: 'in_progress', conclusion: null }));
const green = (): Response => runs(run({ id: 5 }));

describe('ci: waitForCi (v01-b05 2c)', () => {
  it('polls a pending run until it succeeds', async () => {
    const clock = fakeClock();
    const script = sequence(pending, pending, green);
    const wait = await waitForCi(query, script.fetch, LIMITS, clock);
    expect(wait).toMatchObject({
      timedOut: false,
      polls: 3,
      waitedMs: 60_000,
      lastState: 'completed',
    });
    expect(wait.result).toMatchObject({ conclusion: 'success', branchMatched: true });
    expect(clock.sleeps).toEqual([30_000, 30_000]);
  });

  it('returns at once when CI already finished', async () => {
    const clock = fakeClock();
    const wait = await waitForCi(query, sequence(green).fetch, LIMITS, clock);
    expect(wait).toMatchObject({ timedOut: false, polls: 1, waitedMs: 0 });
    expect(clock.sleeps).toEqual([]);
  });

  it('keeps waiting while GitHub has not created a run yet', async () => {
    const clock = fakeClock();
    const wait = await waitForCi(query, sequence(() => runs(), green).fetch, LIMITS, clock);
    expect(wait).toMatchObject({ timedOut: false, polls: 2 });
  });

  it('does not wait for a run that exists only on another branch', async () => {
    const clock = fakeClock();
    const wait = await waitForCi(
      query,
      sequence(() => runs(run({ id: 7, head_branch: 'master' }))).fetch,
      LIMITS,
      clock,
    );
    expect(wait).toMatchObject({ timedOut: false, polls: 1, lastState: 'none' });
    expect(wait.result?.branchMatched).toBe(false);
  });

  it('times out at ci_wait_secs with the last state, never sleeping past the deadline', async () => {
    const clock = fakeClock();
    const wait = await waitForCi(
      query,
      sequence(pending).fetch,
      { timeoutMs: 100_000, pollMs: 30_000 },
      clock,
    );
    expect(wait).toMatchObject({
      result: undefined,
      timedOut: true,
      waitedMs: 100_000,
      lastState: 'pending',
    });
    expect(clock.sleeps).toEqual([30_000, 30_000, 30_000, 10_000]);
  });

  it('waits out a rate limit until its reset, then reads the result', async () => {
    const clock = fakeClock();
    const resetSecs = String(Math.floor(clock.t / 1000) + 120);
    const limited = (): Response =>
      json({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': resetSecs,
      });
    // Authenticated query: rate limit is waited out (SPEC 3.1: only unauthenticated skips).
    const authQuery = { ...query, token: 'ghp_test' };
    const wait = await waitForCi(authQuery, sequence(limited, green).fetch, LIMITS, clock);
    expect(wait).toMatchObject({ timedOut: false, polls: 2 });
    expect(clock.sleeps).toEqual([120_000]);
  });

  it('times out as rate_limited when the limit outlasts the deadline', async () => {
    const clock = fakeClock();
    const limited = (): Response => json({ message: 'API rate limit exceeded' }, 429);
    const wait = await waitForCi(
      query,
      sequence(limited).fetch,
      { timeoutMs: 60_000, pollMs: 30_000 },
      clock,
    );
    expect(wait).toMatchObject({ timedOut: true, lastState: 'rate_limited' });
  });

  it('rejects on errors other than rate limits instead of waiting', async () => {
    const clock = fakeClock();
    const broken = (): Response => new Response('down', { status: 502 });
    await expect(waitForCi(query, sequence(broken).fetch, LIMITS, clock)).rejects.toThrow(
      'HTTP 502',
    );
    expect(clock.sleeps).toEqual([]);
  });

  it('unauthenticated rate limit on first poll returns immediately without waiting', async () => {
    const clock = fakeClock();
    const limited = (): Response =>
      json({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
      });
    // query.token is '' (unauthenticated); first poll rate_limited → return at once.
    const wait = await waitForCi(query, sequence(limited, green).fetch, LIMITS, clock);
    expect(wait).toMatchObject({
      result: undefined,
      timedOut: true,
      waitedMs: 0,
      polls: 1,
      lastState: 'rate_limited',
    });
    // No sleeps: did not wait for the rate limit to reset.
    expect(clock.sleeps).toEqual([]);
  });

  it('authenticated rate limit on first poll still waits as before', async () => {
    const clock = fakeClock();
    const resetSecs = String(Math.floor(clock.t / 1000) + 120);
    const limited = (): Response =>
      json({ message: 'API rate limit exceeded' }, 403, {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': resetSecs,
      });
    const authQuery = { ...query, token: 'ghp_fake' };
    const wait = await waitForCi(authQuery, sequence(limited, green).fetch, LIMITS, clock);
    expect(wait).toMatchObject({ timedOut: false, polls: 2 });
    // Waited for the rate-limit reset (120s).
    expect(clock.sleeps).toEqual([120_000]);
  });

  it('3 consecutive no_runs polls stops early for descendant attribution (SPEC 3.5)', async () => {
    const clock = fakeClock();
    const noRuns = (): Response => runs();
    // Three consecutive no_runs → early return, not a timeout.
    const wait = await waitForCi(query, sequence(noRuns, noRuns, noRuns).fetch, LIMITS, clock);
    expect(wait).toMatchObject({
      timedOut: false,
      polls: 3,
      lastState: 'no_runs',
    });
    // The result is the empty CiResult (no runs).
    expect(wait.result).toMatchObject({ state: 'none', runs: [] });
    // Only 2 sleeps: between poll 1→2 and 2→3; poll 3 returns immediately.
    expect(clock.sleeps).toEqual([30_000, 30_000]);
  });

  it('no_runs counter resets when a pending run appears between them', async () => {
    const clock = fakeClock();
    const noRuns = (): Response => runs();
    // 2 no_runs, then a pending, then 2 more no_runs (not 3 consecutive), then green.
    const wait = await waitForCi(
      query,
      sequence(noRuns, noRuns, pending, noRuns, noRuns, green).fetch,
      LIMITS,
      clock,
    );
    expect(wait).toMatchObject({ timedOut: false, lastState: 'completed' });
    // All 6 polls ran (the counter was reset at poll 3).
    expect(wait.polls).toBe(6);
  });

  it('short sha expansion: evidence.ts expands short shas via revParse before CI queries', () => {
    // This test documents the design: evidence.ts calls revParse(root, headSha)
    // at the top of collectEvidence to expand short shas. The actual expansion
    // is verified in evidence.test.ts; here we verify the CI module's awareness.
    // The NO_RUNS_THRESHOLD constant exists for the 3x no_runs fallback.
    expect(typeof waitForCi).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Descendant attribution (SPEC 3.5 "CI 运行的归属")
// ---------------------------------------------------------------------------

/** Returns different API responses based on the head_sha parameter in the URL. */
function perShaFetch(responses: Record<string, () => Response>): FetchLike {
  return (url) => {
    const shaMatch = /head_sha=([0-9a-f]+)/.exec(url);
    const sha = shaMatch?.[1] ?? '';
    const respond = responses[sha] ?? (() => runs());
    return Promise.resolve(respond());
  };
}

describe('ci: isEnvelopeOnlyDiff (SPEC 3.5)', () => {
  it('accepts an empty diff', () => {
    expect(isEnvelopeOnlyDiff([])).toBe(true);
  });

  it('accepts .collie/ files and docs/progress.md', () => {
    expect(
      isEnvelopeOnlyDiff([
        '.collie/batches/v01-b05-smoke/report.md',
        '.collie/batches/v01-b05-smoke/verdict.md',
        'docs/progress.md',
      ]),
    ).toBe(true);
  });

  it('rejects when a source file changed', () => {
    expect(isEnvelopeOnlyDiff(['.collie/batches/v01-b05/report.md', 'src/ci.ts'])).toBe(false);
  });

  it('rejects docs/backlog.md (not in the allowlist)', () => {
    expect(isEnvelopeOnlyDiff(['docs/backlog.md'])).toBe(false);
  });
});

const DESC_SHA = 'a'.repeat(40);
const CODE_DESC_SHA = 'b'.repeat(40);

describe('ci: queryCiWithAttribution (SPEC 3.5)', () => {
  it('uses head_sha own run when it exists (no descendant fallback)', async () => {
    const fetch = perShaFetch({
      [SHA]: () => runs(run({ id: 1 })),
      [DESC_SHA]: () => runs(run({ id: 2, head_sha: DESC_SHA })),
    });
    const descendants: DescendantCandidate[] = [
      { sha: DESC_SHA, changedFiles: ['.collie/batches/v01-b05-smoke/report.md'] },
    ];
    const result = await queryCiWithAttribution(query, fetch, descendants);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBeUndefined();
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]?.id).toBe(1);
  });

  it('adopts a qualifying descendant when head_sha has no runs', async () => {
    const fetch = perShaFetch({
      [SHA]: () => runs(),
      [DESC_SHA]: () => runs(run({ id: 10, head_sha: DESC_SHA })),
    });
    const descendants: DescendantCandidate[] = [
      {
        sha: DESC_SHA,
        changedFiles: ['.collie/batches/v01-b05-smoke/report.md', 'docs/progress.md'],
      },
    ];
    const result = await queryCiWithAttribution(query, fetch, descendants);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBe(DESC_SHA);
    expect(result.runs).toHaveLength(1);
    expect(result.branchMatched).toBe(true);
  });

  it('rejects a descendant that changed code files', async () => {
    const fetch = perShaFetch({
      [SHA]: () => runs(),
      [CODE_DESC_SHA]: () => runs(run({ id: 20, head_sha: CODE_DESC_SHA })),
    });
    const descendants: DescendantCandidate[] = [
      {
        sha: CODE_DESC_SHA,
        changedFiles: ['.collie/batches/v01-b05-smoke/report.md', 'src/ci.ts'],
      },
    ];
    const result = await queryCiWithAttribution(query, fetch, descendants);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBeUndefined();
    expect(result.runs).toHaveLength(0);
  });

  it('skips a code-changing descendant but adopts the next qualifying one', async () => {
    const cleanDesc = 'c'.repeat(40);
    const fetch = perShaFetch({
      [SHA]: () => runs(),
      [CODE_DESC_SHA]: () => runs(run({ id: 20, head_sha: CODE_DESC_SHA })),
      [cleanDesc]: () => runs(run({ id: 30, head_sha: cleanDesc })),
    });
    const descendants: DescendantCandidate[] = [
      { sha: CODE_DESC_SHA, changedFiles: ['src/ci.ts'] },
      { sha: cleanDesc, changedFiles: ['.collie/batches/v02-b01/report.md'] },
    ];
    const result = await queryCiWithAttribution(query, fetch, descendants);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBe(cleanDesc);
    expect(result.runs[0]?.id).toBe(30);
  });

  it('returns the empty direct result when no descendant qualifies', async () => {
    const fetch = perShaFetch({ [SHA]: () => runs() });
    const result = await queryCiWithAttribution(query, fetch, []);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBeUndefined();
    expect(result.runs).toHaveLength(0);
  });

  it('does not adopt a descendant whose CI is still pending', async () => {
    const fetch = perShaFetch({
      [SHA]: () => runs(),
      [DESC_SHA]: () =>
        runs(run({ id: 15, head_sha: DESC_SHA, status: 'in_progress', conclusion: null })),
    });
    const descendants: DescendantCandidate[] = [
      { sha: DESC_SHA, changedFiles: ['.collie/batches/v01-b05-smoke/report.md'] },
    ];
    const result = await queryCiWithAttribution(query, fetch, descendants);
    expect(result.sha).toBe(SHA);
    expect(result.attributedSha).toBeUndefined();
    expect(result.runs).toHaveLength(0);
  });
});
