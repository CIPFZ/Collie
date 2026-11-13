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
// A2. Real Sandbox runs: cost/model/tokens scripted via fake runner (SPEC 13.23)
// ---------------------------------------------------------------------------

describe('why — Sandbox with scripted cost/model/tokens (SPEC 13.23)', () => {
  let box: Sandbox;

  beforeAll(async () => {
    box = await Sandbox.create();

    // Worker scene with costUsd, numTurns, durationMs, usage scripted on result.
    const workerWithCost: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', cwd);
        for (let i = 0; i < 3; i++) {
          box.write(`tests/t${String(i).padStart(3, '0')}.sh`, 'exit 0\n', cwd);
        }
        const head = await box.commitAll('feat: add feature with tests', cwd);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: head,
          claims: { commits: [head], ...honestClaims(3) },
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
      result: {
        exitCode: 0,
        costUsd: 5.25,
        numTurns: 15,
        durationMs: 240000,
        usage: { inputTokens: 8000, outputTokens: 3000, cacheCreationInputTokens: 2000 },
      },
    };

    // Reviewer scene with costUsd, numTurns, durationMs scripted on result.
    const reviewerWithCost = fooledReviewerScene(box, 'PASS');
    // Override the result to include cost data.
    const originalResult = reviewerWithCost.result;
    reviewerWithCost.result = {
      ...originalResult!, // eslint-disable-line @typescript-eslint/no-non-null-assertion -- test
      costUsd: 1.5,
      numTurns: 4,
      durationMs: 45000,
    };

    const runner = new FakeRunner([workerWithCost, reviewerWithCost]);
    await box.run(runner);
  }, 60_000);

  afterAll(() => {
    box.dispose();
  });

  it('worker cost and reviewer cost are recorded in journal and projected (SPEC 13.23)', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above

    // Worker.
    expect(a.worker).not.toBeNull();
    expect(a.worker?.costUsd).toBe(5.25);
    expect(a.worker?.turns).toBe(15);
    expect(a.worker?.durationMs).toBe(240000);
    expect(a.worker?.tokensIn).toBe(10000); // 8000 + 2000
    expect(a.worker?.tokensOut).toBe(3000);

    // Reviewer.
    expect(a.reviewer).not.toBeNull();
    expect(a.reviewer?.costUsd).toBe(1.5);
    expect(a.reviewer?.turns).toBe(4);
    expect(a.reviewer?.durationMs).toBe(45000);

    // Total cost.
    expect(a.cost.worker).toBe(5.25);
    expect(a.cost.reviewer).toBe(1.5);
    expect(a.cost.total).toBeCloseTo(6.75);
  });

  it('text output includes model= and cost line (SPEC 13.23)', () => {
    const runs = loadRuns(box.root);
    const proj = projectWhy(runs, BATCH);
    expect(proj).not.toBeNull();
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('model=');
    expect(text).toContain('cost: worker=$5.25 reviewer=$1.50 total=$6.75');
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

  // SPEC 13.20: conclusion line rule/reason fallback tests.

  it('no rule on run.finished but verdict.downgraded has rule 9 → conclusion shows 规则 9', () => {
    const RUN = 'r-20261110-200000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T20:05:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'verdict.downgraded',
        batch_id: 'v99-b01',
        from: 'PASS',
        to: 'FIX',
        rule: 9,
        reason: 'evidence unavailable',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T20:10:00Z',
        verdict: 'FIX',
        exit_code: 10,
        // No rule or reason on run.finished — old journal format.
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    // SPEC 13.20: rule falls back to verdict.downgraded.rule.
    expect(a.rule).toBe(9);
    expect(a.reason).toBe('evidence unavailable');
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('规则 9');
    expect(text).toContain('证据缺失');
    expect(text).not.toMatch(/结论：FIX，$/m);
  });

  it('neither run.finished nor verdict.downgraded has rule → 规则 —, no trailing comma', () => {
    const RUN = 'r-20261110-210000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T21:05:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T21:10:00Z',
        verdict: 'FIX',
        exit_code: 10,
        // No rule, no reason, no verdict.downgraded event.
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.rule).toBeNull();
    expect(a.reason).toBeNull();
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('规则 —');
    // Must not end with comma (SPEC 13.20).
    expect(text).not.toMatch(/结论：FIX，$/m);
    expect(text).not.toMatch(/结论：FIX，\n/);
  });

  it('run.finished with rule present → output unchanged (existing behaviour)', () => {
    const RUN = 'r-20261110-220000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T22:05:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T22:10:00Z',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'looks good',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.rule).toBe(10);
    expect(a.reason).toBe('looks good');
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('规则 10');
    expect(text).toContain('采用 reviewer 原值');
  });

  it('--json rule/reason fallback from verdict.downgraded (SPEC 13.20)', () => {
    const RUN = 'r-20261110-230000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'verdict.downgraded',
        batch_id: 'v99-b01',
        from: 'PASS',
        to: 'FIX',
        rule: 9,
        reason: 'evidence missing',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:10:00Z',
        verdict: 'FIX',
        exit_code: 10,
        // No rule or reason on run.finished.
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    // JSON serialization carries fallback values.
    const json = JSON.parse(JSON.stringify(proj)) as {
      attempts: { rule: number | null; reason: string | null }[];
    };
    expect(json.attempts[0]?.rule).toBe(9);
    expect(json.attempts[0]?.reason).toBe('evidence missing');
  });

  it('--json rule/reason are null when neither source has them', () => {
    const RUN = 'r-20261110-230100';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:15:00Z',
        verdict: 'FIX',
        exit_code: 10,
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const json = JSON.parse(JSON.stringify(proj)) as {
      attempts: { rule: number | null; reason: string | null }[];
    };
    expect(json.attempts[0]?.rule).toBeNull();
    expect(json.attempts[0]?.reason).toBeNull();
  });

  it('声称不符 reason → conclusion shows reason without 规则 (SPEC 13.23)', () => {
    const RUN = 'r-20261110-231000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({ run_id: RUN, event: 'worker.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:15:00Z',
        exit_code: 0,
      }),
      makeEvent({
        run_id: RUN,
        event: 'claim.mismatch',
        batch_id: 'v99-b01',
        field: 'head_sha',
        claimed: 'dead000000',
        actual: 'unresolvable',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:16:00Z',
        verdict: 'FIX',
        exit_code: 10,
        // No rule — SPEC 13.23: sha unresolvable FIX has no rule in run.finished.
        reason: '声称不符：report head_sha dead000000 does not resolve to a commit',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();
    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(a.rule).toBeNull();
    expect(a.reason).toContain('声称不符');
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    // Should contain the reason directly, not "规则 0" or "规则 —".
    expect(text).toContain('声称不符');
    expect(text).not.toContain('规则 0');
    expect(text).not.toContain('规则 —');
    // Conclusion line format: 结论：FIX，声称不符：...
    expect(text).toMatch(/结论：FIX，声称不符/);
  });

  it('why shows worker model, duration, tokens and reviewer model, turns, cost, duration (SPEC 13.23)', () => {
    const RUN = 'r-20261110-232000';
    const events: Event[] = [
      makeEvent({ run_id: RUN, event: 'run.started', batch_id: 'v99-b01' }),
      makeEvent({
        run_id: RUN,
        event: 'worker.started',
        batch_id: 'v99-b01',
        model: 'claude-sonnet-4-20250514',
      }),
      makeEvent({
        run_id: RUN,
        event: 'worker.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:25:00Z',
        exit_code: 0,
        num_turns: 12,
        cost_usd: 3.5,
        duration_ms: 180000,
        usage: {
          input_tokens: 5000,
          output_tokens: 2000,
          cache_creation_input_tokens: 1000,
          cache_read_input_tokens: 500,
        },
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.started',
        batch_id: 'v99-b01',
        head_sha: 'abc1234567890abc1234567890abc1234567890a',
        model: 'claude-opus-4-20250514',
      }),
      makeEvent({
        run_id: RUN,
        event: 'reviewer.finished',
        batch_id: 'v99-b01',
        exit_code: 0,
        num_turns: 5,
        cost_usd: 1.2,
        duration_ms: 60000,
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
      }),
      makeEvent({
        run_id: RUN,
        event: 'ci.verdict_commit',
        batch_id: 'v99-b01',
        sha: 'deadbeef1234',
        conclusion: 'success',
        when: 'startup',
      }),
      makeEvent({
        run_id: RUN,
        event: 'run.finished',
        batch_id: 'v99-b01',
        ts: '2026-11-10T23:30:00Z',
        verdict: 'PASS',
        exit_code: 0,
        rule: 10,
        reason: 'ok',
      }),
    ];
    writeJournal(root, RUN, events);
    const runs = loadRuns(root);
    const proj = projectWhy(runs, 'v99-b01');
    expect(proj).not.toBeNull();

    const a = proj!.attempts[0]!; // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above

    // Worker fields (SPEC 13.23).
    expect(a.worker).not.toBeNull();
    expect(a.worker?.model).toBe('claude-sonnet-4-20250514');
    expect(a.worker?.durationMs).toBe(180000);
    expect(a.worker?.tokensIn).toBe(6500); // 5000+1000+500
    expect(a.worker?.tokensOut).toBe(2000);

    // Reviewer fields (SPEC 13.23).
    expect(a.reviewer).not.toBeNull();
    expect(a.reviewer?.model).toBe('claude-opus-4-20250514');
    expect(a.reviewer?.turns).toBe(5);
    expect(a.reviewer?.costUsd).toBe(1.2);
    expect(a.reviewer?.durationMs).toBe(60000);

    // head_sha (SPEC 13.23).
    expect(a.headSha).toBe('abc1234567890abc1234567890abc1234567890a');

    // ci.verdict_commit (SPEC 13.23).
    expect(a.verdictCommitCi).toHaveLength(1);
    expect(a.verdictCommitCi[0]?.sha).toBe('deadbeef1234');
    expect(a.verdictCommitCi[0]?.conclusion).toBe('success');
    expect(a.verdictCommitCi[0]?.when).toBe('startup');

    // Cost breakdown (SPEC 13.23).
    expect(a.cost.worker).toBe(3.5);
    expect(a.cost.reviewer).toBe(1.2);
    expect(a.cost.total).toBeCloseTo(4.7);

    // Text output.
    const text = formatWhy(proj!); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- checked above
    expect(text).toContain('model=claude-sonnet-4-20250514');
    expect(text).toContain('model=claude-opus-4-20250514');
    expect(text).toContain('tokens=in6500/out2000');
    expect(text).toContain('ci.verdict_commit');
    expect(text).toContain('head_sha: abc1234567890abc1234567890abc1234567890a');
    expect(text).toContain('cost: worker=$3.50 reviewer=$1.20 total=$4.70');

    // --json fields.
    const json = JSON.parse(JSON.stringify(proj)) as {
      attempts: {
        worker: { model: string; durationMs: number; tokensIn: number; tokensOut: number };
        reviewer: { model: string; turns: number; costUsd: number; durationMs: number };
        headSha: string;
        verdictCommitCi: { sha: string; conclusion: string; when: string }[];
        cost: { worker: number; reviewer: number; total: number };
      }[];
    };
    expect(json.attempts[0]?.worker.model).toBe('claude-sonnet-4-20250514');
    expect(json.attempts[0]?.worker.durationMs).toBe(180000);
    expect(json.attempts[0]?.worker.tokensIn).toBe(6500);
    expect(json.attempts[0]?.worker.tokensOut).toBe(2000);
    expect(json.attempts[0]?.reviewer.model).toBe('claude-opus-4-20250514');
    expect(json.attempts[0]?.reviewer.turns).toBe(5);
    expect(json.attempts[0]?.reviewer.costUsd).toBe(1.2);
    expect(json.attempts[0]?.reviewer.durationMs).toBe(60000);
    expect(json.attempts[0]?.headSha).toBe('abc1234567890abc1234567890abc1234567890a');
    expect(json.attempts[0]?.verdictCommitCi).toHaveLength(1);
    expect(json.attempts[0]?.cost.worker).toBe(3.5);
    expect(json.attempts[0]?.cost.reviewer).toBe(1.2);
    expect(json.attempts[0]?.cost.total).toBeCloseTo(4.7);
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
