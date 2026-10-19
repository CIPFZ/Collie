import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import {
  readVerdict,
  runReviewer,
  verdictPath,
  VerdictError,
  type ReviewerInput,
} from '../src/roles/reviewer.js';
import { FakeRunner } from '../src/runner/fake.js';
import { lastJsonBlock } from '../src/schema/envelope.js';
import { VerdictSchema, type Verdict } from '../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..');
const config = loadConfig(repoRoot);
const FENCE = '```';

const input: ReviewerInput = {
  batch_id: 'v01-b03',
  base_sha: '96d2c1c',
  head_sha: '080377c',
  items: ['item'],
  acceptance: [{ desc: 'tests', cmd: 'npm test', expect: 'exit_zero' }],
  spec_paths: ['SPEC.md'],
};

const verdict: Verdict = {
  schema_version: 1,
  batch_id: 'v01-b03',
  verdict: 'FIX',
  evidence: {
    commits_actual: ['080377c'],
    verify_results: [{ cmd: 'npm test', exit_code: 1, summary: '44 passed, 3 failed' }],
    remote_has_head: true,
    ci_conclusion: 'success',
    ci_run_url: 'https://github.com/CIPFZ/Collie/actions/runs/1',
    ci_branch_matched: false,
    deps_diff: [],
    spec_diff_lines: 0,
  },
  claim_mismatches: [{ field: 'tests_failed', claimed: 0, actual: 3 }],
  gaps: ['3 tests fail'],
  reason: '声称与实测不符',
};

function verdictMarkdown(...blocks: string[]): string {
  return ['# 裁决', '推理正文。', ...blocks.flatMap((b) => [`${FENCE}json`, b, FENCE]), ''].join(
    '\n\n',
  );
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collie-reviewer-'));
  copyFileSync(join(repoRoot, 'AGENT-reviewer.md'), join(root, 'AGENT-reviewer.md'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function placeVerdict(markdown: string, batchId = 'v01-b03'): void {
  const path = verdictPath(root, batchId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdown);
}

function verdictError(batchId = 'v01-b03'): VerdictError {
  try {
    readVerdict(root, batchId);
  } catch (error) {
    expect(error).toBeInstanceOf(VerdictError);
    if (error instanceof VerdictError) return error;
  }
  throw new Error('expected readVerdict to throw VerdictError');
}

describe('reviewer: runReviewer', () => {
  it('launches role reviewer in root with the configured turns', async () => {
    const runner = new FakeRunner([{ expectRole: 'reviewer', result: { exitCode: 0 } }]);
    await expect(runReviewer(runner, config, input, root)).resolves.toEqual({ exitCode: 0 });
    expect(runner.calls[0]).toMatchObject({
      role: 'reviewer',
      cwd: root,
      maxTurns: 60,
      hasSignal: false,
    });
  });

  it('forwards a signal and propagates a crash', async () => {
    const runner = new FakeRunner([{ error: new Error('reviewer crashed') }]);
    await expect(
      runReviewer(runner, config, input, root, { signal: new AbortController().signal }),
    ).rejects.toThrow('reviewer crashed');
    expect(runner.calls[0]?.hasSignal).toBe(true);
  });

  it('closes the loop with a verdict persisted next to the batch', async () => {
    const runner = new FakeRunner([
      {
        expectRole: 'reviewer',
        // Stands in for R2 persisting the reviewer's final reply (ROLES 2 R4).
        files: {
          '.collie/batches/v01-b03/verdict.md': verdictMarkdown(JSON.stringify(verdict, null, 2)),
        },
        result: { exitCode: 0 },
      },
    ]);
    await runReviewer(runner, config, input, root);
    expect(readVerdict(root, 'v01-b03')).toEqual(verdict);
  });
});

describe('reviewer: VerdictSchema (SPEC 3.5)', () => {
  it('round-trips through JSON', () => {
    expect(VerdictSchema.parse(JSON.parse(JSON.stringify(verdict)))).toEqual(verdict);
  });

  it.each([
    ['lower-case verdict', { ...verdict, verdict: 'pass' }, 'verdict'],
    ['unknown verdict', { ...verdict, verdict: 'MAYBE' }, 'verdict'],
    [
      'free-text ci_conclusion',
      { ...verdict, evidence: { ...verdict.evidence, ci_conclusion: 'success (owner check)' } },
      'evidence.ci_conclusion',
    ],
    [
      'negative spec lines',
      { ...verdict, evidence: { ...verdict.evidence, spec_diff_lines: -1 } },
      'evidence.spec_diff_lines',
    ],
    [
      'string exit code',
      {
        ...verdict,
        evidence: {
          ...verdict.evidence,
          verify_results: [{ cmd: 'x', exit_code: '0', summary: '' }],
        },
      },
      'evidence.verify_results.0.exit_code',
    ],
    [
      'non-hex commit',
      { ...verdict, evidence: { ...verdict.evidence, commits_actual: ['HEAD'] } },
      'evidence.commits_actual.0',
    ],
    ['missing reason', { ...verdict, reason: undefined }, 'reason'],
  ])('rejects %s', (_label, value, path) => {
    const result = VerdictSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual([path]);
  });

  it('accepts the SPEC 3.5 relaxations: null branch match, empty run url, conditions', () => {
    const relaxed = {
      ...verdict,
      verdict: 'PASS',
      evidence: {
        ...verdict.evidence,
        ci_conclusion: 'unknown',
        ci_run_url: '',
        ci_branch_matched: null,
      },
      conditions: ['CI to be confirmed by the owner'],
    };
    expect(VerdictSchema.parse(relaxed)).toEqual(relaxed);
  });

  it('still rejects unknown top-level fields (strict)', () => {
    const result = VerdictSchema.safeParse({ ...verdict, notes: [] });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('notes');
  });

  it.each(['v01-b01', 'v01-b02'])(
    'documents that the historical %s verdict still fails only on free-text ci_conclusion',
    (batchId) => {
      // Written before SPEC 3.5 fixed ci_conclusion to an enum; kept as history.
      const markdown = readFileSync(
        join(repoRoot, `.collie/batches/${batchId}/verdict.md`),
        'utf8',
      );
      const raw: unknown = JSON.parse(lastJsonBlock(markdown)?.content ?? 'null');
      const result = VerdictSchema.safeParse(raw);
      expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['evidence.ci_conclusion']);
    },
  );
});

describe('reviewer: readVerdict boundaries', () => {
  it('fails when verdict.md does not exist', () => {
    expect(verdictError().message).toContain('cannot read verdict');
  });

  it('fails when there is no JSON block', () => {
    placeVerdict('# 裁决\n\nPASS\n');
    expect(verdictError().message).toContain('no fenced ```json block found');
  });

  it('takes the last of two JSON blocks', () => {
    placeVerdict(
      verdictMarkdown(JSON.stringify({ ...verdict, verdict: 'PASS' }), JSON.stringify(verdict)),
    );
    expect(readVerdict(root, 'v01-b03').verdict).toBe('FIX');
  });

  it('fails on invalid JSON, naming the block line', () => {
    placeVerdict(verdictMarkdown('{"verdict": "PASS",'));
    expect(verdictError().message).toMatch(/json block at line \d+ is not valid JSON/);
  });

  it('fails on a schema violation with the field path', () => {
    placeVerdict(verdictMarkdown(JSON.stringify({ ...verdict, verdict: 'pass' })));
    expect(verdictError().message).toMatch(/fails the verdict schema: verdict: /);
  });

  it('fails on a truncated verdict', () => {
    placeVerdict(`# 裁决\n\n${FENCE}json\n{"schema_version": 1`);
    expect(verdictError().message).toContain('is never closed');
  });

  it('fails when the verdict belongs to another batch', () => {
    placeVerdict(verdictMarkdown(JSON.stringify({ ...verdict, batch_id: 'v01-b02' })));
    expect(verdictError().message).toContain('verdict is for batch v01-b02, expected v01-b03');
  });

  it('rejects an unsafe batch id', () => {
    expect(() => readVerdict(root, '../x')).toThrow();
  });
});
