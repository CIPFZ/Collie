// Writes R2's evidence-based record into docs/progress.md (SPEC 6, CONSTRAINTS
// 铁律 3). The file is also curated by hand, so Collie owns exactly one block
// between two markers and never touches anything outside it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArbiterDecision } from './arbiter.js';
import type { Evidence } from './evidence.js';

export const PROGRESS_RELATIVE_PATH = join('docs', 'progress.md');
export const BLOCK_START = '<!-- collie:runs:start -->';
export const BLOCK_END = '<!-- collie:runs:end -->';
const BLOCK_HEADING = '## 调度器实测记录（collie run 自动写入）';
// eslint-disable-next-line no-restricted-syntax -- git's conventional abbreviation length
const SHORT_SHA = 7;

export interface ProgressEntry {
  batchId: string;
  runId: string;
  /** ISO 8601, passed in so output is deterministic. */
  at: string;
  decision: ArbiterDecision;
  evidence: Evidence;
  /** SPEC 11.7: worker's exit code, when available. */
  workerExitCode?: number;
  /** SPEC 11.7: worker's stop reason, when available. */
  workerStopReason?: string;
}

export class ProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressError';
  }
}

function short(sha: string): string {
  return sha.slice(0, SHORT_SHA);
}

/** One entry, built only from measured evidence and the arbiter's decision. */
export function renderEntry(entry: ProgressEntry): string {
  const { decision, evidence } = entry;
  const verdict =
    decision.original === null || !decision.downgraded
      ? decision.final
      : `${decision.final}（reviewer 原判 ${decision.original}，规则 ${String(decision.rule)} 降级）`;
  const failed = evidence.verify_results.filter((r) => r.exit_code !== 0).length;
  const lines = [
    `### ${entry.batchId} · ${entry.runId} · ${verdict}`,
    '',
    `- 时间：${entry.at}`,
    `- 裁定：规则 ${String(decision.rule)}，${decision.reason}`,
    `- 提交：${evidence.commits_actual.length > 0 ? evidence.commits_actual.map((s) => `\`${short(s)}\``).join(' ') : '无'}`,
    `- 验收命令：${String(evidence.verify_results.length - failed)}/${String(evidence.verify_results.length)} 通过`,
    ...evidence.verify_results.map(
      (r) => `  - \`${r.cmd}\` → exit ${String(r.exit_code)}，${r.summary}`,
    ),
    `- 已推送：${evidence.remote_has_head ? '是' : '否'}`,
    `- CI：${evidence.ci_conclusion}，监听分支${evidence.ci_branch_matched === null ? '未能取证' : evidence.ci_branch_matched ? '一致' : '不一致'}${evidence.ci_run_url === '' ? '' : `，${evidence.ci_run_url}`}`,
    `- 受保护文件改动行数：${String(evidence.spec_diff_lines)}`,
    `- 依赖变化：${evidence.deps_diff.length > 0 ? evidence.deps_diff.join('、') : '无'}`,
    ...(decision.mismatches.length > 0
      ? [`- 声称与实测不符：${decision.mismatches.map((m) => m.field).join('、')}`]
      : []),
    ...(entry.workerExitCode !== undefined
      ? [
          `- worker 退出码：${String(entry.workerExitCode)}${entry.workerStopReason !== undefined ? `（${entry.workerStopReason}）` : ''}`,
        ]
      : []),
  ];
  return lines.join('\n');
}

/** Replaces or appends the entry for `entry.batchId` inside Collie's block of `text`. */
export function applyEntry(text: string, entry: ProgressEntry): string {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start < 0 !== end < 0 || (start >= 0 && end < start)) {
    throw new ProgressError(
      `${PROGRESS_RELATIVE_PATH}: unbalanced ${BLOCK_START} / ${BLOCK_END} markers`,
    );
  }
  const rendered = renderEntry(entry);
  if (start < 0) {
    const block = `${BLOCK_HEADING}\n\n${BLOCK_START}\n${rendered}\n${BLOCK_END}\n`;
    return `${text.replace(/\n*$/, '\n\n')}${block}`;
  }
  const inner = text.slice(start + BLOCK_START.length, end);
  // SPEC 4 progress.ts: append per run, not per batch. Only replace entries
  // with the same batchId AND runId (idempotency), keep other runs of the
  // same batch intact.
  const entries = inner
    .split(/\n(?=### )/)
    .map((e) => e.trim())
    .filter((e) => e !== '' && !e.startsWith(`### ${entry.batchId} · ${entry.runId} ·`));
  entries.push(rendered);
  return `${text.slice(0, start + BLOCK_START.length)}\n${entries.join('\n\n')}\n${text.slice(end)}`;
}

/** Updates `<root>/docs/progress.md` in place, keeping everything outside the block. */
export function writeProgress(root: string, entry: ProgressEntry): string {
  const path = join(root, PROGRESS_RELATIVE_PATH);
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  writeFileSync(path, applyEntry(text, entry));
  return path;
}
