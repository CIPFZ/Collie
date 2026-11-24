// Acceptance tests for v046-b44 — [保持] scenarios K1–K2.
// K1: same call as S3 — returns 0, spawn never called, output has timeout message.
// K2: dryRun with 开跑 — returns 0, one output line, no remote commits, no follow.json.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  follow,
  type SpawnResult,
  type SpawnFn,
  type FollowJson,
  type OutputMode,
} from '../../../src/follow.js';
import { git } from '../../../src/git.js';
import { Sandbox } from '../../support/sandbox.js';

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

// ---------------------------------------------------------------------------
// K1: same call as S3 — handledBase equals baseSha, follow loop waits then times out
// ---------------------------------------------------------------------------

describe(
  'K1: handledBase equals baseSha → returns 0, spawn never called, timeout reached',
  { timeout: 300_000 },
  () => {
    let box: Sandbox;

    beforeEach(async () => {
      box = await Sandbox.create();
    });

    afterEach(() => {
      box.dispose();
    });

    it('K1: returns 0, spawn never called, output has follow: timeout reached', async () => {
      const baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
      const pinnedDir = join(box.dir, 'pinned');
      mkdirSync(pinnedDir, { recursive: true });

      // Set up next.md as 开跑 with baseSha
      box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
      await box.commitAll('ops: next -> run');
      await git(box.root, ['push', '-q', 'origin', 'main']);

      // Write follow.json with handledBase = baseSha (already handled)
      const followState: FollowJson = {
        handledBase: baseSha,
        notified: [],
      };
      const statePath = join(box.root, '.collie', 'follow.json');
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, JSON.stringify(followState, null, 2) + '\n');

      const output: string[] = [];
      const clock = createFakeClock();
      const { spawn, calls } = createFakeSpawn();

      const returnCode = await follow({
        root: box.root,
        intervalSecs: 60,
        timeoutSecs: 150,
        now: clock.now,
        sleep: clock.sleep,
        spawn,
        sendNotify: collector([]),
        out: (t) => output.push(t),
        pinnedParentDir: pinnedDir,
      });

      // Returns 0
      expect(returnCode).toBe(0);

      // Fake subprocess never called
      expect(calls).toHaveLength(0);

      // Output has timeout reached
      expect(output.some((line) => line.includes('follow: timeout reached'))).toBe(true);
    });
  },
);

// ---------------------------------------------------------------------------
// K2: dryRun with 开跑 — returns 0, one output line, no side effects
// ---------------------------------------------------------------------------

describe('K2: dryRun with 开跑', { timeout: 300_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('K2: returns 0, exactly one output line starting with action: run, no remote commits, no follow.json', async () => {
    const baseSha = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    const pinnedDir = join(box.dir, 'pinned');
    mkdirSync(pinnedDir, { recursive: true });

    // Set up next.md as 开跑
    box.write('docs/ops/next.md', nextRunMd(baseSha, baseSha, 4), box.root);
    await box.commitAll('ops: next -> run');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    // Capture remote HEAD before follow call
    const remoteHeadBefore = (await git(box.remote, ['rev-parse', 'HEAD'])).trim();

    const output: string[] = [];
    const clock = createFakeClock();
    const { spawn } = createFakeSpawn();

    const returnCode = await follow({
      root: box.root,
      dryRun: true,
      now: clock.now,
      sleep: clock.sleep,
      spawn,
      sendNotify: collector([]),
      out: (t) => output.push(t),
      pinnedParentDir: pinnedDir,
    });

    // Returns 0
    expect(returnCode).toBe(0);

    // Output is exactly one line, starting with "action: run"
    expect(output).toHaveLength(1);
    expect(output[0]).toBeDefined();
    expect(output[0]?.startsWith('action: run')).toBe(true);

    // Remote has no new commits
    const remoteHeadAfter = (await git(box.remote, ['rev-parse', 'HEAD'])).trim();
    expect(remoteHeadAfter).toBe(remoteHeadBefore);

    // follow.json does not exist
    expect(existsSync(join(box.root, '.collie', 'follow.json'))).toBe(false);
  });
});
