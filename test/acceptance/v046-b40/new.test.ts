// Acceptance tests for v046-b40 — [新] scenarios S1–S5.
// loadBacklog reads docs/backlog-archive.md alongside docs/backlog.md.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../../../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../../../src/runner/fake.js';
import { git } from '../../../src/git.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from '../../support/sandbox.js';

// Module path for dynamic import — loadBacklog may gain archive-merge behaviour.
const BACKLOG_MODULE = '../../../src/backlog.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers: minimal valid backlog / archive text builders
// ---------------------------------------------------------------------------

/** Builds a minimal backlog-archive.md with one batch. */
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

/** Builds a minimal backlog.md with one batch, optionally depending on another. */
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
// S1: archive passed + backlog pending with dependency → loadBacklog merges
// ---------------------------------------------------------------------------

describe('S1: loadBacklog merges archive and backlog', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b40-s1-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('S1: returns exactly two batches in order, with depends_on populated', async () => {
    const mod = (await import(BACKLOG_MODULE)) as unknown as {
      loadBacklog: (root: string) => { id: string; depends_on: string[] }[];
    };
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
        depends: 'v01-a01',
      }),
    );
    const batches = mod.loadBacklog(dir);
    expect(batches).toHaveLength(2);
    expect(batches[0]?.id).toBe('v01-a01');
    expect(batches[1]?.id).toBe('v01-b01');
    expect(batches[1]?.depends_on).toEqual(['v01-a01']);
  });
});

// ---------------------------------------------------------------------------
// S2: duplicate batch id across archive and backlog → BacklogError
// ---------------------------------------------------------------------------

describe('S2: duplicate batch across archive and backlog', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b40-s2-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('S2: loadBacklog throws BacklogError with batch id and archive filename', async () => {
    const mod = (await import(BACKLOG_MODULE)) as unknown as {
      loadBacklog: (root: string) => unknown[];
      BacklogError: new (...args: unknown[]) => Error;
    };
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog-archive.md'),
      archiveText({ id: 'v01-a01', title: '归档批次', priority: 1, status: 'passed' }),
    );
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({ id: 'v01-a01', title: '归档批次', priority: 1, status: 'pending' }),
    );
    expect.assertions(3);
    try {
      mod.loadBacklog(dir);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(mod.BacklogError);
      const msg = (err as Error).message;
      expect(msg).toContain('v01-a01');
      expect(msg).toContain('backlog-archive.md');
    }
  });
});

// ---------------------------------------------------------------------------
// S3: archive batch has non-passed status → BacklogError
// ---------------------------------------------------------------------------

describe('S3: archive batch with non-passed status', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'collie-b40-s3-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('S3: pending status in archive throws BacklogError with batch id', async () => {
    const mod = (await import(BACKLOG_MODULE)) as unknown as {
      loadBacklog: (root: string) => unknown[];
      BacklogError: new (...args: unknown[]) => Error;
    };
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog-archive.md'),
      archiveText({ id: 'v01-a01', title: '归档批次', priority: 1, status: 'pending' }),
    );
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({ id: 'v01-b01', title: '活跃批次', priority: 2, status: 'pending' }),
    );
    expect.assertions(2);
    try {
      mod.loadBacklog(dir);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(mod.BacklogError);
      expect((err as Error).message).toContain('v01-a01');
    }
  });

  it('S3: running status in archive throws BacklogError with batch id', async () => {
    const mod = (await import(BACKLOG_MODULE)) as unknown as {
      loadBacklog: (root: string) => unknown[];
      BacklogError: new (...args: unknown[]) => Error;
    };
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(
      join(dir, 'docs', 'backlog-archive.md'),
      archiveText({ id: 'v01-a01', title: '归档批次', priority: 1, status: 'running' }),
    );
    writeFileSync(
      join(dir, 'docs', 'backlog.md'),
      backlogText({ id: 'v01-b01', title: '活跃批次', priority: 2, status: 'pending' }),
    );
    expect.assertions(2);
    try {
      mod.loadBacklog(dir);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(mod.BacklogError);
      expect((err as Error).message).toContain('v01-a01');
    }
  });
});

// ---------------------------------------------------------------------------
// S4: queue mode run with archive dependency → passes end to end
// ---------------------------------------------------------------------------

describe('S4: queue run with archive dependency ends with passed', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S4: exit 0, backlog shows v99-b01 as passed', async () => {
    // Write an archive file with a passed batch that v99-b01 will depend on.
    box.write(
      'docs/backlog-archive.md',
      archiveText({ id: 'v98-a01', title: '归档批次', priority: 1, status: 'passed' }),
    );

    // Modify backlog.md so v99-b01 is pending and depends on v98-a01.
    const backlog = box.read('docs/backlog.md');
    const updatedBacklog = backlog
      .replace(/running/, 'pending')
      .replace(/\| — \|/g, '| v98-a01 |')
      .replace('依赖：无', '依赖：v98-a01');
    box.write('docs/backlog.md', updatedBacklog);
    await box.commitAll('chore: add archive and dependency');

    const runner = new FakeRunner([
      workerScene(box, {
        passing: 47,
        failing: 0,
        push: true,
        claims: honestClaims(47, true),
      }),
      fooledReviewerScene(box),
    ]);

    const exitCode = await box.cli(['run', '--continue'], runner);
    expect(exitCode).toBe(0);

    const finalBacklog = box.read('docs/backlog.md');
    expect(finalBacklog).toContain('passed');
    // The batch v99-b01 should now be passed
    expect(finalBacklog).toMatch(/v99-b01.*passed/);
  });
});

// ---------------------------------------------------------------------------
// S5: worker modifies archive in code commit → spec_diff_lines > 0
// ---------------------------------------------------------------------------

describe('S5: worker modifies backlog-archive.md → BLOCK', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('S5: exit 20, evidence.collected spec_diff_lines > 0', async () => {
    // Write an archive file (already committed).
    box.write(
      'docs/backlog-archive.md',
      archiveText({ id: 'v98-a01', title: '归档批次', priority: 1, status: 'passed' }),
    );
    await box.commitAll('chore: add archive');

    // The worker will modify backlog-archive.md in its code commit.
    const workerThatModifiesArchive: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', cwd);
        box.write('tests/t000.sh', 'exit 0\n', cwd);

        // Append an extra line to backlog-archive.md
        const archivePath = join(cwd, 'docs', 'backlog-archive.md');
        const original = readFileSync(archivePath, 'utf8');
        writeFileSync(archivePath, `${original}\nnote`);

        const head = await box.commitAll('feat: add feature with tests', cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);

        const report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: head,
          claims: {
            commits: [head],
            tests_passed: 1,
            tests_failed: 0,
            pushed: true,
            ci_passed: true,
            new_deps: [],
            spec_touched: false,
          },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
      },
      result: { exitCode: 0 },
    };

    const runner = new FakeRunner([workerThatModifiesArchive, fooledReviewerScene(box)]);
    const exitCode = await box.run(runner);
    expect(exitCode).toBe(20);

    const events = box.events();
    const evidenceEvt = events.find((e) => e.event === 'evidence.collected');
    expect(evidenceEvt).toBeDefined();
    const specDiff = (evidenceEvt as unknown as { spec_diff_lines: number }).spec_diff_lines;
    expect(specDiff).toBeGreaterThan(0);
  });
});
