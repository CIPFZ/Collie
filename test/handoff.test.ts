import { describe, expect, it } from 'vitest';
import { parseNext, decide, type FollowState } from '../src/handoff.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a simple next.md text from key-value pairs. */
function md(kvs: Record<string, string>, body?: string): string {
  const lines = Object.entries(kvs).map(([k, v]) => `${k}：${v}`);
  if (body !== undefined) lines.push('', body);
  return lines.join('\n');
}

const EMPTY_STATE: FollowState = { handledBase: null, notified: new Set() };

// ---------------------------------------------------------------------------
// parseNext — three states and their required keys
// ---------------------------------------------------------------------------

describe('parseNext (SPEC 14.3)', () => {
  it('parses a valid 开跑 document', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: '4',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.状态).toBe('开跑');
    if (r.状态 !== '开跑') return;
    expect(r.基准提交).toBe('abc1234');
    expect(r.固定版本).toBe('def5678');
    expect(r.批次上限).toBe(4);
  });

  it('parses a valid 等所有者裁定 document', () => {
    const text = md({
      状态: '等所有者裁定',
      基准提交: 'abc1234',
      裁定事项: 'v04 closure check',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.状态).toBe('等所有者裁定');
    if (r.状态 !== '等所有者裁定') return;
    expect(r.裁定事项).toBe('v04 closure check');
  });

  it('parses a valid 收工 document', () => {
    const text = md({
      状态: '收工',
      基准提交: 'abc1234',
      摘要: 'all done',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.状态).toBe('收工');
    if (r.状态 !== '收工') return;
    expect(r.摘要).toBe('all done');
  });

  it('rejects duplicate keys', () => {
    // Manually craft a text with duplicate key.
    const text = '状态：开跑\n状态：收工\n基准提交：abc1234\n固定版本：def5678\n批次上限：4';
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('duplicate'))).toBe(true);
  });

  it('rejects invalid sha format for 基准提交', () => {
    const text = md({ 状态: '收工', 基准提交: 'XXXX', 摘要: 'done' });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('基准提交'))).toBe(true);
  });

  it('rejects 批次上限 that is not a positive integer', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: '0',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('批次上限'))).toBe(true);
  });

  it('rejects negative 批次上限', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: '-3',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('批次上限'))).toBe(true);
  });

  it('ignores key-value lines after the first ## heading', () => {
    const text =
      '状态：收工\n基准提交：abc1234\n摘要：done\n## Notes\n批次上限：4\n固定版本：dead123';
    const r = parseNext(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.状态).toBe('收工');
    // 批次上限 and 固定版本 should NOT be parsed (they are after ##).
  });

  it('reports missing required keys for 开跑 (no 固定版本)', () => {
    const text = md({ 状态: '开跑', 基准提交: 'abc1234', 批次上限: '4' });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('固定版本'))).toBe(true);
  });

  it('reports missing 裁定事项 for 等所有者裁定', () => {
    const text = md({ 状态: '等所有者裁定', 基准提交: 'abc1234' });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('裁定事项'))).toBe(true);
  });

  it('reports missing 摘要 for 收工', () => {
    const text = md({ 状态: '收工', 基准提交: 'abc1234' });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('摘要'))).toBe(true);
  });

  it('rejects non-numeric 批次上限', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: 'abc',
    });
    const r = parseNext(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.includes('批次上限'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// decide — SPEC 14.3 decision table
// ---------------------------------------------------------------------------

describe('decide (SPEC 14.3 decision table)', () => {
  it('format error + not yet notified → notify_wait', () => {
    const next = parseNext('garbage content without keys');
    expect(next.ok).toBe(false);
    const action = decide(next, EMPTY_STATE);
    expect(action.action).toBe('notify_wait');
    if (action.action !== 'notify_wait') return;
    expect(action.key).toMatch(/^invalid:/);
  });

  it('format error + already notified → wait', () => {
    const next = parseNext('garbage content without keys');
    expect(next.ok).toBe(false);
    if (next.ok) return;
    const key = `invalid:${next.contentHash}`;
    const action = decide(next, { handledBase: null, notified: new Set([key]) });
    expect(action.action).toBe('wait');
  });

  it('开跑 + baseSha == handledBase → wait', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: '4',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, { handledBase: 'abc1234', notified: new Set() });
    expect(action.action).toBe('wait');
  });

  it('开跑 + baseSha != handledBase → run', () => {
    const text = md({
      状态: '开跑',
      基准提交: 'abc1234',
      固定版本: 'def5678',
      批次上限: '4',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, EMPTY_STATE);
    expect(action.action).toBe('run');
    if (action.action !== 'run') return;
    expect(action.baseSha).toBe('abc1234');
    expect(action.pinnedSha).toBe('def5678');
    expect(action.max).toBe(4);
  });

  it('等所有者裁定 + not yet notified → notify_wait with 裁定事项', () => {
    const text = md({
      状态: '等所有者裁定',
      基准提交: 'abc1234',
      裁定事项: 'check v04 closure',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, EMPTY_STATE);
    expect(action.action).toBe('notify_wait');
    if (action.action !== 'notify_wait') return;
    expect(action.key).toBe('owner:abc1234');
    expect(action.text).toBe('check v04 closure');
  });

  it('等所有者裁定 + already notified → wait', () => {
    const text = md({
      状态: '等所有者裁定',
      基准提交: 'abc1234',
      裁定事项: 'check v04 closure',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, { handledBase: null, notified: new Set(['owner:abc1234']) });
    expect(action.action).toBe('wait');
  });

  it('收工 + not yet notified → notify_end with 摘要', () => {
    const text = md({
      状态: '收工',
      基准提交: 'abc1234',
      摘要: 'v0.45 complete',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, EMPTY_STATE);
    expect(action.action).toBe('notify_end');
    if (action.action !== 'notify_end') return;
    expect(action.key).toBe('done:abc1234');
    expect(action.text).toBe('v0.45 complete');
  });

  it('收工 + already notified → end', () => {
    const text = md({
      状态: '收工',
      基准提交: 'abc1234',
      摘要: 'v0.45 complete',
    });
    const next = parseNext(text);
    expect(next.ok).toBe(true);
    const action = decide(next, { handledBase: null, notified: new Set(['done:abc1234']) });
    expect(action.action).toBe('end');
  });

  it('format error notification key changes when content changes', () => {
    const next1 = parseNext('bad1');
    const next2 = parseNext('bad2');
    expect(next1.ok).toBe(false);
    expect(next2.ok).toBe(false);
    if (next1.ok || next2.ok) return;
    // Different content should produce different hashes.
    expect(next1.contentHash).not.toBe(next2.contentHash);
  });
});
