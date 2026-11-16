// Unit tests for the mutation check list and judgment function (SPEC 15.3).
// These tests do NOT run actual mutations — they verify:
//   1. List shape: names unique, ≥ 44 items, each original appears exactly once in its file
//   2. Judgment function: process outcomes → result classification
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkUnique, judgeExecResult, MUTATIONS } from '../scripts/mutation.js';

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

describe('judgeExecResult (SPEC 15.1)', () => {
  it('returns survived when process exits cleanly (all tests pass)', () => {
    expect(judgeExecResult(null)).toBe('survived');
  });

  it('returns caught when process exits with non-zero and was not killed', () => {
    expect(judgeExecResult({ killed: false, status: 1 })).toBe('caught');
  });

  it('returns timeout when process was killed (e.g. SIGTERM from timeout)', () => {
    expect(judgeExecResult({ killed: true, status: null })).toBe('timeout');
  });

  it('returns caught when killed is undefined and status is non-zero', () => {
    expect(judgeExecResult({ status: 1 })).toBe('caught');
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
