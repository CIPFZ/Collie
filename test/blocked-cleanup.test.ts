// SPEC 16.18: batch cleanup when a batch is finally blocked in queue mode.
// Tests that rescue commits are reverted, acceptance tests are removed, and
// edge cases (conflicts, single-batch mode, evidence_unavailable) are handled.
// Uses Sandbox, FakeRunner, and injected liveness clock (same approach as
// scenario-n.test.ts).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git, revParse } from '../src/git.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Event, Report, Verdict } from '../src/schema/index.js';
import { controllableFingerprint, fakeLivenessClock, instantDelay } from './support/fake-clock.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';
import type { RedCheckFn } from '../src/acceptance.js';

const FENCE = '```';
const repoRoot = join(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Helpers: backlog and scene builders
// ---------------------------------------------------------------------------

interface BatchDef {
  priority: number;
  id: string;
  title: string;
  depends: string;
  status: string;
  /** Optional scenarios (makes the batch a "带情形" batch). */
  scenarios?: string[];
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
    if (d.scenarios !== undefined && d.scenarios.length > 0) {
      lines.push('情形：');
      for (const s of d.scenarios) {
        lines.push(`- ${s}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

/** Idle worker: writes some files but NO report, then goes idle. Triggers rescue commit. */
function idleWorkerWithDirtyFiles(
  batchId: string,
  fp: ReturnType<typeof controllableFingerprint>,
  fileContent = 'partial work\n',
): FakeScene {
  return {
    expectRole: 'worker',
    effect: async (ctx: FakeSceneContext) => {
      const featurePath = join(ctx.cwd, 'feature.txt');
      mkdirSync(dirname(featurePath), { recursive: true });
      writeFileSync(featurePath, fileContent);
      // Don't commit — leave dirty workspace so rescue commits happen.

      // Freeze fingerprint to trigger idle detection.
      fp.freeze();

      // Emit events without changing files.
      for (let i = 0; i < 10; i++) {
        ctx.opts.onEvent?.({ type: 'assistant', message: 'still thinking...' });
      }

      // Wait for the ladder to stop us.
      await ctx.stopped;

      // Unfreeze so the next run can proceed without triggering idle.
      fp.unfreeze();
    },
    result: { exitCode: 0 },
  };
}

/** Idle worker that commits code but no report. */
function idleWorkerCommitted(
  _batchId: string,
  fp: ReturnType<typeof controllableFingerprint>,
): FakeScene {
  return {
    expectRole: 'worker',
    effect: async (ctx: FakeSceneContext) => {
      const featurePath = join(ctx.cwd, 'feature.txt');
      mkdirSync(dirname(featurePath), { recursive: true });
      writeFileSync(featurePath, 'committed partial work\n');
      await git(ctx.cwd, ['add', '-A']);
      await git(ctx.cwd, ['commit', '-q', '-m', 'feat: partial work']);

      // Freeze fingerprint to trigger idle detection.
      fp.freeze();

      for (let i = 0; i < 10; i++) {
        ctx.opts.onEvent?.({ type: 'assistant', message: 'still thinking...' });
      }

      await ctx.stopped;
      fp.unfreeze();
    },
    result: { exitCode: 0 },
  };
}

let workerSeq = 0;

/** Worker that commits code + report and pushes (normal PASS path). */
function normalWorkerScene(box: Sandbox, batchId: string): FakeScene {
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

/** Reviewer: says FIX. */
function reviewerFix(box: Sandbox, batchId: string): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'FIX',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '1 failed | 1 passed (2)' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: ['a test is failing'],
    reason: 'test failure',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
    },
    result: {
      exitCode: 0,
      finalText: `# v\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// Injected liveness options for tests with fake timers (same pattern as scenario-n).
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
// Group 1: Rescue commits are reverted when queue finishes as blocked
// ---------------------------------------------------------------------------

describe('blocked cleanup: rescue commits are reverted', () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
    // progress_secs = 1 so idle fires quickly.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);
  });

  afterEach(() => {
    box.dispose();
  });

  it('idle twice → exit 20 (BLOCK); rescue commit reverted; batch.cleanup in journal', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: cleanup test backlog');

    // Record the initial state.
    const baseSha = await revParse(box.root, 'HEAD');

    const fp = controllableFingerprint();
    const runner = new FakeRunner([
      // Attempt 1: idle → rescue commit → BLOCK.
      idleWorkerWithDirtyFiles('v99-b01', fp),
      // Interrupt retry: idle again → rescue commit → BLOCK.
      idleWorkerWithDirtyFiles('v99-b01', fp),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should have batch.cleanup event.
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeDefined();
    expect(cleanup?.removed_acceptance).toBe(false);
    expect(Array.isArray(cleanup?.reverted)).toBe(true);
    // The reverted array should contain the rescue commit shas.
    const revertedShas = cleanup?.reverted as string[];
    expect(revertedShas.length).toBeGreaterThanOrEqual(1);

    // Should have r2.commit for the cleanup commit.
    const r2Commits = events.filter((e: Event) => e.event === 'r2.commit');
    const cleanupCommit = r2Commits.find(
      (e: Event) =>
        typeof e.subject === 'string' && e.subject.startsWith('progress: v99-b01 cleanup'),
    );
    expect(cleanupCommit).toBeDefined();

    // Should have verdict.pushed for the cleanup commit.
    const pushed = events.filter((e: Event) => e.event === 'verdict.pushed');
    // At least one verdict.pushed for the cleanup.
    expect(pushed.length).toBeGreaterThanOrEqual(1);

    // The git log's most recent commit should be `progress: v99-b01 cleanup`.
    const logOutput = await git(box.root, ['log', '-1', '--format=%s']);
    expect(logOutput.trim()).toBe('progress: v99-b01 cleanup');

    // Rescue commit's changes should be reverted: git diff <baseSha> HEAD -- feature.txt
    // should be empty (the rescue wrote feature.txt, cleanup reverted it).
    const diffOutput = await git(box.root, ['diff', baseSha, 'HEAD', '--', 'feature.txt']);
    expect(diffOutput.trim()).toBe('');

    // Rescue commits should still be in history.
    const rescued = events.filter((e: Event) => e.event === 'worker.rescued');
    expect(rescued.length).toBeGreaterThanOrEqual(1);
    for (const r of rescued) {
      const sha = r.sha as string;
      // The commit should exist in git history.
      const exists = await revParse(box.root, sha).catch(() => null);
      expect(exists).not.toBeNull();
    }

    // queue.finished reason should be 'blocked'.
    const finished = events.find((e: Event) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('blocked');
  });
});

// ---------------------------------------------------------------------------
// Group 2: Acceptance tests are removed; conflict handling
// ---------------------------------------------------------------------------

describe('blocked cleanup: acceptance tests are removed', () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
    // Set fix_max = 1 so we hit fix_max quickly.
    const toml = box.read('.collie/collie.toml').replace(/fix_max\s*=\s*\d+/, 'fix_max = 1');
    box.write('.collie/collie.toml', toml);
  });

  afterEach(() => {
    box.dispose();
  });

  it('fix_max exceeded with acceptance tests → cleanup removes test/acceptance/<batch>/', async () => {
    // Create a batch with scenarios so the tester step writes acceptance tests.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      {
        priority: 2,
        id: 'v99-b01',
        title: '待跑',
        depends: 'v99-a01',
        status: 'pending',
        scenarios: ['S1 [新] scenario A'],
      },
    ]);
    box.write('docs/backlog.md', backlog);

    // Add [agent.tester] and verify.static config.
    let toml = box.read('.collie/collie.toml');
    // Ensure [agent.tester] exists (copy from worker config).
    if (!toml.includes('[agent.tester]')) {
      const workerSection = /\[agent\.worker\][\s\S]*?(?=\[|$)/.exec(toml)?.[0] ?? '';
      const testerSection = workerSection
        .replace('[agent.worker]', '[agent.tester]')
        .replace(/bash_deny\s*=\s*\[.*?\]/s, '');
      // Insert before [limits]
      toml = toml.replace('[limits]', `${testerSection}\n[limits]`);
    }
    if (!toml.includes('tester_max')) {
      toml = toml.replace(/fix_max\s*=\s*\d+/, 'fix_max = 1\ntester_max = 2');
    }
    if (!toml.includes('redcheck_secs')) {
      toml = toml.replace(/tester_max\s*=\s*\d+/, 'tester_max = 2\nredcheck_secs = 600');
    }
    if (!toml.includes('worktree_secs')) {
      toml = toml.replace(/redcheck_secs\s*=\s*\d+/, 'redcheck_secs = 600\nworktree_secs = 1800');
    }
    // Add verify.static
    if (!toml.includes('static')) {
      toml = toml.replace(/\[verify\]/, '[verify]\nstatic = ["true"]');
    }
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: fix_max cleanup test with scenarios');

    // Create the acceptance test file manually (simulating what the tester step creates).
    const acceptanceDir = join('test', 'acceptance', 'v99-b01');
    box.write(join(acceptanceDir, 'new.test.ts'), '// acceptance test stub\n');
    await box.commitAll('chore: seed acceptance test');

    // Worker that commits code + report with FIX verdict from reviewer.
    const runner = new FakeRunner([
      // Run 1: worker + reviewer FIX
      normalWorkerScene(box, 'v99-b01'),
      reviewerFix(box, 'v99-b01'),
      // Run 2 (fix_retry): worker + reviewer FIX again → exceeds fix_max
      normalWorkerScene(box, 'v99-b01'),
      reviewerFix(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner);

    // Should stop due to fix_max.
    expect(code).toBe(20);

    const events = box.events();

    // Should have batch.cleanup with removed_acceptance = true.
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeDefined();
    expect(cleanup?.removed_acceptance).toBe(true);

    // The acceptance test directory should no longer exist.
    const acceptancePath = join(box.root, 'test', 'acceptance', 'v99-b01');
    expect(existsSync(acceptancePath)).toBe(false);

    // Worker code commits should still exist (not reverted).
    const workerCommits = (await git(box.root, ['log', '--format=%s', 'main']))
      .trim()
      .split('\n')
      .filter((s: string) => s.startsWith('feat: '));
    expect(workerCommits.length).toBeGreaterThanOrEqual(1);
  });

  it('revert conflict → batch.cleanup_failed; acceptance tests still removed', async () => {
    // Set up a batch that will produce a rescue commit.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);

    // Set fix_max=1 and progress_secs=1.
    let toml = box.read('.collie/collie.toml');
    toml = toml.replace(/fix_max\s*=\s*\d+/, 'fix_max = 1');
    toml = toml.replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: conflict cleanup test');

    // Create acceptance test file.
    box.write(join('test', 'acceptance', 'v99-b01', 'new.test.ts'), '// stub\n');
    await box.commitAll('chore: seed acceptance test for conflict');

    const fp = controllableFingerprint();

    // Worker scene that leaves dirty feature.txt (triggers rescue).
    const idleWithFeature = idleWorkerWithDirtyFiles('v99-b01', fp, 'rescue content\n');

    // Worker that commits feature.txt with DIFFERENT content + report + pushes.
    // This overwrites the file the rescue commit touched, creating a conflict
    // when cleanup tries to revert the rescue.
    function workerOverwriteScene(): FakeScene {
      return {
        expectRole: 'worker',
        effect: async ({ cwd }: FakeSceneContext) => {
          workerSeq++;
          // Write different content to the same file the rescue commit touched.
          box.write('feature.txt', `completely different ${String(workerSeq)}\n`, cwd);
          box.write('tests/t000.sh', 'exit 0\n', cwd);
          const head = await box.commitAll('feat: overwrite feature', cwd);
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
            batch_id: 'v99-b01',
            head_sha: head,
            claims,
            open_questions: [],
          };
          box.write(
            '.collie/batches/v99-b01/report.md',
            `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
            cwd,
          );
          await box.commitAll('report(collie): v99-b01', cwd);
          await git(cwd, ['push', '-q', 'origin', 'main']);
        },
        result: { exitCode: 0 },
      };
    }

    const runner = new FakeRunner([
      // Run 1: idle → rescue commit (feature.txt = "rescue content") → BLOCK → interrupt retry.
      idleWithFeature,
      // Run 2 (interrupt_retry): worker overwrites feature.txt → reviewer FIX.
      workerOverwriteScene(),
      reviewerFix(box, 'v99-b01'),
      // Run 3 (fix_retry): worker + reviewer FIX again → exceeds fix_max.
      workerOverwriteScene(),
      reviewerFix(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should have batch.cleanup_failed with revert_conflict reason.
    const cleanupFailed = events.find((e: Event) => e.event === 'batch.cleanup_failed');
    expect(cleanupFailed).toBeDefined();
    expect(
      typeof cleanupFailed?.reason === 'string' && cleanupFailed.reason.includes('revert_conflict'),
    ).toBe(true);

    // git status --porcelain should be empty (no half-reverted state).
    const statusOutput = await git(box.root, ['status', '--porcelain']);
    // Filter out untracked files.
    const trackedChanges = statusOutput
      .trim()
      .split('\n')
      .filter((l: string) => l.trim() !== '' && !l.startsWith('??'));
    expect(trackedChanges).toHaveLength(0);

    // Despite revert failure, acceptance tests should still be removed.
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    if (cleanup !== undefined) {
      expect(cleanup.removed_acceptance).toBe(true);
    }
    // The acceptance test directory should not exist.
    const acceptancePath = join(box.root, 'test', 'acceptance', 'v99-b01');
    expect(existsSync(acceptancePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 3: When cleanup must NOT act
// ---------------------------------------------------------------------------

describe('blocked cleanup: when it must not act', () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('single-batch mode with rescue commit → no cleanup commit', async () => {
    const fp = controllableFingerprint();

    // progress_secs = 1 so idle fires quickly.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: single-batch cleanup test');

    const runner = new FakeRunner([
      // Worker goes idle, leaves dirty workspace → rescue commit → BLOCK.
      idleWorkerWithDirtyFiles('v99-b01', fp),
    ]);

    // Single-batch mode: `run v99-b01`
    const code = await box.cli(['run', 'v99-b01'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should have worker.rescued (rescue commit happened).
    const rescued = events.filter((e: Event) => e.event === 'worker.rescued');
    expect(rescued.length).toBeGreaterThanOrEqual(1);

    // Should NOT have batch.cleanup (single-batch mode doesn't clean up).
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeUndefined();
  });

  it('no rescue commit and no acceptance tests → no cleanup commit, no batch.cleanup', async () => {
    const fp = controllableFingerprint();

    // progress_secs = 1 so idle fires quickly.
    const toml = box
      .read('.collie/collie.toml')
      .replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    box.write('.collie/collie.toml', toml);

    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: no cleanup needed test');

    // Worker that commits code but no report (and workspace is clean after).
    const runner = new FakeRunner([
      // Attempt 1: worker commits code but no report → idle → BLOCK.
      idleWorkerCommitted('v99-b01', fp),
      // Interrupt retry: same thing.
      idleWorkerCommitted('v99-b01', fp),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should NOT have worker.rescued (workspace was clean).
    const rescued = events.filter((e: Event) => e.event === 'worker.rescued');
    expect(rescued).toHaveLength(0);

    // Should NOT have batch.cleanup (nothing to clean).
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeUndefined();

    // Should NOT have batch.cleanup_failed.
    const cleanupFailed = events.find((e: Event) => e.event === 'batch.cleanup_failed');
    expect(cleanupFailed).toBeUndefined();
  });

  it('evidence_unavailable stops queue → no cleanup', async () => {
    // evidence_unavailable is triggered when rule 9 fires due to environment failure.
    // Set up a worker that pushes code but CI is unreachable.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: evidence_unavailable test');

    // Worker that commits + report + doesn't push.
    const workerNoPush: FakeScene = {
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
          pushed: false,
          ci_passed: false,
          new_deps: [],
          spec_touched: false,
        };
        const report: Report = {
          schema_version: 1,
          batch_id: 'v99-b01',
          head_sha: head,
          claims,
          open_questions: [],
        };
        box.write(
          '.collie/batches/v99-b01/report.md',
          `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll('report(collie): v99-b01', cwd);
        // Don't push — remote won't have HEAD, CI check will fail.
      },
      result: { exitCode: 0 },
    };

    // Reviewer says PASS, but remote_has_head will be false → rule 9.
    const reviewerPass: FakeScene = {
      expectRole: 'reviewer',
      effect: ({ cwd }: FakeSceneContext) => {
        box.reviewerCwd = cwd;
      },
      result: {
        exitCode: 0,
        finalText: `# v\n\n通过。\n\n${FENCE}json\n${JSON.stringify(
          {
            schema_version: 1,
            batch_id: 'v99-b01',
            verdict: 'PASS',
            evidence: {
              commits_actual: [],
              verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed, 0 failed' }],
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
          } satisfies Verdict,
          null,
          2,
        )}\n${FENCE}\n`,
      },
    };

    // Fake CI that always returns error (simulates environment failure).
    const failFetch = (): Promise<Response> => Promise.resolve(new Response('{}', { status: 500 }));

    const runner = new FakeRunner([workerNoPush, reviewerPass]);

    const code = await box.cli(['run', '--continue'], runner, { fetch: failFetch });
    // evidence_unavailable exits with code 20.
    expect(code).toBe(20);

    const events = box.events();

    // Should have evidence_unavailable escalation.
    const queueFinished = events.find((e: Event) => e.event === 'queue.finished');
    expect(queueFinished?.reason).toBe('evidence_unavailable');

    // Should NOT have batch.cleanup (evidence_unavailable path doesn't clean up).
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Group 4: Cleanup only commits its own paths (SPEC 16.19)
// ---------------------------------------------------------------------------

/** A passing red check for the tester step. */
function passingRedCheck(): RedCheckFn {
  // eslint-disable-next-line @typescript-eslint/require-await -- RedCheckFn is async
  return async () => ({
    ok: true as const,
    problems: [],
    newTestCount: 1,
    keepTestCount: 0,
  });
}

/** A tester scene that creates rogue.txt in the main workspace (like tester-step.test.ts). */
function testerTouchMainScene(mainRoot: string, batchId: string): FakeScene {
  return {
    expectRole: 'tester',
    effect: ({ cwd }: FakeSceneContext) => {
      // Write acceptance files in worktree (normal).
      const outDir = join(cwd, 'test', 'acceptance', batchId);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
      writeFileSync(join(outDir, 'MAP.md'), '# MAP\n');
      // Write a rogue file in the MAIN repo.
      writeFileSync(join(mainRoot, 'rogue.txt'), 'should not be committed\n');
    },
    result: { exitCode: 0, finalText: 'done' },
  };
}

describe('blocked cleanup: only its own paths', () => {
  let box: Sandbox;

  beforeEach(async () => {
    workerSeq = 0;
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('tester_touched_main_tree + rogue.txt → no cleanup commit; rogue.txt stays', async () => {
    // Batch with scenarios triggers the tester step.
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      {
        priority: 2,
        id: 'v99-b01',
        title: '待跑',
        depends: 'v99-a01',
        status: 'pending',
        scenarios: ['S1 [新] scenario A'],
      },
    ]);
    box.write('docs/backlog.md', backlog);

    // Add [agent.tester] config and verify.static (required for tester step).
    let toml = box.read('.collie/collie.toml');
    if (!toml.includes('[agent.tester]')) {
      const workerSection = /\[agent\.worker\][\s\S]*?(?=\n\[)/.exec(toml)?.[0] ?? '';
      const testerSection = workerSection
        .replace('[agent.worker]', '[agent.tester]')
        .replace(/bash_deny\s*=\s*\[.*?\]/s, '');
      toml = toml.replace('[limits]', `${testerSection}\n[limits]`);
    }
    if (!toml.includes('tester_max')) {
      toml = toml.replace(/fix_max\s*=\s*\d+/, 'fix_max = 2\ntester_max = 2');
    }
    if (!toml.includes('redcheck_secs')) {
      toml = toml.replace(/tester_max\s*=\s*\d+/, 'tester_max = 2\nredcheck_secs = 600');
    }
    if (!toml.includes('worktree_secs')) {
      toml = toml.replace(/redcheck_secs\s*=\s*\d+/, 'redcheck_secs = 600\nworktree_secs = 1800');
    }
    if (!toml.includes('static')) {
      toml = toml.replace(/\[verify\]/, '[verify]\nstatic = ["true"]');
    }
    box.write('.collie/collie.toml', toml);

    // Copy AGENT-tester.md so the tester step can run.
    copyFileSync(join(repoRoot, 'AGENT-tester.md'), join(box.root, 'AGENT-tester.md'));

    await box.commitAll('chore: tester scenario setup');

    const runner = new FakeRunner([
      // Tester writes rogue.txt in main workspace → tester_touched_main_tree.
      testerTouchMainScene(box.root, 'v99-b01'),
    ]);

    const redCheck = passingRedCheck();
    const code = await box.cli(['run', '--continue'], runner, { redCheck });
    expect(code).toBe(20);

    const events = box.events();

    // Should have tester_touched_main_tree escalation.
    const escalated = events.find((e: Event) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect(
      typeof escalated?.reason === 'string' &&
        escalated.reason.startsWith('tester_touched_main_tree'),
    ).toBe(true);

    // No batch.cleanup event (no rescue commits, no acceptance tests to remove).
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeUndefined();

    // No cleanup commit in history.
    const logOutput = await git(box.root, ['log', '--format=%s']);
    const cleanupCommits = logOutput
      .trim()
      .split('\n')
      .filter((l: string) => l.includes('cleanup'));
    expect(cleanupCommits).toHaveLength(0);

    // rogue.txt should still be in the workspace.
    expect(existsSync(join(box.root, 'rogue.txt'))).toBe(true);

    // rogue.txt should NOT be in any commit.
    const grepResult = await git(box.root, [
      'log',
      '--all',
      '--diff-filter=A',
      '--name-only',
      '--format=',
    ]);
    expect(grepResult).not.toContain('rogue.txt');
  });

  it('idle workers with note.txt → cleanup only commits rescue paths; note.txt stays', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);

    // SPEC 14.34 item 2: the untracked file is injected by the last reviewer
    // scene (between rescue and cleanup), not hidden via ignore rules.
    let toml = box.read('.collie/collie.toml');
    toml = toml.replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    toml = toml.replace(/fix_max\s*=\s*\d+/, 'fix_max = 1');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: idle workers with note.txt test');

    const baseSha = await revParse(box.root, 'HEAD');

    const fp = controllableFingerprint();

    // Idle worker that writes only feature.txt (triggers rescue). No note.txt.
    function idleWithFeatureOnly(): FakeScene {
      return {
        expectRole: 'worker',
        effect: async (ctx: FakeSceneContext) => {
          writeFileSync(join(ctx.cwd, 'feature.txt'), 'partial work\n');
          fp.freeze();
          for (let i = 0; i < 10; i++) {
            ctx.opts.onEvent?.({ type: 'assistant', message: 'thinking...' });
          }
          await ctx.stopped;
          fp.unfreeze();
        },
        result: { exitCode: 0 },
      };
    }

    // Worker that commits code (NOT feature.txt) + report + pushes, so the
    // subsequent cleanup revert of the rescue commit does not conflict.
    function workerNoFeature(): FakeScene {
      return {
        expectRole: 'worker',
        effect: async ({ cwd }: FakeSceneContext) => {
          workerSeq++;
          box.write('other.txt', `other ${String(workerSeq)}\n`, cwd);
          box.write('tests/t000.sh', 'exit 0\n', cwd);
          const head = await box.commitAll('feat: add other', cwd);
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
            batch_id: 'v99-b01',
            head_sha: head,
            claims,
            open_questions: [],
          };
          box.write(
            '.collie/batches/v99-b01/report.md',
            `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
            cwd,
          );
          await box.commitAll('report(collie): v99-b01', cwd);
          await git(cwd, ['push', '-q', 'origin', 'main']);
        },
        result: { exitCode: 0 },
      };
    }

    // Reviewer FIX that writes note.txt to the main workspace (last reviewer).
    function reviewerFixWithNote(): FakeScene {
      const body: Verdict = {
        schema_version: 1,
        batch_id: 'v99-b01',
        verdict: 'FIX',
        evidence: {
          commits_actual: [],
          verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '1 failed | 1 passed (2)' }],
          remote_has_head: true,
          ci_conclusion: 'success',
          ci_run_url: '',
          ci_branch_matched: true,
          deps_diff: [],
          spec_diff_lines: 0,
        },
        claim_mismatches: [],
        gaps: ['a test is failing'],
        reason: 'test failure',
      };
      return {
        expectRole: 'reviewer',
        effect: () => {
          // Write note.txt to the MAIN workspace as a truly untracked file.
          writeFileSync(join(box.root, 'note.txt'), 'should stay in workspace\n');
        },
        result: {
          exitCode: 0,
          finalText: `# v\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
        },
      };
    }

    const runner = new FakeRunner([
      // Run 1: idle worker → rescue commit (feature.txt) → interrupt retry.
      idleWithFeatureOnly(),
      // Run 2: worker (doesn't touch feature.txt) + reviewer FIX → fix retry.
      workerNoFeature(),
      reviewerFix(box, 'v99-b01'),
      // Run 3: worker + reviewer FIX (writes note.txt) → fix_max exceeded → blocked → cleanup.
      workerNoFeature(),
      reviewerFixWithNote(),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should have rescue events.
    const rescued = events.filter((e: Event) => e.event === 'worker.rescued');
    expect(rescued.length).toBeGreaterThanOrEqual(1);

    // Should have batch.cleanup event.
    const cleanup = events.find((e: Event) => e.event === 'batch.cleanup');
    expect(cleanup).toBeDefined();
    expect(Array.isArray(cleanup?.reverted)).toBe(true);
    const revertedShas = cleanup?.reverted as string[];
    expect(revertedShas.length).toBeGreaterThanOrEqual(1);

    // The cleanup commit should only contain rescue-related files.
    const cleanupCommitEvt = events.find(
      (e: Event) =>
        e.event === 'r2.commit' && typeof e.subject === 'string' && e.subject.includes('cleanup'),
    );
    expect(cleanupCommitEvt).toBeDefined();
    const cleanupSha = cleanupCommitEvt?.sha as string;
    const cleanupDiff = await git(box.root, [
      'diff-tree',
      '--no-commit-id',
      '-r',
      '--name-only',
      cleanupSha,
    ]);
    const cleanupFiles = cleanupDiff.trim().split('\n').filter(Boolean);
    // Cleanup commit should contain feature.txt (from rescue revert).
    expect(cleanupFiles).toContain('feature.txt');
    // note.txt should NOT be in the cleanup commit.
    expect(cleanupFiles).not.toContain('note.txt');

    // note.txt should still be in the workspace.
    expect(existsSync(join(box.root, 'note.txt'))).toBe(true);

    // note.txt should NOT be in any commit.
    const allDiffs = await git(box.root, [
      'log',
      '--all',
      '--diff-filter=A',
      '--name-only',
      '--format=',
    ]);
    expect(allDiffs).not.toContain('note.txt');

    // Rescue's feature.txt changes should be reverted.
    const diff = await git(box.root, ['diff', baseSha, 'HEAD', '--', 'feature.txt']);
    expect(diff.trim()).toBe('');
  });

  it('content conflict → revert_conflict; no merge markers; workspace clean', async () => {
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-a01', title: '已完成', depends: '—', status: 'passed' },
      { priority: 2, id: 'v99-b01', title: '待跑', depends: 'v99-a01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);

    let toml = box.read('.collie/collie.toml');
    toml = toml.replace(/fix_max\s*=\s*\d+/, 'fix_max = 1');
    toml = toml.replace(/progress_secs\s*=\s*\d+/, 'progress_secs = 1');
    // SPEC 14.34 item 3: baseline already has feature.txt with two lines so
    // the rescue and worker changes to the same line produce a real content
    // conflict (not a modify-vs-delete conflict).
    box.write('feature.txt', 'original line 1\nline 2\n');
    box.write('.collie/collie.toml', toml);
    await box.commitAll('chore: conflict test setup');

    const fp = controllableFingerprint();

    // Rescue changes only line 1 of the two-line file.
    const idleWithFeature = idleWorkerWithDirtyFiles(
      'v99-b01',
      fp,
      'rescue changed line 1\nline 2\n',
    );

    // Worker that changes the same line 1 to yet another value + commits + pushes.
    function workerOverwriteScene(): FakeScene {
      return {
        expectRole: 'worker',
        effect: async ({ cwd }: FakeSceneContext) => {
          workerSeq++;
          box.write('feature.txt', `worker changed line 1 ${String(workerSeq)}\nline 2\n`, cwd);
          box.write('tests/t000.sh', 'exit 0\n', cwd);
          const head = await box.commitAll('feat: overwrite feature', cwd);
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
            batch_id: 'v99-b01',
            head_sha: head,
            claims,
            open_questions: [],
          };
          box.write(
            '.collie/batches/v99-b01/report.md',
            `# r\n\n## 做了什么\n完成。\n\n## 测试结果\n见。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
            cwd,
          );
          await box.commitAll('report(collie): v99-b01', cwd);
          await git(cwd, ['push', '-q', 'origin', 'main']);
        },
        result: { exitCode: 0 },
      };
    }

    const runner = new FakeRunner([
      // Run 1: idle → rescue commit (feature.txt line 1 changed) → interrupt retry.
      idleWithFeature,
      // Run 2 (interrupt_retry): worker changes same line 1 → reviewer FIX.
      workerOverwriteScene(),
      reviewerFix(box, 'v99-b01'),
      // Run 3 (fix_retry): worker + reviewer FIX again → exceeds fix_max.
      workerOverwriteScene(),
      reviewerFix(box, 'v99-b01'),
    ]);

    const code = await box.cli(['run', '--continue'], runner, livenessOpts(fp));
    expect(code).toBe(20);

    const events = box.events();

    // Should have batch.cleanup_failed with revert_conflict reason.
    const cleanupFailed = events.find((e: Event) => e.event === 'batch.cleanup_failed');
    expect(cleanupFailed).toBeDefined();
    expect(
      typeof cleanupFailed?.reason === 'string' &&
        cleanupFailed.reason.startsWith('revert_conflict'),
    ).toBe(true);

    // No merge conflict markers in any tracked file.
    const trackedFiles = (await git(box.root, ['ls-files'])).trim().split('\n').filter(Boolean);
    for (const f of trackedFiles) {
      const content = readFileSync(join(box.root, f), 'utf8');
      expect(content).not.toContain('<<<<<<<');
    }

    // git status --porcelain: no tracked file changes (only untracked are allowed).
    const statusOutput = await git(box.root, ['status', '--porcelain']);
    const trackedChanges = statusOutput
      .trim()
      .split('\n')
      .filter((l: string) => l.trim() !== '' && !l.startsWith('??'));
    expect(trackedChanges).toHaveLength(0);

    // queue.finished reason should be 'fix_max'.
    const finished = events.find((e: Event) => e.event === 'queue.finished');
    expect(finished?.reason).toBe('fix_max');
  });
});
