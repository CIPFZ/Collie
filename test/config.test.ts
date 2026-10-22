import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseConfig } from '../src/config.js';

const repoRoot = join(import.meta.dirname, '..');

/** A minimal valid document; individual tests mutate one line at a time. */
const VALID_TOML = `
schema_version = 1

[project]
name = "collie"
repo = "https://github.com/CIPFZ/Collie"

[agent.worker]
model = "claude-opus-4-6"
allowed_tools = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]
max_turns = 200
permission_mode = "bypassPermissions"

[agent.reviewer]
model = "claude-opus-4-6"
allowed_tools = ["Read", "Glob", "Grep", "Bash"]
max_turns = 60
permission_mode = "bypassPermissions"

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
commands = ["npm run lint", "npm run typecheck", "npm test"]

[ci]
provider = "github-actions"
expected_branch = "main"
token_file = "~/.config/collie/github-token"
`;

function configError(text: string): ConfigError {
  try {
    parseConfig(text, 'inline.toml');
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    if (error instanceof ConfigError) return error;
  }
  throw new Error('expected parseConfig to throw ConfigError');
}

function replaceLine(text: string, from: string, to: string): string {
  expect(text).toContain(from);
  return text.replace(from, to);
}

describe('config: the repository .collie/collie.toml', () => {
  // Every value below is copied from SPEC 3.1.
  const config = loadConfig(repoRoot);

  it('has schema_version 1 and the project section', () => {
    expect(config.schema_version).toBe(1);
    expect(config.project).toEqual({ name: 'collie', repo: 'https://github.com/CIPFZ/Collie' });
  });

  it('has the worker agent of SPEC 3.1', () => {
    expect(config.agent.worker).toEqual({
      model: 'claude-opus-4-6',
      allowed_tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      max_turns: 200,
      permission_mode: 'bypassPermissions',
    });
  });

  it('has the reviewer agent of SPEC 3.1, without Write/Edit', () => {
    expect(config.agent.reviewer).toEqual({
      model: 'claude-opus-4-6',
      allowed_tools: ['Read', 'Glob', 'Grep', 'Bash'],
      max_turns: 60,
      permission_mode: 'bypassPermissions',
    });
  });

  it('has the limits of SPEC 3.1', () => {
    expect(config.limits).toEqual({
      stall_secs: 300,
      progress_secs: 900,
      wallclock_secs: 2700,
      resume_max: 2,
      fix_max: 2,
      dry_k: 2,
      ci_wait_secs: 1800,
      ci_poll_secs: 30,
      grace_secs: 20,
    });
  });

  it('has the verify commands and CI section of SPEC 3.1', () => {
    expect(config.verify.commands).toEqual(['npm run lint', 'npm run typecheck', 'npm test']);
    expect(config.ci).toEqual({
      provider: 'github-actions',
      expected_branch: 'main',
      token_file: '~/.config/collie/github-token',
    });
  });

  it('equals the inline SPEC 3.1 fixture used by the error tests', () => {
    expect(parseConfig(VALID_TOML, 'inline.toml')).toEqual(config);
  });
});

describe('config: validation errors carry field paths', () => {
  it('reports a missing field', () => {
    const err = configError(replaceLine(VALID_TOML, 'stall_secs = 300\n', ''));
    expect(err.issues.map((i) => i.path)).toEqual(['limits.stall_secs']);
    expect(err.message).toContain('limits.stall_secs');
    expect(err.message).toContain('inline.toml');
  });

  it('reports a missing section', () => {
    const err = configError(
      replaceLine(
        VALID_TOML,
        '[ci]\nprovider = "github-actions"\nexpected_branch = "main"\ntoken_file = "~/.config/collie/github-token"\n',
        '',
      ),
    );
    expect(err.issues.map((i) => i.path)).toEqual(['ci']);
  });

  it('reports a type error', () => {
    const err = configError(replaceLine(VALID_TOML, 'stall_secs = 300', 'stall_secs = "300"'));
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0]?.path).toBe('limits.stall_secs');
    expect(err.message).toMatch(/limits\.stall_secs: .*number/);
  });

  it('reports a type error in a nested table', () => {
    const err = configError(replaceLine(VALID_TOML, 'max_turns = 60', 'max_turns = 1.5'));
    expect(err.issues.map((i) => i.path)).toEqual(['agent.reviewer.max_turns']);
  });

  it('reports a type error inside an array with its index', () => {
    const err = configError(replaceLine(VALID_TOML, '"npm run typecheck"', '42'));
    expect(err.issues.map((i) => i.path)).toEqual(['verify.commands.1']);
  });

  it('reports each unknown field by name (strict)', () => {
    const err = configError(
      replaceLine(VALID_TOML, 'dry_k = 2', 'dry_k = 2\nstal_secs = 90\nextra = true'),
    );
    expect(err.issues.map((i) => i.path)).toEqual(['limits.stal_secs', 'limits.extra']);
    expect(err.message).toContain('limits.stal_secs: unknown field');
  });

  it('reports an unknown agent role', () => {
    const err = configError(
      `${VALID_TOML}\n[agent.auditor]\nmodel = "m"\nallowed_tools = []\nmax_turns = 1\n`,
    );
    expect(err.issues.map((i) => i.path)).toEqual(['agent.auditor']);
  });

  it('reports a permission_mode outside the SPEC 3.1 values', () => {
    const err = configError(
      replaceLine(
        VALID_TOML,
        'max_turns = 60\npermission_mode = "bypassPermissions"',
        'max_turns = 60\npermission_mode = "yolo"',
      ),
    );
    expect(err.issues.map((i) => i.path)).toEqual(['agent.reviewer.permission_mode']);
  });

  it('accepts a role without permission_mode (SDK default)', () => {
    const text = replaceLine(
      VALID_TOML,
      'max_turns = 200\npermission_mode = "bypassPermissions"\n',
      'max_turns = 200\n',
    );
    expect(parseConfig(text, 'inline.toml').agent.worker.permission_mode).toBeUndefined();
  });

  it('accepts ci.token_file as an optional string (SPEC 3.1)', () => {
    expect(parseConfig(VALID_TOML, 'inline.toml').ci.token_file).toBe(
      '~/.config/collie/github-token',
    );
  });

  it('parses config without ci.token_file (field is optional)', () => {
    const text = replaceLine(VALID_TOML, 'token_file = "~/.config/collie/github-token"\n', '');
    expect(parseConfig(text, 'inline.toml').ci.token_file).toBeUndefined();
  });

  it('reports a schema_version mismatch', () => {
    const err = configError(replaceLine(VALID_TOML, 'schema_version = 1', 'schema_version = 2'));
    expect(err.issues.map((i) => i.path)).toEqual(['schema_version']);
  });

  it('reports every issue at once, not only the first', () => {
    let text = replaceLine(VALID_TOML, 'stall_secs = 300', 'stall_secs = -1');
    text = replaceLine(text, 'expected_branch = "main"', 'expected_branch = ""');
    const err = configError(text);
    expect(err.issues.map((i) => i.path)).toEqual(['limits.stall_secs', 'ci.expected_branch']);
  });

  it('reports TOML syntax errors with the line number', () => {
    const err = configError('schema_version = 1\n[limits\nstall_secs = 300\n');
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0]?.path).toBe('');
    expect(err.message).toMatch(/line 2/);
  });
});

describe('config: loadConfig file handling', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function tempRoot(): string {
    const dir = mkdtempSync(join(tmpdir(), 'collie-config-'));
    dirs.push(dir);
    return dir;
  }

  it('loads <root>/.collie/collie.toml', () => {
    const root = tempRoot();
    mkdirSync(join(root, '.collie'));
    writeFileSync(join(root, '.collie', 'collie.toml'), VALID_TOML);
    expect(loadConfig(root).limits.wallclock_secs).toBe(2700);
  });

  it('throws ConfigError naming the path when the file is missing', () => {
    const root = tempRoot();
    expect(() => loadConfig(root)).toThrow(ConfigError);
    expect(() => loadConfig(root)).toThrow(join(root, '.collie', 'collie.toml'));
  });
});
