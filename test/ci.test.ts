import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CiError,
  CiRateLimitError,
  parseGitHubRepo,
  queryCi,
  type CiQuery,
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
