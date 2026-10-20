import { describe, expect, it } from 'vitest';
import type { ArbiterDecision } from '../src/arbiter.js';
import type { Evidence } from '../src/evidence.js';
import {
  applyEntry,
  BLOCK_END,
  BLOCK_START,
  ProgressError,
  type ProgressEntry,
} from '../src/progress.js';

const evidence: Evidence = {
  commits_actual: ['dbe90a4036e360312e0f6d3aab6131937ca9161a'],
  verify_results: [
    { cmd: 'npm test', exit_code: 1, summary: '44 passed, 3 failed' },
    { cmd: 'npm run lint', exit_code: 0, summary: 'clean' },
  ],
  remote_has_head: true,
  ci_conclusion: 'success',
  ci_run_url: 'https://github.com/CIPFZ/Collie/actions/runs/1',
  ci_branch_matched: true,
  deps_diff: [],
  spec_diff_lines: 0,
};

const decision: ArbiterDecision = {
  final: 'FIX',
  original: 'PASS',
  rule: 6,
  reason: 'claimed test counts differ',
  mismatches: [
    {
      rule: 6,
      field: 'tests',
      claimed: { passed: 47, failed: 0 },
      actual: { passed: 44, failed: 3 },
    },
  ],
  failedAcceptance: [],
  downgraded: true,
};

function entry(batchId: string, final: ProgressEntry['decision']['final'] = 'FIX'): ProgressEntry {
  return {
    batchId,
    runId: 'r-1',
    at: '2026-10-19T12:00:00.000Z',
    decision: { ...decision, final },
    evidence,
  };
}

const HUMAN = '# 进度\n\n人工内容。\n\n## 已知问题\n\n- 一条\n';

describe('progress: rendering from evidence only', () => {
  it('states the verdict, the downgrade, every measured command and the mismatch', () => {
    const text = applyEntry(HUMAN, entry('v01-b04'));
    expect(text).toContain('### v01-b04 · r-1 · FIX（reviewer 原判 PASS，规则 6 降级）');
    expect(text).toContain('- 验收命令：1/2 通过');
    expect(text).toContain('  - `npm test` → exit 1，44 passed, 3 failed');
    expect(text).toContain(
      '- CI：success，监听分支一致，https://github.com/CIPFZ/Collie/actions/runs/1',
    );
    expect(text).toContain('- 声称与实测不符：tests');
  });

  it('shows ci_branch_matched=null as not established', () => {
    const text = applyEntry('', {
      ...entry('v01-b04'),
      evidence: { ...evidence, ci_branch_matched: null, ci_run_url: '' },
    });
    expect(text).toContain('监听分支未能取证');
  });
});

describe('progress: Collie owns one marked block and nothing else', () => {
  it('appends the block after the hand-written content', () => {
    const text = applyEntry(HUMAN, entry('v01-b04'));
    expect(text.startsWith(HUMAN)).toBe(true);
    expect(text.indexOf(BLOCK_START)).toBeGreaterThan(HUMAN.length - 1);
    expect(text.trimEnd().endsWith(BLOCK_END)).toBe(true);
  });

  it('replaces the entry of the same batch and keeps others', () => {
    let text = applyEntry(HUMAN, entry('v01-b03', 'PASS'));
    text = applyEntry(text, entry('v01-b04', 'FIX'));
    text = applyEntry(text, entry('v01-b04', 'PASS'));
    expect(text.match(/### v01-b04 ·/g)).toHaveLength(1);
    expect(text).toContain('### v01-b03 · r-1 · PASS');
    expect(text).toContain('### v01-b04 · r-1 · PASS');
    expect(text.startsWith(HUMAN)).toBe(true);
  });

  it('leaves text after the block untouched', () => {
    const withTail = `${applyEntry(HUMAN, entry('v01-b03'))}\n## 人工追加\n\n保持原样。\n`;
    expect(applyEntry(withTail, entry('v01-b04')).endsWith('\n## 人工追加\n\n保持原样。\n')).toBe(
      true,
    );
  });

  it('refuses to guess with unbalanced markers', () => {
    expect(() => applyEntry(`${HUMAN}${BLOCK_START}\n`, entry('v01-b04'))).toThrow(ProgressError);
    expect(() => applyEntry(`${BLOCK_END}\n${BLOCK_START}\n`, entry('v01-b04'))).toThrow(
      ProgressError,
    );
  });
});
