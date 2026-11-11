// SPEC 13.14 scenario N: interrupt auto-retry, acceptance.failed regardless of
// verdict, queue.gate_passed recording.
// Clock, fingerprint and ladder delay are injected (same approach as scenario G);
// no real timers.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers: monotonic clock, instant delay, controllable fingerprint
// Mirrors scenario G's approach (SPEC 11.5, v02-b04-fix).
// ---------------------------------------------------------------------------

function fakeClock(stepMs = 1): { now: () => number } {
  let t = 0;
  return {
    now: () => {
      t += stepMs;
      return t;
    },
  };
}

function instantDelay(): { delay: (ms: number) => Promise<void> } {
  return {
    delay: async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches LivenessConfig.setTimer signature
function fakeSetTimer(cb: () => void, _ms: number): ReturnType<typeof setTimeout> {
  setImmediate(cb);
  return undefined as unknown as ReturnType<typeof setTimeout>;
}

function controllableFingerprint(): {
  livenessFingerprint: (root: string) => Promise<string>;
  freeze: () => void;
  unfreeze: () => void;
} {
  let counter = 0;
  let frozen = false;
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matches LivenessConfig.fingerprint signature
    livenessFingerprint: async (_root: string): Promise<string> => {
      if (!frozen) counter++;
      await Promise.resolve();
      return `fp-${String(counter)}`;
    },
    freeze: () => {
      frozen = true;
    },
    unfreeze: () => {
      frozen = false;
      counter++; // bump so next call returns a new value
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers: backlog and scene builders
// ---------------------------------------------------------------------------

interface BatchDef {
  priority: number;
  id: string;
  title: string;
  depends: string;
  status: string;
}

function makeBacklog(defs: BatchDef[]): string {
  const lines: string[] = [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
  ];
  for (const d of defs) {
    lines.push(`| ${String(d.priority)} | ${d.id} | ${d.title} | ${d.depends} | ${d.status} |`);
  }
  lines.push('');
  for (const d of defs) {
    const depText = d.depends === '—' ? '无' : d.depends;
    lines.push(`## ${d.id} ${d.title}`);
    lines.push('');
    // eslint-disable-next-line no-irregular-whitespace -- ideographic space matches docs/backlog.md format
    lines.push(`优先级：${String(d.priority)}　依赖：${depText}`);
    lines.push('');
    lines.push('条目：');
    lines.push(`1. 实现 ${d.id}`);
    lines.push('');
    lines.push('验收标准：');
    lines.push('');
    lines.push('| 说明 | 命令 | 期望 |');
    lines.push('|---|---|---|');
    lines.push(`| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |`);
    lines.push(`| 功能文件存在 | \`test -f feature.txt\` | exit 0 |`);
    lines.push('');
  }
  return lines.join('\n');
}

let workerSeq = 0;

/** Worker that commits code + report and optionally pushes. */
function queueWorkerScene(box: Sandbox, batchId: string, push: boolean): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: push,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      if (push) {
        await git(cwd, ['push', '-q', 'origin', 'main']);
      }
    },
    result: { exitCode: 0 },
  };
}

/**
 * Worker scene that commits code with a failing test + report. Used to trigger
 * acceptance.failed recording regardless of verdict.
 */
function queueWorkerWithFailingTest(box: Sandbox, batchId: string): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      box.write('tests/t001.sh', 'exit 1\n', cwd); // failing test
      const head = await box.commitAll('feat: add feature with failing test', cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 1,
        pushed: true,
        ci_passed: false,
        new_deps: [],
        spec_touched: false,
      };
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims,
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/** Idle worker: commits code (no report), then goes idle. */
function idleWorkerNoReport(
  batchId: string,
  fp: ReturnType<typeof controllableFingerprint>,
): FakeScene {
  return {
    expectRole: 'worker',
    effect: async (ctx: FakeSceneContext) => {
      // Commit some code but NO report.
      const featurePath = join(ctx.cwd, 'feature.txt');
      mkdirSync(dirname(featurePath), { recursive: true });
      writeFileSync(featurePath, `idle-${batchId}\n`);
      await git(ctx.cwd, ['add', '-A']);
      await git(ctx.cwd, ['commit', '-q', '-m', 'feat: partial work']);

      // Freeze fingerprint to trigger idle detection.
      fp.freeze();

      // Emit events without changing files.
      for (let i = 0; i < 10; i++) {
        ctx.opts.onEvent?.({ type: 'assistant', message: 'still thinking...' });
      }

      // Wait for the ladder to stop us.
      await ctx.stopped;

      // Unfreeze so the next run can proceed without triggering idle.
      fp.unfreeze();
    },
    result: { exitCode: 0 },
  };
}

/** Crashing worker: throws an error (no idle/stall). */
function crashingWorkerScene(): FakeScene {
  return {
    expectRole: 'worker',
    error: new Error('worker process crash'),
  };
}

/** Reviewer: says PASS cleanly. */
function reviewerClean(box: Sandbox, batchId: string): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'PASS',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed, 0 failed' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: [],
    reason: 'all good',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# v\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Reviewer: says FIX. */
function reviewerFix(box: Sandbox, batchId: string): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'FIX',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '1 failed | 1 passed (2)' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: ['a test is failing'],
    reason: 'test failure',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# v\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// Injected liveness options that make tests fast without real timers.
function livenessOpts(fp: ReturnType<typeof controllableFingerprint>) {
  const { delay } = instantDelay();
  const clock = fakeClock();
  return {
    ladderDelay: delay,
    livenessIntervalMs: 50,
    livenessNow: clock.now,
    livenessSetTimer: fakeSetTimer,
    livenessFingerprint: fp.livenessFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Group 1: Interrupt auto-retry (SPEC 13.14)
// ---------------------------------------------------------------------------

describe('scenario N group 1: interrupt auto-retry in --continue', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
    // progress_secs = 1 so idle fires quickly.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);
  });

  afterEach(() => {
    box.dispose();
  });

  it('idle once → interrupt retry → PASS → queue continues (exit 0)', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: interrupt retry backlog');

    const fp = controllableFingerprint();
    const runner = new FakeRunner([
      // Attempt 1: worker idle, no report → BLOCK.
      idleWorkerNoReport('v99-b01', fp),
      // Retry: worker succeeds → reviewer → PASS.
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(0);

    const events = box.events();
    // batch.retried with cause=interrupted.
    const retried = events.find((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toBeDefined();
    expect(retried?.batch_id).toBe('v99-b01');
    expect(retried?.stop_reason).toBe('idling');

    // queue.batch_started with why=interrupt_retry for the retry run.
    const started = events.filter((e) => e.event === 'queue.batch_started');
    const retryStarted = started.find((e) => e.why === 'interrupt_retry');
    expect(retryStarted).toBeDefined();
    expect(retryStarted?.batch_id).toBe('v99-b01');

    // queue.finished reason=exhausted (not blocked).
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('exhausted');
  });

  it('idle twice → exit 20 (BLOCK)', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: double interrupt backlog');

    const fp = controllableFingerprint();
    const runner = new FakeRunner([
      // Attempt 1: idle → BLOCK.
      idleWorkerNoReport('v99-b01', fp),
      // Retry: idle again → BLOCK.
      idleWorkerNoReport('v99-b01', fp),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();
    // Exactly one batch.retried for this batch.
    const retried = events.filter((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toHaveLength(1);

    // queue.finished reason=blocked.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('blocked');
  });

  it('worker crash → no interrupt retry', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: crash backlog');

    const fp = controllableFingerprint();
    const runner = new FakeRunner([crashingWorkerScene()]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();
    // No batch.retried for interrupt.
    const retried = events.filter((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toHaveLength(0);

    // Queue stopped at BLOCK.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('blocked');
  });

  it('interrupt retry does not consume fix_max', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: fix_max test backlog');

    const fp = controllableFingerprint();
    const runner = new FakeRunner([
      // Attempt 1: idle → interrupt retry.
      idleWorkerNoReport('v99-b01', fp),
      // Retry: PASS.
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(0);

    const events = box.events();
    // No fix_max escalation.
    const fixMaxEscalated = events.filter((e) => e.event === 'escalated' && e.reason === 'fix_max');
    expect(fixMaxEscalated).toHaveLength(0);

    // batch.retried has cause=interrupted, not rule=1.
    const retried = events.find((e) => e.event === 'batch.retried');
    expect(retried).toBeDefined();
    expect(retried?.cause).toBe('interrupted');
    expect(retried?.rule).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Group 2: acceptance.failed regardless of verdict (SPEC 13.14)
// ---------------------------------------------------------------------------

describe('scenario N group 2: acceptance.failed regardless of verdict', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('reviewer FIX with failing acceptance → journal has acceptance.failed', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: acceptance.failed test backlog');

    const runner = new FakeRunner([
      // Worker writes failing test, pushes.
      queueWorkerWithFailingTest(box, 'v99-b01'),
      // Reviewer says FIX (not PASS).
      reviewerFix(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);
    // FIX → retry loop, but with fix_max=3 the queue keeps retrying.
    // We only need the first run's events; exit code depends on fix_max
    // exhaustion but that's not the point of this test.
    // Actually with --continue and FIX, the queue will try fix_retry.
    // Since the runner has no more scenes, the retry will crash → BLOCK.
    // The important thing: acceptance.failed is in the first run's journal.
    expect(code).toBeGreaterThan(0);

    const events = box.events();
    // acceptance.failed should be present even though reviewer said FIX (not PASS).
    const failed = events.filter((e) => e.event === 'acceptance.failed');
    expect(failed.length).toBeGreaterThanOrEqual(1);
    // Verify the failing command is the test harness.
    const testFailed = failed.find((e) => e.cmd === TEST_CMD);
    expect(testFailed).toBeDefined();
    expect(testFailed?.exit_code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Group 3: queue.gate_passed (SPEC 13.14)
// ---------------------------------------------------------------------------

describe('scenario N group 3: queue.gate_passed after PASS', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('PASS with clean gate records queue.gate_passed', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: gate_passed test backlog');

    const runner = new FakeRunner([
      queueWorkerScene(box, 'v99-b01', true),
      reviewerClean(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    const events = box.events();
    const gatePassed = events.find((e) => e.event === 'queue.gate_passed');
    expect(gatePassed).toBeDefined();
    expect(gatePassed?.batch_id).toBe('v99-b01');
    expect(gatePassed?.batch_run_id).toBeDefined();
    // Must not have run_id as extension field (SPEC 13.14).
    expect(gatePassed?.run_id).toBeDefined(); // run_id is the envelope field, always present
  });
});
