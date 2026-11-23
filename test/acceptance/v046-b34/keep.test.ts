// Acceptance tests for v046-b34 — [保持] scenarios K1–K5.
// These behaviours must continue to work after the implementation change.
import { describe, expect, it } from 'vitest';
import { parseBacklog, BacklogError } from '../../../src/backlog.js';

// ---------------------------------------------------------------------------
// Helpers — mirrors test/backlog.test.ts 'allowed protected paths' group
// ---------------------------------------------------------------------------

function backlogAllowedProtected(pathLines?: string[]): string {
  const sections: string[] = [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    '| 1 | v99-b01 | 示例功能 | — | pending |',
    '',
    '## v99-b01 示例功能',
    '',
    '优先级：1　依赖：无',
    '',
    '条目：',
    '1. 实现 feature',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    '| 通过 | `npm test` | exit 0 |',
  ];
  if (pathLines !== undefined) {
    sections.push('', '可改的受保护路径：', ...pathLines);
  }
  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// K1: .github/../SPEC.md → BacklogError with the path in message
// ---------------------------------------------------------------------------

describe('K1: .github/../SPEC.md is rejected', () => {
  it('K1: parseBacklog throws BacklogError whose message contains the traversal path', () => {
    const text = backlogAllowedProtected(['- .github/../SPEC.md']);
    expect(() => parseBacklog(text)).toThrow(BacklogError);
    try {
      parseBacklog(text);
    } catch (err) {
      expect(err).toBeInstanceOf(BacklogError);
      if (err instanceof BacklogError) {
        expect(err.message).toContain('.github/../SPEC.md');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// K2: deep traversal path rejected
// ---------------------------------------------------------------------------

describe('K2: .github/workflows/../../docs/backlog.md is rejected', () => {
  it('K2: parseBacklog throws BacklogError for deep traversal path', () => {
    const text = backlogAllowedProtected(['- .github/workflows/../../docs/backlog.md']);
    expect(() => parseBacklog(text)).toThrow(BacklogError);
  });
});

// ---------------------------------------------------------------------------
// K3: absolute, traversal, and glob patterns are all rejected with the path in message
// ---------------------------------------------------------------------------

describe('K3: /etc/x, ../x, .github/*, .github/workflows/?.yml all rejected', () => {
  it.each(['/etc/x', '../x', '.github/*', '.github/workflows/?.yml'])(
    'K3: parseBacklog throws BacklogError for %s and message contains the path',
    (badPath) => {
      const text = backlogAllowedProtected([`- ${badPath}`]);
      expect(() => parseBacklog(text)).toThrow(BacklogError);
      try {
        parseBacklog(text);
      } catch (err) {
        expect(err).toBeInstanceOf(BacklogError);
        if (err instanceof BacklogError) {
          expect(err.message).toContain(badPath);
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------
// K4: four valid paths → allowed_protected in same order
// ---------------------------------------------------------------------------

describe('K4: four valid protected paths accepted in order', () => {
  it('K4: .github, .github/workflows/ci.yml, eslint.config.js, vitest.config.ts → allowed_protected in same order', () => {
    const text = backlogAllowedProtected([
      '- .github',
      '- .github/workflows/ci.yml',
      '- eslint.config.js',
      '- vitest.config.ts',
    ]);
    const batches = parseBacklog(text);
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const batch = batches[0];
    expect(batch).toBeDefined();
    expect(batch?.allowed_protected).toEqual([
      '.github',
      '.github/workflows/ci.yml',
      'eslint.config.js',
      'vitest.config.ts',
    ]);
  });
});

// ---------------------------------------------------------------------------
// K5: no allowed protected section → no allowed_protected key
// ---------------------------------------------------------------------------

describe('K5: no allowed protected section → no key', () => {
  it('K5: batch has no allowed_protected key when section is absent', () => {
    const text = backlogAllowedProtected();
    const batches = parseBacklog(text);
    expect(batches.length).toBeGreaterThanOrEqual(1);
    const batch = batches[0];
    expect(batch).toBeDefined();
    expect('allowed_protected' in (batch ?? {})).toBe(false);
  });
});
