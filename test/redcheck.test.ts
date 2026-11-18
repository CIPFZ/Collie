// Tests for src/redcheck.ts (SPEC 16.10, v046-b03).
//
// judgeRedCheck: each judgment criterion gets one test with hand-crafted reports.
// runRedCheck: four scenarios use real vitest on real test files in a temp dir
//   (temp dir named collie-redcheck-*, node_modules symlinked, cleaned up after).
// Timeout: one scenario injects a fake spawn that never finishes.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VitestJsonReport } from '../src/redcheck.js';
import { judgeRedCheck, runRedCheck } from '../src/redcheck.js';

const repoRoot = join(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Private temp directory: each test suite uses its own TMPDIR so the
// "no collie-redcheck-* leftover" assertion doesn't collide with other
// processes or tests. SPEC 16.13.
// ---------------------------------------------------------------------------
let privateTmpDir: string;
let savedTmpDir: string | undefined;

beforeEach(() => {
  privateTmpDir = mkdtempSync(join(tmpdir(), 'collie-rc-suite-'));
  savedTmpDir = process.env.TMPDIR;
  process.env.TMPDIR = privateTmpDir;
});

afterEach(() => {
  if (savedTmpDir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = savedTmpDir;
  if (existsSync(privateTmpDir)) rmSync(privateTmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers for building fake vitest JSON reports
// ---------------------------------------------------------------------------

function makeReport(overrides: Partial<VitestJsonReport> = {}): VitestJsonReport {
  return {
    numTotalTests: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        assertionResults: [{ status: 'failed', fullName: 'test > should work' }],
      },
    ],
    ...overrides,
  };
}

function allFailReport(names: string[]): VitestJsonReport {
  return {
    numTotalTests: names.length,
    numPassedTests: 0,
    numFailedTests: names.length,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        assertionResults: names.map((n) => ({ status: 'failed', fullName: n })),
      },
    ],
  };
}

function allPassReport(names: string[]): VitestJsonReport {
  return {
    numTotalTests: names.length,
    numPassedTests: names.length,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        assertionResults: names.map((n) => ({ status: 'passed', fullName: n })),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// judgeRedCheck: pure function tests
// ---------------------------------------------------------------------------

describe('judgeRedCheck', () => {
  it('passes when all new tests fail', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A', 'test B']),
    });
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);
  });

  it('fails when new has a passing test, naming it', () => {
    const report = makeReport({
      numTotalTests: 2,
      numPassedTests: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            { status: 'failed', fullName: 'test A' },
            { status: 'passed', fullName: 'test B' },
          ],
        },
      ],
    });
    const result = judgeRedCheck({ newReport: report });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    const p = result.problems.find((x) => x.testName === 'test B');
    expect(p).toBeDefined();
    expect(p?.file).toBe('new');
    expect(p?.reason).toContain('passed');
  });

  it('fails when new has a skipped test', () => {
    const report = makeReport({
      numTotalTests: 2,
      numPendingTests: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            { status: 'failed', fullName: 'test A' },
            { status: 'skipped', fullName: 'test B' },
          ],
        },
      ],
    });
    const result = judgeRedCheck({ newReport: report });
    expect(result.ok).toBe(false);
    expect(
      result.problems.some((p) => p.testName === 'test B' && p.reason.includes('skipped')),
    ).toBe(true);
  });

  it('fails when new has a todo test', () => {
    const report = makeReport({
      numTotalTests: 2,
      numTodoTests: 1,
      numFailedTests: 1,
      testResults: [
        {
          assertionResults: [
            { status: 'failed', fullName: 'test A' },
            { status: 'todo', fullName: 'test C' },
          ],
        },
      ],
    });
    const result = judgeRedCheck({ newReport: report });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.testName === 'test C' && p.reason.includes('todo'))).toBe(
      true,
    );
  });

  it('fails when new report is null (file load error)', () => {
    const result = judgeRedCheck({ newReport: null });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(
      result.problems.some((p) => p.file === 'new' && p.reason.includes('file load failed')),
    ).toBe(true);
  });

  it('fails when new has zero test cases (file load error)', () => {
    const report = makeReport({
      numTotalTests: 0,
      numFailedTests: 0,
      testResults: [{ assertionResults: [] }],
    });
    const result = judgeRedCheck({ newReport: report });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.reason.includes('zero test cases'))).toBe(true);
  });

  it('passes when no keep file (keepReport undefined)', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A']),
      keepReport: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it('passes when keep report is null (no keep file)', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A']),
      keepReport: null,
    });
    expect(result.ok).toBe(true);
  });

  it('passes when new all fail and keep all pass', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A']),
      keepReport: allPassReport(['keep 1', 'keep 2']),
    });
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);
  });

  it('fails when keep has a failing test, naming it', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A']),
      keepReport: makeReport({
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1,
        testResults: [
          {
            assertionResults: [
              { status: 'passed', fullName: 'keep 1' },
              { status: 'failed', fullName: 'keep 2' },
            ],
          },
        ],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    const kp = result.problems.find((x) => x.testName === 'keep 2');
    expect(kp).toBeDefined();
    expect(kp?.file).toBe('keep');
    expect(kp?.reason).toContain('failed');
  });

  it('fails when keep has zero test cases', () => {
    const result = judgeRedCheck({
      newReport: allFailReport(['test A']),
      keepReport: makeReport({
        numTotalTests: 0,
        numFailedTests: 0,
        testResults: [{ assertionResults: [] }],
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.file === 'keep' && p.reason.includes('zero'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runRedCheck: real vitest integration tests
// ---------------------------------------------------------------------------

// Track all temp directories so we can verify cleanup at the end.
const createdTempDirs: string[] = [];

function createTestTree(): string {
  const dir = mkdtempSync(join(privateTmpDir, 'collie-redcheck-'));
  createdTempDirs.push(dir);
  // Link node_modules from repo root so vitest is available.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'));
  // Minimal vitest config.
  writeFileSync(
    join(dir, 'vitest.config.ts'),
    `import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['**/*.test.ts'] } });
`,
  );
  return dir;
}

function writeTestFile(tree: string, relPath: string, content: string): void {
  const full = join(tree, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

afterAll(() => {
  // Clean up any remaining test trees.
  for (const d of createdTempDirs) {
    if (existsSync(d)) {
      rmSync(d, { recursive: true, force: true });
    }
  }
});

describe('runRedCheck (real vitest)', () => {
  it('passes when new has two failing tests', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
  it('fails B', () => { expect(3).toBe(4); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, { timeoutMs: 60_000, spawn: execFile });
    expect(result.ok).toBe(true);
    expect(result.newTestCount).toBe(2);
    expect(result.keepTestCount).toBe(0);
    expect(result.problems).toHaveLength(0);

    rmSync(tree, { recursive: true, force: true });
  });

  it('fails when new has one pass and one fail, naming the passing test', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
  it('passes B', () => { expect(1).toBe(1); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, { timeoutMs: 60_000, spawn: execFile });
    expect(result.ok).toBe(false);
    expect(result.newTestCount).toBe(2);
    // The passing test should be named in the problems.
    const passingProblem = result.problems.find(
      (p) => p.file === 'new' && p.reason.includes('passed'),
    );
    expect(passingProblem).toBeDefined();
    expect(passingProblem?.testName).toContain('passes B');

    rmSync(tree, { recursive: true, force: true });
  });

  it('fails when new file has an import error (file load failure)', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { nonExistentFunction } from './this-module-does-not-exist.js';
nonExistentFunction();
`,
    );

    const result = await runRedCheck(tree, outDir, { timeoutMs: 60_000, spawn: execFile });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThanOrEqual(1);
    expect(
      result.problems.some((p) => p.file === 'new' && p.reason.includes('file load failed')),
    ).toBe(true);

    rmSync(tree, { recursive: true, force: true });
  });

  it('fails when new all fail but keep has one failing test, naming it', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
});
`,
    );
    writeTestFile(
      tree,
      `${outDir}/keep.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('keep', () => {
  it('passes K1', () => { expect(1).toBe(1); });
  it('fails K2', () => { expect(1).toBe(2); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, { timeoutMs: 60_000, spawn: execFile });
    expect(result.ok).toBe(false);
    expect(result.newTestCount).toBe(1);
    expect(result.keepTestCount).toBe(2);
    const keepProblem = result.problems.find(
      (p) => p.file === 'keep' && p.reason.includes('failed'),
    );
    expect(keepProblem).toBeDefined();
    expect(keepProblem?.testName).toContain('fails K2');

    rmSync(tree, { recursive: true, force: true });
  });

  it('fails on timeout with injected fake spawn', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => { it('fails', () => { expect(1).toBe(2); }); });
`,
    );

    // Fake spawn that immediately calls back with a killed error.
    const fakeSpawn = (
      _file: string,
      _args: readonly string[],
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      const err = Object.assign(new Error('timed out'), { killed: true, code: null });
      // Simulate timeout: call back asynchronously.
      setTimeout(() => {
        callback(err);
      }, 10);
      // Return a fake ChildProcess with unref.
      return {
        unref: () => {
          /* noop */
        },
      };
    };

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 100,
      spawn: fakeSpawn as unknown as typeof execFile,
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(result.problems.some((p) => p.reason.includes('timeout'))).toBe(true);

    rmSync(tree, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// runRedCheck: static commands and missing reports (SPEC 16.11, v046-b05)
// ---------------------------------------------------------------------------

describe('runRedCheck: static commands and missing reports', () => {
  it('static command with exit 0 passes alongside failing new tests', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
  it('fails B', () => { expect(3).toBe(4); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: execFile,
      staticCommands: ['exit 0'],
    });
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);

    rmSync(tree, { recursive: true, force: true });
  });

  it('static command with non-zero exit fails, records exit code and output', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
  it('fails B', () => { expect(3).toBe(4); });
});
`,
    );

    const cmdText = 'echo boom && exit 3';
    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: execFile,
      staticCommands: [cmdText],
    });
    expect(result.ok).toBe(false);
    const p = result.problems.find((x) => x.file === 'static');
    expect(p).toBeDefined();
    expect(p?.testName).toBe(cmdText);
    expect(p?.reason).toContain('3');
    expect(p?.reason).toContain('boom');

    rmSync(tree, { recursive: true, force: true });
  });

  it('two static commands, first passes second fails — only second problem recorded', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails A', () => { expect(1).toBe(2); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: execFile,
      staticCommands: ['exit 0', 'echo oops && exit 1'],
    });
    expect(result.ok).toBe(false);
    const staticProblems = result.problems.filter((x) => x.file === 'static');
    expect(staticProblems).toHaveLength(1);
    expect(staticProblems[0]?.testName).toBe('echo oops && exit 1');

    rmSync(tree, { recursive: true, force: true });
  });

  it('test problems and static problems coexist in the result', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    // new.test.ts has one pass (a test problem) + a failing static command
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('passes unexpectedly', () => { expect(1).toBe(1); });
});
`,
    );

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: execFile,
      staticCommands: ['exit 7'],
    });
    expect(result.ok).toBe(false);
    const testProblems = result.problems.filter((x) => x.file === 'new');
    const staticProblems = result.problems.filter((x) => x.file === 'static');
    expect(testProblems.length).toBeGreaterThanOrEqual(1);
    expect(staticProblems.length).toBeGreaterThanOrEqual(1);

    rmSync(tree, { recursive: true, force: true });
  });

  it('static command timeout records timeout problem', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails', () => { expect(1).toBe(2); });
});
`,
    );

    // Fake spawn that simulates vitest (first two calls) then a static timeout (third call).
    let callCount = 0;
    const fakeSpawn = (
      file: string,
      args: readonly string[],
      options: unknown,
      callback: (error: Error | null, stdout?: string | Buffer, stderr?: string | Buffer) => void,
    ) => {
      callCount++;
      if (file === 'sh') {
        // Static command invocation — simulate timeout
        const err = Object.assign(new Error('timed out'), { killed: true, code: null });
        setTimeout(() => {
          callback(err);
        }, 10);
      } else {
        // vitest invocation — delegate to real execFile
        return execFile(file, args as string[], options as Record<string, unknown>, callback);
      }
      return {
        unref: () => {
          /* noop */
        },
      };
    };

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: fakeSpawn as unknown as typeof execFile,
      staticCommands: ['sleep 999'],
    });
    expect(result.ok).toBe(false);
    const staticProblems = result.problems.filter((x) => x.file === 'static');
    expect(staticProblems).toHaveLength(1);
    expect(staticProblems[0]?.reason).toContain('timeout');
    expect(callCount).toBeGreaterThanOrEqual(2); // at least vitest + static

    rmSync(tree, { recursive: true, force: true });
  });

  it('no staticCommands means no static commands are executed', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails', () => { expect(1).toBe(2); });
});
`,
    );

    // Count spawn calls
    let spawnCalls = 0;
    const countingSpawn = (
      file: string,
      args: readonly string[],
      options: unknown,
      callback: (error: Error | null, stdout?: string | Buffer, stderr?: string | Buffer) => void,
    ) => {
      spawnCalls++;
      return execFile(file, args as string[], options as Record<string, unknown>, callback);
    };

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: countingSpawn as unknown as typeof execFile,
      // no staticCommands
    });
    expect(result.ok).toBe(true);
    // Only 1 spawn call: new.test.ts. No static commands.
    expect(spawnCalls).toBe(1);

    rmSync(tree, { recursive: true, force: true });
  });

  it('keep.test.ts exists but no report produced — not ok with reason', async () => {
    const tree = createTestTree();
    const outDir = 'acceptance';
    writeTestFile(
      tree,
      `${outDir}/new.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('new', () => {
  it('fails', () => { expect(1).toBe(2); });
});
`,
    );
    writeTestFile(
      tree,
      `${outDir}/keep.test.ts`,
      `import { describe, expect, it } from 'vitest';
describe('keep', () => {
  it('passes', () => { expect(1).toBe(1); });
});
`,
    );

    // Fake spawn: real for new.test.ts (first call), no-report for keep.test.ts (second call)
    let callIdx = 0;
    const fakeSpawn = (
      file: string,
      args: readonly string[],
      options: unknown,
      callback: (error: Error | null, stdout?: string | Buffer, stderr?: string | Buffer) => void,
    ) => {
      callIdx++;
      if (callIdx === 1) {
        // First call: new.test.ts — run real vitest
        return execFile(file, args as string[], options as Record<string, unknown>, callback);
      }
      // Second call: keep.test.ts — simulate vitest that produces no report file
      setTimeout(() => {
        // vitest exits non-zero but writes no report
        const err = Object.assign(new Error('segfault'), { code: 1 });
        callback(err);
      }, 10);
      return {
        unref: () => {
          /* noop */
        },
      };
    };

    const result = await runRedCheck(tree, outDir, {
      timeoutMs: 60_000,
      spawn: fakeSpawn as unknown as typeof execFile,
    });
    expect(result.ok).toBe(false);
    const keepProblem = result.problems.find(
      (p) => p.file === 'keep' && p.reason.includes('no report produced'),
    );
    expect(keepProblem).toBeDefined();

    rmSync(tree, { recursive: true, force: true });
  });
});
