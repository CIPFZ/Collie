// Acceptance tests for v046-b44 — [新] scenarios S1–S3.
// S1 & S2: after follow completes with timeout, remote has the report commit
// and exactly 1 "结束" notification was sent.
// S3: when handledBase already matches, follow outputs action=wait lines.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpawnResult, SpawnFn, OutputMode } from '../../../src/follow.js';
import { git } from '../../../src/git.js';
import { Sandbox } from '../../support/sandbox.js';

const MODULE = '../../../src/follow.js';

// ---------------------------------------------------------------------------
// Helpers (replicated from test/follow.test.ts — not exported)
// ---------------------------------------------------------------------------

function nextRunMd(baseSha: string, pinnedSha: string, max: number): string {
  return [
    '状态：开跑',
    `基准提交：${baseSha}`,
    `固定版本：${pinnedSha}`,
    `批次上限：${String(max)}`,
  ].join('\n');
}

function createFakeClock(start = 0): {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
} {
  let t = start;
  return {
    now: () => t,
    // eslint-disable-next-line @typescript-eslint/require-await -- test fake: synchronous but must match async signature
    sleep: async (ms: number) => {
      t += ms;
    },
  };
}

/** NotifySender that collects texts in an array. */
// eslint-disable-next-line @typescript-eslint/require-await -- test fake
const collector = (arr: string[]) => async (text: string) => {
  arr.push(text);
};

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

const SIXTY_SEC_MS = 60_000;

// ---------------------------------------------------------------------------
// S1 & S2: 开跑 with timeoutSecs=100, clock advances 200s during run --continue
// ---------------------------------------------------------------------------

describe(
  'S1 & S2: follow with timeout, clock advances past timeout during run --continue',
  { timeout: 300_000 },
  () => {
    let box: Sandbox;
    let remoteDir: string;
    let returnCode: number;
    let output: string[];
    let notifications: string[];

    beforeAll(async () => {
      box = await Sandbox.create();
      remoteDir = box.remote;
      const baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
      const pinnedDir = join(box.dir, 'pinned');
      mkdirSync(pinnedDir, { recursive: true });

      const pinnedSha = baseSha;
      box.write('docs/ops/next.md', nextRunMd(baseSha, pinnedSha, 4), box.root);
      await box.commitAll('ops: next -> run');
      await git(box.root, ['push', '-q', 'origin', 'main']);

      output = [];
      notifications = [];
      const clock = createFakeClock();

      const preflightJson = JSON.stringify({
        ok: true,
        checks: [{ name: 'worktree_clean', ok: true }],
      });
      const reportJson = JSON.stringify({ reason: 'limit' });

      const spawn: SpawnFn = async (cmd) => {
        const cmdStr = cmd.join(' ');
        if (cmdStr.includes('--continue')) {
          // Advance clock by 200 seconds before returning (exceeds timeoutSecs=100)
          await clock.sleep(200_000);
          mkdirSync(join(box.root, '.collie', 'runs', 'q-20261124120000'), {
            recursive: true,
          });
          return { exitCode: 0, stdout: 'queue done\n', stderr: '' };
        }
        if (cmdStr.includes('preflight')) {
          return { exitCode: 0, stdout: preflightJson + '\n', stderr: '' };
        }
        if (cmdStr.includes('--json')) {
          return { exitCode: 0, stdout: reportJson + '\n', stderr: '' };
        }
        if (cmdStr.includes('report')) {
          return { exitCode: 0, stdout: '# Queue Report\n\nAll good.\n', stderr: '' };
        }
        return OK;
      };

      const mod = (await import(MODULE)) as unknown as {
        follow: (opts: {
          root: string;
          intervalSecs: number;
          timeoutSecs: number;
          now: () => number;
          sleep: (ms: number) => Promise<void>;
          spawn: SpawnFn;
          sendNotify: (text: string) => Promise<void>;
          out: (text: string) => void;
          pinnedParentDir: string;
        }) => Promise<number>;
      };

      returnCode = await mod.follow({
        root: box.root,
        intervalSecs: SIXTY_SEC_MS / 1000,
        timeoutSecs: 100,
        now: clock.now,
        sleep: clock.sleep,
        spawn,
        sendNotify: collector(notifications),
        out: (t: string) => output.push(t),
        pinnedParentDir: pinnedDir,
      });
    });

    afterAll(() => {
      box.dispose();
    });

    it('S1: returns 0 and remote main has a commit starting with ops: report queue', async () => {
      expect(returnCode).toBe(0);
      const remoteLog = await git(remoteDir, ['log', '--oneline', '-10']);
      const hasReportCommit = remoteLog.split('\n').some((line) => {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx < 0) return false;
        return line.slice(spaceIdx + 1).startsWith('ops: report queue');
      });
      expect(hasReportCommit).toBe(true);
    });

    it('S2: notification function received exactly 1 text containing 结束', () => {
      const endNotifs = notifications.filter((n) => n.includes('结束'));
      expect(endNotifs).toHaveLength(1);
    });
  },
);

// ---------------------------------------------------------------------------
// S3: handledBase already equals baseSha → follow outputs action=wait lines
// ---------------------------------------------------------------------------

describe(
  'S3: handledBase equals baseSha, follow outputs action=wait lines',
  { timeout: 300_000 },
  () => {
    let box: Sandbox;
    let output: string[];

    beforeAll(async () => {
      box = await Sandbox.create();
      const baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
      const pinnedDir = join(box.dir, 'pinned');
      mkdirSync(pinnedDir, { recursive: true });

      // Set up next.md as 开跑 with baseSha
      box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
      await box.commitAll('ops: next -> run');
      await git(box.root, ['push', '-q', 'origin', 'main']);

      // Write follow.json with handledBase = baseSha (already handled)
      const followState = {
        handledBase: baseSha,
        notified: [] as string[],
      };
      const statePath = join(box.root, '.collie', 'follow.json');
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, JSON.stringify(followState, null, 2) + '\n');

      output = [];
      const clock = createFakeClock();
      const { spawn } = createFakeSpawn();

      const mod = (await import(MODULE)) as unknown as {
        follow: (opts: {
          root: string;
          intervalSecs: number;
          timeoutSecs: number;
          now: () => number;
          sleep: (ms: number) => Promise<void>;
          spawn: SpawnFn;
          sendNotify: (text: string) => Promise<void>;
          out: (text: string) => void;
          pinnedParentDir: string;
        }) => Promise<number>;
      };

      await mod.follow({
        root: box.root,
        intervalSecs: 60,
        timeoutSecs: 150,
        now: clock.now,
        sleep: clock.sleep,
        spawn,
        sendNotify: collector([]),
        out: (t: string) => output.push(t),
        pinnedParentDir: pinnedDir,
      });
    });

    afterAll(() => {
      box.dispose();
    });

    it('S3: output has at least 2 lines starting with follow: action=wait', () => {
      const waitLines = output.filter((line) => line.startsWith('follow: action=wait'));
      expect(waitLines.length).toBeGreaterThanOrEqual(2);
    });
  },
);
