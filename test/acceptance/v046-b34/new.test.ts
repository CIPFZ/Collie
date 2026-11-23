// Acceptance tests for v046-b34 — [新] scenario S1.
// S1: error message for disallowed path uses "paths under .github/" not ".github/*".
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
// S1: SPEC.md disallowed — message wording uses "paths under .github/"
// ---------------------------------------------------------------------------

describe('S1: SPEC.md rejection message uses new wording', () => {
  it('S1: error message contains "only .github, paths under .github/, eslint.config.js, vitest.config.ts"', () => {
    const text = backlogAllowedProtected(['- SPEC.md']);
    expect(() => parseBacklog(text)).toThrow(BacklogError);
    try {
      parseBacklog(text);
    } catch (err) {
      expect(err).toBeInstanceOf(BacklogError);
      if (err instanceof BacklogError) {
        expect(err.message).toContain(
          'only .github, paths under .github/, eslint.config.js, vitest.config.ts',
        );
      }
    }
  });

  it('S1: error message does not contain ".github/*"', () => {
    const text = backlogAllowedProtected(['- SPEC.md']);
    try {
      parseBacklog(text);
    } catch (err) {
      expect(err).toBeInstanceOf(BacklogError);
      if (err instanceof BacklogError) {
        expect(err.message).not.toContain('.github/*');
      }
    }
  });
});
