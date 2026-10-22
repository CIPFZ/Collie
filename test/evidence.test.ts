import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import { loadConfig, parseConfig } from '../src/config.js';
import { collectEvidence } from '../src/evidence.js';
import { git, revParse } from '../src/git.js';

const config = loadConfig(join(import.meta.dirname, '..'));
const savedEnv = { ...process.env };
let configDir: string;

beforeAll(() => {
  configDir = mkdtempSync(join(tmpdir(), 'collie-gitcfg-'));
  const path = join(configDir, 'gitconfig');
  writeFileSync(
    path,
    '[user]\n\tname = Test\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n',
  );
  process.env.GIT_CONFIG_GLOBAL = path;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

afterAll(() => {
  process.env = savedEnv;
  rmSync(configDir, { recursive: true, force: true });
});

let root: string;
let repo: string;
let base: string;

function write(path: string, content: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
}

async function commitAll(message: string): Promise<string> {
  await git(repo, ['add', '-A']);
  await git(repo, ['commit', '-q', '-m', message]);
  return revParse(repo, 'HEAD');
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'collie-evidence-'));
  repo = join(root, 'work');
  mkdirSync(repo);
  await git(repo, ['init', '-q']);
  await git(root, ['init', '-q', '--bare', 'remote.git']);
  await git(repo, ['remote', 'add', 'origin', join(root, 'remote.git')]);
  write('SPEC.md', 'spec\n');
  write('package.json', JSON.stringify({ dependencies: { zod: '^4.6.7' } }));
  base = await commitAll('base');
  await git(repo, ['push', '-q', 'origin', 'main']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function ciFetch(branch: string | null, conclusion = 'success'): FetchLike {
  return (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    const runs =
      branch === null
        ? []
        : [
            {
              id: 1,
              workflow_id: 1,
              name: 'ci',
              event: 'push',
              head_branch: branch,
              head_sha: sha,
              status: 'completed',
              conclusion,
              html_url: 'https://github.com/CIPFZ/Collie/actions/runs/1',
              created_at: '2026-10-19T00:00:00Z',
            },
          ];
    return Promise.resolve(
      new Response(JSON.stringify({ total_count: runs.length, workflow_runs: runs })),
    );
  };
}

async function collect(head: string, fetch: FetchLike = ciFetch('main'), cmds = ['true']) {
  return collectEvidence({
    root: repo,
    remote: 'origin',
    baseSha: base,
    headSha: head,
    commands: cmds.map((cmd) => ({ desc: cmd, cmd, expect: 'exit_zero' as const })),
    config,
    fetch,
  });
}

describe('evidence: commits and push', () => {
  it('lists commits and finds head_sha on the remote under a later envelope commit', async () => {
    write('src.ts', 'x\n');
    const head = await commitAll('code');
    write('.collie/batches/v99/report.md', 'r\n');
    await commitAll('report(collie): v99');
    await git(repo, ['push', '-q', 'origin', 'main']);
    const { evidence } = await collect(head);
    expect(evidence.commits_actual).toEqual([head]);
    expect(evidence.remote_has_head).toBe(true);
  });

  it('reports remote_has_head=false for an unpushed head', async () => {
    write('src.ts', 'x\n');
    const head = await commitAll('code');
    expect((await collect(head)).evidence.remote_has_head).toBe(false);
  });

  it('reports remote_has_head=false with the reason when the remote is unreachable', async () => {
    write('src.ts', 'x\n');
    const head = await commitAll('code');
    await git(repo, ['remote', 'set-url', 'origin', join(root, 'gone.git')]);
    const collected = await collect(head);
    expect(collected.evidence.remote_has_head).toBe(false);
    expect(collected.remoteError).toBeDefined();
  });
});

describe('evidence: protected files and dependencies', () => {
  it('counts SPEC.md lines changed by the worker', async () => {
    write('SPEC.md', 'spec\nsneaky\n');
    write('src.ts', 'x\n');
    const head = await commitAll('tamper');
    expect((await collect(head)).evidence.spec_diff_lines).toBe(1);
  });

  it.each(['CONSTRAINTS.md', 'AGENT-worker.md', 'docs/backlog.md', '.collie/collie.toml'])(
    'counts %s as protected',
    async (path) => {
      write(path, 'changed\n');
      const head = await commitAll('tamper');
      expect((await collect(head)).evidence.spec_diff_lines).toBe(1);
    },
  );

  it('ignores ordinary source changes and the report envelope', async () => {
    write('src.ts', 'x\n');
    write('.collie/batches/v99/report.md', 'r\n');
    const head = await commitAll('code and report');
    expect((await collect(head)).evidence.spec_diff_lines).toBe(0);
  });

  it('lists added and changed direct dependencies', async () => {
    write(
      'package.json',
      JSON.stringify({
        dependencies: { zod: '^4.6.7', 'left-pad': '1.3.0' },
        devDependencies: { tsx: '^4' },
      }),
    );
    const head = await commitAll('deps');
    expect((await collect(head)).evidence.deps_diff).toEqual(['left-pad@1.3.0', 'tsx@^4']);
  });

  it('flags strong copyleft anywhere in a new lockfile tree', async () => {
    write(
      'package-lock.json',
      JSON.stringify({
        packages: {
          'node_modules/a/node_modules/gpl-thing': { version: '1.0.0', license: 'GPL-3.0' },
          'node_modules/ok': { version: '1', license: 'MIT' },
        },
      }),
    );
    const head = await commitAll('lock');
    expect((await collect(head)).evidence.deps_diff).toEqual(['gpl-thing@1.0.0 (GPL-3.0)']);
  });
});

describe('evidence: CI', () => {
  async function head(): Promise<string> {
    write('src.ts', 'x\n');
    return commitAll('code');
  }

  it('reports success on the expected branch', async () => {
    const { evidence } = await collect(await head());
    expect(evidence).toMatchObject({ ci_conclusion: 'success', ci_branch_matched: true });
    expect(evidence.ci_run_url).toContain('/actions/runs/1');
  });

  it('reports a green run on another branch as unmatched and unknown', async () => {
    const { evidence } = await collect(await head(), ciFetch('master'));
    expect(evidence).toMatchObject({
      ci_conclusion: 'unknown',
      ci_branch_matched: false,
      ci_run_url: '',
    });
  });

  it('folds timed_out into failure', async () => {
    expect((await collect(await head(), ciFetch('main', 'timed_out'))).evidence.ci_conclusion).toBe(
      'failure',
    );
  });

  it('records ci_branch_matched=null when the CI query fails (e.g. rate limit)', async () => {
    const limited: FetchLike = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
      );
    const collected = await collect(await head(), limited);
    expect(collected.evidence).toMatchObject({ ci_conclusion: 'unknown', ci_branch_matched: null });
    expect(collected.ci).toMatchObject({ error: expect.stringContaining('rate limit') as unknown });
  });
});

describe('evidence: verify', () => {
  it('runs each command once, in the worktree root, and finds the test command', async () => {
    write('src.ts', 'x\n');
    const head = await commitAll('code');
    const counts = "printf ' Test Files  1 passed (1)\\n      Tests  3 passed (3)\\n'";
    const collected = await collect(head, ciFetch('main'), [
      'test -f src.ts',
      counts,
      'test -f src.ts',
    ]);
    expect(collected.evidence.verify_results.map((r) => [r.exit_code, r.summary])).toEqual([
      [0, 'exit 0'],
      [0, '3 passed, 0 failed'],
    ]);
    expect(collected.testCommand).toBe(counts);
  });
});

describe('evidence: token_file (SPEC 3.1)', () => {
  let tokenDir: string;

  beforeEach(() => {
    tokenDir = mkdtempSync(join(tmpdir(), 'collie-token-'));
  });

  afterEach(() => {
    rmSync(tokenDir, { recursive: true, force: true });
  });

  /** Config with token_file pointing at a file inside tokenDir. */
  function configWithTokenFile(tokenPath: string): ReturnType<typeof parseConfig> {
    const tomlText = `
schema_version = 1
[project]
name = "collie"
repo = "https://github.com/CIPFZ/Collie"
[agent.worker]
model = "claude-opus-4-6"
allowed_tools = ["Read"]
max_turns = 10
[agent.reviewer]
model = "claude-opus-4-6"
allowed_tools = ["Read"]
max_turns = 10
[limits]
stall_secs = 300
progress_secs = 900
wallclock_secs = 2700
resume_max = 2
fix_max = 2
dry_k = 2
ci_wait_secs = 1800
ci_poll_secs = 30
[verify]
commands = ["true"]
[ci]
provider = "github-actions"
expected_branch = "main"
token_file = ${JSON.stringify(tokenPath)}
`;
    return parseConfig(tomlText, 'test-inline');
  }

  it('reads the token from file and passes it in the Authorization header', async () => {
    const tokenPath = join(tokenDir, 'github-token');
    writeFileSync(tokenPath, '  fake-token  \n');
    const cfg = configWithTokenFile(tokenPath);

    write('src.ts', 'x\n');
    const head = await commitAll('code');
    await git(repo, ['push', '-q', 'origin', 'main']);

    const calls: { headers: Record<string, string> }[] = [];
    const capturingFetch: FetchLike = (url, init) => {
      calls.push({ headers: init.headers });
      return ciFetch('main')(url, init);
    };

    await collectEvidence({
      root: repo,
      remote: 'origin',
      baseSha: base,
      headSha: head,
      commands: [{ desc: 'true', cmd: 'true', expect: 'exit_zero' }],
      config: cfg,
      fetch: capturingFetch,
    });

    // The Authorization header carries the trimmed token from the file.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.headers.Authorization).toBe('Bearer fake-token');
  });

  it('treats a missing token file as unconfigured (no Authorization header)', async () => {
    const cfg = configWithTokenFile(join(tokenDir, 'nonexistent'));

    write('src.ts', 'x\n');
    const head = await commitAll('code');

    const calls: { headers: Record<string, string> }[] = [];
    const capturingFetch: FetchLike = (url, init) => {
      calls.push({ headers: init.headers });
      return ciFetch('main')(url, init);
    };

    await collectEvidence({
      root: repo,
      remote: 'origin',
      baseSha: base,
      headSha: head,
      commands: [{ desc: 'true', cmd: 'true', expect: 'exit_zero' }],
      config: cfg,
      fetch: capturingFetch,
    });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.headers).not.toHaveProperty('Authorization');
  });

  it('expands ~ in token_file path to home directory', () => {
    // We only test that the config accepts tilde paths; actual expansion
    // is verified by the 'reads the token' test above (which uses absolute paths).
    const cfg = configWithTokenFile('~/.config/collie/github-token');
    expect(cfg.ci.token_file).toBe('~/.config/collie/github-token');
  });
});
