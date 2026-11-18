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
import { afterAll, describe, expect, it } from 'vitest';
import { prepareAcceptance, type RecordFn, type RedCheckFn } from '../src/acceptance.js';
import { git, revParse } from '../src/git.js';
import type { RunRedCheckOpts, RunRedCheckResult } from '../src/redcheck.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { RunResult } from '../src/runner/index.js';
import type { Batch } from '../src/schema/index.js';
import { templateConfig } from './support/template-config.js';

const config = templateConfig();
const repoRoot = join(import.meta.dirname, '..');

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

/** Creates a minimal git repo suitable for prepareAcceptance. */
async function createTestRepo(): Promise<{ root: string; headSha: string; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'collie-pa-test-'));
  tempDirs.push(dir);
  const root = dir;

  // Set up git config for this repo.
  const configFile = join(dir, '.gitconfig');
  writeFileSync(
    configFile,
    '[user]\n\tname = Test\n\temail = test@example.invalid\n[init]\n\tdefaultBranch = main\n[gc]\n\tauto = 0\n',
  );
  const savedGlobal = process.env.GIT_CONFIG_GLOBAL;
  const savedNoSystem = process.env.GIT_CONFIG_NOSYSTEM;
  process.env.GIT_CONFIG_GLOBAL = configFile;
  process.env.GIT_CONFIG_NOSYSTEM = '1';

  await git(root, ['init', '-q']);
  // Write AGENT-tester.md so runTester can read it.
  writeFileSync(join(root, 'AGENT-tester.md'), '# Tester Manual\n');
  writeFileSync(join(root, 'dummy.txt'), 'hello\n');
  await git(root, ['add', '-A']);
  await git(root, ['commit', '-q', '-m', 'initial']);
  const headSha = await revParse(root, 'HEAD');

  // Restore env.
  if (savedGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
  else process.env.GIT_CONFIG_GLOBAL = savedGlobal;
  if (savedNoSystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = savedNoSystem;

  return { root, headSha, dir };
}

afterAll(() => {
  for (const d of tempDirs) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
  // Verify no collie-accept-* directories remain in TMPDIR.
  const leftover = readdirSync(tmpdir()).filter((n) => n.startsWith('collie-accept-'));
  expect(leftover, 'collie-accept-* leftovers in TMPDIR').toHaveLength(0);
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

    // No collie-accept-* leftover in tmpdir.
    const leftover = readdirSync(tmpdir()).filter((n) => n.startsWith('collie-accept-'));
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

    const leftover = readdirSync(tmpdir()).filter((n) => n.startsWith('collie-accept-'));
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
    // Commit vitest.config.ts so it's in the worktree.
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
        timeoutMs: 30_000,
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
  });
});
