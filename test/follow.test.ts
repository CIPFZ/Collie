// SPEC 14.4: tests for `collie follow` — constant loop that reads
// docs/ops/next.md, decides via handoff.ts, and executes the chosen action.
// All tests use Sandbox; subprocess is injected via a fake; clock and sleep
// are injected; no real timers or network.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { follow, type SpawnResult, type SpawnFn } from '../src/follow.js';
import { git } from '../src/git.js';
import { Sandbox } from './support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a next.md string for 开跑 with given fields. */
function nextRunMd(baseSha: string, pinnedSha: string, max: number): string {
  return [
    '状态：开跑',
    `基准提交：${baseSha}`,
    `固定版本：${pinnedSha}`,
    `批次上限：${String(max)}`,
  ].join('\n');
}

/** Build a next.md string for 等所有者裁定. */
function nextWaitMd(baseSha: string, matter: string): string {
  return ['状态：等所有者裁定', `基准提交：${baseSha}`, `裁定事项：${matter}`].join('\n');
}

/** Build a next.md string for 收工. */
function nextDoneMd(baseSha: string, summary: string): string {
  return ['状态：收工', `基准提交：${baseSha}`, `摘要：${summary}`].join('\n');
}

/**
 * Fake clock + sleep: clock advances only via sleep calls.
 * No real timers — vitest invariant.
 */
function createFakeClock(start = 0): { now: () => number; sleep: (ms: number) => Promise<void> } {
  let t = start;
  return {
    now: () => t,
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

const OK: SpawnResult = { exitCode: 0, stdout: '', stderr: '' };

/** Create a spawn function that records calls and returns scripted results. */
function createFakeSpawn(results: SpawnResult[] = []): {
  spawn: SpawnFn;
  calls: { args: readonly string[]; cwd: string }[];
} {
  const calls: { args: readonly string[]; cwd: string }[] = [];
  let idx = 0;
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (args, cwd) => {
    calls.push({ args, cwd });
    const result = results[idx] ?? OK;
    idx++;
    return result;
  };
  return { spawn, calls };
}

/** Create a spawn that returns a specific result for calls matching a keyword. */
function createArgSpawn(rules: { match: string; result: SpawnResult }[]): {
  spawn: SpawnFn;
  calls: { args: readonly string[]; cwd: string }[];
} {
  const calls: { args: readonly string[]; cwd: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (args, cwd) => {
    calls.push({ args, cwd });
    const argsStr = args.join(' ');
    for (const rule of rules) {
      if (argsStr.includes(rule.match)) return rule.result;
    }
    return OK;
  };
  return { spawn, calls };
}

/** NotifySender that collects texts in an array. */
// eslint-disable-next-line @typescript-eslint/require-await -- test fake
const collector = (arr: string[]) => async (text: string) => {
  arr.push(text);
};

/** NotifySender that discards. */
const noop: (text: string) => Promise<void> = () => Promise.resolve();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collie follow (SPEC 14.4)', { timeout: 60_000 }, () => {
  let box: Sandbox;
  let baseSha: string;

  beforeEach(async () => {
    box = await Sandbox.create();
    baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
  });

  afterEach(() => {
    box.dispose();
  });

  /** Wrap spawn so a q- dir is created after a run --continue call. */
  function wrapWithQueueDir(
    innerSpawn: SpawnFn,
    callTracker: { args: readonly string[]; cwd: string }[],
    qRunId: string,
  ): SpawnFn {
    return async (args, cwd) => {
      const result = await innerSpawn(args, cwd);
      if (args.some((a) => a === '--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', qRunId), { recursive: true });
      }
      return result;
    };
  }

  // -----------------------------------------------------------------------
  // 1. 开跑 → runs preflight, run, report, commit, push, notify
  // -----------------------------------------------------------------------
  it('开跑 → starts preflight, run, report; commits and pushes; notifies; records handledBase', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const output: string[] = [];
    const notifications: string[] = [];
    const clock = createFakeClock();

    // Use arg-based matching so npm ci calls don't offset positions
    const { spawn, calls } = createArgSpawn([
      { match: 'report', result: { exitCode: 0, stdout: '# Report\n\nAll good.\n', stderr: '' } },
    ]);

    const code = await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120000'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
    });

    expect(code).toBe(0);
    // Verify preflight, run, and report calls were made
    expect(calls.some((c) => c.args.some((a) => a === 'preflight'))).toBe(true);
    expect(calls.some((c) => c.args.some((a) => a === '--continue'))).toBe(true);
    expect(calls.some((c) => c.args.some((a) => a === 'report'))).toBe(true);
    // --max should carry the batch limit
    const runCall = calls.find((c) => c.args.some((a) => a === '--continue'));
    expect(runCall?.args.some((a) => a === '4')).toBe(true);

    expect(existsSync(join(box.root, 'docs', 'ops', 'queue-q-20261116120000.md'))).toBe(true);

    const logOutput = await git(box.root, ['log', '--oneline', '-5']);
    expect(logOutput).toContain('ops: report queue q-20261116120000');

    const remoteLog = await git(box.remote, ['log', '--oneline', '-5']);
    expect(remoteLog).toContain('ops: report queue');

    expect(notifications.some((n) => n.includes('队列') && n.includes('结束'))).toBe(true);
    expect(notifications.some((n) => n.includes('到对话里说「看」'))).toBe(true);

    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as { handledBase: string };
    expect(state.handledBase).toBe(baseSha);
  });

  // -----------------------------------------------------------------------
  // 2. Same baseSha second time → does not run again
  // -----------------------------------------------------------------------
  it('same baseSha second time → does not run again', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const clock = createFakeClock();
    const output: string[] = [];
    const notifications: string[] = [];

    const { spawn: spawn1, calls: calls1 } = createArgSpawn([
      { match: 'report', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn1, calls1, 'q-20261116120001'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
    });

    // Second iteration: should not spawn anything
    const { spawn: spawn2, calls: calls2 } = createFakeSpawn();
    output.length = 0;

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: spawn2,
      sendNotify: noop,
      out: (t) => output.push(t),
    });

    expect(calls2.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 3. preflight fails → notify once, next cycle retry
  // -----------------------------------------------------------------------
  it('preflight failure → notify once, does not record handledBase, retries', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    // Preflight always fails on first run
    const { spawn: spawn1 } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 1, stdout: 'FAIL disk_free', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: spawn1,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.some((n) => n.includes('preflight'))).toBe(true);

    const state1Raw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state1 = JSON.parse(state1Raw) as { handledBase: string | null };
    expect(state1.handledBase).toBeNull();

    // Second run: preflight succeeds → proceeds
    const { spawn: spawn2, calls: calls2 } = createArgSpawn([
      { match: 'report', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn2, calls2, 'q-20261116120002'),
      sendNotify: noop,
      out: () => {
        /* noop */
      },
    });

    expect(calls2.some((c) => c.args.some((a) => a === '--continue'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 4. 等所有者裁定 → notify once only
  // -----------------------------------------------------------------------
  it('等所有者裁定 → notify once then wait on second call', async () => {
    box.write('docs/ops/next.md', nextWaitMd(baseSha, 'check v04'), box.root);
    await box.commitAll('ops: next -> wait');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    const { spawn } = createFakeSpawn();

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0]).toContain('check v04');

    notifications.length = 0;
    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 5. 收工 → notify then exit
  // -----------------------------------------------------------------------
  it('收工 → notify and exit on second call', async () => {
    box.write('docs/ops/next.md', nextDoneMd(baseSha, 'all done'), box.root);
    await box.commitAll('ops: next -> done');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const output: string[] = [];
    const clock = createFakeClock();
    const { spawn } = createFakeSpawn();

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0]).toContain('收工');

    output.length = 0;
    const code = await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: noop,
      out: (t) => output.push(t),
    });

    expect(code).toBe(0);
    expect(output.some((l) => l.includes('收工'))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 6. Format error → notify once
  // -----------------------------------------------------------------------
  it('format error in next.md → notify once then wait', async () => {
    box.write('docs/ops/next.md', 'garbage without valid keys', box.root);
    await box.commitAll('ops: next -> bad');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    const { spawn } = createFakeSpawn();

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.length).toBe(1);

    notifications.length = 0;
    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 7. baseSha not ancestor of HEAD → does not run
  // -----------------------------------------------------------------------
  it('baseSha not ancestor of HEAD → notifies and does not run', async () => {
    const fakeSha = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    box.write('docs/ops/next.md', nextRunMd(fakeSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run with bad base');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    const { spawn, calls } = createFakeSpawn([]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
    });

    expect(notifications.some((n) => n.includes('祖先'))).toBe(true);
    expect(calls.filter((c) => c.args.some((a) => a === '--continue')).length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 8. --dry-run → no side effects
  // -----------------------------------------------------------------------
  it('--dry-run prints action but does nothing', async () => {
    box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const output: string[] = [];
    const notifications: string[] = [];
    const clock = createFakeClock();
    const { spawn, calls } = createFakeSpawn();

    await follow({
      root: box.root,
      once: true,
      dryRun: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
    });

    expect(output.some((l) => l.includes('action: run'))).toBe(true);
    expect(calls.length).toBe(0);
    expect(notifications.length).toBe(0);
    expect(existsSync(join(box.root, '.collie', 'follow.json'))).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 9. report failure → writes minimal report
  // -----------------------------------------------------------------------
  it('report command fails → writes minimal report with stdout/stderr tail', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const output: string[] = [];
    const notifications: string[] = [];
    const clock = createFakeClock();

    // Use arg matching: run --continue returns output, report fails
    const { spawn, calls } = createArgSpawn([
      {
        match: '--continue',
        result: { exitCode: 0, stdout: 'queue: exhausted\n', stderr: '' },
      },
      {
        match: 'report',
        result: { exitCode: 1, stdout: '', stderr: 'report generation failed' },
      },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120003'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
    });

    const reportPath = join(box.root, 'docs', 'ops', 'queue-q-20261116120003.md');
    expect(existsSync(reportPath)).toBe(true);
    const content = readFileSync(reportPath, 'utf8');
    expect(content).toContain('退出码');
    expect(content).toContain('queue: exhausted');
  });

  // -----------------------------------------------------------------------
  // 10. CLI wiring: --help shows dry-run
  // -----------------------------------------------------------------------
  it('CLI --help shows dry-run option', async () => {
    const code = await box.cli(['follow', '--help'], undefined);
    expect(code).toBe(0);
    expect(box.output.some((l) => l.includes('dry-run'))).toBe(true);
  });
});
