// Acceptance tests for v046-b40 — [保持] scenarios K1–K3.
// These behaviours must continue to work after backlog-archive.md support is added.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BacklogError, loadBacklog } from '../../../src/backlog.js';
import { FakeRunner } from '../../../src/runner/fake.js';
import { fooledReviewerScene, honestClaims, Sandbox, workerScene } from '../../support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers: minimal valid backlog / archive text builders (same as new.test.ts)
// ---------------------------------------------------------------------------

function archiveText(opts: {
  id: string;
  title: string;
  priority: number;
  status: string;
  depends?: string;
}): string {
  const dep = opts.depends ?? '无';
  // eslint-disable-next-line no-irregular-whitespace -- U+3000 required by backlog format
  const metaLine = `优先级：${String(opts.priority)}　依赖：${dep}`;
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| ${String(opts.priority)} | ${opts.id} | ${opts.title} | ${dep} | ${opts.status} |`,
    '',
    `## ${opts.id} ${opts.title}`,
    '',
    metaLine,
    '',
    '条目：',
    '1. 归档条目',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    '| 通过 | `echo ok` | exit 0 |',
  ].join('\n');
}

function backlogText(opts: {
  id: string;
  title: string;
  priority: number;
  status: string;
  depends?: string;
}): string {
  const depCell = opts.depends ?? '—';
  const depLine = opts.depends ?? '无';
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
// K1: no archive file, single batch in backlog.md → returns that one batch
// ---------------------------------------------------------------------------

describe('K1: no backlog-archive.md, single batch', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b40-k1-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('K1: loadBacklog returns exactly one batch', () => {
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({ id: 'v01-b01', title: '唯一批次', priority: 1, status: 'pending' }),
    );
    const batches = loadBacklog(dir);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.id).toBe('v01-b01');
  });
});

// ---------------------------------------------------------------------------
// K2: archive exists and is valid, backlog depends on unknown batch → error
// ---------------------------------------------------------------------------

describe('K2: backlog depends on unknown batch', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b40-k2-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('K2: loadBacklog throws BacklogError with unknown batch id v00-x99', () => {
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog-archive.md'),
      archiveText({ id: 'v01-a01', title: '归档批次', priority: 1, status: 'passed' }),
    );
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({
        id: 'v01-b01',
        title: '活跃批次',
        priority: 2,
        status: 'pending',
        depends: 'v00-x99',
      }),
    );
    expect.assertions(2);
    try {
      loadBacklog(dir);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BacklogError);
      expect((err as Error).message).toContain('v00-x99');
    }
  });
});

// ---------------------------------------------------------------------------
// K3: after S4 run, backlog-archive.md is byte-for-byte identical
// ---------------------------------------------------------------------------

describe('K3: archive is not modified by queue run', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K3: backlog-archive.md content is identical before and after the run', async () => {
    const archiveContent = archiveText({
      id: 'v98-a01',
      title: '归档批次',
      priority: 1,
      status: 'passed',
    });
    box.write('docs/backlog-archive.md', archiveContent);

    // Modify backlog.md so v99-b01 is pending and depends on v98-a01.
    const backlog = box.read('docs/backlog.md');
    const updatedBacklog = backlog
      .replace(/running/, 'pending')
      .replace(/\| — \|/g, '| v98-a01 |')
      .replace('依赖：无', '依赖：v98-a01');
    box.write('docs/backlog.md', updatedBacklog);
    await box.commitAll('chore: add archive and dependency');

    // Snapshot the archive before the run.
    const archiveBefore = box.read('docs/backlog-archive.md');

    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      fooledReviewerScene(box),
    ]);

    await box.cli(['run', '--continue'], runner);

    // After the run, archive must be byte-for-byte identical.
    const archiveAfter = box.read('docs/backlog-archive.md');
    expect(archiveAfter).toBe(archiveBefore);
  });
});
