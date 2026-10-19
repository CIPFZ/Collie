import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  EnvelopeError,
  fencedBlocks,
  lastJsonBlock,
  parseTaskFrontmatter,
  renderFrontmatter,
  splitFrontmatter,
} from '../src/schema/envelope.js';
import {
  ReportSchema,
  TaskFrontmatterSchema,
  type Report,
  type TaskFrontmatter,
} from '../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..');
const FENCE = '```';

const frontmatter: TaskFrontmatter = {
  schema_version: 1,
  run_id: 'r-0002',
  batch_id: 'v01-b02',
  base_sha: '4a690f567397beb10bfc2b93ab9023a71c3af30e',
  created_at: '2026-10-16T22:00:00Z',
  attempt: 1,
  interrupted_at: null,
};

const report: Report = {
  schema_version: 1,
  batch_id: 'v01-b03',
  head_sha: 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
  claims: {
    commits: ['e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3'],
    tests_passed: 47,
    tests_failed: 0,
    pushed: true,
    ci_passed: true,
    new_deps: [],
    spec_touched: false,
  },
  open_questions: [],
};

function issuePaths(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}): string[] {
  expect(result.success).toBe(false);
  return (result.error?.issues ?? []).map((i) => i.path.map(String).join('.'));
}

describe('envelope: TaskFrontmatterSchema (SPEC 3.3)', () => {
  it('round-trips through JSON', () => {
    expect(TaskFrontmatterSchema.parse(JSON.parse(JSON.stringify(frontmatter)))).toEqual(
      frontmatter,
    );
  });

  it('accepts the optional issued_by and revised_at fields', () => {
    const issued = {
      ...frontmatter,
      issued_by: 'human-placeholder-r2',
      revised_at: '2026-10-16T23:00:00Z',
    };
    expect(TaskFrontmatterSchema.parse(issued)).toEqual(issued);
    expect(TaskFrontmatterSchema.safeParse({ ...frontmatter, revised_at: null }).success).toBe(
      true,
    );
  });

  it('requires interrupted_at to be present and null in v0.1', () => {
    const missing: Partial<TaskFrontmatter> = { ...frontmatter };
    delete missing.interrupted_at;
    expect(issuePaths(TaskFrontmatterSchema.safeParse(missing))).toEqual(['interrupted_at']);
    expect(
      issuePaths(TaskFrontmatterSchema.safeParse({ ...frontmatter, interrupted_at: 'item 2' })),
    ).toEqual(['interrupted_at']);
  });

  it.each([
    ['unknown key', { ...frontmatter, issuer: 'x' }, ''],
    ['non-hex sha', { ...frontmatter, base_sha: 'a1b2c3g' }, 'base_sha'],
    ['short sha', { ...frontmatter, base_sha: 'abc123' }, 'base_sha'],
    ['attempt 0', { ...frontmatter, attempt: 0 }, 'attempt'],
    ['unsafe batch_id', { ...frontmatter, batch_id: '../v01' }, 'batch_id'],
    ['bad created_at', { ...frontmatter, created_at: 'yesterday' }, 'created_at'],
  ])('rejects %s', (_label, value, path) => {
    expect(issuePaths(TaskFrontmatterSchema.safeParse(value))).toEqual([path]);
  });
});

describe('envelope: ReportSchema (SPEC 3.4)', () => {
  it('round-trips through JSON, including claims.ci_passed', () => {
    expect(ReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it.each([
    [
      'missing ci_passed',
      { ...report, claims: { ...report.claims, ci_passed: undefined } },
      'claims.ci_passed',
    ],
    [
      'string test count',
      { ...report, claims: { ...report.claims, tests_passed: '47' } },
      'claims.tests_passed',
    ],
    [
      'negative failures',
      { ...report, claims: { ...report.claims, tests_failed: -1 } },
      'claims.tests_failed',
    ],
    ['non-hex head_sha (old SPEC example)', { ...report, head_sha: 'e4f5g6h' }, 'head_sha'],
    [
      'non-hex commit',
      { ...report, claims: { ...report.claims, commits: ['zzzzzzz'] } },
      'claims.commits.0',
    ],
    ['unknown claim', { ...report, claims: { ...report.claims, coverage: 90 } }, 'claims'],
    ['wrong schema_version', { ...report, schema_version: 2 }, 'schema_version'],
  ])('rejects %s', (_label, value, path) => {
    expect(issuePaths(ReportSchema.safeParse(value))).toEqual([path]);
  });

  it('documents that the v01-b01 report predates claims.ci_passed', () => {
    // SPEC 3.4 added ci_passed after v01-b01 without bumping SCHEMA_VERSION.
    const markdown = readFileSync(join(repoRoot, '.collie/batches/v01-b01/report.md'), 'utf8');
    const block = lastJsonBlock(markdown);
    expect(block).toBeDefined();
    const raw: unknown = JSON.parse(block?.content ?? '');
    expect(issuePaths(ReportSchema.safeParse(raw))).toEqual(['claims.ci_passed']);
  });
});

describe('envelope: frontmatter render and parse', () => {
  it('renders YAML between --- lines that yaml parses back to the input', () => {
    const text = renderFrontmatter(frontmatter);
    expect(text.startsWith('---\n')).toBe(true);
    expect(text.endsWith('---\n')).toBe(true);
    expect(YAML.parse(splitFrontmatter(text).yaml)).toEqual(frontmatter);
    expect(text).toContain('interrupted_at: null\n');
  });

  it('keeps SPEC 3.3 key order', () => {
    const keys = Object.keys(
      YAML.parse(splitFrontmatter(renderFrontmatter(frontmatter)).yaml) as object,
    );
    expect(keys).toEqual([
      'schema_version',
      'run_id',
      'batch_id',
      'base_sha',
      'created_at',
      'attempt',
      'interrupted_at',
    ]);
  });

  it.each(['0123456', '1234567e10', '4823e15'])(
    'quotes sha %s that YAML would read as a number',
    (sha) => {
      // Unquoted, YAML reads 1234567e10 as 12345670000000000.
      expect(typeof YAML.parse(`v: ${sha}`)).not.toBe('string');
      const text = renderFrontmatter({ ...frontmatter, base_sha: sha });
      expect(parseTaskFrontmatter(text).base_sha).toBe(sha);
    },
  );

  it('refuses to render invalid frontmatter', () => {
    expect(() => renderFrontmatter({ ...frontmatter, attempt: 0 })).toThrow();
  });

  it('parses the frontmatter of the live v01-b02 task.md', () => {
    const markdown = readFileSync(join(repoRoot, '.collie/batches/v01-b02/task.md'), 'utf8');
    expect(parseTaskFrontmatter(markdown)).toMatchObject({
      batch_id: 'v01-b02',
      interrupted_at: null,
    });
  });

  it.each([
    ['no opening ---', '# title\n'],
    ['unclosed frontmatter', '---\nschema_version: 1\n'],
    ['invalid YAML', '---\n: : :\n  - [\n---\n'],
    ['schema violation', '---\nschema_version: 1\n---\n'],
  ])('rejects %s', (_label, text) => {
    expect(() => parseTaskFrontmatter(text)).toThrow(EnvelopeError);
  });
});

describe('envelope: fenced JSON blocks', () => {
  it('finds the last json block among several', () => {
    const md = [
      '# r',
      `${FENCE}json`,
      '{"n":1}',
      FENCE,
      'text',
      `${FENCE}ts`,
      'x',
      FENCE,
      `${FENCE}json`,
      '{"n":2}',
      FENCE,
      '',
    ].join('\n');
    expect(lastJsonBlock(md)).toEqual({ lang: 'json', content: '{"n":2}', line: 9 });
  });

  it('returns undefined when there is no json block', () => {
    expect(lastJsonBlock(`text\n${FENCE}ts\nx\n${FENCE}\n`)).toBeUndefined();
  });

  it('treats a json block quoted inside a longer fence as content', () => {
    const md = [
      '````markdown',
      `${FENCE}json`,
      '{"quoted":true}',
      FENCE,
      '````',
      `${FENCE}json`,
      '{"real":true}',
      FENCE,
    ].join('\n');
    expect(fencedBlocks(md).map((b) => b.lang)).toEqual(['markdown', 'json']);
    expect(lastJsonBlock(md)?.content).toBe('{"real":true}');
  });

  it('supports tilde fences and an upper-case info string', () => {
    expect(lastJsonBlock('~~~JSON\n{"t":1}\n~~~\n')?.content).toBe('{"t":1}');
  });

  it('does not close a fence with a fence that carries an info string', () => {
    const md = [`${FENCE}json`, '{"a":1}', `${FENCE}json`, FENCE].join('\n');
    expect(fencedBlocks(md)).toHaveLength(1);
    expect(lastJsonBlock(md)?.content).toBe(`{"a":1}\n${FENCE}json`);
  });

  it('ignores a fence indented by four spaces (an indented code block)', () => {
    expect(fencedBlocks(`    ${FENCE}json\n    {}\n    ${FENCE}\n`)).toEqual([]);
  });

  it('reports an unclosed fence with its line number', () => {
    expect(() => fencedBlocks(`a\nb\n${FENCE}json\n{"cut":`)).toThrow(
      /line 3: fenced block opened with ``` is never closed/,
    );
  });

  it('extracts the tail block of the real v01-b01 report', () => {
    const markdown = readFileSync(join(repoRoot, '.collie/batches/v01-b01/report.md'), 'utf8');
    const raw: unknown = JSON.parse(lastJsonBlock(markdown)?.content ?? 'null');
    expect(raw).toMatchObject({
      batch_id: 'v01-b01',
      head_sha: 'e99fde38dc15ce2920f5bd4710fcee27dbf41f9d',
    });
  });
});
