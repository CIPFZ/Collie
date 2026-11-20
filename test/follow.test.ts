// SPEC 14.4 / 14.9: tests for `collie follow` — constant loop that reads
// docs/ops/next.md, decides via handoff.ts, and executes the chosen action.
// All tests use Sandbox; subprocess is injected via a fake; clock and sleep
// are injected; no real timers or network.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  follow,
  defaultSpawn,
  type SpawnResult,
  type SpawnFn,
  type FollowJson,
  type OutputMode,
  keepLines,
} from '../src/follow.js';
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
  calls: { cmd: readonly string[]; cwd: string; mode: OutputMode }[];
} {
  const calls: { cmd: readonly string[]; cwd: string; mode: OutputMode }[] = [];
  let idx = 0;
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (cmd, cwd, mode) => {
    calls.push({ cmd, cwd, mode });
    const result = results[idx] ?? OK;
    idx++;
    return result;
  };
  return { spawn, calls };
}

/** Create a spawn that returns a specific result for calls matching a keyword. */
function createArgSpawn(rules: { match: string; result: SpawnResult }[]): {
  spawn: SpawnFn;
  calls: { cmd: readonly string[]; cwd: string; mode: OutputMode }[];
} {
  const calls: { cmd: readonly string[]; cwd: string; mode: OutputMode }[] = [];
  // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
  const spawn: SpawnFn = async (cmd, cwd, mode) => {
    calls.push({ cmd, cwd, mode });
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

describe('collie follow (SPEC 14.4 / 14.9)', { timeout: 300_000 }, () => {
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
    callTracker: { cmd: readonly string[]; cwd: string; mode: OutputMode }[],
    qRunId: string,
  ): SpawnFn {
    return async (cmd, cwd, mode) => {
      const result = await innerSpawn(cmd, cwd, mode);
      if (cmd.some((a) => a === '--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', qRunId), { recursive: true });
      }
      return result;
    };
  }

  // -----------------------------------------------------------------------
  // 1. 开跑 → runs preflight, run, report; commits and pushes; notifies; records handledBase
  // -----------------------------------------------------------------------
  it('开跑 → starts preflight, run, report; commits (base marker); pushes on second cycle; notifies; records handledBase', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const output: string[] = [];
    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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

    // Cycle 1: execute run, commit report (not pushed yet)
    // Cycle 2: sync pushes, pendingReport notification sent

    const timeoutSecs = 61;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120000'),
      sendNotify: collector(notifications),
      out: (t) => output.push(t),
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(2);

    // Verify preflight, run, and report calls were made
    expect(calls.some((c) => c.cmd.some((a) => a === 'preflight'))).toBe(true);
    expect(calls.some((c) => c.cmd.some((a) => a === '--continue'))).toBe(true);
    expect(calls.some((c) => c.cmd.some((a) => a === 'report'))).toBe(true);

    expect(existsSync(join(box.root, 'docs', 'ops', 'queue-q-20261116120000.md'))).toBe(true);

    // SPEC 14.9 item 1: commit message contains (base <12chars>)
    const logOutput = await git(box.root, ['log', '--oneline', '-5']);
    expect(logOutput).toContain('ops: report queue q-20261116120000');
    expect(logOutput).toContain(`(base ${baseSha.slice(0, 12)})`);

    // SPEC 14.12: push happens in sync (cycle 2)
    const remoteLog = await git(box.remote, ['log', '--oneline', '-5']);
    expect(remoteLog).toContain('ops: report queue');

    // SPEC 14.12 item 2: queue-end notification only after push (cycle 2)
    expect(notifications.some((n) => n.includes('队列') && n.includes('结束'))).toBe(true);
    expect(notifications.some((n) => n.includes('到对话里说「看」'))).toBe(true);

    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as FollowJson;
    expect(state.handledBase).toBe(baseSha);
    // pendingReport should be cleared after sending
    expect(state.pendingReport).toBeUndefined();
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
  it('push failure across 3 cycles: run --continue starts only once, 1 push notification, pendingReport stored', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Make remote unreachable by setting a broken URL
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
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

    // SPEC 14.12: queue-end notification NOT sent (local still ahead)
    const endNotifs = notifications.filter((n) => n.includes('队列') && n.includes('结束'));
    expect(endNotifs.length).toBe(0);

    // pendingReport should still be in state
    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as FollowJson;
    expect(state.pendingReport).toBeDefined();
    expect(state.pendingReport?.reason).toBe('limit');
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
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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

    const CYCLES = 3;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
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
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

    let subprocessCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async () => {
      subprocessCount++;
      return OK;
    };

    const CYCLES = 3;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
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
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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

    // 2 cycles: cycle 1 runs, cycle 2 pushes and sends notification

    const timeoutSecs = 61;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-20261116120005'),
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(2);

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

    const allCalls: { cmd: readonly string[]; cwd: string; mode: OutputMode }[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd, cwd, mode) => {
      allCalls.push({ cmd, cwd, mode });
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
    // SPEC 14.9 item 5 / 14.12 item 5: appendix section
    expect(content).toContain('## 运行环境（follow 记录）');
    expect(content).toContain(baseSha);
    expect(content).toContain(pinnedSha);
    expect(content).toContain('run 退出码');
    expect(content).toContain('preflight：ok');
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
  // 20. SPEC 14.9 item 2 / 14.15 item 1: git pull failure — sync failure notification
  // -----------------------------------------------------------------------
  it('broken remote 4 cycles → 1 "git pull 连续失败" notification at cycle 3, no queue-end', async () => {
    box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Make remote unreachable
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };
    const { spawn } = createFakeSpawn();

    const CYCLES = 4;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;

    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
    // SPEC 14.15 item 1: "git pull 连续失败" exactly once (at cycle 3)
    const pullNotifs = notifications.filter((n) => n.includes('git pull 连续失败'));
    expect(pullNotifs.length).toBe(1);
    // No queue-end notification
    const endNotifs = notifications.filter((n) => n.includes('队列') && n.includes('结束'));
    expect(endNotifs.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 21. SPEC 14.12: push fail 3 → restore → 3 more → remote has report, 1 run, 1 notification after restore
  // -----------------------------------------------------------------------
  it('push fail 3 → restore remote → 3 more → remote has report, run --continue once, 1 queue-end notification after restore', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const realRemote = box.remote;
    // Break remote
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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
        mkdirSync(join(box.root, '.collie', 'runs', `q-restore-${String(runContinueCount)}`), {
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

    // Phase 1: 3 cycles with broken remote

    const phase1Secs = 2 * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs: phase1Secs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(3);
    expect(runContinueCount).toBe(1);
    // No queue-end notification yet
    expect(notifications.filter((n) => n.includes('队列') && n.includes('结束')).length).toBe(0);

    // Phase 2: restore remote, run 3 more cycles
    await git(box.root, ['remote', 'set-url', 'origin', realRemote]);
    sleepCount = 0;

    const phase2Secs = 2 * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs: phase2Secs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(3);
    // run --continue still only 1 total
    expect(runContinueCount).toBe(1);
    // Remote has the report commit
    const remoteLog = await git(box.remote, ['log', '--oneline', '-5']);
    expect(remoteLog).toContain('ops: report queue');
    // Local is not ahead
    const localHead = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    const remoteHead = (await git(box.remote, ['rev-parse', 'HEAD'])).trim();
    expect(localHead).toBe(remoteHead);
    // Queue-end notification sent exactly once, after restore
    const endNotifs = notifications.filter((n) => n.includes('队列') && n.includes('结束'));
    expect(endNotifs.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 22. SPEC 14.12: remote has extra commit during queue → rebase, no diverged notification
  // -----------------------------------------------------------------------
  it('remote extra commit during queue → rebase, remote has both commits, no diverged notification, 4 cycles', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    let extraCommitDone = false;

    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
      // Push an extra commit to remote between cycle 1 and cycle 2
      if (!extraCommitDone) {
        const tmpClone = join(box.dir, 'tmpclone');
        mkdirSync(tmpClone);
        await git(box.dir, ['clone', '-q', box.remote, tmpClone]);
        writeFileSync(join(tmpClone, 'extra.txt'), 'extra\n');
        await git(tmpClone, ['add', 'extra.txt']);
        await git(tmpClone, ['commit', '-q', '-m', 'chore: extra commit from another actor']);
        await git(tmpClone, ['push', '-q', 'origin', 'main']);
        extraCommitDone = true;
      }
    };

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });
    const reportJson = JSON.stringify({ reason: 'limit' });

    const { spawn, calls } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      { match: '--continue', result: { exitCode: 0, stdout: 'done\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: reportJson + '\n', stderr: '' } },
      { match: 'report', result: { exitCode: 0, stdout: '# Report\n', stderr: '' } },
    ]);

    // Cycle 1: execute run, commit report
    // Sleep → push extra commit to remote
    // Cycle 2: sync → fetch → diverged → rebase → push → pendingReport notification
    // Sleep
    // Cycle 3: nothing (wait)
    // Sleep
    // Cycle 4: timeout

    const CYCLES = 4;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-rebase-1'),
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Assert cycle count
    expect(sleepCount).toBe(CYCLES);

    // Remote should have both the extra commit and the report commit
    const remoteLog = await git(box.remote, ['log', '--oneline', '-5']);
    expect(remoteLog).toContain('ops: report queue');
    expect(remoteLog).toContain('extra commit');

    // Local not ahead or behind
    const localHead = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    const remoteHead = (await git(box.remote, ['rev-parse', 'HEAD'])).trim();
    expect(localHead).toBe(remoteHead);

    // No diverged notification
    const divergedNotifs = notifications.filter((n) => n.includes('分叉'));
    expect(divergedNotifs.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 23. SPEC 14.12: local non-report commit + remote ahead → no rebase, 1 diverged notification in 3 cycles
  // -----------------------------------------------------------------------
  it('local non-report unpushed commit + remote ahead → no rebase, 3 cycles only 1 diverged', async () => {
    box.write('docs/ops/next.md', nextWaitMd(baseSha, 'check wait'), box.root);
    await box.commitAll('ops: next -> wait');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Make a local non-report commit
    writeFileSync(join(box.root, 'local-change.txt'), 'local\n');
    await git(box.root, ['add', 'local-change.txt']);
    await git(box.root, ['commit', '-q', '-m', 'feat: local change']);

    // Push extra commit to remote from a clone
    const tmpClone = join(box.dir, 'tmpclone2');
    mkdirSync(tmpClone);
    await git(box.dir, ['clone', '-q', box.remote, tmpClone]);
    writeFileSync(join(tmpClone, 'remote-change.txt'), 'remote\n');
    await git(tmpClone, ['add', 'remote-change.txt']);
    await git(tmpClone, ['commit', '-q', '-m', 'chore: remote change']);
    await git(tmpClone, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };
    const { spawn } = createFakeSpawn();

    const CYCLES = 3;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
    // Exactly 1 diverged notification
    const divergedNotifs = notifications.filter((n) => n.includes('分叉'));
    expect(divergedNotifs.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 24. SPEC 14.12: rebase conflict → abort, repo unchanged, 1 notification
  // -----------------------------------------------------------------------
  it('rebase conflict → abort, repo back to pre-rebase state, 1 diverged notification', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });
    const reportJson = JSON.stringify({ reason: 'limit' });
    const { spawn, calls } = createArgSpawn([
      { match: 'preflight', result: { exitCode: 0, stdout: preflightJson + '\n', stderr: '' } },
      { match: '--continue', result: { exitCode: 0, stdout: 'done\n', stderr: '' } },
      { match: '--json', result: { exitCode: 0, stdout: reportJson + '\n', stderr: '' } },
      { match: 'report', result: { exitCode: 0, stdout: '# Report\n', stderr: '' } },
    ]);

    const notifications: string[] = [];
    const clock = createFakeClock();

    // Cycle 1: run queue, commit report (an ops: report queue commit)
    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn: wrapWithQueueDir(spawn, calls, 'q-conflict-1'),
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    const localHeadBefore = (await git(box.root, ['rev-parse', 'HEAD'])).trim();

    // Create conflicting commit on remote: modify the same file as the report
    const tmpClone = join(box.dir, 'tmpclone3');
    mkdirSync(tmpClone);
    await git(box.dir, ['clone', '-q', box.remote, tmpClone]);
    mkdirSync(join(tmpClone, 'docs', 'ops'), { recursive: true });
    writeFileSync(join(tmpClone, 'docs', 'ops', 'queue-q-conflict-1.md'), 'CONFLICT CONTENT\n');
    await git(tmpClone, ['add', 'docs/ops/queue-q-conflict-1.md']);
    await git(tmpClone, ['commit', '-q', '-m', 'ops: conflict on report file']);
    await git(tmpClone, ['push', '-q', 'origin', 'main']);

    // Cycle 2: sync → fetch → diverged → all local are report commits → rebase → conflict → abort → notify
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

    // Repo should be back to pre-rebase state
    const localHeadAfter = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    expect(localHeadAfter).toBe(localHeadBefore);

    // 1 diverged notification
    const divergedNotifs = notifications.filter((n) => n.includes('分叉'));
    expect(divergedNotifs.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 25. SPEC 14.12 item 3: keepLines pure function — 500 lines
  // -----------------------------------------------------------------------
  it('keepLines: full mode preserves all 500 lines, tail mode keeps last 200', () => {
    const NUM_LINES = 500;
    const lines = Array.from({ length: NUM_LINES }, (_, i) => `line ${String(i + 1)}`);
    const text = lines.join('\n');

    const full = keepLines(text, 'full');
    expect(full).toBe(text);
    expect(full.split('\n').length).toBe(NUM_LINES);

    const tail = keepLines(text, 'tail');
    const tailLines = tail.split('\n');

    expect(tailLines.length).toBe(200);
    expect(tailLines[0]).toBe('line 301');
    expect(tailLines[tailLines.length - 1]).toBe('line 500');
  });

  // -----------------------------------------------------------------------
  // 26. SPEC 14.12 item 3: injected spawn receives correct output mode
  // -----------------------------------------------------------------------
  it('injected spawn receives correct mode: report/report --json/preflight --json=full, run --continue/npm ci=tail', async () => {
    const pinnedSha = baseSha;
    // Write a different package-lock.json to trigger npm ci
    box.write('package-lock.json', '{"different": true}', box.root);
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run with changed lock');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const clock = createFakeClock();
    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    const recordedModes: { match: string; mode: OutputMode }[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake: cwd unused but mode is needed
    const spawn: SpawnFn = async (cmd, _cwd, mode) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('npm ci')) recordedModes.push({ match: 'npm ci', mode });
      if (cmdStr.includes('preflight') && cmdStr.includes('--json'))
        recordedModes.push({ match: 'preflight --json', mode });
      if (cmdStr.includes('--continue')) {
        recordedModes.push({ match: 'run --continue', mode });
        mkdirSync(join(box.root, '.collie', 'runs', 'q-mode-1'), { recursive: true });
        return { exitCode: 0, stdout: 'done\n', stderr: '' };
      }
      if (cmdStr.includes('report') && cmdStr.includes('--json'))
        recordedModes.push({ match: 'report --json', mode });
      else if (cmdStr.includes('report')) recordedModes.push({ match: 'report', mode });
      if (cmdStr.includes('preflight')) {
        return { exitCode: 0, stdout: preflightJson + '\n', stderr: '' };
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
      sendNotify: noop,
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // Check modes
    const npmCiMode = recordedModes.find((r) => r.match === 'npm ci');
    expect(npmCiMode?.mode).toBe('tail');

    const preflightMode = recordedModes.find((r) => r.match === 'preflight --json');
    expect(preflightMode?.mode).toBe('full');

    const runMode = recordedModes.find((r) => r.match === 'run --continue');
    expect(runMode?.mode).toBe('tail');

    const reportMode = recordedModes.find((r) => r.match === 'report');
    expect(reportMode?.mode).toBe('full');

    const reportJsonMode = recordedModes.find((r) => r.match === 'report --json');
    expect(reportJsonMode?.mode).toBe('full');
  });

  // -----------------------------------------------------------------------
  // 27. SPEC 14.12: remote has new commit, local not ahead → pull, no pull notification
  // -----------------------------------------------------------------------
  it('remote has new commit, local not ahead → pulls, HEAD equals remote, no pull notification', async () => {
    box.write('docs/ops/next.md', nextWaitMd(baseSha, 'check wait'), box.root);
    await box.commitAll('ops: next -> wait');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Push extra commit to remote
    const tmpClone = join(box.dir, 'tmpclone4');
    mkdirSync(tmpClone);
    await git(box.dir, ['clone', '-q', box.remote, tmpClone]);
    writeFileSync(join(tmpClone, 'new-file.txt'), 'new\n');
    await git(tmpClone, ['add', 'new-file.txt']);
    await git(tmpClone, ['commit', '-q', '-m', 'chore: new remote commit']);
    await git(tmpClone, ['push', '-q', 'origin', 'main']);
    const remoteHeadBefore = (await git(box.remote, ['rev-parse', 'HEAD'])).trim();

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

    // Local HEAD should equal remote HEAD
    const localHead = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    expect(localHead).toBe(remoteHeadBefore);

    // No pull notification
    const pullNotifs = notifications.filter((n) => n.includes('pull'));
    expect(pullNotifs.length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 28. SPEC 14.12 item 4: npm ci failure → dir removed → next attempt recreates
  // -----------------------------------------------------------------------
  it('npm ci failure → pinned dir removed, success on retry → continues', async () => {
    const pinnedSha = baseSha;
    // Different lock file triggers npm ci
    box.write('package-lock.json', '{"trigger-ci": true}', box.root);
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run with npm ci');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const preflightJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    let npmCiCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd) => {
      const cmdStr = cmd.join(' ');
      // Check for npm ci specifically (cmd[0]='npm', cmd[1]='ci')
      if (cmd[0] === 'npm' && cmd[1] === 'ci') {
        npmCiCallCount++;
        // First call fails, second succeeds
        if (npmCiCallCount === 1) {
          return { exitCode: 1, stdout: '', stderr: 'npm ci failed' };
        }
        return OK;
      }
      if (cmdStr.includes('preflight')) {
        return { exitCode: 0, stdout: preflightJson + '\n', stderr: '' };
      }
      if (cmdStr.includes('--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', 'q-lock-1'), { recursive: true });
        return { exitCode: 0, stdout: 'done\n', stderr: '' };
      }
      if (cmdStr.includes('report')) {
        return { exitCode: 0, stdout: '# R\n', stderr: '' };
      }
      return OK;
    };

    // Cycle 1: npm ci fails → pinned dir removed, backoff
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

    // Pinned dir should NOT exist after failure
    const shaPrefix = pinnedSha.slice(0, 12);
    const pinnedItems = readdirSync(pinnedDir).filter((d) => d.includes(shaPrefix));
    expect(pinnedItems.length).toBe(0);

    // Should have pinned failure notification
    expect(notifications.some((n) => n.includes('固定版本'))).toBe(true);

    // Advance past backoff and retry
    await clock.sleep(FIVE_MIN_MS + SIXTY_SEC_MS);

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

    // npm ci should have been called twice (once fail, once success)

    expect(npmCiCallCount).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 29. SPEC 14.12 item 4: default spawn — nonexistent program → exit 127
  // -----------------------------------------------------------------------
  it('default spawn with nonexistent program returns exit code 127', async () => {
    // Call the actual defaultSpawn with a program that does not exist.
    // This exercises the ENOENT error handler (SPEC 14.12 item 4).
    const result = await defaultSpawn(['collie-nonexistent-program-xyz-9999'], tmpdir(), 'tail');

    expect(result.exitCode).toBe(127);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 30. SPEC 14.12 item 5: base commit change clears backoff
  // -----------------------------------------------------------------------
  it('changing base commit clears backoff from previous base', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const notifications: string[] = [];
    const clock = createFakeClock();

    const failJson = JSON.stringify({
      ok: false,
      checks: [{ name: 'disk_free', ok: false }],
    });
    const preflightOkJson = JSON.stringify({
      ok: true,
      checks: [{ name: 'worktree_clean', ok: true }],
    });

    let preflightCount = 0;
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake
    const spawn: SpawnFn = async (cmd) => {
      const cmdStr = cmd.join(' ');
      if (cmdStr.includes('preflight')) {
        preflightCount++;
        // First call (old base) fails; subsequent (new base) succeeds
        if (preflightCount === 1) {
          return { exitCode: 1, stdout: failJson + '\n', stderr: '' };
        }
        return { exitCode: 0, stdout: preflightOkJson + '\n', stderr: '' };
      }
      if (cmdStr.includes('--continue')) {
        mkdirSync(join(box.root, '.collie', 'runs', 'q-backoff-1'), { recursive: true });
        return { exitCode: 0, stdout: 'done\n', stderr: '' };
      }
      if (cmdStr.includes('report')) {
        return { exitCode: 0, stdout: '# R\n', stderr: '' };
      }
      return OK;
    };

    // Cycle 1: preflight fails → backoff
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

    expect(preflightCount).toBe(1);

    // State should have retry set
    const state1Raw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state1 = JSON.parse(state1Raw) as FollowJson;
    expect(state1.retry).toBeDefined();
    expect(state1.retryBase).toBe(baseSha);

    // Now change the base commit (simulate new next.md from R1)
    writeFileSync(join(box.root, 'new-base.txt'), 'new\n');
    const newBase = await box.commitAll('chore: new base');
    await git(box.root, ['push', '-q', 'origin', 'main']);
    box.write('docs/ops/next.md', nextRunMd(newBase, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run with new base');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Cycle 2: even though we're within the old backoff window, the new base clears it
    // No clock.sleep needed — backoff cleared by base change
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

    // Preflight should have been called again (backoff cleared)

    expect(preflightCount).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 31. SPEC 14.15 item 1: remote unreachable 5 cycles → 1 notification at cycle 3;
  //     restore 1 cycle → syncFailures=0; break again 3 cycles → 2nd notification; total 2
  // -----------------------------------------------------------------------
  it('remote unreachable 5+1+3 cycles: 2 "git pull 连续失败" notifications total', async () => {
    box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const realRemote = box.remote;
    // Phase 1: break remote, run 5 cycles
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };
    const { spawn } = createFakeSpawn();

    const PHASE1_CYCLES = 5;
    const timeoutSecs1 = (PHASE1_CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs: timeoutSecs1,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(PHASE1_CYCLES);
    // 1 "git pull 连续失败" (appeared at cycle 3)
    const pullNotifs1 = notifications.filter((n) => n.includes('git pull 连续失败'));
    expect(pullNotifs1.length).toBe(1);

    // Phase 2: restore remote, run 1 cycle to clear syncFailures
    await git(box.root, ['remote', 'set-url', 'origin', realRemote]);
    sleepCount = 0;

    await follow({
      root: box.root,
      once: true,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    // syncFailures should be 0 after success
    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as FollowJson;
    expect(state.syncFailures ?? 0).toBe(0);

    // Phase 3: break remote again, run 3 cycles → 2nd notification at cycle 3
    await git(box.root, ['remote', 'set-url', 'origin', '/nonexistent/path.git']);
    sleepCount = 0;

    const PHASE3_CYCLES = 3;
    const timeoutSecs3 = (PHASE3_CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs: timeoutSecs3,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(PHASE3_CYCLES);
    // Total 2 "git pull 连续失败" notifications
    const pullNotifs2 = notifications.filter((n) => n.includes('git pull 连续失败'));
    expect(pullNotifs2.length).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 32. SPEC 14.15 item 1: local behind, pull blocked by untracked file for 3 cycles
  // -----------------------------------------------------------------------
  it('pull blocked by untracked file 3 cycles: 1 "git pull 连续失败" notification', async () => {
    box.write('docs/ops/next.md', nextWaitMd(baseSha, 'check wait'), box.root);
    await box.commitAll('ops: next -> wait');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Push a commit to remote that creates a file
    const tmpClone = join(box.dir, 'tmpclone-pull');
    mkdirSync(tmpClone);
    await git(box.dir, ['clone', '-q', box.remote, tmpClone]);
    writeFileSync(join(tmpClone, 'blocking-file.txt'), 'from-remote\n');
    await git(tmpClone, ['add', 'blocking-file.txt']);
    await git(tmpClone, ['commit', '-q', '-m', 'chore: add blocking file']);
    await git(tmpClone, ['push', '-q', 'origin', 'main']);

    // Create an untracked file with the same name locally to block ff pull
    writeFileSync(join(box.root, 'blocking-file.txt'), 'local-untracked\n');

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };
    const { spawn } = createFakeSpawn();

    const CYCLES = 3;
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;

    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
    // SPEC 14.15 item 1: "git pull 连续失败" exactly once
    const pullNotifs = notifications.filter((n) => n.includes('git pull 连续失败'));
    expect(pullNotifs.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 33. SPEC 14.15 item 2: report commit failure → notify "汇报没能提交", no "到对话里说"
  // -----------------------------------------------------------------------
  it('report commit failure 3 cycles: run --continue once, 1 notification with "汇报没能提交", no "到对话里说"', async () => {
    const pinnedSha = baseSha;
    box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Install a pre-commit hook that rejects all commits
    const hookDir = join(box.root, '.git', 'hooks');
    mkdirSync(hookDir, { recursive: true });
    writeFileSync(join(hookDir, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

    const notifications: string[] = [];
    const clock = createFakeClock();
    let sleepCount = 0;
    const countedSleep = async (ms: number) => {
      sleepCount++;
      await clock.sleep(ms);
    };

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
        mkdirSync(join(box.root, '.collie', 'runs', `q-commit-fail-${String(runContinueCount)}`), {
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
    const timeoutSecs = (CYCLES - 1) * (SIXTY_SEC_MS / 1000) + 1;
    await follow({
      root: box.root,
      intervalSecs: SIXTY_SEC_MS / 1000,
      timeoutSecs,
      now: clock.now,
      sleep: countedSleep,
      spawn,
      sendNotify: collector(notifications),
      out: () => {
        /* noop */
      },
      pinnedParentDir: pinnedDir,
    });

    expect(sleepCount).toBe(CYCLES);
    // run --continue should have been called exactly once
    expect(runContinueCount).toBe(1);

    // Exactly 1 notification with "汇报没能提交"
    const commitFailNotifs = notifications.filter((n) => n.includes('汇报没能提交'));
    expect(commitFailNotifs.length).toBe(1);
    // The notification must contain the queue run id
    expect(commitFailNotifs[0]).toContain('q-commit-fail-1');
    // Must NOT contain "到对话里说"
    expect(commitFailNotifs[0]).not.toContain('到对话里说');

    // No queue-end "到对话里说「看」" notification
    const lookNotifs = notifications.filter((n) => n.includes('到对话里说'));
    expect(lookNotifs.length).toBe(0);

    // pendingReport should NOT be in state (commit failed)
    const stateRaw = readFileSync(join(box.root, '.collie', 'follow.json'), 'utf8');
    const state = JSON.parse(stateRaw) as FollowJson;
    expect(state.pendingReport).toBeUndefined();
    // But handledBase should be set (base marked as handled)
    expect(state.handledBase).toBe(baseSha);
  });
});
