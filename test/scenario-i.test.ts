// SPEC 12.1 (v03-b01-fix) scenario I: startup catch-up push only fires for a
// failed verdict commit and must complete before orphan rescue.
// (a) rescue commit never pushed; (b) failed verdict push retried; (c) HEAD
// moved after failure → push_skipped.
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git, remoteContains, revParse } from '../src/git.js';
import { writeHeartbeat } from '../src/heartbeat.js';
import { EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from '../src/journal.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Report } from '../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

const FENCE = '```';
/** A PID that is almost certainly not alive in the test environment. */
const DEAD_PID = 4194300;

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Install a pre-receive hook on the bare remote that rejects all pushes. */
function installRejectHook(): void {
  const hookDir = join(box.remote, 'hooks');
  mkdirSync(hookDir, { recursive: true });
  writeFileSync(join(hookDir, 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
}

/** Remove the reject hook so pushes succeed again. */
function removeRejectHook(): void {
  try {
    rmSync(join(box.remote, 'hooks', 'pre-receive'));
  } catch {
    // Already removed.
  }
}

/** Write a journal event to a run's events.ndjson. */
function writeJournalEvent(runId: string, event: Record<string, unknown>): void {
  const dir = join(box.root, RUNS_RELATIVE_DIR, runId);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, EVENTS_FILE_NAME), JSON.stringify(event) + '\n');
}

/** Worker scene that pushes code then installs reject hook to block R2's verdict push. */
function workerThenBlock(): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature with tests', cwd);
      const report: Report = {
        schema_version: 1,
        batch_id: BATCH,
        head_sha: head,
        claims: { commits: [head], ...honestClaims(1, true) },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
      // Block all future pushes so R2's verdict push fails.
      installRejectHook();
    },
    result: { exitCode: 0 },
  };
}

// ---------------------------------------------------------------------------
// I-a: rescue commit never pushed to remote (SPEC 12.1: push before rescue)
// ---------------------------------------------------------------------------

describe('scenario I-a: rescue commit not pushed to remote', () => {
  it('startup does not push rescued sha; journal has no verdict.pushed', async () => {
    // Simulate round 1: R2 killed mid-run.  Leave dirty files + heartbeat.
    box.write('dirty-a.txt', 'partial work\n');
    const baseSha = await revParse(box.root, 'HEAD');
    writeHeartbeat(box.root, {
      run_id: 'r-20260101-000000',
      batch_id: BATCH,
      pid: DEAD_PID,
      phase: 'worker',
      started_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:05:00.000Z',
    });
    // Minimal journal for the orphaned run (so batchHistory picks it up).
    writeJournalEvent('r-20260101-000000', {
      ts: '2026-01-01T00:00:00.000Z',
      run_id: 'r-20260101-000000',
      batch_id: BATCH,
      event: 'batch.selected',
      base_sha: baseSha,
    });

    // Block ALL pushes so nothing reaches remote in round 2.
    installRejectHook();

    // Round 2: killed worker → escalation (push fails due to hook).
    const killedWorker: FakeScene = {
      expectRole: 'worker',
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    await box.run(new FakeRunner([killedWorker]));

    // A. The orphan rescue must have created a rescue commit.
    const events = box.events();
    const rescued = events.find((e) => e.event === 'worker.rescued' && typeof e.sha === 'string');
    expect(rescued).toBeDefined();
    const rescuedSha = rescued?.sha as string;
    expect(rescuedSha).toMatch(/^[0-9a-f]{7,40}$/);

    // B. Remote does NOT contain the rescued sha.
    const onRemote = await remoteContains(box.root, 'origin', 'main', rescuedSha).catch(
      () => false,
    );
    expect(onRemote).toBe(false);

    // C. Journal has NO verdict.pushed event at all.
    const pushed = events.filter((e) => e.event === 'verdict.pushed');
    expect(pushed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// I-b: failed verdict push retried on next run (SPEC 12.1: catch-up push)
// ---------------------------------------------------------------------------

describe('scenario I-b: failed verdict push retried on next startup', () => {
  it('startup pushes the verdict sha and records verdict.pushed', async () => {
    // Round 1: worker pushes, hook blocks R2's verdict push.
    const r1 = new FakeRunner([workerThenBlock(), fooledReviewerScene(box)]);
    await box.run(r1);

    // Verify that round 1 recorded verdict.push_failed.
    const events1 = box.events();
    const pushFailed = events1.find((e) => e.event === 'verdict.push_failed');
    expect(pushFailed).toBeDefined();
    const failedSha = pushFailed?.sha as string;
    expect(failedSha).toMatch(/^[0-9a-f]{7,40}$/);

    // Remove hook so push works in round 2.
    removeRejectHook();

    // Round 2: startup finds push_failed, HEAD == sha, remote lacks it → pushes.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    // A. Remote now contains the previously-failed verdict sha.
    const onRemote = await remoteContains(box.root, 'origin', 'main', failedSha);
    expect(onRemote).toBe(true);

    // B. Journal has verdict.pushed with the catch-up sha.
    const events2 = box.events();
    const pushed = events2.filter((e) => e.event === 'verdict.pushed');
    expect(pushed.length).toBeGreaterThanOrEqual(1);
    const catchupPush = pushed.find((e) => e.sha === failedSha);
    expect(catchupPush).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// I-c: HEAD moved after failed verdict push → push_skipped
// ---------------------------------------------------------------------------

describe('scenario I-c: HEAD moved after failed verdict push → push_skipped', () => {
  it('records verdict.push_skipped with reason=head_is_not_verdict', async () => {
    // Round 1: worker pushes, hook blocks R2's verdict push.
    const r1 = new FakeRunner([workerThenBlock(), fooledReviewerScene(box)]);
    await box.run(r1);

    const events1 = box.events();
    const pushFailed = events1.find((e) => e.event === 'verdict.push_failed');
    expect(pushFailed).toBeDefined();

    // Remove hook and add a commit to move HEAD away from the verdict sha.
    removeRejectHook();
    box.write('extra.txt', 'extra commit\n');
    await box.commitAll('chore: extra commit');

    // Round 2: startup finds push_failed sha ≠ HEAD → push_skipped.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const events2 = box.events();
    const skipped = events2.find((e) => e.event === 'verdict.push_skipped');
    expect(skipped).toBeDefined();
    expect(skipped?.reason).toBe('head_is_not_verdict');
    expect(typeof skipped?.head).toBe('string');
  });
});
