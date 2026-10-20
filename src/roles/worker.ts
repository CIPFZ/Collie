// R3 worker role (SPEC 4, ROLES 2 R3): build and write task.md, launch the
// worker through the runner interface, read back and validate report.md.
// Depends on the runner *interface* only (CONSTRAINTS 铁律 15).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AgentRunner, RunHandle, RunResult } from '../runner/index.js';
import { EnvelopeError, lastJsonBlock, renderFrontmatter } from '../schema/envelope.js';
import {
  BatchIdSchema,
  ReportSchema,
  type Acceptance,
  type Batch,
  type CollieConfig,
  type Report,
  type TaskFrontmatter,
} from '../schema/index.js';

export const BATCHES_RELATIVE_DIR = join('.collie', 'batches');
export const TASK_FILE_NAME = 'task.md';
export const REPORT_FILE_NAME = 'report.md';
export const WORKER_MANUAL = 'AGENT-worker.md';
/** issued_by of every envelope collie run writes (SPEC 3.3). */
export const ISSUER = 'collie';

/** Facts only R2 knows when issuing a task (SPEC 3.3). Time is passed in, never read here. */
export interface TaskContext {
  run_id: string;
  base_sha: string;
  created_at: string;
  attempt: number;
}

export interface TaskEnvelope {
  frontmatter: TaskFrontmatter;
  markdown: string;
}

export class ReportError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = 'ReportError';
    this.path = path;
  }
}

function batchDir(root: string, batchId: string): string {
  const parsed = BatchIdSchema.safeParse(batchId);
  if (!parsed.success) throw new Error(`invalid batch id ${JSON.stringify(batchId)}`);
  return join(root, BATCHES_RELATIVE_DIR, parsed.data);
}

export function taskPath(root: string, batchId: string): string {
  return join(batchDir(root, batchId), TASK_FILE_NAME);
}

export function reportPath(root: string, batchId: string): string {
  return join(batchDir(root, batchId), REPORT_FILE_NAME);
}

/** Escapes a table cell for GFM: pipes split cells even inside code spans. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Wraps `text` in a code span whose backtick run is longer than any run inside it. */
function codeSpan(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function expectText(expect: Acceptance['expect']): string {
  return expect === 'exit_zero' ? 'exit 0' : `stdout 匹配 ${codeSpan(expect.stdout_matches)}`;
}

/** Indents continuation lines so a multi-line item stays inside its list entry. */
function listItem(marker: string, text: string): string {
  return `${marker} ${text.split('\n').join(`\n${' '.repeat(marker.length + 1)}`)}`;
}

function renderBody(batch: Batch): string {
  const reportFile = `.collie/batches/${batch.id}/${REPORT_FILE_NAME}`;
  const sections = [
    `# 批次 ${batch.id}：${batch.title}`,
    [
      '## 你的身份与边界',
      '',
      `你的身份、权限边界与工作协议见 \`${WORKER_MANUAL}\`，全局铁律见 \`CONSTRAINTS.md\`，`,
      '方案来源见 `SPEC.md`。本文件只做本批次提醒。',
    ].join('\n'),
    [
      `## 本批次条目（${String(batch.items.length)} 个）`,
      '',
      ...batch.items.map((item, i) => listItem(`${String(i + 1)}.`, item)),
    ].join('\n'),
    [
      '## 验收标准（可机器判定）',
      '',
      '| 说明 | 命令 | 期望 |',
      '|---|---|---|',
      ...batch.acceptance.map(
        (a) => `| ${cell(a.desc)} | ${cell(codeSpan(a.cmd))} | ${cell(expectText(a.expect))} |`,
      ),
    ].join('\n'),
    [
      '## 本批次额外禁止',
      '',
      ...(batch.forbidden.length > 0 ? batch.forbidden.map((f) => listItem('-', f)) : ['- 无']),
    ].join('\n'),
    [
      '## 汇报要求',
      '',
      `完成后写 \`${reportFile}\`：固定四段（做了什么 / 测试结果 / 偏离或疑问 / 下一步建议）`,
      '+ 尾部围栏 JSON 块，格式见 SPEC 3.4。',
      `写完后以 \`report(collie): ${batch.id}\` 为提交信息单独提交并推送该文件。`,
    ].join('\n'),
  ];
  return `${sections.join('\n\n')}\n`;
}

/** Assembles task.md: YAML frontmatter (SPEC 3.3) followed by the Markdown body. */
export function buildTask(batch: Batch, ctx: TaskContext): TaskEnvelope {
  const frontmatter: TaskFrontmatter = {
    schema_version: 1,
    run_id: ctx.run_id,
    batch_id: batch.id,
    base_sha: ctx.base_sha,
    created_at: ctx.created_at,
    attempt: ctx.attempt,
    interrupted_at: null,
    // SPEC 3.3: tells the worker no human will confirm a plan (AGENT-worker.md 6).
    issued_by: ISSUER,
  };
  // renderFrontmatter validates, so an invalid context fails here, not at the worker.
  return { frontmatter, markdown: `${renderFrontmatter(frontmatter)}\n${renderBody(batch)}` };
}

/** Writes task.md to .collie/batches/<id>/ and returns its path. */
export function writeTask(root: string, batch: Batch, task: TaskEnvelope): string {
  if (task.frontmatter.batch_id !== batch.id) {
    throw new Error(`task is for ${task.frontmatter.batch_id}, not ${batch.id}`);
  }
  const path = taskPath(root, batch.id);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, task.markdown);
  return path;
}

/** The prompt only points at task.md; the worker reads it and the repo itself. */
function workerPrompt(batch: Batch): string {
  return [
    `执行批次 ${batch.id}。`,
    `任务信封：.collie/batches/${batch.id}/${TASK_FILE_NAME}。`,
    `按 ${WORKER_MANUAL} 第 1 节顺序阅读后开始。`,
  ].join('\n');
}

/**
 * Launches the worker through `runner` with the R3 manual and the configured tool whitelist.
 * `signal` is forwarded untouched; the wall-clock budget is R2's concern (SPEC 3.3).
 * `onEvent` and `onStarted` are forwarded for stream/heartbeat (SPEC 11.2, 11.3).
 */
export async function runWorker(
  runner: AgentRunner,
  cfg: CollieConfig,
  batch: Batch,
  root: string,
  opts: {
    signal?: AbortSignal;
    onEvent?: (event: unknown) => void;
    onStarted?: (handle: RunHandle) => void;
    resumeSessionId?: string;
  } = {},
): Promise<RunResult> {
  const systemPrompt = readFileSync(join(root, WORKER_MANUAL), 'utf8');
  return runner.run({
    role: 'worker',
    prompt: workerPrompt(batch),
    systemPrompt,
    allowedTools: [...cfg.agent.worker.allowed_tools],
    cwd: root,
    maxTurns: cfg.agent.worker.max_turns,
    ...(opts.signal === undefined ? {} : { signal: opts.signal }),
    ...(opts.onEvent === undefined ? {} : { onEvent: opts.onEvent }),
    ...(opts.onStarted === undefined ? {} : { onStarted: opts.onStarted }),
    ...(opts.resumeSessionId === undefined ? {} : { resumeSessionId: opts.resumeSessionId }),
  });
}

/** Reads report.md and validates its last fenced JSON block (SPEC 3.4). */
export function readReport(root: string, batchId: string): Report {
  const path = reportPath(root, batchId);
  let markdown: string;
  try {
    markdown = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ReportError(path, `cannot read report: ${reason}`);
  }

  let block;
  try {
    block = lastJsonBlock(markdown);
  } catch (error) {
    if (error instanceof EnvelopeError) throw new ReportError(path, error.message);
    throw error;
  }
  if (block === undefined) throw new ReportError(path, 'no fenced ```json block found');

  let raw: unknown;
  try {
    raw = JSON.parse(block.content);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ReportError(
      path,
      `json block at line ${String(block.line)} is not valid JSON: ${reason}`,
    );
  }
  const result = ReportSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new ReportError(
      path,
      `json block at line ${String(block.line)} fails the report schema: ${issues.join('; ')}`,
    );
  }
  if (result.data.batch_id !== batchId) {
    throw new ReportError(path, `report is for batch ${result.data.batch_id}, expected ${batchId}`);
  }
  return result.data;
}
