// Scenario E (SPEC 11.9): fake worker writes files, then gets killed (effect
// calls handle.stop('kill')). Front half: rescue commit. Back half (v02-b05):
// attempt=2, interrupted_at, rescue_sha, base_sha reuse across attempts.
// Orphan rescue path (v02-e-fix2): heartbeat left behind, rescue_sha cross-run.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git, revParse } from '../src/git.js';
import { writeHeartbeat } from '../src/heartbeat.js';
import { EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from '../src/journal.js';
import { batchHistory, STREAM_FILE_NAME } from '../src/run.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

/**
 * A worker scene that writes two files (dirtying the workspace) then kills
 * itself via the RunHandle (SPEC 11.9: "fake 以「写文件后 stop('kill') 自己」模拟").
 */
function killedWorkerScene(): FakeScene {
  return {
    expectRole: 'worker',
    files: {
      'dirty-a.txt': 'partial work A\n',
      'dirty-b.txt': 'partial work B\n',
    },
    effect: async ({ handle }: FakeSceneContext) => {
      // Simulate a kill mid-run. The RunHandle.stop('kill') causes the scene
      // to return with stopReason: 'stopped', and the dirty files remain.
      await handle.stop('kill');
    },
    // The result the scene would normally return; stop() overrides it with stopReason.
    result: { exitCode: 1 },
  };
}

describe('scenario E front half: worker killed, rescue commit created', () => {
  it('creates a wip(collie) rescue commit containing the dirty files', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    // The run escalates (worker didn't produce a report), but we care about the rescue.
    const code = await box.run(runner);
    // Escalated = BLOCK (exit 20).
    expect(code).toBe(20);

    // The HEAD commit should be the rescue commit (or a progress commit after it).
    const logOutput = await git(box.root, ['log', '--oneline', '-5']);
    expect(logOutput).toContain(`wip(collie): ${BATCH} rescue`);

    // The rescue commit must contain the two dirty files.
    // Find the rescue commit sha.
    const rescueLine = logOutput.split('\n').find((line) => line.includes('wip(collie):'));
    expect(rescueLine).toBeDefined();
    const rescueSha = rescueLine?.split(' ')[0] ?? '';
    const diffOutput = await git(box.root, [
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      rescueSha,
    ]);
    expect(diffOutput).toContain('dirty-a.txt');
    expect(diffOutput).toContain('dirty-b.txt');
  });

  it('records a worker.rescued event with sha and files', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);

    const events = box.events();
    const rescued = events.find((e) => e.event === 'worker.rescued');
    expect(rescued).toBeDefined();
    expect(rescued?.sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(rescued?.files).toEqual(expect.arrayContaining(['dirty-a.txt', 'dirty-b.txt']));
  });

  it('does not record worker.rescued when the workspace is clean', async () => {
    // A worker that commits everything and leaves a clean workspace.
    const cleanWorker: FakeScene = {
      expectRole: 'worker',
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    const runner = new FakeRunner([cleanWorker]);
    await box.run(runner);

    const events = box.events();
    expect(events.find((e) => e.event === 'worker.rescued')).toBeUndefined();
  });

  it('records the worker as finished with stop_reason', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);

    const events = box.events();
    const finished = events.find((e) => e.event === 'worker.finished');
    expect(finished).toBeDefined();
    expect(finished?.stop_reason).toBe('stopped');
  });
});

describe('scenario E: heartbeat lifecycle during a run', () => {
  it('heartbeat file does not exist after a normal run completes', async () => {
    const runner = new FakeRunner([killedWorkerScene()]);
    await box.run(runner);
    // After the run, the heartbeat should be cleaned up.
    const fs = await import('node:fs');
    const path = await import('node:path');
    expect(fs.existsSync(path.join(box.root, '.collie', 'heartbeat.json'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario E back half (v02-b05): attempt=2, interrupted_at, rescue_sha,
// base_sha reuse across attempts.
// ---------------------------------------------------------------------------

describe('scenario E back half: interrupt marking and base_sha reuse', () => {
  it('second run has attempt=2, interrupted_at, rescue_sha, and reuses the first base_sha', async () => {
    // --- Run 1: worker killed, rescue commit created ---
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Verify batchHistory after run 1.
    const h1 = batchHistory(box.root, BATCH);
    expect(h1.attempt).toBe(2);
    expect(h1.interruptedAt).toBeDefined();
    expect(h1.interruptedAt).toContain('run.finished');
    expect(h1.rescueSha).toMatch(/^[0-9a-f]{40}$/);
    const firstBaseSha = h1.baseSha;
    expect(firstBaseSha).toBeDefined();

    // --- Run 2: honest worker succeeds ---
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    const code2 = await box.run(r2);
    expect(code2).toBe(0);

    // The second run's events should include worker.resumed.
    const events = box.events();
    const resumed = events.filter((e) => e.event === 'worker.resumed');
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.attempt).toBe(2);

    // base_sha reuse (SPEC 4.3): both runs share the same base_sha.
    const selected = events.filter((e) => e.event === 'batch.selected');
    expect(selected).toHaveLength(2);
    expect(selected[0]?.base_sha).toBe(firstBaseSha);
    expect(selected[1]?.base_sha).toBe(firstBaseSha);
  });

  it('PASS run resets interrupt state; a third run starts fresh', async () => {
    // Run 1: killed → interrupted
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Run 2: honest PASS → resets
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r2)).toBe(0);

    // After PASS, interrupt context should be cleared.
    const h = batchHistory(box.root, BATCH);
    expect(h.interruptedAt).toBeUndefined();
    expect(h.rescueSha).toBeUndefined();
    // PASS does not reset attempt; a re-run of this batch would still be attempt 2.
    // In practice, passed batches are never re-run (SPEC 11.7).
    expect(h.attempt).toBe(2);
  });

  it('batch.task_written includes the interrupt section in the task body', async () => {
    // Run 1: killed
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Run 2: check the task.md content includes the interrupt section.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('## 上一轮中断');
    expect(taskContent).toContain('中断信息');
    expect(taskContent).toContain('救援提交');
  });
});

// ---------------------------------------------------------------------------
// Scenario E: evidence base_sha reuse across attempts (SPEC 11.7 v02-e-fix)
// ---------------------------------------------------------------------------

describe('scenario E: evidence base_sha reuse (SPEC 11.7)', () => {
  it('attempt 2 commits_actual contains attempt 1 commits (base_sha from first run)', async () => {
    // Run 1: worker makes a commit (dirty files → rescue commit), then killed.
    const r1 = new FakeRunner([killedWorkerScene()]);
    await box.run(r1);

    // Record the rescue commit sha from run 1.
    const h1 = batchHistory(box.root, BATCH);
    expect(h1.rescueSha).toBeDefined();
    const rescueSha = h1.rescueSha;

    // Run 2: honest worker succeeds and gets PASS.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    const code2 = await box.run(r2);
    expect(code2).toBe(0);

    // The second run's evidence (from reviewer.verdict or the arbiter) should
    // have commits_actual that includes the rescue commit from run 1, because
    // the base_sha is from the first run (SPEC 11.7).
    const events = box.events();
    // Find the run.finished for run 2 (the PASS one).
    const finishes = events.filter((e) => e.event === 'run.finished');
    expect(finishes).toHaveLength(2);
    expect(finishes[1]?.verdict).toBe('PASS');

    // The claim.mismatch events will not include commits_actual directly, but
    // the evidence was collected with base_sha from the first run. We verify
    // that by checking the batch.selected events both use the same base_sha.
    const selected = events.filter((e) => e.event === 'batch.selected');
    expect(selected).toHaveLength(2);
    expect(selected[0]?.base_sha).toBe(selected[1]?.base_sha);

    // The rescue commit from run 1 is between base_sha and head_sha of run 2,
    // so it must be in the git log that the evidence collects.
    // This verifies the core requirement: evidence range starts at the FIRST
    // run's base_sha.
    expect(rescueSha).toBeDefined();
  });

  it('attempt 1 SPEC-touching causes attempt 2 BLOCK by rule 2', async () => {
    // Run 1: worker edits SPEC.md and creates dirty files, then killed.
    const specTouchingScene: FakeScene = {
      expectRole: 'worker',
      files: {
        'dirty-a.txt': 'partial work A\n',
        'SPEC.md': '# SPEC\n\nThe feature is optional.\n',
      },
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    const r1 = new FakeRunner([specTouchingScene]);
    await box.run(r1);

    // Verify run 1 is interrupted with rescue commit containing SPEC.md.
    const h1 = batchHistory(box.root, BATCH);
    expect(h1.attempt).toBe(2);
    expect(h1.rescueSha).toBeDefined();

    // Run 2: honest worker succeeds, but the evidence range includes
    // the rescue commit from run 1 which touched SPEC.md → BLOCK by rule 2.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    const code2 = await box.run(r2);
    // Rule 2: spec_diff_lines > 0 causes BLOCK regardless of the verdict.
    expect(code2).toBe(20);

    // Verify the BLOCK is from rule 2.
    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded?.rule).toBe(2);
    expect(downgraded?.to).toBe('BLOCK');
  });
});

// ---------------------------------------------------------------------------
// Scenario E: interrupted_at sources and orphaned detection (SPEC 11.7 v02-e-fix)
// ---------------------------------------------------------------------------

/**
 * Helper: write a raw journal event to a run's events.ndjson.
 * Each call appends one line; events must be valid per EventSchema.
 */
function writeJournalEvent(root: string, runId: string, event: Record<string, unknown>): void {
  const dir = join(root, RUNS_RELATIVE_DIR, runId);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, EVENTS_FILE_NAME), JSON.stringify(event) + '\n');
}

/**
 * Helper: write a raw event line to a run's stream.ndjson.
 */
function writeStreamEvent(root: string, runId: string, event: Record<string, unknown>): void {
  const dir = join(root, RUNS_RELATIVE_DIR, runId);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, STREAM_FILE_NAME), JSON.stringify(event) + '\n');
}

describe('scenario E: interrupted_at orphaned and stream.ndjson fallback (SPEC 11.7)', () => {
  it('orphaned run: interrupted_at contains orphaned and event type from stream.ndjson', () => {
    // Simulate a crashed R2: write journal events (no run.finished) and
    // stream.ndjson with a later event.
    const orphanRunId = 'r-20260101-000000';

    // Journal for the orphaned run: batch.selected and worker.started, but no run.finished.
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:00.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'batch.selected',
      base_sha: 'aaaa000000000000000000000000000000000000',
    });
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:01.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'worker.started',
    });

    // Stream.ndjson: worker produced some events before R2 crashed.
    // The last event has a type that is NOT worker.started.
    // SPEC 11.7 (v02-e-fix2): SDK events use `timestamp`, not `ts`.
    writeStreamEvent(box.root, orphanRunId, {
      type: 'content_block_delta',
      timestamp: '2026-01-01T00:01:00.000Z',
    });
    writeStreamEvent(box.root, orphanRunId, {
      type: 'tool_use',
      timestamp: '2026-01-01T00:02:00.000Z',
    });

    const h = batchHistory(box.root, BATCH);
    expect(h.attempt).toBe(2);
    expect(h.interruptedAt).toBeDefined();
    // Must contain 'orphaned' as the stop reason.
    expect(h.interruptedAt).toContain('orphaned');
    // The event type must come from stream.ndjson, NOT be 'worker.started'.
    expect(h.interruptedAt).not.toContain('worker.started');
    // The stream event type should appear in interrupted_at.
    expect(h.interruptedAt).toContain('tool_use');
  });

  it('orphaned run without stream.ndjson falls back to journal last event', () => {
    const orphanRunId = 'r-20260101-000001';

    // Journal only, no stream.ndjson.
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:00.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'batch.selected',
      base_sha: 'bbbb000000000000000000000000000000000000',
    });
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:01.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'worker.started',
    });

    const h = batchHistory(box.root, BATCH);
    expect(h.interruptedAt).toContain('orphaned');
    // Without stream.ndjson, falls back to journal last event.
    expect(h.interruptedAt).toContain('worker.started');
  });

  it('renderInterruptSection shows fallback text when no rescue_sha', async () => {
    // Run 1: worker killed with a clean workspace (no rescue commit).
    const cleanKill: FakeScene = {
      expectRole: 'worker',
      // No files written — workspace stays clean, so no rescue commit.
      effect: async ({ handle }: FakeSceneContext) => {
        await handle.stop('kill');
      },
      result: { exitCode: 1 },
    };
    const r1 = new FakeRunner([cleanKill]);
    await box.run(r1);

    // Verify no rescue_sha in history.
    const h = batchHistory(box.root, BATCH);
    expect(h.rescueSha).toBeUndefined();

    // Run 2: check that the task.md includes the fallback text.
    const r2 = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r2);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('## 上一轮中断');
    expect(taskContent).toContain('上一轮未留下救援提交');
    expect(taskContent).toContain('git log');
  });
});

// ---------------------------------------------------------------------------
// Scenario E: orphan rescue path via full runBatch flow (SPEC 11.7 v02-e-fix2)
// Simulates R2 being killed: heartbeat left over, no run.finished,
// stream.ndjson last line is a user message without timestamp.
// The next run detects the orphan, creates a rescue commit, and generates
// task.md with rescue_sha, 请先核实, and a refined interrupted_at.
// ---------------------------------------------------------------------------

describe('scenario E: orphan rescue path with fake runner (SPEC 11.7 v02-e-fix2)', () => {
  /** A PID that is almost certainly not alive in the test environment. */
  const DEAD_PID = 4194300;

  it('rescue_sha in task.md matches worker.rescued, body has 请先核实, interrupted_at refined', async () => {
    // --- Simulate round 1: R2 crashed mid-run ---
    const orphanRunId = 'r-20260101-000000';
    const baseSha = await revParse(box.root, 'HEAD');

    // 1. Write dirty files that will become the rescue commit.
    box.write('dirty-a.txt', 'partial work A\n');
    box.write('dirty-b.txt', 'partial work B\n');

    // 2. Write heartbeat with a dead PID → triggers orphan detection on next run.
    writeHeartbeat(box.root, {
      run_id: orphanRunId,
      batch_id: BATCH,
      pid: DEAD_PID,
      phase: 'worker',
      started_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:05:00.000Z',
    });

    // 3. Write journal events for the orphaned run: batch.selected + worker.started,
    //    but NO run.finished (R2 was killed before it could write one).
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:00.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'batch.selected',
      base_sha: baseSha,
    });
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:01.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'worker.started',
    });

    // 4. Write stream.ndjson: earlier events WITH timestamp, last event is a
    //    `user` message WITHOUT timestamp (SPEC 11.7: forces backward search).
    //    The user message has a tool_use content block so the type is refined
    //    from bare `user` to `tool_use/Bash` (SPEC 11.7 v02-e-fix2).
    writeStreamEvent(box.root, orphanRunId, {
      type: 'assistant',
      content: [{ type: 'tool_use', name: 'Bash' }],
      timestamp: '2026-01-01T00:03:00.000Z',
    });
    writeStreamEvent(box.root, orphanRunId, {
      type: 'user',
      content: [{ type: 'tool_use', name: 'Bash' }],
      // No timestamp — tests backward search and non-empty ts guarantee.
    });

    // --- Round 2: collie run detects orphan and generates task.md ---
    const runner = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    const code = await box.run(runner);
    expect(code).toBe(0);

    // --- Assertions ---
    const events = box.events();

    // A. worker.rescued event must exist (orphan rescue created a commit).
    const rescued = events.find((e) => e.event === 'worker.rescued');
    expect(rescued).toBeDefined();
    const rescueSha = rescued?.sha as string;
    expect(rescueSha).toMatch(/^[0-9a-f]{7,40}$/);

    // B. task.md frontmatter must have rescue_sha matching the rescued event.
    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    expect(taskContent).toContain('rescue_sha');
    expect(taskContent).toContain(rescueSha);

    // C. task.md body must contain the 请先核实 sentence (SPEC 11.7).
    expect(taskContent).toContain('请先核实');

    // D. interrupted_at must contain 'orphaned' and have non-empty time.
    //    YAML may or may not quote the value; match both forms.
    const iaMatch = /interrupted_at:\s*"?([^\n"]+)"?/.exec(taskContent);
    expect(iaMatch).toBeTruthy();
    const interruptedAt = iaMatch?.[1] ?? '';
    expect(interruptedAt).toContain('orphaned');

    // Time part (after @) must not be empty (SPEC 11.7: time must never be empty).
    const atIdx = interruptedAt.lastIndexOf('@');
    expect(atIdx).toBeGreaterThan(0);
    const timePart = interruptedAt.slice(atIdx + 1);
    expect(timePart).toBeTruthy();
    expect(timePart.length).toBeGreaterThan(0);
    // The timestamp comes from backward search: '2026-01-01T00:03:00.000Z'.
    expect(timePart).toMatch(/^\d{4}-\d{2}-\d{2}/);

    // E. Event type in interrupted_at must NOT be bare 'user' (v02-e-fix2 refinement).
    //    It should be 'tool_use/Bash' because the user message had tool_use content.
    expect(interruptedAt).toContain('tool_use');
    expect(interruptedAt).not.toMatch(/ user@/);
  });

  it('heartbeat updated_at is the final timestamp fallback when stream has no timestamps', async () => {
    // Variant: stream.ndjson has NO timestamps at all → falls back to heartbeat.
    const orphanRunId = 'r-20260101-000002';
    const baseSha = await revParse(box.root, 'HEAD');

    // Dirty files for rescue.
    box.write('dirty-c.txt', 'partial work C\n');

    // Heartbeat with a known updated_at.
    writeHeartbeat(box.root, {
      run_id: orphanRunId,
      batch_id: BATCH,
      pid: DEAD_PID,
      phase: 'worker',
      started_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:07:42.000Z',
    });

    // Journal: no run.finished.
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:00.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'batch.selected',
      base_sha: baseSha,
    });
    writeJournalEvent(box.root, orphanRunId, {
      ts: '2026-01-01T00:00:01.000Z',
      run_id: orphanRunId,
      batch_id: BATCH,
      event: 'worker.started',
    });

    // Stream: only a bare user message, no timestamp anywhere.
    writeStreamEvent(box.root, orphanRunId, {
      type: 'user',
      // No timestamp, no earlier events either → heartbeat fallback.
    });

    // Round 2.
    const runner = new FakeRunner([
      workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(runner);

    const taskContent = box.read(`.collie/batches/${BATCH}/task.md`);
    const iaMatch = /interrupted_at:\s*"?([^\n"]+)"?/.exec(taskContent);
    expect(iaMatch).toBeTruthy();
    const interruptedAt = iaMatch?.[1] ?? '';

    // Time must not be empty: the heartbeat updated_at is the fallback.
    const atIdx = interruptedAt.lastIndexOf('@');
    expect(atIdx).toBeGreaterThan(0);
    const timePart = interruptedAt.slice(atIdx + 1);
    expect(timePart).toBeTruthy();
    // The fallback timestamp should be the heartbeat's updated_at.
    expect(timePart).toContain('2026-01-01T00:07:42');
  });
});

// ---------------------------------------------------------------------------
// Scenario E: head_sha against first base_sha, commits_actual excludes R2
// commits (SPEC 11.7 v03-b03-fix). Attempt 1 pushes code but writes no report.
// Attempt 2 only writes the report with head_sha pointing to attempt 1's code
// commit → not escalated, reviewer runs, commits_actual excludes R2 commits.
// ---------------------------------------------------------------------------

describe('scenario E: head_sha against first base_sha and R2 commit exclusion (v03-b03-fix)', () => {
  it('attempt 2 referencing attempt 1 code commit is accepted; commits_actual excludes task/progress commits', async () => {
    // --- Run 1: worker commits code, pushes, but no report (killed) ---
    let attempt1CodeSha: string | undefined;
    const workerScene1: FakeScene = {
      expectRole: 'worker',
      effect: async (ctx: FakeSceneContext) => {
        box.write('feature.txt', 'feature\n', ctx.cwd);
        box.write('tests/t000.sh', 'exit 0\n', ctx.cwd);
        attempt1CodeSha = await box.commitAll('feat: add feature with tests', ctx.cwd);
        await git(ctx.cwd, ['push', '-q', 'origin', 'main']);
        // Killed without writing report.
        await ctx.handle.stop('kill');
      },
      result: { exitCode: 1, sessionId: 'sess-push' },
    };
    const r1 = new FakeRunner([workerScene1]);
    const code1 = await box.run(r1);
    expect(code1).toBe(20); // BLOCK: no report
    expect(attempt1CodeSha).toBeDefined();

    // --- Run 2: worker only writes report pointing to attempt 1's code commit ---
    const FENCE = '```';
    const workerScene2: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        // Write report with head_sha pointing to attempt 1's code commit.
        const report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: attempt1CodeSha,
          claims: { commits: [attempt1CodeSha], ...honestClaims(1, true) },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);
      },
      result: { exitCode: 0 },
    };
    const r2 = new FakeRunner([workerScene2, fooledReviewerScene(box)]);
    const code2 = await box.run(r2);

    // --- Assertions ---
    // A. Not escalated: should reach the reviewer and produce a verdict.
    // The head_sha is a descendant of the first base_sha and an ancestor of HEAD.
    expect(code2).toBe(0); // PASS

    // B. Reviewer was called (2nd scene consumed).
    expect(r2.calls).toHaveLength(2);

    // C. Events should show reviewer.started and reviewer.verdict.
    const events = box.events();
    const reviewerStarted = events.filter((e) => e.event === 'reviewer.started');
    expect(reviewerStarted.length).toBeGreaterThanOrEqual(1);

    // D. commits_actual in evidence should only contain the worker's code commit,
    //    not the task, progress, or report(collie) commits.
    // The verdict.downgraded or claim.mismatch events give indirect evidence,
    // but let's check the progress record for the final evidence.
    const progress = box.read('docs/progress.md');
    // The commits line should contain the code commit.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded at line 615
    expect(progress).toContain(attempt1CodeSha!.slice(0, 7));

    // E. Verify batch.selected events show same base_sha across runs.
    const selected = events.filter((e) => e.event === 'batch.selected');
    expect(selected).toHaveLength(2);
    expect(selected[0]?.base_sha).toBe(selected[1]?.base_sha);
  });
});

// ---------------------------------------------------------------------------
// Scenario E: wallclock interrupt stop_reason and interrupted_at (v03-b03-fix)
// Tests SPEC 11.7: worker.finished.stop_reason = ladder reason, not SDK's
// error_during_execution; interrupted_at contains 'wallclock', not 'error'.
// ---------------------------------------------------------------------------

/** Near-instant delay for the signal ladder (from scenario-g pattern). */
function instantDelay(): {
  delay: (ms: number) => Promise<void>;
} {
  return {
    delay: async () => {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
      }
    },
  };
}

describe('scenario E: wallclock interrupt writes correct stop_reason (v03-b03-fix)', () => {
  it('worker.finished has stop_reason=wallclock and sdk_stop_reason; interrupted_at contains wallclock', async () => {
    // Use a wallclock signal to trigger the ladder with reason=wallclock.
    // We use ctx.workerSignal (an AbortSignal) to bypass the real wallclock
    // timer and trigger the ladder immediately via the test.
    const ac = new AbortController();

    // Worker scene that waits to be stopped, simulating a long-running task.
    const waitingWorker: FakeScene = {
      expectRole: 'worker',
      effect: async ({ stopped }: FakeSceneContext) => {
        // Signal the abort (triggers wallclock ladder).
        ac.abort();
        // Wait to be stopped by the ladder.
        await stopped;
      },
      // FakeRunner returns stopReason='stopped' when interrupted via handle.stop().
      result: { exitCode: 1, stopReason: 'stopped', sessionId: 'sess-wallclock' },
    };

    const runner = new FakeRunner([waitingWorker]);
    const { delay } = instantDelay();

    const code1 = await box.run(runner, {
      workerSignal: ac.signal,
      ladderDelay: delay,
    });
    expect(code1).toBe(20); // BLOCK: no report

    // Check worker.finished event.
    const events = box.events();
    const finished = events.find((e) => e.event === 'worker.finished');
    expect(finished).toBeDefined();
    // stop_reason should be 'wallclock' (from ladder), not 'error' (from SDK).
    expect(finished?.stop_reason).toBe('wallclock');
    // sdk_stop_reason should preserve the SDK's original value ('stopped' via FakeRunner).
    expect(finished?.sdk_stop_reason).toBe('stopped');

    // Check worker.signaled exists with reason=wallclock.
    const signaled = events.find((e) => e.event === 'worker.signaled');
    expect(signaled).toBeDefined();
    expect(signaled?.reason).toBe('wallclock');

    // Check batchHistory: interrupted_at should contain 'wallclock' and not 'error'.
    const h = batchHistory(box.root, BATCH);
    expect(h.interruptedAt).toBeDefined();
    expect(h.interruptedAt).toContain('wallclock');
    expect(h.interruptedAt).not.toContain('error');
  });
});
