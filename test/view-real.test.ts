// Tests for projection values using real Sandbox runs (SPEC 13.13, v04-b08).
// Covers: attempt computation against task.md, run duration, cost summary dash.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import {
  computeAttempt,
  formatVersionSummary,
  loadRuns,
  projectRuns,
  projectTimeline,
  projectVersionSummary,
} from '../src/view.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extracts the `attempt` value from the task.md YAML frontmatter. */
function parseTaskAttempt(root: string, batchId: string): number {
  const taskPath = join(root, '.collie', 'batches', batchId, 'task.md');
  const content = readFileSync(taskPath, 'utf8');
  const match = /^attempt:\s*(\d+)/m.exec(content);
  if (match === null) throw new Error(`no attempt field in ${taskPath}`);
  return Number(match[1]);
}

// ---------------------------------------------------------------------------
// Shared sandbox: FIX run followed by PASS run for the same batch.
// ---------------------------------------------------------------------------

describe('view-real (SPEC 13.13)', () => {
  let box: Sandbox;
  let taskAttemptAfterRun1: number;
  let taskAttemptAfterRun2: number;

  beforeAll(async () => {
    box = await Sandbox.create();

    // Run 1: FIX verdict.
    const fixRunner = new FakeRunner([
      workerScene(box, { passing: 3, failing: 0, push: true, claims: honestClaims(3) }),
      fooledReviewerScene(box, 'FIX'),
    ]);
    await box.run(fixRunner);
    taskAttemptAfterRun1 = parseTaskAttempt(box.root, BATCH);

    // Run 2: PASS verdict.
    const passRunner = new FakeRunner([
      workerScene(box, { passing: 3, failing: 0, push: true, claims: honestClaims(3) }),
      fooledReviewerScene(box, 'PASS'),
    ]);
    await box.run(passRunner);
    taskAttemptAfterRun2 = parseTaskAttempt(box.root, BATCH);
  }, 60_000);

  afterAll(() => {
    box.dispose();
  });

  // --- Attempt ---

  it('projected attempt for FIX run is 1 and matches task.md', () => {
    const runs = loadRuns(box.root);
    const batchRuns = runs.filter((r) => r.status === 'ok' && !r.runId.startsWith('q-'));
    expect(batchRuns).toHaveLength(2);
    const first = batchRuns[0];
    expect(first).toBeDefined();
    if (first?.status !== 'ok') return;
    const attempt = computeAttempt(runs, first.runId, BATCH);
    expect(attempt).toBe(1);
    expect(taskAttemptAfterRun1).toBe(1);
  });

  it('projected attempt for PASS run after FIX is 2 and matches task.md', () => {
    const runs = loadRuns(box.root);
    const batchRuns = runs.filter((r) => r.status === 'ok' && !r.runId.startsWith('q-'));
    const second = batchRuns[1];
    expect(second).toBeDefined();
    if (second?.status !== 'ok') return;
    const attempt = computeAttempt(runs, second.runId, BATCH);
    expect(attempt).toBe(2);
    expect(taskAttemptAfterRun2).toBe(2);
  });

  // --- Duration ---

  it('run duration is not null for finished runs', () => {
    const runs = loadRuns(box.root);
    const projections = projectRuns(runs);
    expect(projections.length).toBeGreaterThanOrEqual(2);
    for (const p of projections) {
      expect(p.durationMs).not.toBeNull();
      if (p.durationMs !== null) {
        expect(p.durationMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  // --- Cost ---

  it('version summary shows — when no cost data', () => {
    const runs = loadRuns(box.root);
    const nodes = projectTimeline(runs);
    const summaries = projectVersionSummary(nodes);
    // Both sandbox runs use the fake worker which does not report cost_usd.
    expect(summaries.length).toBeGreaterThanOrEqual(1);
    const text = formatVersionSummary(summaries);
    // SPEC 13.13: all runs without cost → display — not $0.00.
    expect(text).toContain('cost: —');
    expect(text).not.toContain('$0.00');
  });

  // --- Timeline attempt ---

  it('timeline run_end nodes carry computed attempt values', () => {
    const runs = loadRuns(box.root);
    const nodes = projectTimeline(runs);
    const runEndNodes = nodes.filter((n) => n.kind === 'run_end');
    expect(runEndNodes).toHaveLength(2);
    expect(runEndNodes[0]?.detail.attempt).toBe(1);
    expect(runEndNodes[1]?.detail.attempt).toBe(2);
  });
});
