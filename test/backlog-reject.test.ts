import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BacklogError, parseBacklog } from '../src/backlog.js';

/** Frozen copy of docs/backlog.md as issued with v01-b02. */
const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures', 'backlog.md'), 'utf8');

const B01_LINT_ROW = '| 代码规范零错误 | `npm run lint` | exit 0 |';

/** Replaces exactly one occurrence, so a stale fixture fails loudly instead of testing nothing. */
function mutate(from: string, to: string, text = FIXTURE): string {
  const at = text.indexOf(from);
  expect(at, `fixture must contain ${JSON.stringify(from)}`).toBeGreaterThanOrEqual(0);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** 1-based line of the first line containing `needle`. */
function lineOf(text: string, needle: string): number {
  const index = text.split('\n').findIndex((l) => l.includes(needle));
  expect(index, `text must contain ${JSON.stringify(needle)}`).toBeGreaterThanOrEqual(0);
  return index + 1;
}

function backlogError(text: string): BacklogError {
  try {
    parseBacklog(text, 'backlog.md');
  } catch (error) {
    expect(error).toBeInstanceOf(BacklogError);
    if (error instanceof BacklogError) return error;
  }
  throw new Error('expected parseBacklog to throw BacklogError');
}

describe('backlog-reject: acceptance that is not machine-decidable', () => {
  it.each(['exit 1', '人工确认', '质量良好'])(
    'rejects expect column "%s" naming batch and acceptance',
    (expectText) => {
      const row = `| 代码规范零错误 | \`npm run lint\` | ${expectText} |`;
      const text = mutate(B01_LINT_ROW, row);
      const err = backlogError(text);
      expect(err.batchId).toBe('v01-b01');
      expect(err.line).toBe(lineOf(text, row));
      expect(err.message).toContain('[v01-b01]');
      expect(err.message).toContain('代码规范零错误');
      expect(err.message).toContain(expectText);
      expect(err.message).toContain('not machine-decidable');
    },
  );

  it('rejects a command that is prose instead of a code span', () => {
    const row = '| 代码规范零错误 | 人工检查代码风格 | exit 0 |';
    const err = backlogError(mutate(B01_LINT_ROW, row));
    expect(err.batchId).toBe('v01-b01');
    expect(err.message).toMatch(/代码规范零错误.*command must be a single code span/);
  });

  it('rejects an empty command', () => {
    const err = backlogError(mutate(B01_LINT_ROW, '| 代码规范零错误 | ` ` | exit 0 |'));
    expect(err.message).toMatch(/\[v01-b01\] acceptance "代码规范零错误": command is empty/);
  });

  it('rejects a row whose unescaped pipe splits the command cell', () => {
    const row = '| 管道 | `npm test | tee out.log` | exit 0 |';
    const text = mutate(B01_LINT_ROW, row);
    const err = backlogError(text);
    expect(err.line).toBe(lineOf(text, row));
    expect(err.message).toMatch(/4 cells, expected 3 \(escape literal pipes as \\\|\)/);
  });

  it('rejects the whole backlog rather than silently dropping the bad batch', () => {
    expect(() =>
      parseBacklog(mutate(B01_LINT_ROW, '| 代码规范零错误 | `npm run lint` | 人工确认 |')),
    ).toThrow(BacklogError);
  });
});

describe('backlog-reject: overview table', () => {
  it('rejects depends_on referencing a batch that does not exist', () => {
    const row = '| 2 | v01-b02 | 批次解析与 worker 角色 | v01-b09 | running |';
    const text = mutate('| 2 | v01-b02 | 批次解析与 worker 角色 | v01-b01 | running |', row);
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b02');
    expect(err.line).toBe(lineOf(text, row));
    expect(err.message).toContain('unknown batch "v01-b09"');
  });

  it('rejects a status outside the enum (已签发)', () => {
    const row = '| 3 | v01-b03 | 审核角色与仲裁 | v01-b02 | 已签发 |';
    const text = mutate('| 3 | v01-b03 | 审核角色与仲裁 | v01-b02 | pending |', row);
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b03');
    expect(err.line).toBe(lineOf(text, row));
    expect(err.message).toContain(
      'status "已签发" is not one of pending / running / passed / blocked',
    );
  });

  it('rejects a missing column, naming it', () => {
    const text = mutate(
      '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
      '| 优先级 | 批次 | 标题 | 状态 |',
    );
    const err = backlogError(text);
    expect(err.line).toBe(lineOf(text, '| 优先级 | 批次 | 标题 | 状态 |'));
    expect(err.message).toContain('missing column(s) 依赖');
  });

  it('rejects reordered columns', () => {
    const header = '| 批次 | 优先级 | 标题 | 依赖 | 状态 |';
    const err = backlogError(mutate('| 优先级 | 批次 | 标题 | 依赖 | 状态 |', header));
    expect(err.message).toContain('table header must be 优先级 | 批次 | 标题 | 依赖 | 状态');
  });

  it('rejects a non-integer priority', () => {
    const err = backlogError(mutate('| 1 | v01-b01 |', '| first | v01-b01 |'));
    expect(err.message).toMatch(/\[v01-b01\] priority "first"/);
  });

  it('rejects a missing overview section', () => {
    const err = backlogError(mutate('## 队列总览', '## Overview'));
    expect(err.message).toContain('missing section "## 队列总览"');
  });

  it('rejects a duplicate batch id', () => {
    const err = backlogError(mutate('| 3 | v01-b03 |', '| 3 | v01-b02 |'));
    expect(err.message).toContain('[v01-b02] duplicate batch id in overview');
  });
});

describe('backlog-reject: batch sections', () => {
  it('rejects a batch listed in the overview without a section', () => {
    const start = FIXTURE.indexOf('## v01-b03 审核角色与仲裁');
    const text = FIXTURE.slice(0, start);
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b03');
    expect(err.line).toBe(lineOf(text, '| 3 | v01-b03 |'));
    expect(err.message).toContain('missing section "## v01-b03 审核角色与仲裁"');
  });

  it('rejects a section that has no overview row', () => {
    const text = `${FIXTURE}\n## v01-b99 幽灵批次\n`;
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b99');
    expect(err.line).toBe(lineOf(text, '## v01-b99'));
  });

  it('rejects a section without an acceptance table', () => {
    const text = mutate(
      '验收标准：\n\n| 说明 | 命令 | 期望 |\n|---|---|---|\n| 代码规范与类型 | `npm run lint && npm run typecheck` | exit 0 |\n| 仲裁规则全覆盖',
      '| 仲裁规则全覆盖',
    );
    // Removing the label leaves a stray table that is ignored as prose.
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b03');
    expect(err.message).toContain('missing "验收标准：" table');
  });

  it('rejects a section without items', () => {
    const err = backlogError(mutate('条目：\n1. 工程骨架', '1. 工程骨架'));
    expect(err.batchId).toBe('v01-b01');
    expect(err.message).toContain('missing "条目：" block');
  });

  it('rejects more than three items with the schema path', () => {
    const text = mutate('3. `src/journal.ts`', '4. extra item\n3. `src/journal.ts`');
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b01');
    expect(err.message).toMatch(/invalid batch: items: /);
  });

  it('rejects a section title that differs from the overview', () => {
    const err = backlogError(mutate('## v01-b03 审核角色与仲裁', '## v01-b03 审核与仲裁'));
    expect(err.message).toContain(
      'section title "审核与仲裁" differs from overview title "审核角色与仲裁"',
    );
  });

  it('rejects a section priority that differs from the overview', () => {
    const err = backlogError(mutate('优先级：3', '优先级：4'));
    expect(err.message).toContain('[v01-b03] section priority 4 differs from overview priority 3');
  });

  it('rejects section dependencies that differ from the overview', () => {
    const err = backlogError(mutate('依赖：v01-b02', '依赖：v01-b01'));
    expect(err.message).toContain(
      '[v01-b03] section dependencies [v01-b01] differ from overview [v01-b02]',
    );
  });

  it('rejects an acceptance table with a wrong header', () => {
    const text = mutate('| 说明 | 命令 | 期望 |', '| 说明 | 命令 |');
    const err = backlogError(text);
    expect(err.batchId).toBe('v01-b01');
    expect(err.message).toContain('missing column(s) 期望');
  });
});
