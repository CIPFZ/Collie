// SPEC 14.4 / 14.9: tests for `collie follow` — constant loop that reads
// docs/ops/next.md, decides via handoff.ts, and executes the chosen action.
// All tests use Sandbox; subprocess is injected via a fake; clock and sleep
// are injected; no real timers or network.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { follow, type SpawnResult, type SpawnFn, type FollowJson } from '../src/follow.js';
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
  calls: { cmd: readonly string[]; cwd: string }[];
} {
  const calls: { cmd: readonly string[]; cwd: string }[] = [];
  let idx = 0;
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (cmd, cwd) => {
    calls.push({ cmd, cwd });
    const result = results[idx] ?? OK;
    idx++;
    return result;
  };
  return { spawn, calls };
}

/** Create a spawn that returns a specific result for calls matching a keyword. */
function createArgSpawn(rules: { match: string; result: SpawnResult }[]): {
  spawn: SpawnFn;
  calls: { cmd: readonly string[]; cwd: string }[];
} {
  const calls: { cmd: readonly string[]; cwd: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (cmd, cwd) => {
    calls.push({ cmd, cwd });
    const cmdStr = cmd.join(' ');
    for (const rule of rules) {
      if (cmdStr.includes(rule.match)) return rule.result;
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

const SIXTY_SEC_MS = 60_000;

const FIVE_MIN_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collie follow (SPEC 14.4 / 14.9)', { timeout: 120_000 }, () => {
  let box: Sandbox;
  let baseSha: string;
  let pinnedDir: string;

  beforeEach(async () => {
    box = await Sandbox.create();
    baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    // Create a dedicated pinned parent dir inside sandbox
    pinnedDir = join(box.dir, 'pinned');
    mkdirSync(pinnedDir, { recursive: true });
  });

  afterEach(() => {
    box.dispose();
  });

  /** Wrap spawn so a q- dir is created after a run --continue call. */
  function wrapWithQueueDir(
    innerSpawn: SpawnFn,
    callTracker: { cmd: readonly string[]; cwd: string }[],
    qRunId: string,
  ): SpawnFn {
    return async (cmd, cwd) => {
      const result = await innerSpawn(cmd, cwd);
      if (cmd.some((a) => a === '--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', qRunId), { recursive: true });
      }
      return result;
    };
  }

  // -----------------------------------------------------------------------
  // 1. 开跑 → runs preflight, run, report; commits and pushes; notifies; records handledBase
  // -----------------------------------------------------------------------
  it('开跑 → starts preflight, run, report; commits (base marker) and pushes; notifies; records handledBase', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const output: string[] = [];
    const notifications: string[] = [];
    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });
    const reportJson = JSON.stringify({ reason: 'limit' });

    const { spawn, calls } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      {
        match: 'report --queue',
        result: { exitCode: 0, stdout: '# Report\n\nAll good.\n', stderr: '' },
      },
      { match: '--json', result: { exitCode: 0, stdout: reportJson + '\n', stderr: '' } },
    ]);

    const code = await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120000'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
      pinnedParentDir: pinnedDir,
    });

    expect(code).toBe(0);
    // Verify preflight, run, and report calls were made
    expect(calls.some((c) => c.cmd.some((a) => a === 'preflight'))).toBe(true);
    expect(calls.some((c) => c.cmd.some((a) => a === '--continue'))).toBe(true);
    expect(calls.some((c) => c.cmd.some((a) => a === 'report'))).toBe(true);

    expect(existsSync(join(box.root, 'docs', 'ops', 'queue-q-20261116120000.md'))).toBe(true);

    // SPEC 14.9 item 1: commit message contains (base <12chars>)
    const logOutput = await git(box.root, ['log', '--oneline', '-5']);
    expect(logOutput).toContain('ops: report queue q-20261116120000');
    expect(logOutput).toContain(`(base ${baseSha.slice(0, 12)})`);

    const remoteLog = await git(box.remote, ['log', '--oneline', '-5']);
    expect(remoteLog).toContain('ops: report queue');

    expect(notifications.some((n) => n.includes('队列') && n.includes('结束'))).toBe(true);
    expect(notifications.some((n) => n.includes('到对话里说「看」'))).toBe(true);

    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as FollowJson;
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

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn: spawn1, calls: calls1 } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      { match: 'report --queue', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: '{}', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn1, calls1, 'q-20261116120001'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
    });

    expect(calls2.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 3. preflight fails → notify once, next cycle retry (single cycle)
  // -----------------------------------------------------------------------
  it('preflight failure → notify once, does not record handledBase, retries after backoff', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const failJson = JSON.stringify({
      ok: false,
      checks: [
        { name: 'worktree_clean', ok: true },
        { name: 'disk_free', ok: false, detail: '50 MB free, need 200 MB' },
      ],
    });

    // Preflight always fails on first run
    const { spawn: spawn1 } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 1, stdout: failJson + '\n', stderr: '' } },
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
      pinnedParentDir: pinnedDir,
    });

    expect(notifications.some((n) => n.includes('preflight'))).toBe(true);

    const state1Raw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state1 = JSON.parse(state1Raw) as FollowJson;
    expect(state1.handledBase).toBeNull();
    // SPEC 14.9 item 2: retry state with notBefore should be set
    expect(state1.retry).toBeDefined();
    expect(state1.retry?.notBefore).toBeGreaterThan(0);

    // Advance clock past backoff and retry with success
    await clock.sleep(FIVE_MIN_MS + SIXTY_SEC_MS);

    const preflightOkJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn: spawn2, calls: calls2 } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightOkJson + '\n', stderr: '' } },
      { match: 'report --queue', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: '{}', stderr: '' } },
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
      pinnedParentDir: pinnedDir,
    });

    expect(calls2.some((c) => c.cmd.some((a) => a === '--continue'))).toBe(true);
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
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
      pinnedParentDir: pinnedDir,
    });

    expect(notifications.some((n) => n.includes('祖先'))).toBe(true);
    expect(calls.filter((c) => c.cmd.some((a) => a === '--continue')).length).toBe(0);
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
      pinnedParentDir: pinnedDir,
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

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn, calls } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
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
      pinnedParentDir: pinnedDir,
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

  // -----------------------------------------------------------------------
  // 11. SPEC 14.9 item 1: push failure 3 cycles — run --continue only starts once
  // -----------------------------------------------------------------------
  it('push failure across 3 cycles: run --continue starts only once, 1 report in repo', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Make push fail by removing the remote
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });
    const reportJson = JSON.stringify({ reason: 'limit' });

    let runContinueCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('--continue')) {
        runContinueCount++;
        mkdirSync(join(box.root, '.collie', 'runs', `q-push-${String(runContinueCount)}`), {
          recursive: true,
        });
        return { exitCode: 0, stdout: 'done\n', stderr: '' };
      }
      if (cmdStr.includes('preflight')) {
        return { exitCode: 0, stdout: preflightJson + '\n', stderr: '' };
      }
      if (cmdStr.includes('--json')) {
        return { exitCode: 0, stdout: reportJson + '\n', stderr: '' };
      }
      if (cmdStr.includes('report')) {
        return { exitCode: 0, stdout: '# Report\n', stderr: '' };
      }
      return OK;
    };

    const CYCLES = 3;
    // Run 3 cycles using --timeout
    const timeoutSecs = (CYCLES * SIXTY_SEC_MS) / 1000 + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // run --continue should have been called exactly once
    expect(runContinueCount).toBe(1);

    // Only 1 report file in docs/ops/
    const opsDir = join(box.root, 'docs', 'ops');
    const queueReports = existsSync(opsDir)
      ? readdirSync(opsDir).filter((f) => f.startsWith('queue-'))
      : [];
    expect(queueReports.length).toBe(1);

    // Push notification should appear exactly once
    const pushNotifs = notifications.filter((n) => n.includes('推送失败'));
    expect(pushNotifs.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 12. SPEC 14.9 item 2: preflight continuous failure 3 cycles — backoff
  // -----------------------------------------------------------------------
  it('preflight continuous failure 3 cycles: preflight called once, notified once; after 5min backoff 2nd preflight, still 1 notification', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const failJson = JSON.stringify({
      ok: false,
      checks: [
        { name: 'worktree_clean', ok: true },
        { name: 'disk_free', ok: false, detail: '50 MB' },
      ],
    });

    let preflightCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('preflight')) {
        preflightCount++;
        return { exitCode: 1, stdout: failJson + '\n', stderr: '' };
      }
      return OK;
    };

    // Run 3 cycles at 60s intervals — backoff is 5 min so cycles 2 and 3 skip preflight
    const CYCLES = 3; // test: 3 cycles
    const timeoutSecs = (CYCLES * SIXTY_SEC_MS) / 1000 + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Preflight should have been called exactly once (cycles 2 & 3 are within backoff)
    expect(preflightCount).toBe(1);
    // Notification should have been sent exactly once
    const preflightNotifs = notifications.filter((n) => n.includes('preflight'));
    expect(preflightNotifs.length).toBe(1);

    // Now advance clock past the 5-minute backoff and run one more cycle
    await clock.sleep(FIVE_MIN_MS);

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
      pinnedParentDir: pinnedDir,
    });

    // Second preflight attempt should happen now
    expect(preflightCount).toBe(2);
    // But still only 1 preflight notification (same key)
    const preflightNotifs2 = notifications.filter((n) => n.includes('preflight'));
    expect(preflightNotifs2.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 13. SPEC 14.9: baseSha not ancestor — 3 cycles → only 1 notification, no subprocess
  // -----------------------------------------------------------------------
  it('baseSha not ancestor 3 cycles: only 1 notification, no subprocess', async () => {
    const fakeSha = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    box.write('docs/ops/next.md', nextRunMd(fakeSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> bad ancestor');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    let subprocessCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async () => {
      subprocessCount++;
      return OK;
    };

    const CYCLES = 3; // test: 3 cycles
    const timeoutSecs = (CYCLES * SIXTY_SEC_MS) / 1000 + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Only 1 notification
    const ancestorNotifs = notifications.filter((n) => n.includes('祖先'));
    expect(ancestorNotifs.length).toBe(1);
    // No subprocess started
    expect(subprocessCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 14. SPEC 14.9 item 1: follow.json deleted → same base not re-run (git log marker)
  // -----------------------------------------------------------------------
  it('follow.json deleted after handling → same base not re-run (git log marker)', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const clock = createFakeClock();
    const notifications: string[] = [];

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn: spawn1, calls: calls1 } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      { match: 'report --queue', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: '{}', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn1, calls1, 'q-20261116120004'),
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Verify follow.json has handledBase
    const statePath = join(box.root, '.collie', 'follow.json');
    expect(existsSync(statePath)).toBe(true);

    // Delete follow.json
    unlinkSync(statePath);

    // Second iteration: should not spawn run --continue (git log has marker)
    let runCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn2: SpawnFn = async (cmd) => {
      if (cmd.some((a) => a === '--continue')) runCount++;
      return OK;
    };

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: spawn2,
      sendNotify: noop,
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(runCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 15. SPEC 14.9 item 3: preflight notification does not contain /
  // -----------------------------------------------------------------------
  it('preflight failure notification does not contain /', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    // JSON with detail that contains a path
    const failJson = JSON.stringify({
      ok: false,
      checks: [
        { name: 'ci_token', ok: false, detail: '/home/user/.config/collie/github-token not found' },
      ],
    });

    const { spawn } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 1, stdout: failJson + '\n', stderr: '' } },
    ]);

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
      pinnedParentDir: pinnedDir,
    });

    // The notification should list item name, not path
    expect(notifications.length).toBeGreaterThan(0);
    const preflightNotif = notifications.find((n) => n.includes('preflight'));
    expect(preflightNotif).toBeDefined();
    expect(preflightNotif).not.toContain('/');
  });

  // -----------------------------------------------------------------------
  // 16. SPEC 14.9 item 3: queue reason from journal (limit ≠ exhausted)
  // -----------------------------------------------------------------------
  it('queue end notification reason comes from journal, not exit code', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });
    const reportJson = JSON.stringify({ reason: 'limit' });

    const { spawn, calls } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      { match: '--continue', result: { exitCode: 0, stdout: 'done\n', stderr: '' } },
      // --json must be before report to match the JSON variant first
      { match: '--json', result: { exitCode: 0, stdout: reportJson + '\n', stderr: '' } },
      { match: 'report', result: { exitCode: 0, stdout: '# Report\n', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120005'),
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    const endNotif = notifications.find((n) => n.includes('队列') && n.includes('结束'));
    expect(endNotif).toBeDefined();
    // Reason should be 'limit' (from journal), not 'exhausted'
    expect(endNotif).toContain('limit');
    expect(endNotif).not.toContain('exhausted');
  });

  // -----------------------------------------------------------------------
  // 17. SPEC 14.9 item 4: lock file different → npm is first word of command
  // -----------------------------------------------------------------------
  it('different lock file → npm ci subprocess command starts with npm', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    // Modify package-lock.json so it differs from the pinned version
    box.write('package-lock.json', '{"different": true}', box.root);
    await box.commitAll('ops: next -> run with changed lock');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const allCalls: { cmd: readonly string[]; cwd: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd, cwd) => {
      allCalls.push({ cmd, cwd });
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('preflight')) {
        return { exitCode: 0, stdout: preflightJson + '\n', stderr: '' };
      }
      if (cmdStr.includes('--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', 'q-20261116120006'), {
          recursive: true,
        });
        return { exitCode: 0, stdout: 'done\n', stderr: '' };
      }
      if (cmdStr.includes('report') && cmdStr.includes('--json')) {
        return { exitCode: 0, stdout: '{}', stderr: '' };
      }
      if (cmdStr.includes('report')) {
        return { exitCode: 0, stdout: '# R\n', stderr: '' };
      }
      return OK;
    };

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
      pinnedParentDir: pinnedDir,
    });

    // Find the npm ci call
    const npmCiCall = allCalls.find(
      (c) => c.cmd.some((a) => a === 'ci') && c.cmd.some((a) => a === 'npm'),
    );
    expect(npmCiCall).toBeDefined();
    // First word should be 'npm'
    expect(npmCiCall?.cmd[0]).toBe('npm');
  });

  // -----------------------------------------------------------------------
  // 18. SPEC 14.9 item 5: report has appendix section
  // -----------------------------------------------------------------------
  it('generated report has appendix section with follow environment info', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn, calls } = createArgSpawn([
      {
        match: 'preflight',
        result: { exitCode: 0, stdout: preflightJson + '\npreflight: ok\n', stderr: '' },
      },
      { match: '--continue', result: { exitCode: 0, stdout: 'queue run done\n', stderr: '' } },
      {
        match: 'report --queue',
        result: { exitCode: 0, stdout: '# Queue Report\n\nDetails here.\n', stderr: '' },
      },
      {
        match: '--json',
        result: { exitCode: 0, stdout: JSON.stringify({ reason: 'limit' }), stderr: '' },
      },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120007'),
      sendNotify: noop,
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    const reportPath = join(box.root, 'docs', 'ops', 'queue-q-20261116120007.md');
    expect(existsSync(reportPath)).toBe(true);
    const content = readFileSync(reportPath, 'utf8');
    // SPEC 14.9 item 5: appendix section
    expect(content).toContain('## 运行环境（follow 记录）');
    expect(content).toContain(baseSha);
    expect(content).toContain(pinnedSha);
    expect(content).toContain('run 退出码');
    expect(content).toContain('preflight 末行');
  });

  // -----------------------------------------------------------------------
  // 19. SPEC 14.9 item 6: pinned dirs only created inside injected parent
  // -----------------------------------------------------------------------
  it('pinned dirs created only inside injected parent, not system tmpdir', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Snapshot system tmpdir before test
    const sysTmp = tmpdir();
    const sysBefore = new Set(readdirSync(sysTmp).filter((d) => d.startsWith('collie-r2-')));

    const clock = createFakeClock();
    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const { spawn, calls } = createArgSpawn([
      {
        match: 'preflight',
        result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' },
      },
      { match: 'report --queue', result: { exitCode: 0, stdout: '# R\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: '{}', stderr: '' } },
    ]);

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120008'),
      sendNotify: noop,
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Pinned dir should be inside pinnedDir
    const pinnedItems = readdirSync(pinnedDir).filter((d) => d.startsWith('collie-r2-'));
    expect(pinnedItems.length).toBeGreaterThan(0);

    // No NEW collie-r2- dirs in system tmpdir from this test
    const sysAfter = readdirSync(sysTmp).filter((d) => d.startsWith('collie-r2-'));
    const newInSysTmp = sysAfter.filter((d) => !sysBefore.has(d));
    expect(newInSysTmp.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 20. SPEC 14.9 item 2: git pull failure 3 cycles → notify once
  // -----------------------------------------------------------------------
  it('git pull failure 3 consecutive cycles → notifies once', async () => {
    box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Make pull fail by setting a broken remote
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    const { spawn } = createFakeSpawn();

    const CYCLES = 4;
    const timeoutSecs = (CYCLES * SIXTY_SEC_MS) / 1000 + 1;

    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    const pullNotifs = notifications.filter((n) => n.includes('pull'));
    expect(pullNotifs.length).toBe(1);
  });
});
