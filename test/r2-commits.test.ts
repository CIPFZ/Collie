// SPEC 16.14 (v046-b14): rule 2 must count every commit R2 did not make, and
// R2's own commits (identified by sha in the journal, not by message prefix)
// must stay out of the protected-path count.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import { RUNS_RELATIVE_DIR } from '../src/journal.js';
import type { FakeSceneContext } from '../src/runner/fake.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { Claims, Report, Verdict } from '../src/schema/index.js';
import { controllableFingerprint, fakeLivenessClock, instantDelay } from './support/fake-clock.js';
import { Sandbox, TEST_CMD } from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Liveness helpers (same approach as scenario-n, SPEC 16.15 v046-b16)
// ---------------------------------------------------------------------------

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

/** Idle worker: commits code (no report), then goes idle (SPEC 13.14). */
function idleWorkerNoReport(
  batchId: string,
  fp: ReturnType<typeof controllableFingerprint>,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async (ctx: FakeSceneContext) => {
      const featurePath = join(ctx.cwd, 'feature.txt');
      mkdirSync(dirname(featurePath), { recursive: true });
      writeFileSync(featurePath, `idle-${batchId}\n`);
      await git(ctx.cwd, ['add', '-A']);
      await git(ctx.cwd, ['commit', '-q', '-m', 'feat: partial work']);
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let workerSeq = 0;

interface BatchDef {
  priority: number;
  id: string;
  title: string;
  depends: string;
  status: string;
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
  }
  return lines.join('\n');
}

/** Worker that edits a protected file and uses a specific commit message prefix. */
function protectedFileWorkerScene(
  box: Sandbox,
  batchId: string,
  commitSubject: string,
  protectedFile: string,
  protectedContent: string,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      box.write(protectedFile, protectedContent, cwd);
      const head = await box.commitAll(commitSubject, cwd);
      const claims: Claims = {
        commits: [head],
        tests_passed: 1,
        tests_failed: 0,
        pushed: true,
        ci_passed: false,
        new_deps: [],
        spec_touched: protectedFile === 'SPEC.md',
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

/** Worker that commits a file under test/acceptance/ using a docs: issue prefix. */
function acceptanceWorkerScene(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      workerSeq++;
      box.write('feature.txt', `feature ${String(workerSeq)}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      // The worker writes an acceptance test file using an R2-like commit subject
      box.write('test/acceptance/v99-b01/new.test.ts', 'test content\n', cwd);
      const head = await box.commitAll('docs: issue v99-b01 task envelope', cwd);
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

/** Reviewer that says PASS. */
function reviewerPassScene(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
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
  };
  return {
    expectRole: 'reviewer',
    effect: () => {
      /* no-op */
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Reviewer that says FIX. */
function reviewerFixScene(
  box: Sandbox,
  batchId: string,
): {
  expectRole: 'reviewer';
  effect: (ctx: FakeSceneContext) => void;
  result: { exitCode: number; finalText: string };
} {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'FIX',
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
    gaps: ['needs improvement'],
    reason: 'not good enough',
  };
  return {
    expectRole: 'reviewer',
    effect: () => {
      /* no-op */
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Normal worker that does not touch any protected files. */
function normalWorkerScene(
  box: Sandbox,
  batchId: string,
  push: boolean,
): {
  expectRole: 'worker';
  effect: (ctx: FakeSceneContext) => Promise<void>;
  result: { exitCode: number };
} {
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
        pushed: push,
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
      if (push) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

// ---------------------------------------------------------------------------
// Group 1: rule 2 counts every commit that R2 did not make
// ---------------------------------------------------------------------------

describe('rule 2 counts every commit that R2 did not make', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  // The worker edits SPEC.md but uses one of the four R2 commit prefixes.
  // Under the old code, the prefix would skip this commit in protected-path counting.
  // Under the new code, only real R2 commits (tracked in journal) are skipped.
  it.each([
    'docs: issue v99-b01 task envelope',
    'progress: v99-b01 PASS',
    'report(collie): v99-b01',
    'ops: next -> queue 15',
  ])('BLOCK rule 2 when worker edits SPEC.md with subject "%s"', async (subject) => {
    const runner = new FakeRunner([
      protectedFileWorkerScene(box, 'v99-b01', subject, 'SPEC.md', '# SPEC\n\nChanged.\n'),
      reviewerPassScene(box, 'v99-b01'),
    ]);
    const code = await box.run(runner);
    expect(code).toBe(20);

    // Verify it's rule 2 that blocks
    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded?.rule).toBe(2);
  });

  it('BLOCK rule 2 when worker commits test/acceptance/ with "docs: issue" prefix', async () => {
    const runner = new FakeRunner([
      acceptanceWorkerScene(box, 'v99-b01'),
      reviewerPassScene(box, 'v99-b01'),
    ]);
    const code = await box.run(runner);
    expect(code).toBe(20);

    const events = box.events();
    const downgraded = events.find((e) => e.event === 'verdict.downgraded');
    expect(downgraded).toBeDefined();
    expect(downgraded?.rule).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Group 2: R2 own commits stay out of the count
// ---------------------------------------------------------------------------

describe('R2 own commits stay out of the count', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    // Replace backlog with a multi-batch version for queue tests
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-b01', title: '示例功能', depends: '—', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: multi-batch backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('FIX then PASS: R2 ruling commit changes docs/progress.md, second run still PASS', async () => {
    // First run: FIX verdict
    // Second run: PASS verdict
    // R2's ruling commit from the first run changes docs/progress.md which is a protected path.
    // The second run should still be PASS because R2's own commits are excluded.
    const runner = new FakeRunner([
      // Run 1: worker + reviewer FIX
      normalWorkerScene(box, 'v99-b01', true),
      reviewerFixScene(box, 'v99-b01'),
      // Run 2: worker + reviewer PASS
      normalWorkerScene(box, 'v99-b01', true),
      reviewerPassScene(box, 'v99-b01'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '1'], runner);
    expect(code).toBe(0);

    // The final event should be PASS
    const events = box.events();
    const runFinishedEvents = events.filter((e) => e.event === 'run.finished');
    // Should be two run.finished events: FIX then PASS
    expect(runFinishedEvents).toHaveLength(2);
    expect(runFinishedEvents[0]?.verdict).toBe('FIX');
    expect(runFinishedEvents[1]?.verdict).toBe('PASS');

    // spec_diff_lines should be 0 for the PASS run
    const evidenceEvents = events.filter((e) => e.event === 'evidence.collected');
    const lastEvidence = evidenceEvents.at(-1);
    expect(lastEvidence?.spec_diff_lines).toBe(0);
  });

  it('rule 1 auto-retry: second run is not blocked by R2 retry commit', async () => {
    // Replace backlog for multi-batch queue test
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-b01', title: '示例功能', depends: '—', status: 'pending' },
      { priority: 2, id: 'v99-b02', title: '第二功能', depends: 'v99-b01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: two-batch backlog');

    const runner = new FakeRunner([
      // Run 1: worker OK + reviewer returns garbage (rule 1 BLOCK)
      normalWorkerScene(box, 'v99-b01', true),
      {
        expectRole: 'reviewer' as const,
        effect: () => {
          /* no-op */
        },
        result: { exitCode: 0, finalText: 'garbage output not parseable as verdict' },
      },
      // Run 2 (rule 1 retry): worker + reviewer PASS
      normalWorkerScene(box, 'v99-b01', true),
      reviewerPassScene(box, 'v99-b01'),
      // Run 3: v99-b02 worker + reviewer PASS
      normalWorkerScene(box, 'v99-b02', true),
      reviewerPassScene(box, 'v99-b02'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '2'], runner);
    expect(code).toBe(0);

    // Should have batch.retried for rule 1
    const events = box.events();
    expect(events.some((e) => e.event === 'batch.retried' && e.rule === 1)).toBe(true);

    // The retry should PASS: spec_diff_lines = 0
    const passFinished = events.filter((e) => e.event === 'run.finished' && e.verdict === 'PASS');
    expect(passFinished.length).toBeGreaterThanOrEqual(1);
  });

  it('interrupt auto-retry: second run is not blocked by R2 retry commit', async () => {
    // Replace backlog for multi-batch queue test
    const backlog = makeBacklog([
      { priority: 1, id: 'v99-b01', title: '示例功能', depends: '—', status: 'pending' },
      { priority: 2, id: 'v99-b02', title: '第二功能', depends: 'v99-b01', status: 'pending' },
    ]);
    box.write('docs/backlog.md', backlog);
    await box.commitAll('chore: two-batch backlog');

    const fp = controllableFingerprint();

    const runner = new FakeRunner([
      // Run 1: worker idle, no report → BLOCK → interrupt retry.
      idleWorkerNoReport('v99-b01', fp),
      // Retry: normal worker + reviewer PASS.
      normalWorkerScene(box, 'v99-b01', true),
      reviewerPassScene(box, 'v99-b01'),
      // Run 3: v99-b02 worker + reviewer PASS.
      normalWorkerScene(box, 'v99-b02', true),
      reviewerPassScene(box, 'v99-b02'),
    ]);
    const code = await box.cli(['run', '--continue', '--max', '2'], runner, livenessOpts(fp));
    expect(code).toBe(0);

    const events = box.events();

    // queue.batch_started with why=interrupt_retry for the retry run.
    const retryStarted = events.find(
      (e) => e.event === 'queue.batch_started' && e.why === 'interrupt_retry',
    );
    expect(retryStarted).toBeDefined();
    expect(retryStarted?.batch_id).toBe('v99-b01');

    // The retry should PASS with spec_diff_lines = 0.
    const passFinished = events.filter((e) => e.event === 'run.finished' && e.verdict === 'PASS');
    expect(passFinished.length).toBeGreaterThanOrEqual(1);
    const evidenceEvents = events.filter((e) => e.event === 'evidence.collected');
    // Find the evidence for the PASS run of v99-b01 (the retry).
    const retryEvidence = evidenceEvents.find(
      (e) => e.batch_id === 'v99-b01' && e.spec_diff_lines === 0,
    );
    expect(retryEvidence).toBeDefined();
    expect(retryEvidence?.spec_diff_lines).toBe(0);
  });

  it('R2 commit count in git log equals r2.commit count in journal', async () => {
    // Run a full cycle: worker + reviewer PASS
    const runner = new FakeRunner([
      normalWorkerScene(box, 'v99-b01', true),
      reviewerPassScene(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue', '--max', '1'], runner);

    const events = box.events();
    const r2CommitEvents = events.filter((e) => e.event === 'r2.commit');

    // After the run, all R2 commits should be recorded in the journal.
    expect(r2CommitEvents.length).toBeGreaterThan(0);

    // Collect the sha set from journal r2.commit events.
    const journalShas = new Set(
      r2CommitEvents.map((e) => {
        const sha: unknown = e.sha;
        return typeof sha === 'string' ? sha : '';
      }),
    );

    // Collect commits from git log whose subjects match R2 prefixes.
    const logOutput = await git(box.root, ['log', '--format=%H %s', 'main']);
    const gitR2Shas = new Set<string>();
    for (const line of logOutput.trim().split('\n')) {
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx === -1) continue;
      const sha = line.slice(0, spaceIdx);
      const subject = line.slice(spaceIdx + 1);
      if (subject.startsWith('docs: issue ') || subject.startsWith('progress: ')) {
        gitR2Shas.add(sha);
      }
    }

    // The two sets must be equal.
    expect(journalShas).toEqual(gitR2Shas);
  });

  it('deleting .collie/runs/ causes rule 2 to block R2 own ruling commit (conservative)', async () => {
    // First run: FIX verdict (creates R2 commits in journal)
    const runner1 = new FakeRunner([
      normalWorkerScene(box, 'v99-b01', true),
      reviewerFixScene(box, 'v99-b01'),
    ]);
    await box.cli(['run', '--continue', '--max', '1'], runner1);

    // Extract the base_sha from the first run's journal before deleting
    const events1 = box.events();
    const batchSelected = events1.find((e) => e.event === 'batch.selected');
    expect(batchSelected).toBeDefined();
    const baseSha = batchSelected?.base_sha;
    expect(typeof baseSha).toBe('string');

    // Find the first run's run_id to create a minimal journal below
    const runStarted = events1.find((e) => e.event === 'run.started');
    const firstRunId = runStarted?.run_id;
    expect(typeof firstRunId).toBe('string');

    // Delete .collie/runs/ — full journal gone
    const runsDir = join(box.root, RUNS_RELATIVE_DIR);
    if (existsSync(runsDir)) {
      rmSync(runsDir, { recursive: true, force: true });
    }

    // Recreate a minimal journal that preserves batch.selected (baseSha) but NOT
    // r2.commit events. This simulates "换了一台机器接着跑同一个批次" (SPEC 16.14):
    // the new machine has the git commits but not the full journal.
    const minRunId = String(firstRunId);
    const minRunDir = join(runsDir, minRunId);
    mkdirSync(minRunDir, { recursive: true });
    const minJournal = [
      {
        ts: '2026-10-19T12:00:00.000Z',
        run_id: minRunId,
        batch_id: 'v99-b01',
        event: 'run.started',
      },
      {
        ts: '2026-10-19T12:00:01.000Z',
        run_id: minRunId,
        batch_id: 'v99-b01',
        event: 'batch.selected',
        base_sha: baseSha,
      },
      {
        ts: '2026-10-19T12:00:59.000Z',
        run_id: minRunId,
        batch_id: 'v99-b01',
        event: 'run.finished',
        verdict: 'FIX',
      },
    ];
    writeFileSync(
      join(minRunDir, 'events.ndjson'),
      minJournal.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    // Second run: baseSha is preserved from the minimal journal, but r2Shas is
    // empty (no r2.commit events). The commit range includes R2's progress commit
    // from run 1 (which changed docs/progress.md), and that commit is NOT in
    // r2Shas → spec_diff_lines > 0 → rule 2 fires.
    const runner2 = new FakeRunner([
      normalWorkerScene(box, 'v99-b01', true),
      reviewerPassScene(box, 'v99-b01'),
    ]);
    const code2 = await box.run(runner2);

    // Expected: BLOCK due to rule 2 — known conservative behavior (SPEC 16.14).
    expect(code2).not.toBe(0);
    const events2 = box.events();
    const lastEvidence = events2.filter((e) => e.event === 'evidence.collected').at(-1);
    expect(lastEvidence?.spec_diff_lines).toBeGreaterThan(0);
  });
});
