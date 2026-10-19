import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadBacklog, parseBacklog } from '../src/backlog.js';
import { buildTask, type TaskContext } from '../src/roles/worker.js';
import { splitFrontmatter } from '../src/schema/envelope.js';
import type { Batch } from '../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..');
const batches = loadBacklog(repoRoot);
/** Frozen backlog snapshot, for assertions on the wording of a specific batch. */
const frozen = parseBacklog(
  readFileSync(join(import.meta.dirname, 'fixtures', 'backlog.md'), 'utf8'),
);

const ctx: TaskContext = {
  run_id: 'r-0002',
  base_sha: '4a690f567397beb10bfc2b93ab9023a71c3af30e',
  created_at: '2026-10-16T22:00:00Z',
  attempt: 1,
};

function batch(id: string, from: readonly Batch[] = batches): Batch {
  const found = from.find((b) => b.id === id);
  if (found === undefined) throw new Error(`batch ${id} not in backlog`);
  return found;
}

/** Lines of the acceptance table body (header and separator excluded). */
function acceptanceRows(body: string): string[] {
  const lines = body.split('\n');
  const header = lines.indexOf('| 说明 | 命令 | 期望 |');
  expect(header).toBeGreaterThanOrEqual(0);
  expect(lines[header + 1]).toBe('|---|---|---|');
  const rows: string[] = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(line);
  }
  return rows;
}

/** Embeds the rendered acceptance table in a minimal backlog and parses it back. */
function reparseAcceptance(source: Batch, body: string): Batch['acceptance'] {
  const backlog = [
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| 1 | ${source.id} | ${source.title} | — | pending |`,
    '',
    `## ${source.id} ${source.title}`,
    '',
    '优先级：1\u3000依赖：无',
    '',
    '条目：',
    '1. item',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    ...acceptanceRows(body),
    '',
  ].join('\n');
  return parseBacklog(backlog)[0]?.acceptance ?? [];
}

describe('task-envelope: frontmatter (SPEC 3.3)', () => {
  const task = buildTask(batch('v01-b02'), ctx);
  const { yaml, body } = splitFrontmatter(task.markdown);
  const parsed: unknown = YAML.parse(yaml);

  it('is parseable by yaml and carries every SPEC 3.3 field', () => {
    expect(parsed).toEqual({
      schema_version: 1,
      run_id: 'r-0002',
      batch_id: 'v01-b02',
      base_sha: '4a690f567397beb10bfc2b93ab9023a71c3af30e',
      created_at: '2026-10-16T22:00:00Z',
      attempt: 1,
      interrupted_at: null,
    });
    expect(task.frontmatter).toEqual(parsed);
  });

  it('writes interrupted_at: null explicitly', () => {
    expect(yaml.split('\n')).toContain('interrupted_at: null');
  });

  it('starts the body after the closing ---', () => {
    expect(task.markdown.startsWith('---\n')).toBe(true);
    expect(body.trimStart().startsWith('# 批次 v01-b02：批次解析与 worker 角色')).toBe(true);
  });

  it('rejects an invalid context instead of emitting a broken envelope', () => {
    expect(() => buildTask(batch('v01-b02'), { ...ctx, base_sha: 'HEAD' })).toThrow();
    expect(() => buildTask(batch('v01-b02'), { ...ctx, attempt: 0 })).toThrow();
    expect(() => buildTask(batch('v01-b02'), { ...ctx, run_id: '../r' })).toThrow();
  });

  it('is deterministic', () => {
    expect(buildTask(batch('v01-b02'), ctx).markdown).toBe(task.markdown);
  });
});

describe('task-envelope: body', () => {
  it.each(batches.map((b) => [b.id, b] as const))(
    '%s has one acceptance row per acceptance entry',
    (_id, source) => {
      const { body } = splitFrontmatter(buildTask(source, ctx).markdown);
      expect(acceptanceRows(body)).toHaveLength(source.acceptance.length);
    },
  );

  it.each(batches.map((b) => [b.id, b] as const))(
    '%s acceptance round-trips through the backlog parser',
    (_id, source) => {
      const { body } = splitFrontmatter(buildTask(source, ctx).markdown);
      expect(reparseAcceptance(source, body)).toEqual(source.acceptance);
    },
  );

  it('escapes pipes in commands so the table keeps three columns', () => {
    const { body } = splitFrontmatter(buildTask(batch('v01-b02'), ctx).markdown);
    const grepRow = acceptanceRows(body).at(-1) ?? '';
    expect(grepRow).toContain('(@anthropic-ai\\|\\.\\./runner/fake\\|\\./fake)');
    expect(grepRow.split(/(?<!\\)\|/)).toHaveLength(5);
  });

  it('wraps a command containing backticks in a longer code span', () => {
    const source: Batch = {
      ...batch('v01-b02'),
      acceptance: [
        { desc: 'subshell', cmd: 'test "`git rev-parse HEAD`" != ""', expect: 'exit_zero' },
      ],
    };
    const { body } = splitFrontmatter(buildTask(source, ctx).markdown);
    expect(acceptanceRows(body)).toEqual([
      '| subshell | ``test "`git rev-parse HEAD`" != ""`` | exit 0 |',
    ]);
    expect(reparseAcceptance(source, body)).toEqual(source.acceptance);
  });

  it('lists the items, keeping multi-line items inside their list entry', () => {
    const { body } = splitFrontmatter(buildTask(batch('v01-b03', frozen), ctx).markdown);
    expect(body).toContain('## 本批次条目（3 个）');
    expect(body).toContain(
      '1. `src/verify.ts` + `src/git.ts` + `src/ci.ts`：实跑验收命令并结构化输出；\n   git 封装',
    );
    expect(body).toContain('3. `src/arbiter.ts`');
  });

  it('lists forbidden items, or 无 when there are none', () => {
    const withForbidden = splitFrontmatter(buildTask(batch('v01-b03', frozen), ctx).markdown).body;
    expect(withForbidden).toContain('## 本批次额外禁止\n\n- 用约束解码强制 verdict 三值');
    const none = splitFrontmatter(
      buildTask({ ...batch('v01-b03', frozen), forbidden: [] }, ctx).markdown,
    ).body;
    expect(none).toContain('## 本批次额外禁止\n\n- 无\n');
  });

  it('states the reporting requirement with the report path and envelope commit', () => {
    const { body } = splitFrontmatter(buildTask(batch('v01-b02'), ctx).markdown);
    expect(body).toContain('## 汇报要求');
    expect(body).toContain('`.collie/batches/v01-b02/report.md`');
    expect(body).toContain('`report(collie): v01-b02`');
  });

  it('has the SPEC 3.3 section order', () => {
    const { body } = splitFrontmatter(buildTask(batch('v01-b01'), ctx).markdown);
    const headings = body.split('\n').filter((l) => l.startsWith('#'));
    expect(headings).toEqual([
      '# 批次 v01-b01：工程骨架与基础设施',
      '## 你的身份与边界',
      '## 本批次条目（3 个）',
      '## 验收标准（可机器判定）',
      '## 本批次额外禁止',
      '## 汇报要求',
    ]);
  });
});
