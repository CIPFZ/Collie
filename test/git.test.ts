import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  commit,
  diffStat,
  git,
  GitError,
  isAncestor,
  log,
  lsRemote,
  remoteContains,
  removeWorktree,
  revParse,
  status,
} from '../src/git.js';

// Isolate from the developer's git configuration (insteadOf rules, hooks, signing).
const savedEnv = { ...process.env };
let configDir: string;

beforeAll(() => {
  configDir = mkdtempSync(join(tmpdir(), 'collie-gitcfg-'));
  const config = join(configDir, 'gitconfig');
  writeFileSync(
    config,
    '[user]\n\tname = Test Worker\n\temail = worker@example.invalid\n[init]\n\tdefaultBranch = main\n',
  );
  process.env.GIT_CONFIG_GLOBAL = config;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

afterAll(() => {
  process.env = savedEnv;
  rmSync(configDir, { recursive: true, force: true });
});

let root: string;
let repo: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'collie-git-'));
  repo = join(root, 'work');
  mkdirSync(repo);
  await git(repo, ['init', '-q']);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(path: string, content: string): void {
  writeFileSync(join(repo, path), content);
}

async function commitAll(message: string): Promise<string> {
  await git(repo, ['add', '-A']);
  await git(repo, ['commit', '-q', '-m', message]);
  return revParse(repo, 'HEAD');
}

describe('git: revParse and errors', () => {
  it('resolves HEAD to a full sha', async () => {
    write('a.txt', 'a\n');
    expect(await commitAll('init')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('rejects with GitError carrying args, exit code and stderr', async () => {
    const error = await revParse(repo, 'no-such-ref').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitError);
    expect(error).toMatchObject({ exitCode: 128 });
    expect((error as GitError).args).toContain('rev-parse');
  });
});

describe('git: log', () => {
  it('lists base..head oldest first with author and subject', async () => {
    write('a.txt', 'a\n');
    const base = await commitAll('init');
    write('b.txt', 'b\n');
    const first = await commitAll('feat: add b');
    write('c.txt', 'c\n');
    const second = await commitAll('fix: subject with | pipe and tab\tinside');
    expect(await log(repo, base, second)).toEqual([
      { sha: first, author: 'Test Worker', subject: 'feat: add b' },
      { sha: second, author: 'Test Worker', subject: 'fix: subject with | pipe and tab\tinside' },
    ]);
  });

  it('returns [] for an empty range', async () => {
    write('a.txt', 'a\n');
    const head = await commitAll('init');
    expect(await log(repo, head, head)).toEqual([]);
  });
});

describe('git: diffStat', () => {
  it('counts added and deleted lines per file, with totals', async () => {
    write('SPEC.md', 'one\ntwo\nthree\n');
    write('src.ts', 'x\n');
    const base = await commitAll('init');
    write('SPEC.md', 'one\nTWO\nthree\nfour\n');
    write('new.ts', 'a\nb\n');
    const head = await commitAll('change');
    const stat = await diffStat(repo, base, head);
    expect(stat.files).toEqual([
      { path: 'SPEC.md', added: 2, deleted: 1 },
      { path: 'new.ts', added: 2, deleted: 0 },
    ]);
    expect([stat.added, stat.deleted]).toEqual([4, 1]);
  });

  it('restricts to the given paths (e.g. protected files)', async () => {
    write('SPEC.md', 'a\n');
    write('src.ts', 'x\n');
    const base = await commitAll('init');
    write('src.ts', 'y\n');
    const head = await commitAll('code only');
    expect((await diffStat(repo, base, head, ['SPEC.md', 'CONSTRAINTS.md'])).files).toEqual([]);
  });

  it('reports a renamed file under its old path too', async () => {
    write('SPEC.md', 'a\nb\n');
    const base = await commitAll('init');
    renameSync(join(repo, 'SPEC.md'), join(repo, 'NOTES.md'));
    const head = await commitAll('rename');
    const stat = await diffStat(repo, base, head, ['SPEC.md']);
    expect(stat.files).toEqual([{ path: 'SPEC.md', added: 0, deleted: 2 }]);
  });

  it('reports binary files with null counts', async () => {
    write('a.txt', 'a\n');
    const base = await commitAll('init');
    writeFileSync(join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]));
    const head = await commitAll('binary');
    expect((await diffStat(repo, base, head)).files).toEqual([
      { path: 'blob.bin', added: null, deleted: null },
    ]);
  });
});

describe('git: lsRemote', () => {
  it('lists refs of a remote given by path, filtered by pattern', async () => {
    const remote = join(root, 'remote.git');
    await git(root, ['init', '-q', '--bare', remote]);
    write('a.txt', 'a\n');
    const head = await commitAll('init');
    await git(repo, ['push', '-q', remote, 'main']);
    expect(await lsRemote(repo, remote, ['refs/heads/main'])).toEqual([
      { sha: head, ref: 'refs/heads/main' },
    ]);
    expect(await lsRemote(repo, remote, ['refs/heads/master'])).toEqual([]);
  });

  it('rejects for an unreachable remote', async () => {
    await expect(lsRemote(repo, join(root, 'missing.git'))).rejects.toBeInstanceOf(GitError);
  });
});

describe('git: status', () => {
  it('is clean right after a commit', async () => {
    write('a.txt', 'a\n');
    await commitAll('init');
    expect(await status(repo)).toEqual({ clean: true, entries: [] });
  });

  it('reports modified, staged, untracked and renamed paths', async () => {
    write('a.txt', 'a\n');
    write('b.txt', 'b\n');
    await commitAll('init');
    write('a.txt', 'changed\n');
    write('new file.txt', 'n\n');
    await git(repo, ['mv', 'b.txt', 'c.txt']);
    const result = await status(repo);
    expect(result.clean).toBe(false);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        { code: ' M', path: 'a.txt' },
        { code: '??', path: 'new file.txt' },
        { code: 'R ', path: 'c.txt', from: 'b.txt' },
      ]),
    );
    expect(result.entries).toHaveLength(3);
  });
});

describe('git: commit', () => {
  it('commits only the given paths and returns the new HEAD', async () => {
    write('a.txt', 'a\n');
    await commitAll('init');
    mkdirSync(join(repo, '.collie'));
    write('.collie/report.md', '# report\n');
    write('scratch.txt', 'leave me\n');
    const sha = await commit(repo, 'report(collie): v99-b01', ['.collie/report.md']);
    expect(sha).toBe(await revParse(repo, 'HEAD'));
    expect((await log(repo, 'HEAD~1', 'HEAD'))[0]?.subject).toBe('report(collie): v99-b01');
    expect((await status(repo)).entries).toEqual([{ code: '??', path: 'scratch.txt' }]);
  });

  it('refuses an empty path list', async () => {
    await expect(commit(repo, 'nothing', [])).rejects.toThrow('no paths to commit');
  });
});

describe('git: pushed means contained in the remote branch (SPEC 3.4)', () => {
  async function withRemote(): Promise<string> {
    const remote = join(root, 'remote.git');
    await git(root, ['init', '-q', '--bare', remote]);
    await git(repo, ['remote', 'add', 'origin', remote]);
    return remote;
  }

  it('is true for head_sha even when a report envelope commit sits on top', async () => {
    await withRemote();
    write('a.txt', 'a\n');
    const head = await commitAll('code');
    mkdirSync(join(repo, '.collie'));
    write('.collie/report.md', 'r\n');
    const envelope = await commitAll('report(collie): v99-b01');
    await git(repo, ['push', '-q', 'origin', 'main']);
    // The remote tip is the envelope, so ref equality would wrongly say "not pushed".
    expect((await lsRemote(repo, 'origin', ['refs/heads/main']))[0]?.sha).toBe(envelope);
    expect(await remoteContains(repo, 'origin', 'main', head)).toBe(true);
  });

  it('is false for a local commit that was never pushed', async () => {
    await withRemote();
    write('a.txt', 'a\n');
    await commitAll('pushed');
    await git(repo, ['push', '-q', 'origin', 'main']);
    write('b.txt', 'b\n');
    const local = await commitAll('local only');
    expect(await remoteContains(repo, 'origin', 'main', local)).toBe(false);
  });

  it('is false for a commit pushed only to another branch', async () => {
    await withRemote();
    write('a.txt', 'a\n');
    await commitAll('base');
    await git(repo, ['push', '-q', 'origin', 'main']);
    await git(repo, ['checkout', '-q', '-b', 'master']);
    write('b.txt', 'b\n');
    const other = await commitAll('on master');
    await git(repo, ['push', '-q', 'origin', 'master']);
    expect(await remoteContains(repo, 'origin', 'main', other)).toBe(false);
  });

  it('rejects for an unknown commit instead of answering false', async () => {
    write('a.txt', 'a\n');
    await commitAll('base');
    await expect(isAncestor(repo, 'f'.repeat(40), 'HEAD')).rejects.toBeInstanceOf(GitError);
  });
});

describe('git: worktrees', () => {
  it('checks out head_sha without later commits, and removes cleanly', async () => {
    write('a.txt', 'code\n');
    const head = await commitAll('code');
    mkdirSync(join(repo, '.collie'));
    write('.collie/report.md', 'secret\n');
    await commitAll('report(collie): v99-b01');
    const tree = join(root, 'review');
    await addWorktree(repo, tree, head);
    expect(readFileSync(join(tree, 'a.txt'), 'utf8')).toBe('code\n');
    expect(existsSync(join(tree, '.collie', 'report.md'))).toBe(false);
    expect(await revParse(tree, 'HEAD')).toBe(head);
    writeFileSync(join(tree, 'scratch.txt'), 'dirty');
    await removeWorktree(repo, tree);
    expect(existsSync(tree)).toBe(false);
    expect((await git(repo, ['worktree', 'list', '--porcelain'])).includes(tree)).toBe(false);
  });
});
