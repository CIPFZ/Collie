// Tests for src/acceptance.ts (SPEC 16.12, v046-b08).
//
// Three groups:
// 1. retry loop — fake red check; first fail then pass; both fail; non-zero exit; event recording.
// 2. what is taken from the tree — sneaky files, missing keep.test.ts / MAP.md, redCheck throws.
// 3. real red check — FakeRunner writes failing tests, real runRedCheck judges them.
//
// Uses Sandbox for a real git repo; FakeRunner for the tester agent; injected redCheck for groups 1 & 2.
// Does NOT modify test/support/sandbox.ts.

import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  prepareAcceptance,
  type RecordFn,
  type RedCheckFn,
  type AcceptanceFailReason,
} from '../src/acceptance.js';
import { git, revParse } from '../src/git.js';
import type { RunRedCheckOpts, RunRedCheckResult } from '../src/redcheck.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { RunResult } from '../src/runner/index.js';
import type { Batch } from '../src/schema/index.js';
import { templateConfig } from './support/template-config.js';

const config = templateConfig();
const repoRoot = join(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Private temp directory: each test suite uses its own TMPDIR so assertions
// about collie-accept-* leftovers don't collide with other tests or the
// system temp dir. SPEC 16.13.
// ---------------------------------------------------------------------------
let privateTmpDir: string;
let savedTmpDir: string | undefined;

// Git identity env vars set in beforeEach so tests pass on machines
// with no global git config (SPEC 16.13).
const GIT_ID_KEYS = [
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
] as const;
type GitIdKey = (typeof GIT_ID_KEYS)[number];
let savedGitId: Record<GitIdKey, string | undefined>;

// GIT_CONFIG_GLOBAL / GIT_CONFIG_NOSYSTEM: replaced during the suite so
// tests do not read the machine's global git config (SPEC 16.14, v046-b12).
let gitConfigFile: string;
let savedGitConfigGlobal: string | undefined;
let savedGitConfigNosystem: string | undefined;

beforeEach(() => {
  privateTmpDir = mkdtempSync(join(tmpdir(), 'collie-pa-suite-'));
  savedTmpDir = process.env.TMPDIR;
  process.env.TMPDIR = privateTmpDir;

  savedGitId = {
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
    GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
  };
  process.env.GIT_AUTHOR_NAME = 'PATest';
  process.env.GIT_AUTHOR_EMAIL = 'pa@example.invalid';
  process.env.GIT_COMMITTER_NAME = 'PATest';
  process.env.GIT_COMMITTER_EMAIL = 'pa@example.invalid';

  // Replace global git config so tests pass on machines with commit signing,
  // no identity, etc. (照 test/support/sandbox.ts 的做法, SPEC 16.14).
  gitConfigFile = join(privateTmpDir, 'gitconfig');
  writeFileSync(
    gitConfigFile,
    '[user]\n\tname = PATest\n\temail = pa@example.invalid\n[init]\n\tdefaultBranch = main\n[gc]\n\tauto = 0\n',
  );
  savedGitConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
  savedGitConfigNosystem = process.env.GIT_CONFIG_NOSYSTEM;
  process.env.GIT_CONFIG_GLOBAL = gitConfigFile;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

afterEach(() => {
  if (savedTmpDir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = savedTmpDir;
  if (existsSync(privateTmpDir)) rmSync(privateTmpDir, { recursive: true, force: true });

  for (const k of GIT_ID_KEYS) {
    const v = savedGitId[k];
    if (v === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- restoring env
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  // Restore GIT_CONFIG_GLOBAL / GIT_CONFIG_NOSYSTEM.
  if (savedGitConfigGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGitConfigGlobal;
  if (savedGitConfigNosystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedGitConfigNosystem;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OK_RESULT: RunResult = { exitCode: 0 };
const FAIL_RESULT: RunResult = { exitCode: 1 };

/** Minimal batch with scenarios and interfaces. */
function testBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'v99-b01',
    title: 'test batch',
    priority: 1,
    depends_on: [],
    items: ['implement something'],
    acceptance: [{ desc: 'pass', cmd: 'true', expect: 'exit_zero' }],
    forbidden: [],
    status: 'running',
    scenarios: [{ id: 'S1', kind: 'new', text: 'do something new' }],
    interfaces: ['src/feature.ts exportName'],
    ...overrides,
  };
}

function batchWithKeep(): Batch {
  return testBatch({
    scenarios: [
      { id: 'S1', kind: 'new', text: 'do something new' },
      { id: 'K1', kind: 'keep', text: 'keep this behavior' },
    ],
  });
}

/** A red-check result that passes. */
function okRedCheck(): RunRedCheckResult {
  return { ok: true, problems: [], newTestCount: 2, keepTestCount: 0 };
}

/** A red-check result that fails. */
function failRedCheck(reason = 'expected to fail but passed'): RunRedCheckResult {
  return {
    ok: false,
    problems: [{ file: 'new', testName: 'test A', reason }],
    newTestCount: 1,
    keepTestCount: 0,
  };
}

/** Minimal RunRedCheckOpts for injection. */
function dummyRedCheckOpts(): RunRedCheckOpts {
  return {
    timeoutMs: 30_000,
    spawn: execFile,
  };
}

// Track temp directories for cleanup verification.
const tempDirs: string[] = [];

/** Creates a minimal git repo suitable for prepareAcceptance.
 *  Uses the private TMPDIR set in beforeEach; relies on the git identity
 *  env vars also set in beforeEach (SPEC 16.13). */
async function createTestRepo(): Promise<{ root: string; headSha: string; dir: string }> {
  const dir = mkdtempSync(join(privateTmpDir, 'collie-pa-test-'));
  tempDirs.push(dir);
  const root = dir;

  await git(root, ['init', '-q', '-b', 'main']);
  await git(root, ['config', 'gc.auto', '0']);
  // Write AGENT-tester.md so runTester can read it.
  writeFileSync(join(root, 'AGENT-tester.md'), '# Tester Manual\n');
  writeFileSync(join(root, 'dummy.txt'), 'hello\n');
  await git(root, ['add', '-A']);
  await git(root, ['commit', '-q', '-m', 'initial']);
  const headSha = await revParse(root, 'HEAD');

  return { root, headSha, dir };
}

afterAll(() => {
  for (const d of tempDirs) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Group 1: retry loop
// ---------------------------------------------------------------------------

describe('prepareAcceptance: retry loop', () => {
  it('first red check fails, second passes: tester called twice, ok=true, attempts=2', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    let callCount = 0;
    const fakeRedCheck: RedCheckFn = () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? failRedCheck() : okRedCheck());
    };
    // The FakeRunner writes the required files on each call.
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(
            join(cwd, outDir, 'new.test.ts'),
            'test("a", () => { throw new Error("fail"); });',
          );
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(
            join(cwd, outDir, 'new.test.ts'),
            'test("a", () => { throw new Error("fail"); });',
          );
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    if (result.ok) {
      expect(result.files.some((f) => f.path.endsWith('new.test.ts'))).toBe(true);
      expect(result.files.some((f) => f.path.endsWith('MAP.md'))).toBe(true);
    }
    expect(runner.calls).toHaveLength(2);
  });

  it('testerMax=2, both fail: tester called twice, ok=false, attempts=2', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    if (!result.ok) {
      expect(result.problems.length).toBeGreaterThan(0);
    }
    expect(runner.calls).toHaveLength(2);
  });

  it('tester exits non-zero: no red check for that attempt', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    let redCheckCalled = false;
    const fakeRedCheck: RedCheckFn = () => {
      redCheckCalled = true;
      return Promise.resolve(okRedCheck());
    };
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        result: FAIL_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(redCheckCalled).toBe(false);
    if (!result.ok) {
      expect(result.problems[0]).toContain('exited with code');
    }
  });

  it('record receives events in the right order for two attempts', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    let callCount = 0;
    const fakeRedCheck: RedCheckFn = () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? failRedCheck() : okRedCheck());
    };
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
    ]);

    const events: { event: string; fields: Record<string, unknown> }[] = [];
    const record: RecordFn = (event, fields) => {
      events.push({ event, fields });
    };

    await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
      record,
    });

    // Two full attempts: each has started, finished, redcheck.result.
    const eventNames = events.map((e) => e.event);
    expect(eventNames).toEqual([
      'tester.started',
      'tester.finished',
      'redcheck.result',
      'tester.started',
      'tester.finished',
      'redcheck.result',
    ]);

    // Verify attempt numbers.
    expect(events[0]?.fields.attempt).toBe(1);
    expect(events[1]?.fields.attempt).toBe(1);
    expect(events[2]?.fields.attempt).toBe(1);
    expect(events[3]?.fields.attempt).toBe(2);
    expect(events[4]?.fields.attempt).toBe(2);
    expect(events[5]?.fields.attempt).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Group 2: what is taken from the tree
// ---------------------------------------------------------------------------

describe('prepareAcceptance: what is taken from the tree', () => {
  it('sneaky files are excluded, worktree and tmpdir cleaned, git status clean', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'new test content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
          // Sneaky extra files:
          writeFileSync(join(cwd, outDir, 'extra.ts'), 'sneaky extra');
          mkdirSync(join(cwd, 'src'), { recursive: true });
          writeFileSync(join(cwd, 'src', 'sneaky.ts'), 'sneaky src');
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const paths = result.files.map((f) => f.path);
      expect(paths).not.toContain(`${outDir}/extra.ts`);
      expect(paths).not.toContain('src/sneaky.ts');
      expect(paths.some((p) => p.endsWith('new.test.ts'))).toBe(true);
      expect(paths.some((p) => p.endsWith('MAP.md'))).toBe(true);
    }

    // git status --porcelain should be empty (main repo not modified).
    const statusOut = await git(root, ['status', '--porcelain']);
    expect(statusOut.trim()).toBe('');

    // git worktree list should have only 1 line (main).
    const worktreeOut = await git(root, ['worktree', 'list']);
    expect(worktreeOut.trim().split('\n')).toHaveLength(1);

    // No collie-accept-* leftover in private tmpdir.
    const leftover = readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'));
    expect(leftover).toHaveLength(0);
  });

  it('batch has [保持] but no keep.test.ts → not ok', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = batchWithKeep();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'new test');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
          // No keep.test.ts!
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.includes('keep.test.ts'))).toBe(true);
    }
  });

  it('no [保持] scenarios but tester writes keep.test.ts → files do not include it', async () => {
    const { root, headSha } = await createTestRepo();
    // Only new scenarios, no keep.
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'new test');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
          writeFileSync(join(cwd, outDir, 'keep.test.ts'), 'keep content');
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const paths = result.files.map((f) => f.path);
      expect(paths.some((p) => p.endsWith('keep.test.ts'))).toBe(false);
    }
  });

  it('no MAP.md → not ok', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'new test');
          // No MAP.md!
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems.some((p) => p.includes('MAP.md'))).toBe(true);
    }
  });

  it('injected redCheck throws → error propagates, worktree still removed', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => {
      throw new Error('boom from red check');
    };
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
    ]);

    await expect(
      prepareAcceptance({
        root,
        headSha,
        batch,
        config,
        runner,
        testerMax: 1,
        redCheckOpts: dummyRedCheckOpts(),
        redCheck: fakeRedCheck,
      }),
    ).rejects.toThrow('boom from red check');

    // Worktree must still be cleaned up.
    const worktreeOut = await git(root, ['worktree', 'list']);
    expect(worktreeOut.trim().split('\n')).toHaveLength(1);

    const leftover = readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'));
    expect(leftover).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Group 3: real red check
// ---------------------------------------------------------------------------

describe('prepareAcceptance: real red check', () => {
  it('FakeRunner writes failing tests, real runRedCheck judges them → ok=true', async () => {
    const { root } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;

    // Write a vitest config in the repo so the worktree has one.
    writeFileSync(
      join(root, 'vitest.config.ts'),
      `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['**/*.test.ts'] } });
`,
    );
    // Symlink node_modules into the repo root so the worktree picks them up.
    const repoNodeModules = join(repoRoot, 'node_modules');
    if (!existsSync(join(root, 'node_modules'))) {
      symlinkSync(repoNodeModules, join(root, 'node_modules'));
    }
    // Commit vitest.config.ts so it's in the worktree (identity from env, SPEC 16.13).
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-q', '-m', 'add vitest config']);
    const newHead = await revParse(root, 'HEAD');

    // The FakeRunner writes two failing test cases and a MAP.md.
    const failingTestContent = `import { describe, expect, it } from 'vitest';

describe('new feature', () => {
  it('should do X', () => {
    expect(1).toBe(2);
  });
  it('should do Y', () => {
    expect('a').toBe('b');
  });
});
`;
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), failingTestContent);
          writeFileSync(
            join(cwd, outDir, 'MAP.md'),
            '# MAP\n| S1 | new feature > should do X |\n| S1 | new feature > should do Y |\n',
          );
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha: newHead,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: {
        timeoutMs: 240_000,
        spawn: execFile,
      },
      // No redCheck injection — uses real runRedCheck.
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(1);
      expect(result.files.some((f) => f.path.endsWith('new.test.ts'))).toBe(true);
      expect(result.files.some((f) => f.path.endsWith('MAP.md'))).toBe(true);
    }

    // No collie-accept-* leftover in private tmpdir (SPEC 16.14, restored from v046-b09).
    const leftover = readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'));
    expect(leftover).toHaveLength(0);
  }, 300_000);
});

// ---------------------------------------------------------------------------
// Group 4: reports, reasons, and early stop (SPEC 16.13, v046-b10)
// ---------------------------------------------------------------------------

describe('prepareAcceptance: reports and early stop', () => {
  it('misclassified in reply JSON → tester called once, reason=misclassified, reports has 1 entry', async () => {
    // testerMax=2, first red check fails, reply has misclassified → no second attempt.
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());
    const replyWithMisclassified = [
      'Some text here.',
      '```json',
      '{ "misclassified": ["S1 was labelled new but is keep"] }',
      '```',
    ].join('\n');
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyWithMisclassified },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    if (!result.ok) {
      expect(result.reason).toBe('misclassified' satisfies AcceptanceFailReason);
      expect(result.reports).toHaveLength(1);
      expect(result.reports[0]).toBe(replyWithMisclassified);
      expect(result.problems.length).toBeGreaterThan(0);
    }
    // Tester was only called once despite testerMax=2.
    expect(runner.calls).toHaveLength(1);
  });

  it('red check fails, reply has no JSON block → retries normally', async () => {
    // Same scenario but reply has no JSON fence → second attempt runs.
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());
    const replyNoJson = 'I wrote the tests but they did not pass red check.';
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyNoJson },
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyNoJson },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    // Both attempts ran.
    expect(runner.calls).toHaveLength(2);
  });

  it('reports present on success, length equals attempts', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    let callCount = 0;
    const fakeRedCheck: RedCheckFn = () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? failRedCheck() : okRedCheck());
    };
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: 'reply one' },
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: 'reply two' },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reports).toHaveLength(2);
      expect(result.reports[0]).toBe('reply one');
      expect(result.reports[1]).toBe('reply two');
    }
  });

  it('reason=red_check when both red checks fail', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0 },
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0 },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('red_check' satisfies AcceptanceFailReason);
    }
  });

  it('reason=tester_failed when tester exits non-zero', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        result: { exitCode: 42 },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('tester_failed' satisfies AcceptanceFailReason);
      expect(result.reports).toHaveLength(1);
      expect(result.reports[0]).toBe('');
    }
  });

  it('misclassified as empty array → retries normally', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());
    const replyEmptyMisclassified = ['```json', '{ "misclassified": [] }', '```'].join('\n');
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyEmptyMisclassified },
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyEmptyMisclassified },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    expect(runner.calls).toHaveLength(2);
  });

  it('non-zero exit → next prompt has the exit code', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    let callCount = 0;
    const fakeRedCheck: RedCheckFn = () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? failRedCheck() : okRedCheck());
    };
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        result: { exitCode: 7 },
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: 'ok second time' },
      },
    ]);

    await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    // The second call's prompt should mention exit code 7.
    expect(runner.calls).toHaveLength(2);
    const secondPrompt = runner.calls[1]?.prompt ?? '';
    expect(secondPrompt).toContain('7');
    expect(secondPrompt).toContain('exited');
  });

  it('tester prompt includes both SPEC.md and CONSTRAINTS.md', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0 },
      },
    ]);

    await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(runner.calls).toHaveLength(1);
    const prompt = runner.calls[0]?.prompt ?? '';
    expect(prompt).toContain('SPEC.md');
    expect(prompt).toContain('CONSTRAINTS.md');
  });

  it('addWorktree fails (bad headSha) → error thrown, worktree list has 1 line, no collie-accept-* leftover', async () => {
    const { root } = await createTestRepo();
    const batch = testBatch();
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());
    const runner = new FakeRunner([]);

    await expect(
      prepareAcceptance({
        root,
        headSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        batch,
        config,
        runner,
        testerMax: 1,
        redCheckOpts: dummyRedCheckOpts(),
        redCheck: fakeRedCheck,
      }),
    ).rejects.toThrow();

    // git worktree list should have only 1 line.
    const worktreeOut = await git(root, ['worktree', 'list']);
    expect(worktreeOut.trim().split('\n')).toHaveLength(1);

    // No collie-accept-* leftover in private tmpdir.
    const leftover = readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'));
    expect(leftover).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Group 5: tester events, signal, and misclassified list (SPEC 16.14, v046-b12)
// ---------------------------------------------------------------------------

describe('prepareAcceptance: tester events, signal and misclassified list', () => {
  it('tester.finished has exit_code, num_turns, cost_usd and no exitCode key; events go through onTesterEvent', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        events: [{ type: 'fake-event', data: 'hello' }],
        result: { exitCode: 0, numTurns: 7, costUsd: 0.5 },
      },
    ]);

    const events: { event: string; fields: Record<string, unknown> }[] = [];
    const record: RecordFn = (event, fields) => {
      events.push({ event, fields });
    };

    const testerEvents: { attempt: number; event: unknown }[] = [];

    await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
      record,
      onTesterEvent: (attempt, event) => {
        testerEvents.push({ attempt, event });
      },
    });

    // Check tester.finished event has exit_code (not exitCode), num_turns, cost_usd.
    const finished = events.find((e) => e.event === 'tester.finished');
    expect(finished).toBeDefined();
    expect(finished?.fields.exit_code).toBe(0);
    expect(finished?.fields.num_turns).toBe(7);
    expect(finished?.fields.cost_usd).toBe(0.5);
    // Must NOT have the old exitCode key.
    expect(finished !== undefined && 'exitCode' in finished.fields).toBe(false);

    // Check onTesterEvent received the events with attempt=1.
    expect(testerEvents).toHaveLength(1);
    expect(testerEvents[0]?.attempt).toBe(1);
    expect(testerEvents[0]?.event).toEqual({ type: 'fake-event', data: 'hello' });
  });

  it('signal aborted before next attempt → tester_failed, no second invocation', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());

    // Create a pre-aborted signal.
    const ac = new AbortController();
    ac.abort();

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0 },
      },
      {
        expectRole: 'tester',
        result: { exitCode: 0 },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
      signal: ac.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('tester_failed' satisfies AcceptanceFailReason);
    }
    // Signal was aborted before first attempt, so no invocations.
    expect(runner.calls).toHaveLength(0);
  });

  it('misclassified as {id,why} objects → misclassified array formatted with ：, no [object Object]', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());

    const replyWithObjMisclassified = [
      'Some text.',
      '```json',
      '{ "misclassified": [{ "id": "S1", "why": "已有行为" }] }',
      '```',
    ].join('\n');

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyWithObjMisclassified },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('misclassified' satisfies AcceptanceFailReason);
      expect(result.misclassified).toEqual(['S1：已有行为']);
      // Must not contain [object Object].
      for (const m of result.misclassified) {
        expect(m).not.toContain('[object Object]');
      }
    }
  });

  it('misclassified as plain strings still works', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());

    const replyWithStringMisclassified = [
      'Text.',
      '```json',
      '{ "misclassified": ["S1 was labelled new but is keep"] }',
      '```',
    ].join('\n');

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0, finalText: replyWithStringMisclassified },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('misclassified' satisfies AcceptanceFailReason);
      expect(result.misclassified).toEqual(['S1 was labelled new but is keep']);
    }
  });

  it('failure without misclassified → misclassified is empty array', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(failRedCheck());

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'test("a", () => {});');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: { exitCode: 0 },
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 1,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.misclassified).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 6: abort and runner errors (SPEC 16.15, v046-b16)
// ---------------------------------------------------------------------------

describe('prepareAcceptance: abort and runner errors', () => {
  it('runner throws while signal is aborted → ok false, attempts 1, reason tester_failed, one invocation, cleanup done', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());

    // AbortController that aborts during the first (and only) effect.
    const ac = new AbortController();

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: () => {
          // Abort the signal mid-run, so throwIfAborted fires after the effect.
          ac.abort();
        },
        result: OK_RESULT,
      },
      // Second scene should NOT be consumed.
      {
        expectRole: 'tester',
        result: OK_RESULT,
      },
    ]);

    const events: { event: string; fields: Record<string, unknown> }[] = [];
    const record: RecordFn = (event, fields) => {
      events.push({ event, fields });
    };

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
      record,
      signal: ac.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    if (!result.ok) {
      expect(result.reason).toBe('tester_failed' satisfies AcceptanceFailReason);
    }
    // Runner called only once.
    expect(runner.calls).toHaveLength(1);

    // Record has tester.started and tester.finished, finished has error.
    const startedEvents = events.filter((e) => e.event === 'tester.started');
    const finishedEvents = events.filter((e) => e.event === 'tester.finished');
    expect(startedEvents).toHaveLength(1);
    expect(finishedEvents).toHaveLength(1);
    expect(finishedEvents[0]?.fields.error).toBeDefined();
    expect(typeof finishedEvents[0]?.fields.error).toBe('string');

    // No collie-accept-* leftover in private tmpdir.
    const leftover = readdirSync(privateTmpDir).filter((n) => n.startsWith('collie-accept-'));
    expect(leftover).toHaveLength(0);
  });

  it('runner throws normal error on attempt 1, attempt 2 succeeds → ok true, attempts 2, prompt has error info', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());

    const runner = new FakeRunner([
      // Attempt 1: runner throws a normal error.
      {
        expectRole: 'tester',
        error: new Error('model API 503'),
      },
      // Attempt 2: succeeds.
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        result: OK_RESULT,
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    // The second call's prompt should mention the error from attempt 1.
    expect(runner.calls).toHaveLength(2);
    const secondPrompt = runner.calls[1]?.prompt ?? '';
    expect(secondPrompt).toContain('model API 503');
  });

  it('runner throws twice → tester_failed, attempts 2, problems has error info', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const fakeRedCheck: RedCheckFn = () => Promise.resolve(okRedCheck());

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        error: new Error('error one'),
      },
      {
        expectRole: 'tester',
        error: new Error('error two'),
      },
    ]);

    const result = await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
    });

    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(2);
    if (!result.ok) {
      expect(result.reason).toBe('tester_failed' satisfies AcceptanceFailReason);
      expect(result.problems.some((p) => p.includes('error two'))).toBe(true);
    }
  });

  it('onTesterEvent receives attempt=2 on second invocation', async () => {
    const { root, headSha } = await createTestRepo();
    const batch = testBatch();
    const outDir = `test/acceptance/${batch.id}`;
    let callCount = 0;
    const fakeRedCheck: RedCheckFn = () => {
      callCount++;
      return Promise.resolve(callCount === 1 ? failRedCheck() : okRedCheck());
    };

    const runner = new FakeRunner([
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        events: [{ type: 'ev1' }],
        result: OK_RESULT,
      },
      {
        expectRole: 'tester',
        effect: ({ cwd }) => {
          mkdirSync(join(cwd, outDir), { recursive: true });
          writeFileSync(join(cwd, outDir, 'new.test.ts'), 'content');
          writeFileSync(join(cwd, outDir, 'MAP.md'), '# MAP\n');
        },
        events: [{ type: 'ev2' }],
        result: OK_RESULT,
      },
    ]);

    const testerEvents: { attempt: number; event: unknown }[] = [];

    await prepareAcceptance({
      root,
      headSha,
      batch,
      config,
      runner,
      testerMax: 2,
      redCheckOpts: dummyRedCheckOpts(),
      redCheck: fakeRedCheck,
      onTesterEvent: (attempt, event) => {
        testerEvents.push({ attempt, event });
      },
    });

    // Should have events from both invocations.
    expect(testerEvents).toHaveLength(2);
    expect(testerEvents[0]?.attempt).toBe(1);
    expect(testerEvents[1]?.attempt).toBe(2);
  });
});
