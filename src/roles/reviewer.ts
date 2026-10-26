// R4 reviewer role (SPEC 4.2, ROLES 2 R4). The prompt is assembled from zero
// out of an allow-list of inputs. Nothing here can see the worker's report:
// the input type has no field for it, unknown fields are rejected at runtime,
// and ESLint forbids importing the worker role, which owns the report reader.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentRunner, RunResult } from '../runner/index.js';
import { EnvelopeError, lastJsonBlock } from '../schema/envelope.js';
import {
  AcceptanceSchema,
  BatchIdSchema,
  ShaSchema,
  VerdictSchema,
  type Acceptance,
  type CollieConfig,
  type Verdict,
} from '../schema/index.js';

export const REVIEWER_MANUAL = 'AGENT-reviewer.md';
export const VERDICT_FILE_NAME = 'verdict.md';
const BATCHES_RELATIVE_DIR = join('.collie', 'batches');

/** Tools that would let the reviewer change the repository (backlog v01-b03 forbidden list). */
export const WRITE_TOOLS: readonly string[] = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

/**
 * Everything the reviewer may be told (SPEC 4.2): the diff pointer, the batch
 * items and acceptance commands, and SPEC paths to read itself. There is
 * deliberately no field for the report body, worker history or session id.
 */
export const ReviewerInputSchema = z.strictObject({
  batch_id: BatchIdSchema,
  base_sha: ShaSchema,
  head_sha: ShaSchema,
  items: z.array(z.string().min(1)),
  /** In parseBacklog form: the commands to run verbatim (SPEC 3.2). */
  acceptance: z.array(AcceptanceSchema).nonempty(),
  spec_paths: z.array(z.string().min(1)).nonempty(),
});
export type ReviewerInput = z.infer<typeof ReviewerInputSchema>;

export class ReviewerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewerError';
  }
}

export class VerdictError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = 'VerdictError';
    this.path = path;
  }
}

function validInput(input: ReviewerInput): ReviewerInput {
  const parsed = ReviewerInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new ReviewerError(`invalid reviewer input: ${issues.join('; ')}`);
  }
  return parsed.data;
}

function expectText(expect: Acceptance['expect']): string {
  return expect === 'exit_zero'
    ? '退出码为 0'
    : `退出码为 0 且 stdout 匹配 /${expect.stdout_matches}/`;
}

/** A fence longer than any backtick run in `text`, so the command is shown verbatim. */
function fenced(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(Math.max(longest + 1, '```'.length));
  return `${fence}sh\n${text}\n${fence}`;
}

export function verdictPath(root: string, batchId: string): string {
  return join(root, BATCHES_RELATIVE_DIR, BatchIdSchema.parse(batchId), VERDICT_FILE_NAME);
}

/** Builds the reviewer prompt from the SPEC 4.2 allow-list only. */
export function buildReviewerPrompt(input: ReviewerInput): string {
  const data = validInput(input);
  const range = `${data.base_sha}..${data.head_sha}`;
  const sections = [
    `# 审核批次 ${data.batch_id}`,
    [
      '## 取证范围',
      '',
      `worker 产出的 diff 为 \`${range}\`（\`git log ${range}\`、\`git diff ${range}\`）。`,
      '`head_sha` 之后的 `report(collie):` 信封提交不在取证范围内（SPEC 3.4）。',
    ].join('\n'),
    [
      '## 本批次条目',
      '',
      ...(data.items.length > 0
        ? data.items.map((item, i) => `${String(i + 1)}. ${item.split('\n').join('\n   ')}`)
        : ['（未提供）']),
    ].join('\n'),
    [
      '## 验收命令',
      '',
      '以下命令已是 `parseBacklog` 解析后的形式（SPEC 3.2 唯一执行形式），逐条原样实跑，',
      '记录真实退出码与输出；不要从任何 `.md` 源码复制命令。',
      '',
      ...data.acceptance.map(
        (a, i) =>
          `${String(i + 1)}. ${a.desc}（期望：${expectText(a.expect)}）\n\n${fenced(a.cmd)}\n`,
      ),
    ].join('\n'),
    ['## 需要自行阅读的 SPEC 章节', '', ...data.spec_paths.map((p) => `- \`${p}\``)].join('\n'),
    [
      '## 输出',
      '',
      '你没有写文件的工具。把完整裁决（推理正文 + 尾部 ```json 块，字段见 SPEC 3.5）',
      `作为最终回复输出，由 R2 落盘到 \`.collie/batches/${data.batch_id}/${VERDICT_FILE_NAME}\`。`,
    ].join('\n'),
  ];
  return `${sections.join('\n\n')}\n`;
}

/**
 * Launches the reviewer through `runner` with the R4 manual and the reviewer
 * tool whitelist, refusing any whitelist that grants write access.
 */
export async function runReviewer(
  runner: AgentRunner,
  cfg: CollieConfig,
  input: ReviewerInput,
  root: string,
  opts: {
    signal?: AbortSignal;
    onEvent?: (event: unknown) => void;
    redact?: readonly string[];
  } = {},
): Promise<RunResult> {
  const tools = cfg.agent.reviewer.allowed_tools;
  const writable = tools.filter((t) => WRITE_TOOLS.includes(t));
  if (writable.length > 0) {
    throw new ReviewerError(`reviewer must not have write tools, got ${writable.join(', ')}`);
  }
  const prompt = buildReviewerPrompt(input);
  const systemPrompt = readFileSync(join(root, REVIEWER_MANUAL), 'utf8');
  return runner.run({
    role: 'reviewer',
    prompt,
    systemPrompt,
    allowedTools: [...tools],
    cwd: root,
    maxTurns: cfg.agent.reviewer.max_turns,
    ...(opts.signal === undefined ? {} : { signal: opts.signal }),
    ...(opts.onEvent === undefined ? {} : { onEvent: opts.onEvent }),
    ...(opts.redact !== undefined && opts.redact.length > 0 ? { redact: [...opts.redact] } : {}),
  });
}

/** Reads verdict.md and validates its last fenced JSON block (SPEC 3.5). */
export function readVerdict(root: string, batchId: string): Verdict {
  const path = verdictPath(root, batchId);
  let markdown: string;
  try {
    markdown = readFileSync(path, 'utf8');
  } catch (error) {
    throw new VerdictError(
      path,
      `cannot read verdict: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let block;
  try {
    block = lastJsonBlock(markdown);
  } catch (error) {
    if (error instanceof EnvelopeError) throw new VerdictError(path, error.message);
    throw error;
  }
  if (block === undefined) throw new VerdictError(path, 'no fenced ```json block found');

  let raw: unknown;
  try {
    raw = JSON.parse(block.content);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new VerdictError(
      path,
      `json block at line ${String(block.line)} is not valid JSON: ${reason}`,
    );
  }
  const result = VerdictSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new VerdictError(
      path,
      `json block at line ${String(block.line)} fails the verdict schema: ${issues.join('; ')}`,
    );
  }
  if (result.data.batch_id !== batchId) {
    throw new VerdictError(
      path,
      `verdict is for batch ${result.data.batch_id}, expected ${batchId}`,
    );
  }
  return result.data;
}
