// SPEC 14.1: tests for `collie preflight [--smoke] [--json]`.
// Uses Sandbox to get a real git repo; disk-free and runner are injected.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeHeartbeat } from '../src/heartbeat.js';
import { FakeRunner } from '../src/runner/fake.js';
import { Sandbox } from './support/sandbox.js';

describe('collie preflight', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  // -----------------------------------------------------------------------
  // Base checks (no --smoke)
  // -----------------------------------------------------------------------

  it('passes when worktree is clean, remote in sync, no token, disk ok', async () => {
    const code = await box.cli(['preflight'], undefined, { diskFreeMb: () => 2000 }); // test double
    expect(code).toBe(0);
    const out = box.output.join('');
    expect(out).toContain('ok   worktree_clean');
    expect(out).toContain('ok   remote_in_sync');
    expect(out).toContain('ok   ci_token');
    expect(out).toContain('ok   disk_free');
    expect(out).toContain('preflight: ok');
  });

  it('fails when worktree is dirty', async () => {
    // Create an uncommitted file.
    writeFileSync(join(box.root, 'dirty.txt'), 'dirty');
    const code = await box.cli(['preflight'], undefined);
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL worktree_clean');
    expect(out).toMatch(/preflight: failed.*worktree_clean/);
  });

  it('worktree_clean is ok when heartbeat exists (orphaned run)', async () => {
    // Create an uncommitted file AND a heartbeat (orphaned run).
    writeFileSync(join(box.root, 'dirty.txt'), 'dirty');
    writeHeartbeat(box.root, {
      run_id: 'r-20261019120000',
      batch_id: 'v99-b01',
      pid: 99999,
      phase: 'worker',
      started_at: '2026-10-19T12:00:00Z',
      updated_at: '2026-10-19T12:00:00Z',
    });
    const code = await box.cli(['preflight'], undefined);
    expect(code).toBe(0);
    const out = box.output.join('');
    expect(out).toContain('ok   worktree_clean: orphaned run present');
  });

  it('fails when local is behind remote', async () => {
    // Push a commit from the "remote side" so local falls behind.
    const { git } = await import('../src/git.js');
    // Create a second clone, push from it.
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const cloneDir = mkdtempSync(join(tmpdir(), 'collie-clone-'));
    try {
      await git(cloneDir, ['clone', box.remote, 'work']);
      const workDir = join(cloneDir, 'work');
      // Configure git user for the clone.
      await git(workDir, ['config', 'user.name', 'Tester']);
      await git(workDir, ['config', 'user.email', 'test@example.invalid']);
      writeFileSync(join(workDir, 'ahead.txt'), 'ahead');
      await git(workDir, ['add', '-A']);
      await git(workDir, ['commit', '-m', 'ahead']);
      await git(workDir, ['push', 'origin', 'main']);
    } finally {
      rmSync(cloneDir, { recursive: true, force: true });
    }

    const code = await box.cli(['preflight'], undefined);
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL remote_in_sync');
  });

  it('fails when disk free is below threshold', async () => {
    const code = await box.cli(['preflight'], undefined, { diskFreeMb: () => 500 }); // test double: below threshold
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL disk_free');
    expect(out).toMatch(/500 MB free/);
  });

  // -----------------------------------------------------------------------
  // --smoke checks
  // -----------------------------------------------------------------------

  it('--smoke adds runner and ci_query checks', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner);
    expect(code).toBe(0);
    const out = box.output.join('');
    expect(out).toContain('ok   runner');
    expect(out).toContain('ok   ci_query');
  });

  it('--smoke runner failure shows FAIL runner', async () => {
    const runner = new FakeRunner([]);
    // FakeRunner with no scenes will throw on run().
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner);
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL runner');
  });

  // -----------------------------------------------------------------------
  // --json output
  // -----------------------------------------------------------------------

  it('--json outputs valid JSON with ok and checks', async () => {
    const code = await box.cli(['preflight', '--json'], undefined);
    expect(code).toBe(0);
    const out = box.output.join('');
    const parsed = JSON.parse(out) as { ok: boolean; checks: { name: string; ok: boolean }[] };
    expect(parsed.ok).toBe(true);
    expect(parsed.checks.some((c) => c.name === 'worktree_clean')).toBe(true);
    expect(parsed.checks.some((c) => c.name === 'disk_free')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Queue: preflight_failed blocks task issuance
  // -----------------------------------------------------------------------

  it('--continue with dirty worktree: no batch.task_written, exit 1', async () => {
    // Sandbox already has v99-b01 with status 'running'.
    // Set it to pending so --continue can pick it up.
    const { setBatchStatus } = await import('../src/backlog.js');
    const backlogPath = join(box.root, 'docs', 'backlog.md');
    const { readFileSync: readFs } = await import('node:fs');
    const backlogText = readFs(backlogPath, 'utf8');
    const result = setBatchStatus(backlogText, 'v99-b01', 'pending');
    if (result.changed) {
      writeFileSync(backlogPath, result.text);
    }
    await box.commitAll('chore: pending backlog');

    // Now dirty the worktree.
    writeFileSync(join(box.root, 'dirty.txt'), 'dirty');

    const runner = new FakeRunner([]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(1);

    // No batch.task_written event should exist.
    const events = box.events();
    expect(events.some((e) => e.event === 'batch.task_written')).toBe(false);
    // queue.preflight should be recorded.
    const preflight = events.find((e) => e.event === 'queue.preflight');
    expect(preflight).toBeTruthy();
    expect(preflight?.ok).toBe(false);
    // queue.finished with reason preflight_failed.
    const finished = events.find((e) => e.event === 'queue.finished');
    expect(finished).toBeTruthy();
    expect(finished?.reason).toBe('preflight_failed');
  });

  // -----------------------------------------------------------------------
  // Single-batch mode does NOT auto-check
  // -----------------------------------------------------------------------

  it('single-batch mode does not run preflight', async () => {
    // Dirty worktree, but single-batch should not care.
    writeFileSync(join(box.root, 'dirty.txt'), 'dirty');
    const runner = new FakeRunner([]);
    // FakeRunner will fail, but the point is it doesn't fail on preflight.
    await box.cli(['run', 'v99-b01'], runner);
    // It should fail for some other reason (runner has no scenes), not preflight.
    const events = box.events();
    expect(events.some((e) => e.event === 'queue.preflight')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SPEC 14.33: runner exit-code and timing in preflight --smoke
// ---------------------------------------------------------------------------

describe('preflight: runner check judges the exit code', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('exitCode 1 with stopReason → FAIL runner line, preflight fails, --json ok=false', async () => {
    const runner = new FakeRunner([
      { expectRole: 'worker', result: { exitCode: 1, stopReason: 'error' as const } },
    ]);
    // Inject a deterministic clock that advances 3000 ms (3 seconds).
    let tick = 0;
    const clock = (): number => {
      const v = tick;
      tick += 3000;
      return v;
    };
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL runner: exitCode=1 stopReason=error');
    expect(out).toContain('secs=3');
    expect(out).toMatch(/preflight: failed.*runner/);
  });

  it('exitCode 0 → ok runner line with secs=', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    // Inject clock: 0 ms → 5000 ms = 5 seconds.
    let tick = 0;
    const clock = (): number => {
      const v = tick;
      tick += 5000;
      return v;
    };
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });
    expect(code).toBe(0);
    const out = box.output.join('');
    expect(out).toContain('ok   runner: exitCode=0 secs=5');
  });

  it('exitCode 1 without stopReason → FAIL runner with no stopReason in detail', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 1 } }]);
    let tick = 0;
    const clock = (): number => {
      const v = tick;
      tick += 1000;
      return v;
    };
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner, {
      preflightNow: clock,
    });
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL runner: exitCode=1 secs=1');
    expect(out).not.toContain('stopReason');
  });

  it('runner throws → FAIL runner with error message (no secs)', async () => {
    // FakeRunner with no scenes throws when run() is called.
    const runner = new FakeRunner([]);
    const code = await box.cli(['preflight', '--smoke', '--runner', 'fake'], runner);
    expect(code).toBe(1);
    const out = box.output.join('');
    expect(out).toContain('FAIL runner');
    expect(out).toMatch(/preflight: failed.*runner/);
  });

  it('--json with exitCode 1 → runner check ok=false', async () => {
    const runner = new FakeRunner([
      { expectRole: 'worker', result: { exitCode: 1, stopReason: 'error' as const } },
    ]);
    const code = await box.cli(['preflight', '--smoke', '--json', '--runner', 'fake'], runner);
    expect(code).toBe(1);
    const out = box.output.join('');
    const parsed = JSON.parse(out) as {
      ok: boolean;
      checks: { name: string; ok: boolean; detail?: string }[];
    };
    expect(parsed.ok).toBe(false);
    const runnerCheck = parsed.checks.find((c) => c.name === 'runner');
    expect(runnerCheck).toBeTruthy();
    expect(runnerCheck?.ok).toBe(false);
    expect(runnerCheck?.detail).toContain('exitCode=1');
    expect(runnerCheck?.detail).toContain('stopReason=error');
  });
});
