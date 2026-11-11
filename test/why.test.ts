// Tests for `collie why` (SPEC 13.4, v04-b09).
// Two categories:
//   A. Real Sandbox runs (PASS, FIX→PASS): fake runner produces real journals.
//   B. Hand-written fixtures: rule 8 FIX, rule 2 BLOCK, rule 1 format error,
//      escalation (no report), interrupted+resumed, exit codes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { formatWhy, loadRuns, projectWhy } from '../src/view.js';
import { main, WHY_EXIT } from '../src/cli.js';
import type { Event, Claims, Report } from '../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';
import { git } from '../src/git.js';

// ---------------------------------------------------------------------------
// Helpers for hand-written fixtures
// ---------------------------------------------------------------------------

function makeEvent(partial: Partial<Event> & { run_id: string; event: string }): Event {
  return {
    ts: partial.ts ?? '2026-11-10T12:00:00Z',
    ...partial,
  };
}

function writeJournal(root: string, runId: string, events: Event[]): void {
  const dir = join(root, '.collie', 'runs', runId);
  mkdirSync(dir, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(dir, 'events.ndjson'), lines);
}

const FENCE = '```';

/** A worker scene that writes distinct content (for second-run tests). */
function secondWorkerScene(box: Sandbox, claims: Omit<Claims, 'commits'>): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      // Write distinct content so git has something to commit.
      box.write('feature.txt', 'feature v2\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      box.write('tests/t001.sh', 'exit 0\n', cwd);
      box.write('tests/t002.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: update feature', cwd);
      const report: Report = {
        schema_version: 1,
        batch_id: BATCH,
        head_sha: head,
        claims: { commits: [head], ...claims },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

// Minimal backlog for the hand-written fixture tests.
// eslint-disable-next-line no-irregular-whitespace -- U+3000 required by the backlog parser (SPEC 3.2)
const FIXTURE_BACKLOG = `# backlog\n\n## 队列总览\n\n| 优先级 | 批次 | 标题 | 依赖 | 状态 |\n|---|---|---|---|---|\n| 1 | v99-b01 | test | — | running |\n\n## v99-b01 test\n\n优先级：1　依赖：无\n\n条目：\n1. feature\n\n验收标准：\n\n| 说明 | 命令 | 期望 |\n|---|---|---|\n| pass | \`true\` | exit 0 |\n`;

// ---------------------------------------------------------------------------
// A. Real Sandbox runs
// ---------------------------------------------------------------------------

describe('why — real Sandbox runs (SPEC 13.4)', () => {
  let box: Sandbox;

  beforeAll(async () => {
    box = await Sandbox.create();

    // Run 1: PASS verdict.
    const passRunner = new FakeRunner([
      workerScene(box, { passing: 3, failing: 0, push: true, claims: honestClaims(3) }),
      fooledReviewerScene(box, 'PASS'),
    ]);
    await box.run(passRunner);
  }, 60_000);

  afterAll(() => {
    box.dispose();
  });

  it('PASS run: why shows evidence chain with attempt 1', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    expect(proj!.attempts).toHaveLength(1); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.attempt).toBe(1);
    expect(a.verdict).toBe('PASS');
    expect(a.worker).not.toBeNull();
    expect(a.evidence).not.toBeNull();
    expect(a.reviewer).not.toBeNull();
    expect(a.reviewer?.verdict).toBe('PASS');
  });

  it('PASS run: text output contains conclusion line with rule 10', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('attempt 1');
    expect(text).toContain('结论：PASS');
    expect(text).toContain('规则 10');
    expect(text).toContain('采用 reviewer 原值');
  });

  it('PASS run: gate facts are populated when no queue.gate_passed', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    expect(proj!.gatePassedCount).toBe(0); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.gateFacts).not.toBeNull(); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('放行判定');
  });
});

describe('why — FIX then PASS (real Sandbox)', () => {
  let box: Sandbox;

  beforeAll(async () => {
    box = await Sandbox.create();

    // Run 1: reviewer says FIX.
    const fixRunner = new FakeRunner([
      workerScene(box, { passing: 3, failing: 0, push: true, claims: honestClaims(3) }),
      fooledReviewerScene(box, 'FIX'),
    ]);
    await box.run(fixRunner);

    // Run 2: reviewer says PASS. Worker writes distinct content.
    const passRunner = new FakeRunner([
      secondWorkerScene(box, honestClaims(3)),
      fooledReviewerScene(box, 'PASS'),
    ]);
    await box.run(passRunner);
  }, 60_000);

  afterAll(() => {
    box.dispose();
  });

  it('two attempts shown: attempt 1 FIX, attempt 2 PASS', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    expect(proj!.attempts).toHaveLength(2); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[0]?.attempt).toBe(1); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[0]?.verdict).toBe('FIX'); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[1]?.attempt).toBe(2); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[1]?.verdict).toBe('PASS'); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
  });

  it('--attempt filters to a single attempt', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH, 2);
    expect(proj).not.toBeNull();
    expect(proj!.attempts).toHaveLength(1); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[0]?.attempt).toBe(2); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(proj!.attempts[0]?.verdict).toBe('PASS'); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
  });
});

// ---------------------------------------------------------------------------
// B. Hand-written fixtures
// ---------------------------------------------------------------------------

describe('why — hand-written fixtures (SPEC 13.4)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'collie-why-'));
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'backlog.md'), FIXTURE_BACKLOG);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('rule 8 FIX: shows acceptance.failed entries', () => {
    const RUN = 'r-20261110-120000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T12:05:00Z',
        exit_code: 0,
        stop_reason: 'end_turn',
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.verdict',
        batch_id: 'v99-b01',
        verdict: 'PASS',
        gaps: [],
      }),
      makeEvent({
        run_id: RUN,
        event: 'evidence.collected',
        batch_id: 'v99-b01',
        tests_passed: 10,
        tests_failed: 0,
        acceptance_passed: 0,
        acceptance_total: 1,
        spec_diff_lines: 0,
        deps_diff: 0,
        remote_has_head: true,
        commits: 1,
      }),
      makeEvent({
        run_id: RUN,
        event: 'acceptance.failed',
        batch_id: 'v99-b01',
        cmd: 'npm test',
        exit_code: 1,
        expect: 'exit_zero',
      }),
      makeEvent({
        run_id: RUN,
        event: 'verdict.downgraded',
        batch_id: 'v99-b01',
        from: 'PASS',
        to: 'FIX',
        rule: 8,
        reason: '1 acceptance command(s) not met: npm test',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T12:10:00Z',
        verdict: 'FIX',
        exit_code: 10,
        rule: 8,
        reason: '1 acceptance command(s) not met: npm test',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.failedAcceptance).toHaveLength(1);
    expect(a.failedAcceptance[0]?.cmd).toBe('npm test');
    expect(a.downgraded).not.toBeNull();
    expect(a.downgraded?.from).toBe('PASS');
    expect(a.downgraded?.to).toBe('FIX');
    expect(a.verdict).toBe('FIX');
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('acceptance.failed');
    expect(text).toContain('规则 8');
    expect(text).toContain('验收命令未满足');
  });

  it('rule 2 BLOCK: shows protected file change', () => {
    const RUN = 'r-20261110-130000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T13:05:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.verdict',
        batch_id: 'v99-b01',
        verdict: 'PASS',
        gaps: [],
      }),
      makeEvent({
        run_id: RUN,
        event: 'evidence.collected',
        batch_id: 'v99-b01',
        tests_passed: 5,
        tests_failed: 0,
        acceptance_passed: 1,
        acceptance_total: 1,
        spec_diff_lines: 3,
        deps_diff: 0,
        remote_has_head: true,
        commits: 1,
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T13:10:00Z',
        verdict: 'BLOCK',
        exit_code: 20,
        rule: 2,
        reason: 'protected files changed by 3 lines',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.verdict).toBe('BLOCK');
    expect(a.rule).toBe(2);
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('结论：BLOCK');
    expect(text).toContain('规则 2');
    expect(text).toContain('改动受保护文件');
  });

  it('rule 1 format error: verdict unparseable', () => {
    const RUN = 'r-20261110-140000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T14:05:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.verdict',
        batch_id: 'v99-b01',
        error: 'no JSON fence found',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T14:10:00Z',
        verdict: 'BLOCK',
        exit_code: 20,
        rule: 1,
        reason: 'verdict unparseable: no JSON fence found',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.verdict).toBe('BLOCK');
    expect(a.rule).toBe(1);
    // reviewer.verdict has error field, so reviewer shows null verdict
    expect(a.reviewer?.verdict).toBeNull();
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('规则 1');
    expect(text).toContain('裁决不可解析');
  });

  it('escalation: no report → BLOCK with escalated event', () => {
    const RUN = 'r-20261110-150000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T15:05:00Z',
        exit_code: 0,
        final_text: 'I could not find the task.',
      }),
      makeEvent({
        run_id: RUN,
        event: 'escalated',
        batch_id: 'v99-b01',
        reason: 'no parseable report.md',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T15:06:00Z',
        verdict: 'BLOCK',
        exit_code: 20,
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.escalated).toBe('no parseable report.md');
    expect(a.verdict).toBe('BLOCK');
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('escalated');
    expect(text).toContain('结论：BLOCK，上报');
  });

  it('interrupted then resumed: shows interrupt events', () => {
    const RUN1 = 'r-20261110-160000';
    const RUN2 = 'r-20261110-170000';
    // Run 1: interrupted (worker signaled, run.finished BLOCK).
    const run1Events: Event[] = [
      makeEvent({
        run_id: RUN1,
        event: 'run.started',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:00:00Z',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'worker.started',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:00:01Z',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'worker.signaled',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:30:00Z',
        signal: 'SIGINT',
        reason: 'wallclock',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:30:10Z',
        exit_code: 0,
        stop_reason: 'wallclock',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'worker.rescued',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:30:11Z',
        sha: 'abcdef1',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'escalated',
        batch_id: 'v99-b01',
        reason: 'no parseable report.md',
      }),
      makeEvent({
        run_id: RUN1,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T16:30:12Z',
        verdict: 'BLOCK',
        exit_code: 20,
      }),
    ];
    writeJournal(root, RUN1, run1Events);

    // Run 2: resumed, succeeded.
    const run2Events: Event[] = [
      makeEvent({
        run_id: RUN2,
        event: 'run.started',
        batch_id: 'v99-b01',
        ts: '2026-11-10T17:00:00Z',
      }),
      makeEvent({
        run_id: RUN2,
        event: 'worker.resumed',
        batch_id: 'v99-b01',
        ts: '2026-11-10T17:00:01Z',
        from_run: RUN1,
        attempt: 2,
      }),
      makeEvent({
        run_id: RUN2,
        event: 'worker.started',
        batch_id: 'v99-b01',
        ts: '2026-11-10T17:00:02Z',
      }),
      makeEvent({
        run_id: RUN2,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T17:10:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN2,
        event: 'reviewer.verdict',
        batch_id: 'v99-b01',
        verdict: 'PASS',
        gaps: [],
      }),
      makeEvent({
        run_id: RUN2,
        event: 'evidence.collected',
        batch_id: 'v99-b01',
        tests_passed: 5,
        tests_failed: 0,
        acceptance_passed: 1,
        acceptance_total: 1,
        spec_diff_lines: 0,
        deps_diff: 0,
        remote_has_head: true,
        commits: 1,
      }),
      makeEvent({
        run_id: RUN2,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T17:15:00Z',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'looks good',
      }),
    ];
    writeJournal(root, RUN2, run2Events);

    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    expect(proj!.attempts).toHaveLength(2); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above

    // Attempt 1: interrupted.
    const a1 = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a1.interrupts.length).toBeGreaterThanOrEqual(1);
    expect(a1.interrupts.some((i) => i.event === 'worker.signaled')).toBe(true);
    expect(a1.interrupts.some((i) => i.event === 'worker.rescued')).toBe(true);

    // Attempt 2: resumed and passed.
    const a2 = proj!.attempts[1]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a2.verdict).toBe('PASS');
    expect(a2.interrupts.some((i) => i.event === 'worker.resumed')).toBe(true);

    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('worker.signaled');
    expect(text).toContain('worker.resumed');
  });
});

// ---------------------------------------------------------------------------
// C. CLI exit codes (SPEC 13.4)
// ---------------------------------------------------------------------------

describe('why — exit codes (SPEC 13.4)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'collie-why-exit-'));
    // backlog with one batch
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'backlog.md'), FIXTURE_BACKLOG);
    mkdirSync(join(root, '.collie'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exit 0: batch has journal data', async () => {
    const RUN = 'r-20261110-180000';
    writeJournal(root, RUN, [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T18:10:00Z',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'ok',
      }),
    ]);
    const output: string[] = [];
    const code = await main(['why', 'v99-b01'], {
      cwd: root,
      runner: undefined,
      fetch: () => Promise.resolve(new Response('{}')),
      now: () => new Date('2026-11-10T19:00:00Z'),
      out: (t) => output.push(t),
      err: (t) => output.push(t),
    });
    expect(code).toBe(WHY_EXIT.HAS_DATA);
    expect(output.join('')).toContain('attempt 1');
  });

  it('exit 1: batch not in backlog', async () => {
    const output: string[] = [];
    const code = await main(['why', 'no-such-batch'], {
      cwd: root,
      runner: undefined,
      fetch: () => Promise.resolve(new Response('{}')),
      now: () => new Date('2026-11-10T19:00:00Z'),
      out: (t) => output.push(t),
      err: (t) => output.push(t),
    });
    expect(code).toBe(WHY_EXIT.NOT_IN_BACKLOG);
    expect(output.join('')).toContain('not in');
  });

  it('exit 2: batch in backlog but no journal', async () => {
    const output: string[] = [];
    const code = await main(['why', 'v99-b01'], {
      cwd: root,
      runner: undefined,
      fetch: () => Promise.resolve(new Response('{}')),
      now: () => new Date('2026-11-10T19:00:00Z'),
      out: (t) => output.push(t),
      err: (t) => output.push(t),
    });
    expect(code).toBe(WHY_EXIT.NO_JOURNAL);
    expect(output.join('')).toContain('no journal');
  });

  it('--json outputs valid JSON', async () => {
    const RUN = 'r-20261110-190000';
    writeJournal(root, RUN, [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T19:10:00Z',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'ok',
      }),
    ]);
    const output: string[] = [];
    const code = await main(['why', 'v99-b01', '--json'], {
      cwd: root,
      runner: undefined,
      fetch: () => Promise.resolve(new Response('{}')),
      now: () => new Date('2026-11-10T20:00:00Z'),
      out: (t) => output.push(t),
      err: (t) => output.push(t),
    });
    expect(code).toBe(WHY_EXIT.HAS_DATA);
    const parsed = JSON.parse(output.join('')) as unknown;
    expect(parsed).toHaveProperty('batchId', 'v99-b01');
    expect(parsed).toHaveProperty('attempts');
  });
});
