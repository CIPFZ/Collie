// SPEC 16.18: api_error counts as a resumable interruption in --continue mode.
// The queue auto-retries once (shared with other interrupt causes); only
// api_error waits api_retry_wait_secs before the retry.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { controllableFingerprint, fakeLivenessClock, instantDelay } from './support/fake-clock.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers
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

/** Worker that exits with api_error stopReason and no report. */
function apiErrorWorker(): FakeScene {
  return {
    expectRole: 'worker',
    result: { exitCode: 1, stopReason: 'api_error' },
  };
}

/** Worker that goes idle: freezes fingerprint and blocks until the ladder fires. */
function idlingWorker(fp: ReturnType<typeof controllableFingerprint>): FakeScene {
  return {
    expectRole: 'worker',
    effect: async (ctx: FakeSceneContext) => {
      // Freeze fingerprint to trigger idle detection.
      fp.freeze();
      // Emit events without changing files (keeps the worker "alive" but not making progress).
      for (let i = 0; i < 10; i++) {
        ctx.opts.onEvent?.({ type: 'assistant', message: 'thinking...' });
      }
      // Wait for the liveness ladder to stop us.
      await ctx.stopped;
      // Unfreeze so the next run can proceed.
      fp.unfreeze();
    },
    result: { exitCode: 0 },
  };
}

/** Worker that commits code + report and pushes. */
function queueWorkerScene(box: Sandbox, batchId: string): FakeScene {
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

/** Reviewer: PASS. */
function reviewerPass(box: Sandbox, batchId: string): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'PASS',
    evidence: {
      commits_actual: [],
      verify_results: [],
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
    result: {
      exitCode: 0,
      finalText: `# v\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

function livenessOpts(fp: ReturnType<typeof controllableFingerprint>) {
  const { delay } = instantDelay();
  const clock = fakeLivenessClock(() => fp.isFrozen());
  return {
    ladderDelay: delay,
    livenessIntervalMs: 50,
    livenessNow: clock.now,
    livenessSetTimer: clock.setTimer,
    livenessFingerprint: fp.livenessFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queue: api_error counts as a resumable interruption', () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('api_error first time, no report → waits 300s, auto-retries once, PASS → queue continues, exit 0', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: api_error retry backlog');

    const fp = controllableFingerprint();

    // Track retryDelay calls.
    const delayMsCalls: number[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test stub returns resolved Promise
    const retryDelay = async (ms: number): Promise<void> => {
      delayMsCalls.push(ms);
    };

    const runner = new FakeRunner([
      // Attempt 1: worker exits with api_error, no report.
      apiErrorWorker(),
      // Retry: worker succeeds → reviewer → PASS.
      queueWorkerScene(box, 'v99-b01'),
      reviewerPass(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, {
      ...livenessOpts(fp),
      retryDelay,
    });
    expect(code).toBe(0);

    // retryDelay was called with 300000 ms (300 * 1000).
    expect(delayMsCalls).toEqual([300_000]);

    const events = box.events();

    // batch.retried with cause=interrupted, stop_reason=api_error, waited_secs=300.
    const retried = events.find((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toBeDefined();
    expect(retried?.batch_id).toBe('v99-b01');
    expect(retried?.stop_reason).toBe('api_error');
    expect(retried?.waited_secs).toBe(300);

    // queue.finished reason=exhausted.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('exhausted');
  });

  it('api_error retry also fails with api_error → no second retry, queue blocked, exit 20', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: double api_error backlog');

    const fp = controllableFingerprint();

    const delayMsCalls: number[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test stub returns resolved Promise
    const retryDelay = async (ms: number): Promise<void> => {
      delayMsCalls.push(ms);
    };

    const runner = new FakeRunner([
      // Attempt 1: api_error.
      apiErrorWorker(),
      // Retry: also api_error.
      apiErrorWorker(),
    ]);

    const code = await box.cli(['run', '--continue'], runner, {
      ...livenessOpts(fp),
      retryDelay,
    });
    expect(code).toBe(20);

    // retryDelay was called exactly once (for the first retry).
    expect(delayMsCalls).toEqual([300_000]);

    const events = box.events();

    // Only one batch.retried with cause=interrupted.
    const retried = events.filter((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toHaveLength(1);

    // queue.finished reason=blocked.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('blocked');
  });

  it('idling first → retry does NOT wait, retryDelay never called', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    // Set progress_secs = 1 so idle fires quickly.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: idling retry backlog');

    const fp = controllableFingerprint();

    const delayMsCalls: number[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test stub returns resolved Promise
    const retryDelay = async (ms: number): Promise<void> => {
      delayMsCalls.push(ms);
    };

    const runner = new FakeRunner([
      // Attempt 1: idling → interrupt retry.
      idlingWorker(fp),
      // Retry: worker succeeds → reviewer → PASS.
      queueWorkerScene(box, 'v99-b01'),
      reviewerPass(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, {
      ...livenessOpts(fp),
      retryDelay,
    });
    expect(code).toBe(0);

    // retryDelay was NOT called (idling does not wait).
    expect(delayMsCalls).toEqual([]);

    const events = box.events();

    // batch.retried with cause=interrupted, stop_reason=idling, NO waited_secs.
    const retried = events.find((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toBeDefined();
    expect(retried?.stop_reason).toBe('idling');
    expect(retried).not.toHaveProperty('waited_secs');
  });

  it('api_error with api_retry_wait_secs = 0 still records waited_secs: 0', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    // Set api_retry_wait_secs = 0 so there is no wait.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/api_retry_wait_secs\s*=\s*\d+/, 'api_retry_wait_secs = 0');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: api_retry_wait_secs = 0 backlog');

    const fp = controllableFingerprint();

    const delayMsCalls: number[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test stub returns resolved Promise
    const retryDelay = async (ms: number): Promise<void> => {
      delayMsCalls.push(ms);
    };

    const runner = new FakeRunner([
      // Attempt 1: worker exits with api_error, no report.
      apiErrorWorker(),
      // Retry: worker succeeds → reviewer → PASS.
      queueWorkerScene(box, 'v99-b01'),
      reviewerPass(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, {
      ...livenessOpts(fp),
      retryDelay,
    });
    expect(code).toBe(0);

    // retryDelay was called with 0 ms (api_retry_wait_secs = 0 → 0 * 1000).
    expect(delayMsCalls).toEqual([0]);

    const events = box.events();

    // batch.retried with cause=interrupted, stop_reason=api_error, waited_secs=0.
    const retried = events.find((e) => e.event === 'batch.retried' && e.cause === 'interrupted');
    expect(retried).toBeDefined();
    expect(retried?.batch_id).toBe('v99-b01');
    expect(retried?.stop_reason).toBe('api_error');
    expect(retried?.waited_secs).toBe(0);

    // queue.finished reason=exhausted.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('exhausted');
  });
});
