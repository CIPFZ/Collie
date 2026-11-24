// Acceptance tests for v046-b41 — [保持] scenarios K1–K4.
// These behaviours must continue to work after broken-dependency reporting is added.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBacklog } from '../../../src/backlog.js';
import { Sandbox } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allOutput(box: Sandbox): string {
  return box.output.join('');
}

/**
 * Builds a backlog-archive.md with two batches in the overview table and
 * two matching sections.  Used by K4.
 * Following the pattern from test/acceptance/v046-b40/new.test.ts.
 */
function archiveTwoBatches(
  batch1: { id: string; title: string; priority: number; status: string },
  batch2: { id: string; title: string; priority: number; status: string },
): string {
  // eslint-disable-next-line no-irregular-whitespace -- U+3000 required by backlog format
  const meta1 = `优先级：${String(batch1.priority)}　依赖：无`;
  // eslint-disable-next-line no-irregular-whitespace -- U+3000 required by backlog format
  const meta2 = `优先级：${String(batch2.priority)}　依赖：无`;
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| ${String(batch1.priority)} | ${batch1.id} | ${batch1.title} | — | ${batch1.status} |`,
    `| ${String(batch2.priority)} | ${batch2.id} | ${batch2.title} | — | ${batch2.status} |`,
    '',
    `## ${batch1.id} ${batch1.title}`,
    '',
    meta1,
    '',
    '条目：',
    '1. 归档条目一',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    '| 通过 | `echo ok` | exit 0 |',
    '',
    `## ${batch2.id} ${batch2.title}`,
    '',
    meta2,
    '',
    '条目：',
    '1. 归档条目二',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    '| 通过 | `echo ok` | exit 0 |',
  ].join('\n');
}

/** Builds a minimal backlog.md with one batch. */
function backlogText(opts: {
  id: string;
  title: string;
  priority: number;
  status: string;
}): string {
  const depCell = '—';
  const depLine = '无';
  // eslint-disable-next-line no-irregular-whitespace -- U+3000 required by backlog format
  const metaLine = `优先级：${String(opts.priority)}　依赖：${depLine}`;
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| ${String(opts.priority)} | ${opts.id} | ${opts.title} | ${depCell} | ${opts.status} |`,
    '',
    `## ${opts.id} ${opts.title}`,
    '',
    metaLine,
    '',
    '条目：',
    '1. 实现功能',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    '| 通过 | `echo ok` | exit 0 |',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// K1: fresh sandbox, no runs, status → exit 0, "no runs recorded"
// ---------------------------------------------------------------------------

describe('K1: status with no runs recorded', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K1: exits 0 and output contains "no runs recorded"', async () => {
    const exitCode = await box.cli(['status'], undefined);
    expect(exitCode).toBe(0);
    expect(allOutput(box)).toContain('no runs recorded');
  });
});

// ---------------------------------------------------------------------------
// K2: fresh sandbox, why v99-b99 (not in backlog) → exit 1,
//     output includes "batch v99-b99 is not in docs/backlog.md"
// ---------------------------------------------------------------------------

describe('K2: why for batch not in backlog', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K2: exits 1 and output contains "batch v99-b99 is not in docs/backlog.md"', async () => {
    const exitCode = await box.cli(['why', 'v99-b99'], undefined);
    expect(exitCode).toBe(1);
    expect(allOutput(box)).toContain('batch v99-b99 is not in docs/backlog.md');
  });
});

// ---------------------------------------------------------------------------
// K3: modified sandbox (broken dep), show v99-b01 → exit 1, output has v00-x99
// ---------------------------------------------------------------------------

describe('K3: show with broken dependency', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Same modification as S1: change v99-b01's dependency to non-existent v00-x99.
    const original = box.read('docs/backlog.md');
    const updated = original.replace('| — |', '| v00-x99 |').replace('依赖：无', '依赖：v00-x99');
    box.write('docs/backlog.md', updated);
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: exits 1 and output contains v00-x99', async () => {
    const exitCode = await box.cli(['show', 'v99-b01'], undefined);
    expect(exitCode).toBe(1);
    expect(allOutput(box)).toContain('v00-x99');
  });
});

// ---------------------------------------------------------------------------
// K4: archive with two batches (blocked, passed) + backlog with one pending
//     → loadBacklog returns 3 batches in correct order with correct statuses
// ---------------------------------------------------------------------------

describe('K4: loadBacklog merges two-batch archive with one-batch backlog', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b41-k4-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('K4: returns 3 batches, first two statuses are blocked and passed', () => {
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog-archive.md'),
      archiveTwoBatches(
        { id: 'v01-a01', title: '归档批次一', priority: 1, status: 'blocked' },
        { id: 'v01-a02', title: '归档批次二', priority: 2, status: 'passed' },
      ),
    );
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({ id: 'v01-b01', title: '活跃批次', priority: 3, status: 'pending' }),
    );
    const batches = loadBacklog(dir);
    expect(batches).toHaveLength(3);
    expect(batches[0]?.status).toBe('blocked');
    expect(batches[1]?.status).toBe('passed');
  });
});
