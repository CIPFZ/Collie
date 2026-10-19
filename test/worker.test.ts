import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBacklog } from '../src/backlog.js';
import { loadConfig } from '../src/config.js';
import {
  buildTask,
  readReport,
  ReportError,
  reportPath,
  runWorker,
  taskPath,
  writeTask,
  type TaskContext,
} from '../src/roles/worker.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Batch, Report } from '../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..');
const config = loadConfig(repoRoot);
const manual = readFileSync(join(repoRoot, 'AGENT-worker.md'), 'utf8');
const FENCE = '```';
const HEAD = 'e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3';

function backlogBatch(id: string): Batch {
  const found = loadBacklog(repoRoot).find((b) => b.id === id);
  if (found === undefined) throw new Error(`batch ${id} not in backlog`);
  return found;
}

const b02 = backlogBatch('v01-b02');

const ctx: TaskContext = {
  run_id: 'r-0002',
  base_sha: '4a690f567397beb10bfc2b93ab9023a71c3af30e',
  created_at: '2026-10-16T22:00:00Z',
  attempt: 1,
};

const claimedReport: Report = {
  schema_version: 1,
  batch_id: 'v01-b02',
  head_sha: HEAD,
  claims: {
    commits: [HEAD],
    tests_passed: 47,
    tests_failed: 0,
    pushed: true,
    ci_passed: true,
    new_deps: [],
    spec_touched: false,
  },
  open_questions: ['is 47 real?'],
};

/** A report in the SPEC 3.4 shape: four prose sections, then trailing JSON blocks. */
function reportMarkdown(...jsonBlocks: string[]): string {
  return [
    '# 批次 v01-b02 汇报',
    '## 做了什么',
    '全部完成。',
    '## 测试结果',
    '47 passed',
    '## 偏离或疑问',
    '无',
    '## 下一步建议',
    '无',
    ...jsonBlocks.flatMap((json) => [`${FENCE}json`, json, FENCE]),
    '',
  ].join('\n\n');
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collie-worker-'));
  copyFileSync(join(repoRoot, 'AGENT-worker.md'), join(root, 'AGENT-worker.md'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function placeReport(markdown: string, batchId = 'v01-b02'): void {
  const path = reportPath(root, batchId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown);
}

function reportError(batchId = 'v01-b02'): ReportError {
  try {
    readReport(root, batchId);
  } catch (error) {
    expect(error).toBeInstanceOf(ReportError);
    if (error instanceof ReportError) return error;
  }
  throw new Error('expected readReport to throw ReportError');
}

describe('worker: fake runner closed loop', () => {
  it('runs buildTask -> writeTask -> runWorker -> readReport end to end', async () => {
    const task = buildTask(b02, ctx);
    const written = writeTask(root, b02, task);
    expect(written).toBe(join(root, '.collie', 'batches', 'v01-b02', 'task.md'));
    expect(readFileSync(written, 'utf8')).toBe(task.markdown);

    const runner = new FakeRunner([
      {
        expectRole: 'worker',
        files: {
          '.collie/batches/v01-b02/report.md': reportMarkdown(
            JSON.stringify(claimedReport, null, 2),
          ),
        },
        result: {
          exitCode: 0,
          sessionId: 'opaque-1',
          usage: { inputTokens: 1200, outputTokens: 300 },
        },
      },
    ]);
    const result = await runWorker(runner, config, b02, root);
    expect(result).toEqual({
      exitCode: 0,
      sessionId: 'opaque-1',
      usage: { inputTokens: 1200, outputTokens: 300 },
    });

    const report = readReport(root, 'v01-b02');
    expect(report).toEqual(claimedReport);
    expect(typeof report.claims.tests_passed).toBe('number');
    expect(typeof report.claims.tests_failed).toBe('number');
    expect(typeof report.claims.pushed).toBe('boolean');
    expect(typeof report.claims.ci_passed).toBe('boolean');
    expect(typeof report.claims.spec_touched).toBe('boolean');
    expect(Array.isArray(report.claims.commits)).toBe(true);
    expect(Array.isArray(report.claims.new_deps)).toBe(true);
  });

  it('passes AGENT-worker.md as systemPrompt and the configured tools and turns', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runWorker(runner, config, b02, root);
    expect(runner.calls).toHaveLength(1);
    const [call] = runner.calls;
    expect(call?.role).toBe('worker');
    expect(call?.systemPrompt).toBe(manual);
    expect(call?.allowedTools).toEqual(config.agent.worker.allowed_tools);
    expect(call?.allowedTools).toEqual(['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']);
    expect(call?.maxTurns).toBe(config.agent.worker.max_turns);
    expect(call?.cwd).toBe(root);
    expect(call?.prompt).toContain('.collie/batches/v01-b02/task.md');
  });

  it('reads the manual from the given root, not from the Collie repository', async () => {
    writeFileSync(join(root, 'AGENT-worker.md'), 'project-specific manual\n');
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runWorker(runner, config, b02, root);
    expect(runner.calls[0]?.systemPrompt).toBe('project-specific manual\n');
  });

  it('propagates a runner crash and a non-zero exit code', async () => {
    const crash = new FakeRunner([{ error: new Error('agent crashed') }]);
    await expect(runWorker(crash, config, b02, root)).rejects.toThrow('agent crashed');
    const failed = new FakeRunner([{ result: { exitCode: 2 } }]);
    await expect(runWorker(failed, config, b02, root)).resolves.toEqual({ exitCode: 2 });
  });

  it('does not let the runner mutate the configured tool list', async () => {
    const runner = new FakeRunner([
      {
        effect: ({ opts }) => {
          opts.allowedTools.push('Danger');
        },
        result: { exitCode: 0 },
      },
    ]);
    await runWorker(runner, config, b02, root);
    expect(config.agent.worker.allowed_tools).not.toContain('Danger');
  });

  it('refuses to write a task envelope under another batch id', () => {
    const task = buildTask(b02, ctx);
    const b01 = backlogBatch('v01-b01');
    expect(() => writeTask(root, b01, task)).toThrow('task is for v01-b02, not v01-b01');
    expect(existsSync(taskPath(root, 'v01-b01'))).toBe(false);
  });
});

describe('worker: readReport boundaries', () => {
  it('fails when report.md does not exist', () => {
    expect(reportError().message).toContain('cannot read report');
  });

  it('fails when there is no JSON block', () => {
    placeReport(reportMarkdown());
    expect(reportError().message).toContain('no fenced ```json block found');
  });

  it('takes the last of two JSON blocks', () => {
    const draft = { ...claimedReport, claims: { ...claimedReport.claims, tests_passed: 1 } };
    placeReport(reportMarkdown(JSON.stringify(draft), JSON.stringify(claimedReport)));
    expect(readReport(root, 'v01-b02').claims.tests_passed).toBe(47);
  });

  it('fails when the last block violates the schema, even if an earlier one is valid', () => {
    const bad = { ...claimedReport, claims: { ...claimedReport.claims, tests_passed: '47' } };
    placeReport(reportMarkdown(JSON.stringify(claimedReport), JSON.stringify(bad)));
    const err = reportError();
    expect(err.message).toMatch(/fails the report schema: claims\.tests_passed: /);
  });

  it.each(['v01-b01', 'v01-b02'])('accepts the real %s report from the repository', (batchId) => {
    // v01-b01 predates claims.ci_passed; it must still be readable (SPEC 3.4).
    const report = readReport(repoRoot, batchId);
    expect(report.batch_id).toBe(batchId);
    expect(typeof report.claims.ci_passed).toBe('boolean');
  });

  it('fails when the last block is not valid JSON, naming its line', () => {
    placeReport(reportMarkdown('{"schema_version": 1,'));
    expect(reportError().message).toMatch(/json block at line \d+ is not valid JSON/);
  });

  it('fails when the report is truncated inside the JSON block', () => {
    placeReport(`${reportMarkdown()}\n${FENCE}json\n{"schema_version": 1`);
    expect(reportError().message).toContain('is never closed');
  });

  it('fails when the report belongs to another batch', () => {
    placeReport(reportMarkdown(JSON.stringify({ ...claimedReport, batch_id: 'v01-b01' })));
    expect(reportError().message).toContain('report is for batch v01-b01, expected v01-b02');
  });

  it('rejects an unsafe batch id before touching the filesystem', () => {
    expect(() => readReport(root, '../..')).toThrow('invalid batch id');
  });
});
