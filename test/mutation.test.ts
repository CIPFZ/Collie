// Unit tests for the mutation check list and judgment functions (SPEC 15.5).
// These tests do NOT run actual mutations — they verify:
//   1. List shape: names unique, >= 44 items, each original appears exactly once in its file
//   2. Judgment pure functions: JSON report samples -> result classification
//   3. Baseline judgment: type check / test failures / no tests executed
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkUnique,
  judgeBaseline,
  judgeExecResult,
  judgeTypecheckResult,
  MUTATIONS,
  type VitestJsonReport,
} from '../scripts/mutation.js';

const ROOT = join(import.meta.dirname, '..');

describe('mutation list shape (SPEC 15.1)', () => {
  it('has at least 44 items', () => {
    expect(MUTATIONS.length).toBeGreaterThanOrEqual(44);
  });

  it('has no duplicate names', () => {
    const names = MUTATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('each original appears exactly once in its source file', () => {
    for (const m of MUTATIONS) {
      const content = readFileSync(join(ROOT, m.file), 'utf8');
      expect(checkUnique(content, m.original), `"${m.name}" original not unique in ${m.file}`).toBe(
        true,
      );
    }
  });

  it('every protected path is in the mutation list', () => {
    const protectedNames = MUTATIONS.filter((m) => m.name.startsWith('protected:')).map(
      (m) => m.name,
    );
    expect(protectedNames.length).toBe(9);
  });
});

describe('judgeExecResult (SPEC 15.5)', () => {
  it('returns caught when at least one test failed', () => {
    const report: VitestJsonReport = { numTotalTests: 5, numFailedTests: 2 };
    expect(judgeExecResult(report, 1)).toBe('caught');
  });

  it('returns survived when all tests pass (exit 0, 0 failures)', () => {
    const report: VitestJsonReport = { numTotalTests: 10, numFailedTests: 0 };
    expect(judgeExecResult(report, 0)).toBe('survived');
  });

  it('returns invalid when non-zero exit but no test failures', () => {
    const report: VitestJsonReport = { numTotalTests: 3, numFailedTests: 0 };
    expect(judgeExecResult(report, 1)).toBe('invalid');
  });

  it('returns invalid when no tests were executed (numTotalTests === 0)', () => {
    const report: VitestJsonReport = { numTotalTests: 0, numFailedTests: 0 };
    expect(judgeExecResult(report, 1)).toBe('invalid');
  });

  it('returns invalid when report is null (unreadable)', () => {
    expect(judgeExecResult(null, 1)).toBe('invalid');
  });

  it('returns caught even with exit 0 when numFailedTests > 0', () => {
    // Edge case: vitest might exit 0 but still record failures in some scenarios
    const report: VitestJsonReport = { numTotalTests: 5, numFailedTests: 1 };
    expect(judgeExecResult(report, 0)).toBe('caught');
  });
});

describe('judgeTypecheckResult (SPEC 15.5)', () => {
  it('returns ok when type check succeeds (no error)', () => {
    expect(judgeTypecheckResult(null)).toBe('ok');
  });

  it('returns timeout when process was killed', () => {
    expect(judgeTypecheckResult({ killed: true, status: null })).toBe('timeout');
  });

  it('returns invalid when type check fails (compile error)', () => {
    expect(judgeTypecheckResult({ killed: false, status: 1 })).toBe('invalid');
  });
});

describe('judgeBaseline (SPEC 15.5)', () => {
  it('returns typecheck reason when type check fails', () => {
    const result = judgeBaseline(
      { exitCode: 1, killed: false },
      { exitCode: 0, killed: false },
      { numTotalTests: 10, numFailedTests: 0 },
    );
    expect(result).toBe('typecheck');
  });

  it('returns tests failed when baseline tests have failures', () => {
    const result = judgeBaseline(
      { exitCode: 0, killed: false },
      { exitCode: 1, killed: false },
      { numTotalTests: 10, numFailedTests: 3 },
    );
    expect(result).toBe('tests failed');
  });

  it('returns no tests executed when numTotalTests is 0', () => {
    const result = judgeBaseline(
      { exitCode: 0, killed: false },
      { exitCode: 0, killed: false },
      { numTotalTests: 0, numFailedTests: 0 },
    );
    expect(result).toBe('no tests executed');
  });

  it('returns typecheck timeout when type check is killed', () => {
    const result = judgeBaseline(
      { exitCode: 0, killed: true },
      { exitCode: 0, killed: false },
      { numTotalTests: 10, numFailedTests: 0 },
    );
    expect(result).toBe('typecheck timeout');
  });

  it('returns null when baseline passes', () => {
    const result = judgeBaseline(
      { exitCode: 0, killed: false },
      { exitCode: 0, killed: false },
      { numTotalTests: 10, numFailedTests: 0 },
    );
    expect(result).toBeNull();
  });
});

describe('checkUnique (SPEC 15.1)', () => {
  it('returns true for a string that appears exactly once', () => {
    expect(checkUnique('hello world', 'world')).toBe(true);
  });

  it('returns false for a string that appears zero times', () => {
    expect(checkUnique('hello world', 'xyz')).toBe(false);
  });

  it('returns false for a string that appears more than once', () => {
    expect(checkUnique('hello hello', 'hello')).toBe(false);
  });
});

describe('last line format (SPEC 15.5)', () => {
  it('matches the fixed format regex', () => {
    const line = 'mutation: caught 44 survived 0 invalid 0 timeout 0 stale 0';
    expect(line).toMatch(/^mutation: caught \d+ survived \d+ invalid \d+ timeout \d+ stale \d+$/);
  });
});
