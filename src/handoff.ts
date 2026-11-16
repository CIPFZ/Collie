// SPEC 14.3: handoff protocol — parseNext and decide.
// Pure functions: no node:fs, no node:child_process, no setTimeout/setInterval, no Date.now.
// This module reads docs/ops/next.md content (passed as a string) and returns
// structured results for collie follow to act on.

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three valid states for docs/ops/next.md. */
export type NextStatus = '开跑' | '等所有者裁定' | '收工';

/** Parsed 开跑 state with its required fields. */
export interface NextRun {
  ok: true;
  状态: '开跑';
  基准提交: string;
  固定版本: string;
  批次上限: number;
}

/** Parsed 等所有者裁定 state with its required fields. */
export interface NextWaitOwner {
  ok: true;
  状态: '等所有者裁定';
  基准提交: string;
  裁定事项: string;
}

/** Parsed 收工 state with its required fields. */
export interface NextDone {
  ok: true;
  状态: '收工';
  基准提交: string;
  摘要: string;
}

export type ParsedNext = NextRun | NextWaitOwner | NextDone;

/** Parse failure. */
export interface ParseError {
  ok: false;
  errors: string[];
  /** Hash of the raw input text, used as notification dedup key. */
  contentHash: string;
}

export type ParseResult = ParsedNext | ParseError;

/** State kept by collie follow between iterations (SPEC 14.3). */
export interface FollowState {
  /** The 基准提交 that was already run and reported. */
  handledBase: string | null;
  /** Set of notification keys already sent. */
  notified: ReadonlySet<string>;
}

export type DecideAction =
  | { action: 'wait' }
  | { action: 'notify_wait'; key: string; text: string }
  | { action: 'run'; baseSha: string; pinnedSha: string; max: number }
  | { action: 'notify_end'; key: string; text: string }
  | { action: 'end' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_STATUSES: ReadonlySet<string> = new Set<string>(['开跑', '等所有者裁定', '收工']);
const SHA_RE = /^[0-9a-f]{7,40}$/;
const FULL_WIDTH_COLON = '：'; // ：

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract key-value pairs before the first ## heading. */
function extractKvLines(text: string): { seen: Map<string, string>; errors: string[] } {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('## ')) break;

    const colonIdx = trimmed.indexOf(FULL_WIDTH_COLON);
    if (colonIdx < 0) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + FULL_WIDTH_COLON.length).trim();

    if (key === '') continue;

    if (seen.has(key)) {
      errors.push(`duplicate key: ${key}`);
      continue;
    }
    seen.set(key, value);
  }
  return { seen, errors };
}

/**
 * Validate and build the result for 开跑.
 * Returns the typed result or appends errors and returns undefined.
 */
function buildRun(
  baseSha: string,
  seen: Map<string, string>,
  errors: string[],
): NextRun | undefined {
  const pinned = seen.get('固定版本');
  if (pinned === undefined) {
    errors.push('missing required key for 开跑: 固定版本');
  } else if (!SHA_RE.test(pinned)) {
    errors.push(`invalid 固定版本 (not a valid sha): ${pinned}`);
  }

  const maxStr = seen.get('批次上限');
  let maxVal: number | undefined;
  if (maxStr === undefined) {
    errors.push('missing required key for 开跑: 批次上限');
  } else {
    const n = Number(maxStr);
    if (!Number.isInteger(n) || n < 1) {
      errors.push(`invalid 批次上限 (not a positive integer): ${maxStr}`);
    } else {
      maxVal = n;
    }
  }

  if (errors.length > 0) return undefined;
  // At this point both pinned and maxVal are validated.
  return {
    ok: true,
    状态: '开跑',
    基准提交: baseSha,
    固定版本: pinned ?? '',
    批次上限: maxVal ?? 0,
  };
}

// ---------------------------------------------------------------------------
// parseNext
// ---------------------------------------------------------------------------

/**
 * SPEC 14.3: parse the key-value header of docs/ops/next.md.
 *
 * Only lines before the first `## ` heading count. Each line is `键：值`
 * (full-width colon). Duplicate keys, missing required keys, and invalid
 * value formats all produce errors.
 */
export function parseNext(text: string): ParseResult {
  const hash = createHash('sha256').update(text).digest('hex');
  const { seen, errors } = extractKvLines(text);

  // Validate 状态 (always required).
  const statusRaw = seen.get('状态');
  if (statusRaw === undefined) {
    errors.push('missing required key: 状态');
    return { ok: false, errors, contentHash: hash };
  }
  if (!VALID_STATUSES.has(statusRaw)) {
    errors.push(`invalid 状态: ${statusRaw}`);
    return { ok: false, errors, contentHash: hash };
  }
  const status = statusRaw as NextStatus;

  // Validate 基准提交 (always required).
  const baseSha = seen.get('基准提交');
  if (baseSha === undefined) {
    errors.push('missing required key: 基准提交');
    return { ok: false, errors, contentHash: hash };
  }
  if (!SHA_RE.test(baseSha)) {
    errors.push(`invalid 基准提交 (not a valid sha): ${baseSha}`);
    return { ok: false, errors, contentHash: hash };
  }

  // Conditional required keys per status.
  if (status === '开跑') {
    const result = buildRun(baseSha, seen, errors);
    if (result !== undefined) return result;
    return { ok: false, errors, contentHash: hash };
  }

  if (status === '等所有者裁定') {
    const ruling = seen.get('裁定事项');
    if (ruling === undefined) {
      errors.push('missing required key for 等所有者裁定: 裁定事项');
      return { ok: false, errors, contentHash: hash };
    }
    return { ok: true, 状态: '等所有者裁定', 基准提交: baseSha, 裁定事项: ruling };
  }

  // status === '收工'
  const summary = seen.get('摘要');
  if (summary === undefined) {
    errors.push('missing required key for 收工: 摘要');
    return { ok: false, errors, contentHash: hash };
  }
  return { ok: true, 状态: '收工', 基准提交: baseSha, 摘要: summary };
}

// ---------------------------------------------------------------------------
// decide
// ---------------------------------------------------------------------------

/**
 * SPEC 14.3 decision table: given the parsed next.md and follow state,
 * return the action collie follow should take.
 */
export function decide(next: ParseResult, state: FollowState): DecideAction {
  // Row 1: format error.
  if (!next.ok) {
    const key = `invalid:${next.contentHash}`;
    if (!state.notified.has(key)) {
      return {
        action: 'notify_wait',
        key,
        text: `next.md format error: ${next.errors.join('; ')}`,
      };
    }
    return { action: 'wait' };
  }

  switch (next.状态) {
    // Rows 2-3: 开跑.
    case '开跑': {
      if (next.基准提交 === state.handledBase) return { action: 'wait' };
      return {
        action: 'run',
        baseSha: next.基准提交,
        pinnedSha: next.固定版本,
        max: next.批次上限,
      };
    }

    // Row 4: 等所有者裁定.
    case '等所有者裁定': {
      const key = `owner:${next.基准提交}`;
      if (!state.notified.has(key)) {
        return { action: 'notify_wait', key, text: next.裁定事项 };
      }
      return { action: 'wait' };
    }

    // Row 5: 收工.
    case '收工': {
      const key = `done:${next.基准提交}`;
      if (!state.notified.has(key)) {
        return { action: 'notify_end', key, text: next.摘要 };
      }
      return { action: 'end' };
    }
  }
}
