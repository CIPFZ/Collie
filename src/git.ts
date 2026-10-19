// Thin wrappers over the git CLI (SPEC 4: log / diff / ls-remote / status / commit).
// git runs without a shell and every output is parsed from a machine format
// (-z, --numstat, --porcelain), never from human-oriented text.
import { spawn } from 'node:child_process';

export class GitError extends Error {
  readonly args: readonly string[];
  readonly exitCode: number | null;
  readonly stderr: string;

  constructor(args: readonly string[], exitCode: number | null, stderr: string) {
    super(`git ${args.join(' ')} failed (exit ${String(exitCode)}): ${stderr.trim()}`);
    this.name = 'GitError';
    this.args = args;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

const NUL = '\0';
const FIELD = '\x1f';
/** Porcelain v1 record: two status letters, a space, the path. */
const STATUS_RECORD = /^(?<code>[ A-Z?!]{2}) (?<path>.*)$/s;

/** Runs git in `cwd` and resolves with stdout; rejects with GitError on a non-zero exit. */
export function git(cwd: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      reject(new GitError(args, null, error.message));
    });
    child.on('close', (code) => {
      const err = Buffer.concat(stderr).toString('utf8');
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new GitError(args, code, err));
    });
  });
}

/** Resolves a revision to its full sha. */
export async function revParse(cwd: string, rev: string): Promise<string> {
  return (await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`])).trim();
}

export interface CommitInfo {
  sha: string;
  author: string;
  subject: string;
}

/** Commits in `base..head`, oldest first. */
export async function log(cwd: string, base: string, head: string): Promise<CommitInfo[]> {
  const out = await git(cwd, [
    'log',
    '--reverse',
    '-z',
    `--format=%H${FIELD}%an${FIELD}%s`,
    `${base}..${head}`,
    '--',
  ]);
  return out
    .split(NUL)
    .filter((record) => record !== '')
    .map((record) => {
      const [sha = '', author = '', subject = ''] = record.split(FIELD);
      return { sha, author, subject };
    });
}

export interface DiffStatEntry {
  path: string;
  /** null for binary files, which git reports as "-". */
  added: number | null;
  deleted: number | null;
}

export interface DiffStat {
  files: DiffStatEntry[];
  added: number;
  deleted: number;
}

function numstatCount(text: string): number | null {
  return text === '-' ? null : Number(text);
}

/**
 * Per-file line counts for `base..head` (git diff --numstat, the machine form
 * of --stat). Renames are reported as a delete plus an add so every path that
 * changed is listed, e.g. a renamed SPEC.md cannot hide behind its new name.
 */
export async function diffStat(
  cwd: string,
  base: string,
  head: string,
  paths: readonly string[] = [],
): Promise<DiffStat> {
  const out = await git(cwd, [
    'diff',
    '--numstat',
    '-z',
    '--no-renames',
    base,
    head,
    '--',
    ...paths,
  ]);
  const files = out
    .split(NUL)
    .filter((record) => record !== '')
    .map((record): DiffStatEntry => {
      const [added = '', deleted = '', ...rest] = record.split('\t');
      return { path: rest.join('\t'), added: numstatCount(added), deleted: numstatCount(deleted) };
    });
  return {
    files,
    added: files.reduce((sum, f) => sum + (f.added ?? 0), 0),
    deleted: files.reduce((sum, f) => sum + (f.deleted ?? 0), 0),
  };
}

export interface RemoteRef {
  sha: string;
  ref: string;
}

/** Refs advertised by `remote` (a remote name or URL), optionally filtered by patterns. */
export async function lsRemote(
  cwd: string,
  remote: string,
  patterns: readonly string[] = [],
): Promise<RemoteRef[]> {
  const out = await git(cwd, ['ls-remote', '--end-of-options', remote, ...patterns]);
  return out
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [sha = '', ref = ''] = line.split('\t');
      return { sha, ref };
    });
}

export interface StatusEntry {
  /** Two-letter porcelain code, e.g. " M", "A ", "??". */
  code: string;
  path: string;
  /** Source path of a rename or copy. */
  from?: string;
}

export interface Status {
  clean: boolean;
  entries: StatusEntry[];
}

/** Working tree status, untracked files included (git status --porcelain=v1 -z). */
export async function status(cwd: string): Promise<Status> {
  const records = (
    await git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  ).split(NUL);
  const entries: StatusEntry[] = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i] ?? '';
    if (record === '') continue;
    const parsed = STATUS_RECORD.exec(record);
    if (parsed?.groups === undefined)
      throw new GitError(['status'], 0, `unexpected record ${JSON.stringify(record)}`);
    const { code = '', path = '' } = parsed.groups;
    // With -z a rename or copy is followed by its source path as a separate record.
    if (code.includes('R') || code.includes('C')) {
      i++;
      entries.push({ code, path, from: records[i] ?? '' });
    } else {
      entries.push({ code, path });
    }
  }
  return { clean: entries.length === 0, entries };
}

/** Stages `paths` and commits only them; resolves with the new HEAD sha. */
export async function commit(
  cwd: string,
  message: string,
  paths: readonly string[],
): Promise<string> {
  if (paths.length === 0) throw new GitError(['commit'], null, 'no paths to commit');
  await git(cwd, ['add', '--', ...paths]);
  await git(cwd, ['commit', '-m', message, '--', ...paths]);
  return revParse(cwd, 'HEAD');
}
