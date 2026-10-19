import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBacklog, parseBacklog } from '../src/backlog.js';
import { BatchStatusSchema, type Batch } from '../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..');
/** Frozen copy of docs/backlog.md as issued with v01-b02 (commit 4a690f5). */
const FIXTURE = readFileSync(join(import.meta.dirname, 'fixtures', 'backlog.md'), 'utf8');

interface Expected {
  id: string;
  title: string;
  priority: number;
  depends_on: string[];
  items: number;
  acceptance: number;
  forbidden: number;
}

/** Hand-written from docs/backlog.md. These fields are fixed once issued (ROLES 1.4). */
const EXPECTED: Expected[] = [
  {
    id: 'v01-b01',
    title: '工程骨架与基础设施',
    priority: 1,
    depends_on: [],
    items: 3,
    acceptance: 7,
    forbidden: 3,
  },
  {
    id: 'v01-b02',
    title: '批次解析与 worker 角色',
    priority: 2,
    depends_on: ['v01-b01'],
    items: 3,
    acceptance: 8,
    forbidden: 2,
  },
  {
    id: 'v01-b03',
    title: '审核角色与仲裁',
    priority: 3,
    depends_on: ['v01-b02'],
    items: 3,
    acceptance: 7,
    forbidden: 2,
  },
];

function summarize(batch: Batch): Expected {
  return {
    id: batch.id,
    title: batch.title,
    priority: batch.priority,
    depends_on: batch.depends_on,
    items: batch.items.length,
    acceptance: batch.acceptance.length,
    forbidden: batch.forbidden.length,
  };
}

describe('backlog: the live docs/backlog.md', () => {
  const batches = loadBacklog(repoRoot);

  it('parses into exactly the three v0.1 batches with their fixed fields', () => {
    expect(batches.map(summarize)).toEqual(EXPECTED);
  });

  it('has statuses inside the SPEC 3.2 enum (values change as batches progress)', () => {
    for (const batch of batches) expect(BatchStatusSchema.options).toContain(batch.status);
  });

  it('restores the 7 acceptance commands of v01-b01 verbatim', () => {
    const b01 = batches.find((b) => b.id === 'v01-b01');
    expect(b01?.acceptance.map((a) => a.cmd)).toEqual([
      'npm run lint',
      'npm run typecheck',
      'npm test',
      'npm test -- schema',
      'npm test -- journal',
      'npm test -- config',
      "grep -qE 'branches:\\s*\\[\\s*main\\s*\\]' .github/workflows/ci.yml",
    ]);
    expect(b01?.acceptance.every((a) => a.expect === 'exit_zero')).toBe(true);
  });

  it('un-escapes GFM \\| inside commands (v01-b02 grep)', () => {
    const b02 = batches.find((b) => b.id === 'v01-b02');
    expect(b02?.acceptance.at(-1)).toEqual({
      desc: 'roles 不直接依赖 SDK 或 fake',
      cmd: 'test -d src/roles && ! grep -rE "from [\'\\"](@anthropic-ai|\\.\\./runner/fake|\\./fake)" src/roles/',
      expect: 'exit_zero',
    });
  });
});

describe('backlog: frozen fixture (status snapshot at v01-b02 issue)', () => {
  const batches = parseBacklog(FIXTURE, 'fixture.md');

  it('matches the hand-written expectation including status', () => {
    expect(batches.map((b) => [b.id, b.status])).toEqual([
      ['v01-b01', 'passed'],
      ['v01-b02', 'running'],
      ['v01-b03', 'pending'],
    ]);
    expect(batches.map(summarize)).toEqual(EXPECTED);
  });

  it('joins indented continuation lines of an item with a newline', () => {
    expect(batches[1]?.items[0]).toBe(
      '`src/backlog.ts`：解析本文件为 `Batch[]`，校验验收标准均为可执行命令\n（不可机器判定则报错并拒绝执行）',
    );
  });

  it('parses forbidden bullets and ignores free prose between blocks', () => {
    expect(batches[2]?.forbidden).toEqual([
      '用约束解码强制 verdict 三值（必须由 arbiter 解析校验）',
      '让 reviewer 具备写入能力（工具白名单不得含 Write/Edit）',
    ]);
  });

  it('defaults forbidden to [] when the block is absent', () => {
    const text = FIXTURE.replace(
      /额外禁止：\n- 用约束解码强制 verdict 三值（必须由 arbiter 解析校验）\n- 让 reviewer 具备写入能力（工具白名单不得含 Write\/Edit）\n?/,
      '',
    );
    expect(text).not.toBe(FIXTURE);
    expect(parseBacklog(text).at(-1)?.forbidden).toEqual([]);
  });

  it('accepts a comma-separated dependency list', () => {
    const text = FIXTURE.replace(
      '| 3 | v01-b03 | 审核角色与仲裁 | v01-b02 |',
      '| 3 | v01-b03 | 审核角色与仲裁 | v01-b01, v01-b02 |',
    ).replace('优先级：3\u3000依赖：v01-b02', '优先级：3\u3000依赖：v01-b01、v01-b02');
    expect(parseBacklog(text).at(-1)?.depends_on).toEqual(['v01-b01', 'v01-b02']);
  });

  it('returns batches in overview order', () => {
    expect(batches.map((b) => b.priority)).toEqual([1, 2, 3]);
  });
});
