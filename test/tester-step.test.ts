// Tests for the tester step wiring in runBatch (SPEC 16.14, v046-b15).
// Uses a custom TesterSandbox (like test/support/sandbox.ts but copies
// AGENT-tester.md and accepts a custom backlog), FakeRunner, and injected
// redCheck to avoid real runners, real vitest subprocesses, and network.
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import { main, type CliDeps } from '../src/cli.js';
import { git, revParse } from '../src/git.js';
import { createJournal } from '../src/journal.js';
import { TESTER_STREAM_FILE_NAME } from '../src/run.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import type { Event, Report, Verdict } from '../src/schema/index.js';
import type { RedCheckFn } from '../src/acceptance.js';

const repoRoot = join(import.meta.dirname, '..');
const BATCH = 'v99-b01';
const TEST_CMD = 'sh run-tests.sh';
const FENCE = '```';

/** Runs every tests/*.sh, counts exit statuses, prints vitest-style totals. */
const HARNESS = `#!/bin/sh
passed=0
failed=0
for t in tests/*.sh; do
  [ -e "$t" ] || continue
  if sh "$t" >/dev/null 2>&1; then passed=$((passed + 1)); else failed=$((failed + 1)); fi
done
total=$((passed + failed))
if [ "$failed" -gt 0 ]; then
  echo " Test Files  1 failed (1)"
  echo "      Tests  $failed failed | $passed passed ($total)"
  exit 1
fi
echo " Test Files  1 passed (1)"
echo "      Tests  $passed passed ($total)"
`;

// Backlog with scenarios (带情形的批次).
const BACKLOG_WITH_SCENARIOS = `# backlog

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | ${BATCH} | 示例功能 | — | running |

## ${BATCH} 示例功能

优先级：1\u3000依赖：无

条目：
1. 实现 feature.txt 并补测试

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |
| 功能文件存在 | \`test -f feature.txt\` | exit 0 |

情形：
- S1 [新] 新增功能 A
- S2 [新] 新增功能 B

接口：
- src/feature.ts featureFunc
`;

// Backlog without scenarios (不带情形的批次).
const BACKLOG_WITHOUT_SCENARIOS = `# backlog

## 队列总览

| 优先级 | 批次 | 标题 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | ${BATCH} | 示例功能 | — | running |

## ${BATCH} 示例功能

优先级：1\u3000依赖：无

条目：
1. 实现 feature.txt 并补测试

验收标准：

| 说明 | 命令 | 期望 |
|---|---|---|
| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |
| 功能文件存在 | \`test -f feature.txt\` | exit 0 |
`;

// ---------------------------------------------------------------------------
// TesterSandbox — like test/support/sandbox.ts but copies AGENT-tester.md
// and accepts a custom backlog with scenarios.
// ---------------------------------------------------------------------------

function restore(
  name: 'GIT_CONFIG_GLOBAL' | 'GIT_CONFIG_NOSYSTEM',
  value: string | undefined,
): void {
  if (value !== undefined) process.env[name] = value;
  else if (name === 'GIT_CONFIG_GLOBAL') delete process.env.GIT_CONFIG_GLOBAL;
  else delete process.env.GIT_CONFIG_NOSYSTEM;
}

class TesterSandbox {
  readonly dir: string;
  readonly root: string;
  readonly remote: string;
  readonly output: string[] = [];
  ciBranch = 'main';
  ciConclusion = 'success';
  ciPendingPolls = 0;
  ciPolls = 0;
  private tick = 0;
  private readonly savedEnv = {
    global: process.env.GIT_CONFIG_GLOBAL,
    nosystem: process.env.GIT_CONFIG_NOSYSTEM,
  };

  private constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'collie-tester-step-'));
    this.root = join(this.dir, 'project');
    this.remote = join(this.dir, 'origin.git');
  }

  static async create(backlog: string): Promise<TesterSandbox> {
    const box = new TesterSandbox();
    const configDir = join(box.dir, 'gitconfig');
    writeFileSync(
      configDir,
      '[user]\n\tname = Sandbox\n\temail = sandbox@example.invalid\n[init]\n\tdefaultBranch = main\n[gc]\n\tauto = 0\n',
    );
    process.env.GIT_CONFIG_GLOBAL = configDir;
    process.env.GIT_CONFIG_NOSYSTEM = '1';

    mkdirSync(box.root);
    await git(box.root, ['init', '-q']);
    await git(box.dir, ['init', '-q', '--bare', box.remote]);
    await git(box.root, ['remote', 'add', 'origin', box.remote]);

    // Copy agent prompts — including AGENT-tester.md for the tester step.
    for (const file of [
      'AGENT-worker.md',
      'AGENT-reviewer.md',
      'AGENT-tester.md',
      'CONSTRAINTS.md',
    ]) {
      copyFileSync(join(repoRoot, file), join(box.root, file));
    }
    const toml = readFileSync(join(repoRoot, 'templates', 'collie.toml'), 'utf8')
      .replace('"{{name}}"', '"sandbox"')
      .replace('"{{repo}}"', '"https://github.com/example/sandbox"')
      .replace(/^commands = .*$/m, `commands = ["${TEST_CMD}"]`)
      .replace(/^token_file = .*$/m, '# token_file removed for sandbox')
      .replace(/^webhook_file = .*$/m, '# webhook_file removed for sandbox');
    box.write('.collie/collie.toml', toml);
    box.write('.gitignore', '.collie/runs/\n.collie/heartbeat.json\n');
    box.write('SPEC.md', '# SPEC\n\nThe feature must exist.\n');
    box.write('docs/backlog.md', backlog);
    box.write('docs/progress.md', '# 进度\n\n人工维护的内容，Collie 不得改动。\n');
    box.write('run-tests.sh', HARNESS);
    await box.commitAll('chore: sandbox base');
    await git(box.root, ['push', '-q', 'origin', 'main']);
    return box;
  }

  write(path: string, content: string, rootDir = this.root): void {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), content);
  }

  async commitAll(message: string, rootDir = this.root): Promise<string> {
    await git(rootDir, ['add', '-A']);
    await git(rootDir, ['commit', '-q', '-m', message]);
    return revParse(rootDir, 'HEAD');
  }

  readonly fetch: FetchLike = (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    const run = {
      id: 42,
      workflow_id: 1,
      name: 'ci',
      event: 'push',
      head_branch: this.ciBranch,
      head_sha: sha,
      status: this.ciPolls++ < this.ciPendingPolls ? 'in_progress' : 'completed',
      conclusion: this.ciPolls <= this.ciPendingPolls ? null : this.ciConclusion,
      html_url: 'https://github.com/example/sandbox/actions/runs/42',
      created_at: '2026-10-19T12:00:00Z',
    };
    return Promise.resolve(new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })));
  };

  async run(runner: FakeRunner, extra: Partial<CliDeps> = {}): Promise<number> {
    return main(['run', BATCH], {
      cwd: this.root,
      runner,
      fetch: this.fetch,
      now: () => new Date(Date.UTC(2026, 9, 19, 12, 0, this.tick++)),
      out: (t) => this.output.push(t),
      err: (t) => this.output.push(t),
      diskFreeMb: () => 10_000,
      ...extra,
    });
  }

  events(): Event[] {
    const runsDir = join(this.root, '.collie', 'runs');
    if (!existsSync(runsDir)) return [];
    const journal = createJournal(this.root);
    return readdirSync(runsDir)
      .sort()
      .flatMap((runId) => journal.replay(runId));
  }

  eventTypes(): string[] {
    return this.events().map((e) => e.event);
  }

  read(path: string): string {
    return readFileSync(join(this.root, path), 'utf8');
  }

  dispose(): void {
    restore('GIT_CONFIG_GLOBAL', this.savedEnv.global);
    restore('GIT_CONFIG_NOSYSTEM', this.savedEnv.nosystem);
    rmSync(this.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---------------------------------------------------------------------------
// Helpers: fake scenes, red check
// ---------------------------------------------------------------------------

/** A passing red check. */
function passingRedCheck(): RedCheckFn {
  // eslint-disable-next-line @typescript-eslint/require-await -- RedCheckFn is async
  return async () => ({
    ok: true as const,
    problems: [],
    newTestCount: 1,
    keepTestCount: 0,
  });
}

/** A failing red check. */
function failingRedCheck(reasons: string[] = ['test did not fail']): RedCheckFn {
  // eslint-disable-next-line @typescript-eslint/require-await -- RedCheckFn is async
  return async () => ({
    ok: false as const,
    problems: reasons.map((r) => ({
      file: 'new' as const,
      testName: 'scenario S1',
      reason: r,
    })),
    newTestCount: 1,
    keepTestCount: 0,
  });
}

/**
 * A tester scene that writes new.test.ts and MAP.md in the working directory
 * (which is the worktree, not the main repo).
 */
function testerScene(opts?: { exitCode?: number; misclassified?: string[] }): FakeScene {
  const exitCode = opts?.exitCode ?? 0;
  const misclassified = opts?.misclassified;
  return {
    expectRole: 'tester',
    effect: ({ cwd }: FakeSceneContext) => {
      const outDir = join(cwd, 'test', 'acceptance', BATCH);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
      writeFileSync(join(outDir, 'MAP.md'), '# MAP\n\nS1 -> new.test.ts\n');
    },
    result: {
      exitCode,
      ...(misclassified !== undefined
        ? {
            finalText: `done\n\n${FENCE}json\n${JSON.stringify({ misclassified })}\n${FENCE}\n`,
          }
        : { finalText: 'done' }),
    },
  };
}

/** A tester scene that writes a rogue file in the MAIN repo's tree. */
function testerTouchMainScene(mainRoot: string): FakeScene {
  return {
    expectRole: 'tester',
    effect: ({ cwd }: FakeSceneContext) => {
      // Write acceptance files in worktree (normal)
      const outDir = join(cwd, 'test', 'acceptance', BATCH);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
      writeFileSync(join(outDir, 'MAP.md'), '# MAP\n');
      // Also write a rogue file in the MAIN repo
      writeFileSync(join(mainRoot, 'rogue.txt'), 'should not be here\n');
    },
    result: { exitCode: 0, finalText: 'done' },
  };
}

/**
 * A tester scene that modifies a tracked file AND creates an untracked file
 * in the MAIN repo's tree (SPEC 16.17 scenario).
 */
function testerTouchTrackedAndUntrackedScene(mainRoot: string): FakeScene {
  return {
    expectRole: 'tester',
    effect: ({ cwd }: FakeSceneContext) => {
      const outDir = join(cwd, 'test', 'acceptance', BATCH);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
      writeFileSync(join(outDir, 'MAP.md'), '# MAP\n');
      // Modify a tracked file in the MAIN repo
      appendFileSync(join(mainRoot, 'docs', 'progress.md'), '\ntester was here\n');
      // Create an untracked file in the MAIN repo
      writeFileSync(join(mainRoot, 'rogue.txt'), 'should not be here\n');
    },
    result: { exitCode: 0, finalText: 'done' },
  };
}

/**
 * A tester scene that only deletes a tracked file in the MAIN repo's tree.
 * Uses SPEC.md because docs/progress.md would be rewritten by R2 anyway.
 */
function testerDeleteTrackedScene(mainRoot: string): FakeScene {
  return {
    expectRole: 'tester',
    effect: ({ cwd }: FakeSceneContext) => {
      const outDir = join(cwd, 'test', 'acceptance', BATCH);
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
      writeFileSync(join(outDir, 'MAP.md'), '# MAP\n');
      // Delete a tracked file in the MAIN repo
      rmSync(join(mainRoot, 'SPEC.md'));
    },
    result: { exitCode: 0, finalText: 'done' },
  };
}

function workerScene(box: TesterSandbox, suffix = ''): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', `feature${suffix}\n`, cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature with tests', cwd);
      const report: Report = {
        schema_version: 1,
        batch_id: BATCH,
        head_sha: head,
        claims: {
          commits: [head],
          tests_passed: 1,
          tests_failed: 0,
          pushed: true,
          ci_passed: true,
          new_deps: [],
          spec_touched: false,
        },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

function reviewerScene(verdict: 'PASS' | 'FIX' = 'PASS'): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: BATCH,
    verdict,
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
    gaps: verdict === 'FIX' ? ['needs another look'] : [],
    reason: verdict === 'FIX' ? 'some gaps found' : 'the report looks complete',
  };
  return {
    expectRole: 'reviewer',
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n看起来都对。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tester step: runs before the task envelope', () => {
  let box: TesterSandbox;

  beforeEach(async () => {
    box = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
  });

  afterEach(() => {
    box.dispose();
  });

  it('with scenarios, red check passes first time: tester, worker, reviewer called in order', async () => {
    const runner = new FakeRunner([testerScene(), workerScene(box), reviewerScene()]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck });
    expect(exit).toBe(0);

    // Verify the runner was called: tester, worker, reviewer
    expect(runner.calls).toHaveLength(3);
    expect(runner.calls[0]?.role).toBe('tester');
    expect(runner.calls[1]?.role).toBe('worker');
    expect(runner.calls[2]?.role).toBe('reviewer');

    // The docs: issue commit should contain task.md, new.test.ts, and MAP.md
    const events = box.events();
    const taskWritten = events.find((e) => e.event === 'batch.task_written');
    expect(taskWritten).toBeDefined();
    const taskCommitSha = taskWritten?.commit as string;
    expect(taskCommitSha).toBeTruthy();

    // Check the commit has the acceptance test files
    const diff = await git(box.root, [
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      taskCommitSha,
    ]);
    expect(diff).toContain(`test/acceptance/${BATCH}/new.test.ts`);
    expect(diff).toContain(`test/acceptance/${BATCH}/MAP.md`);
    expect(diff).toContain(`.collie/batches/${BATCH}/task.md`);

    // Journal should have tester.started, tester.finished, redcheck.result
    // before batch.task_written
    const eventTypes = box.eventTypes();
    const testerStartedIdx = eventTypes.indexOf('tester.started');
    const testerFinishedIdx = eventTypes.indexOf('tester.finished');
    const redcheckResultIdx = eventTypes.indexOf('redcheck.result');
    const taskWrittenIdx = eventTypes.indexOf('batch.task_written');
    expect(testerStartedIdx).toBeGreaterThan(-1);
    expect(testerFinishedIdx).toBeGreaterThan(testerStartedIdx);
    expect(redcheckResultIdx).toBeGreaterThan(testerFinishedIdx);
    expect(taskWrittenIdx).toBeGreaterThan(redcheckResultIdx);

    // The conclusion should be PASS
    const runFinished = events.findLast((e) => e.event === 'run.finished');
    expect(runFinished?.verdict).toBe('PASS');
  });

  it('without scenarios, only worker and reviewer are called, no tester events', async () => {
    const noScenarioBox = await TesterSandbox.create(BACKLOG_WITHOUT_SCENARIOS);
    try {
      const runner = new FakeRunner([workerScene(noScenarioBox), reviewerScene()]);
      const exit = await noScenarioBox.run(runner);
      expect(exit).toBe(0);

      // Runner called only worker, reviewer
      expect(runner.calls).toHaveLength(2);
      expect(runner.calls[0]?.role).toBe('worker');
      expect(runner.calls[1]?.role).toBe('reviewer');

      // No tester events
      const eventTypes = noScenarioBox.eventTypes();
      expect(eventTypes.filter((e) => e.startsWith('tester.')).length).toBe(0);
      expect(eventTypes.filter((e) => e.startsWith('redcheck.')).length).toBe(0);

      // No tester.stream.ndjson
      const runsDir = join(noScenarioBox.root, '.collie', 'runs');
      const runDirs = existsSync(runsDir) ? readdirSync(runsDir) : [];
      for (const d of runDirs) {
        expect(existsSync(join(runsDir, d, TESTER_STREAM_FILE_NAME))).toBe(false);
      }
    } finally {
      noScenarioBox.dispose();
    }
  });
});

describe('tester step: failures stop the batch', () => {
  let box: TesterSandbox;

  beforeEach(async () => {
    box = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
  });

  afterEach(() => {
    box.dispose();
  });

  it('red check fails twice → exit 20, escalated with red_check', async () => {
    // tester_max defaults to 2, so the tester is called twice
    const runner = new FakeRunner([testerScene(), testerScene()]);
    const redCheck = failingRedCheck(['test S1 should fail but passed']);
    const exit = await box.run(runner, { redCheck });

    expect(exit).toBe(20);

    // Check escalation reason
    const events = box.events();
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect((escalated?.reason as string).startsWith('red_check_failed')).toBe(true);

    // tester.md should exist in the batch dir
    expect(existsSync(join(box.root, '.collie', 'batches', BATCH, 'tester.md'))).toBe(true);

    // tester.md should be in git (committed as part of the escalation commit)
    const logOutput = await git(box.root, ['log', '--name-only', '--format=%s', '-5']);
    expect(logOutput).toContain('tester.md');

    // Worker and reviewer should NOT have been called
    expect(runner.calls.filter((c) => c.role === 'worker').length).toBe(0);
    expect(runner.calls.filter((c) => c.role === 'reviewer').length).toBe(0);
  });

  it('tester declares misclassified → only 1 attempt, escalated with misclassified', async () => {
    const runner = new FakeRunner([testerScene({ misclassified: ['S1'] })]);
    const redCheck = failingRedCheck(['test did not fail']);
    const exit = await box.run(runner, { redCheck });

    expect(exit).toBe(20);

    const events = box.events();
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect((escalated?.reason as string).startsWith('misclassified')).toBe(true);

    // Only 1 tester call (misclassified stops retry)
    expect(runner.calls.filter((c) => c.role === 'tester').length).toBe(1);

    // tester.md should contain misclassified section
    const testerMd = box.read(`.collie/batches/${BATCH}/tester.md`);
    expect(testerMd).toContain('S1');
  });

  it('tester writes to main workspace → escalated with tester_touched_main_tree', async () => {
    const runner = new FakeRunner([testerTouchMainScene(box.root)]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck });

    expect(exit).toBe(20);

    const events = box.events();
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect((escalated?.reason as string).startsWith('tester_touched_main_tree')).toBe(true);

    // The rogue file should still be in the main workspace (not cleaned up)
    expect(existsSync(join(box.root, 'rogue.txt'))).toBe(true);
  });

  it('testerSignal aborts → escalated with tester_failed', async () => {
    // Create an already-aborted signal
    const ac = new AbortController();
    ac.abort();

    const runner = new FakeRunner([]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck, testerSignal: ac.signal });

    expect(exit).toBe(20);

    const events = box.events();
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect((escalated?.reason as string).startsWith('tester_failed')).toBe(true);
  });

  it('config has no [agent.tester] → exit 1, stderr names [agent.tester], no commits', async () => {
    const noTesterBox = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
    try {
      // Remove [agent.tester] from config
      const tomlPath = join(noTesterBox.root, '.collie', 'collie.toml');
      let toml = readFileSync(tomlPath, 'utf8');
      toml = toml.replace(/\[agent\.tester\]\n(?:.*\n)*?(?=\n\[)/, '');
      writeFileSync(tomlPath, toml);

      const headBefore = await revParse(noTesterBox.root, 'HEAD');

      const runner = new FakeRunner([]);
      const exit = await noTesterBox.run(runner);

      expect(exit).toBe(1);

      // stderr should mention [agent.tester]
      const stderr = noTesterBox.output.join('');
      expect(stderr).toContain('[agent.tester]');

      // No new commits
      const headAfter = await revParse(noTesterBox.root, 'HEAD');
      expect(headAfter).toBe(headBefore);
    } finally {
      noTesterBox.dispose();
    }
  });
});

describe('tester step: skipped when the tests are already in the tree', () => {
  let box: TesterSandbox;

  beforeEach(async () => {
    box = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
  });

  afterEach(() => {
    box.dispose();
  });

  it('HEAD already has new.test.ts: tester not called at all', async () => {
    // Pre-commit acceptance test into the tree so the tester step is skipped
    box.write(`test/acceptance/${BATCH}/new.test.ts`, '// pre-existing\n');
    await box.commitAll('chore: add acceptance test');
    await git(box.root, ['push', '-q', 'origin', 'main']);

    const runner = new FakeRunner([workerScene(box), reviewerScene()]);
    const exit = await box.run(runner);
    expect(exit).toBe(0);

    // Only worker and reviewer called
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0]?.role).toBe('worker');
    expect(runner.calls[1]?.role).toBe('reviewer');

    // No tester events in journal
    const eventTypes = box.eventTypes();
    expect(eventTypes.filter((e) => e.startsWith('tester.')).length).toBe(0);
    expect(eventTypes.filter((e) => e.startsWith('redcheck.')).length).toBe(0);
  });

  it('FIX rerun after first FIX: tester only runs on first attempt', async () => {
    // First run: tester runs and passes, full pipeline gets FIX verdict
    const runner1 = new FakeRunner([testerScene(), workerScene(box), reviewerScene('FIX')]);
    const redCheck = passingRedCheck();
    const exit1 = await box.run(runner1, { redCheck });
    expect(exit1).toBe(10); // FIX exit code

    // Verify the acceptance test is now in the tree
    expect(existsSync(join(box.root, `test/acceptance/${BATCH}/new.test.ts`))).toBe(true);

    // Second run: the acceptance test is already in the tree, so the tester
    // step should be skipped automatically — no need to change the backlog.
    const runner2 = new FakeRunner([workerScene(box, '-v2'), reviewerScene()]);
    const exit2 = await box.run(runner2);
    expect(exit2).toBe(0); // PASS exit code

    // Second run should not call tester
    expect(runner2.calls).toHaveLength(2);
    expect(runner2.calls[0]?.role).toBe('worker');
    expect(runner2.calls[1]?.role).toBe('reviewer');

    // Combined call sequence across both runs: tester, worker, reviewer, worker, reviewer
    const allCalls = [...runner1.calls, ...runner2.calls].map((c) => c.role);
    expect(allCalls).toEqual(['tester', 'worker', 'reviewer', 'worker', 'reviewer']);
  });
});

describe('tester step: heartbeat and tracked-file safety', () => {
  let box: TesterSandbox;

  beforeEach(async () => {
    box = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
  });

  afterEach(() => {
    box.dispose();
  });

  it('tracked file modified + untracked file → restore tracked, leave untracked, tester.md lists both', async () => {
    // The tester modifies docs/progress.md (tracked) and creates rogue.txt (untracked)
    const runner = new FakeRunner([testerTouchTrackedAndUntrackedScene(box.root)]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck });

    expect(exit).toBe(20);

    // Escalation event must start with tester_touched_main_tree
    const events = box.events();
    const escalated = events.find((e) => e.event === 'escalated');
    expect(escalated).toBeDefined();
    expect((escalated?.reason as string).startsWith('tester_touched_main_tree')).toBe(true);

    // The rogue.txt must still be in the workspace (untracked, not cleaned)
    expect(existsSync(join(box.root, 'rogue.txt'))).toBe(true);

    // git log -p must NOT contain the tester's line in any commit
    const logP = await git(box.root, ['log', '-p']);
    expect(logP).not.toContain('tester was here');

    // tester.md must have two sections with correct files
    const testerMd = box.read(`.collie/batches/${BATCH}/tester.md`);
    expect(testerMd).toContain('恢复了的被跟踪文件');
    expect(testerMd).toContain('docs/progress.md');
    expect(testerMd).toContain('留在工作区的未跟踪文件');
    expect(testerMd).toContain('rogue.txt');
  });

  it('tester only deletes a tracked file → that file is restored, listed in tester.md', async () => {
    const runner = new FakeRunner([testerDeleteTrackedScene(box.root)]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck });

    expect(exit).toBe(20);

    // The deleted file must be restored
    expect(existsSync(join(box.root, 'SPEC.md'))).toBe(true);

    // The restored content must match HEAD
    const headContent = await git(box.root, ['show', 'HEAD:SPEC.md']);
    const diskContent = readFileSync(join(box.root, 'SPEC.md'), 'utf8');
    expect(diskContent).toBe(headContent);

    // tester.md must list it under restored tracked files
    const testerMd = box.read(`.collie/batches/${BATCH}/tester.md`);
    expect(testerMd).toContain('恢复了的被跟踪文件');
    expect(testerMd).toContain('SPEC.md');
  });

  it('after tester step, heartbeat phase is worker', async () => {
    // We need a worker scene that checks the heartbeat
    let heartbeatPhase: string | undefined;
    const workerSceneWithHeartbeatCheck: FakeScene = {
      expectRole: 'worker',
      effect: async ({ cwd }: FakeSceneContext) => {
        // The worker runs AFTER the tester step. At this point, heartbeat
        // phase should have been set back to 'worker'.
        // The heartbeat file is in the MAIN repo (box.root), not the worktree.
        const hbPath = join(box.root, '.collie', 'heartbeat.json');
        if (existsSync(hbPath)) {
          const hb = JSON.parse(readFileSync(hbPath, 'utf8')) as { phase?: string };
          heartbeatPhase = hb.phase;
        }
        // Still do the normal worker work
        box.write('feature.txt', 'feature\n', cwd);
        box.write('tests/t000.sh', 'exit 0\n', cwd);
        const head = await box.commitAll('feat: add feature with tests', cwd);
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: head,
          claims: {
            commits: [head],
            tests_passed: 1,
            tests_failed: 0,
            pushed: true,
            ci_passed: true,
            new_deps: [],
            spec_touched: false,
          },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
        await git(cwd, ['push', '-q', 'origin', 'main']);
      },
      result: { exitCode: 0 },
    };

    const runner = new FakeRunner([testerScene(), workerSceneWithHeartbeatCheck, reviewerScene()]);
    const redCheck = passingRedCheck();
    const exit = await box.run(runner, { redCheck });
    expect(exit).toBe(0);

    // Verify heartbeat phase was 'worker' when the worker scene ran
    expect(heartbeatPhase).toBe('worker');
  });
});

describe('tester step: wallclock', () => {
  it('tester wallclock uses worktree_secs', async () => {
    // Create a sandbox with worktree_secs = 1 (1 second timeout)
    const box = await TesterSandbox.create(BACKLOG_WITH_SCENARIOS);
    try {
      // Patch collie.toml to set worktree_secs = 1
      const tomlPath = join(box.root, '.collie', 'collie.toml');
      let toml = readFileSync(tomlPath, 'utf8');
      toml = toml.replace(/^worktree_secs\s*=\s*\d+/m, 'worktree_secs = 1');
      writeFileSync(tomlPath, toml);
      await box.commitAll('config: set worktree_secs = 1');
      await git(box.root, ['push', '-q', 'origin', 'main']);

      // Tester scene that waits for the abort signal (via opts.signal)
      const waitingTesterScene: FakeScene = {
        expectRole: 'tester',
        effect: async ({ cwd, opts }: FakeSceneContext) => {
          // Write acceptance files so the scene looks normal up to this point
          const outDir = join(cwd, 'test', 'acceptance', BATCH);
          mkdirSync(outDir, { recursive: true });
          writeFileSync(join(outDir, 'new.test.ts'), '// acceptance test\nexport {};\n');
          writeFileSync(join(outDir, 'MAP.md'), '# MAP\n');
          // Wait until the abort signal fires (worktree_secs = 1 second)
          if (opts.signal && !opts.signal.aborted) {
            await new Promise<void>((resolve) => {
              const sig = opts.signal;
              if (sig) {
                sig.addEventListener(
                  'abort',
                  () => {
                    resolve();
                  },
                  { once: true },
                );
              }
            });
          }
        },
        result: { exitCode: 0, finalText: 'done' },
      };

      const runner = new FakeRunner([waitingTesterScene]);
      const redCheck = passingRedCheck();
      // Do NOT inject testerSignal — the system should use worktree_secs from config
      const exit = await box.run(runner, { redCheck });

      expect(exit).toBe(20);

      // Escalation reason should start with tester_failed
      const events = box.events();
      const escalated = events.find((e) => e.event === 'escalated');
      expect(escalated).toBeDefined();
      expect((escalated?.reason as string).startsWith('tester_failed')).toBe(true);
    } finally {
      box.dispose();
    }
  });
});
