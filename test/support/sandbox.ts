// A throwaway Collie project for end-to-end runs: a real git repository with a
// bare "origin", a POSIX-sh test harness that really runs test files, and fake
// agents scripted through FakeRunner. Nothing touches the network.
import {
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
import type { FetchLike } from '../../src/ci.js';
import { main, type CliDeps } from '../../src/cli.js';
import { git, revParse } from '../../src/git.js';
import { createJournal } from '../../src/journal.js';
import type { FakeScene, FakeSceneContext } from '../../src/runner/fake.js';
import { FakeRunner } from '../../src/runner/fake.js';
import type { Claims, Event, Report, Verdict } from '../../src/schema/index.js';

const repoRoot = join(import.meta.dirname, '..', '..');
export const BATCH = 'v99-b01';
export const TEST_CMD = 'sh run-tests.sh';
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

const BACKLOG = `# backlog

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

export class Sandbox {
  readonly dir: string;
  readonly root: string;
  readonly remote: string;
  readonly output: string[] = [];
  /** Branch the fake GitHub Actions API reports runs on (scenario A sets 'master'). */
  ciBranch = 'main';
  ciConclusion = 'success';
  /** Polls that answer 'in_progress' before the run completes (Infinity: never completes). */
  ciPendingPolls = 0;
  ciPolls = 0;
  /** What the fake reviewer could see in its working directory. */
  reviewerSawReport: boolean | undefined;
  reviewerCwd: string | undefined;
  private readonly savedEnv = {
    global: process.env.GIT_CONFIG_GLOBAL,
    nosystem: process.env.GIT_CONFIG_NOSYSTEM,
  };

  private constructor() {
    this.dir = mkdtempSync(join(tmpdir(), 'collie-sandbox-'));
    this.root = join(this.dir, 'project');
    this.remote = join(this.dir, 'origin.git');
  }

  static async create(): Promise<Sandbox> {
    const box = new Sandbox();
    const configDir = join(box.dir, 'gitconfig');
    writeFileSync(
      configDir,
      '[user]\n\tname = Sandbox\n\temail = sandbox@example.invalid\n[init]\n\tdefaultBranch = main\n',
    );
    process.env.GIT_CONFIG_GLOBAL = configDir;
    process.env.GIT_CONFIG_NOSYSTEM = '1';

    mkdirSync(box.root);
    await git(box.root, ['init', '-q']);
    await git(box.dir, ['init', '-q', '--bare', box.remote]);
    await git(box.root, ['remote', 'add', 'origin', box.remote]);

    for (const file of ['AGENT-worker.md', 'AGENT-reviewer.md', 'CONSTRAINTS.md']) {
      copyFileSync(join(repoRoot, file), join(box.root, file));
    }
    const toml = readFileSync(join(repoRoot, 'templates', 'collie.toml'), 'utf8')
      .replace('"{{name}}"', '"sandbox"')
      .replace('"{{repo}}"', '"https://github.com/example/sandbox"')
      .replace(/^commands = .*$/m, `commands = ["${TEST_CMD}"]`);
    box.write('.collie/collie.toml', toml);
    box.write('.gitignore', '.collie/runs/\n.collie/heartbeat\n');
    box.write('SPEC.md', '# SPEC\n\nThe feature must exist.\n');
    box.write('docs/backlog.md', BACKLOG);
    box.write('docs/progress.md', '# 进度\n\n人工维护的内容，Collie 不得改动。\n');
    box.write('run-tests.sh', HARNESS);
    await box.commitAll('chore: sandbox base');
    await git(box.root, ['push', '-q', 'origin', 'main']);
    return box;
  }

  write(path: string, content: string, root = this.root): void {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }

  async commitAll(message: string, root = this.root): Promise<string> {
    await git(root, ['add', '-A']);
    await git(root, ['commit', '-q', '-m', message]);
    return revParse(root, 'HEAD');
  }

  /** GitHub Actions double: one completed run per sha, on `ciBranch`. */
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
    return this.cli(['run', BATCH], runner, extra);
  }

  async cli(
    argv: string[],
    runner: FakeRunner | undefined,
    extra: Partial<CliDeps> = {},
  ): Promise<number> {
    let tick = 0;
    return main(argv, {
      cwd: this.root,
      runner,
      fetch: this.fetch,
      // A fixed, advancing clock keeps envelopes and run ids deterministic.
      now: () => new Date(Date.UTC(2026, 9, 19, 12, 0, tick++)),
      out: (t) => this.output.push(t),
      err: (t) => this.output.push(t),
      ...extra,
    });
  }

  /** Every journaled event of every run in this sandbox, in run order. */
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
    rmSync(this.dir, { recursive: true, force: true });
  }
}

function restore(
  name: 'GIT_CONFIG_GLOBAL' | 'GIT_CONFIG_NOSYSTEM',
  value: string | undefined,
): void {
  if (value !== undefined) process.env[name] = value;
  else if (name === 'GIT_CONFIG_GLOBAL') delete process.env.GIT_CONFIG_GLOBAL;
  else delete process.env.GIT_CONFIG_NOSYSTEM;
}

export interface WorkerPlan {
  /** Test files the worker commits: how many pass and how many fail when run. */
  passing: number;
  failing: number;
  /** Also edits SPEC.md in the code commit (scenario C). */
  editSpec?: boolean;
  /** Pushes to origin/main. */
  push: boolean;
  /** The claims written into report.md: the worker's story, true or not. */
  claims: Omit<Claims, 'commits'>;
  /** Skip writing report.md entirely. */
  noReport?: boolean;
}

/** A worker scene that really commits code and tests, then reports `plan.claims`. */
export function workerScene(box: Sandbox, plan: WorkerPlan): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature\n', cwd);
      for (let i = 0; i < plan.passing + plan.failing; i++) {
        box.write(
          `tests/t${String(i).padStart(3, '0')}.sh`,
          i < plan.passing ? 'exit 0\n' : 'exit 1\n',
          cwd,
        );
      }
      if (plan.editSpec === true) box.write('SPEC.md', '# SPEC\n\nThe feature is optional.\n', cwd);
      const head = await box.commitAll('feat: add feature with tests', cwd);
      if (plan.noReport !== true) {
        const report: Report = {
          schema_version: 1,
          batch_id: BATCH,
          head_sha: head,
          claims: { commits: [head], ...plan.claims },
          open_questions: [],
        };
        box.write(
          `.collie/batches/${BATCH}/report.md`,
          `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
          cwd,
        );
        await box.commitAll(`report(collie): ${BATCH}`, cwd);
      }
      if (plan.push) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/** A reviewer that is fooled: it echoes the worker's story and says PASS. */
export function fooledReviewerScene(box: Sandbox, verdict: Verdict['verdict'] = 'PASS'): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: BATCH,
    verdict,
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '47 passed, 0 failed' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: [],
    reason: 'the report looks complete',
  };
  return {
    expectRole: 'reviewer',
    effect: ({ cwd }: FakeSceneContext) => {
      box.reviewerCwd = cwd;
      box.reviewerSawReport = (() => {
        try {
          readFileSync(join(cwd, '.collie', 'batches', BATCH, 'report.md'));
          return true;
        } catch {
          return false;
        }
      })();
    },
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n看起来都对。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

/** Honest claims for `passing` green tests, pushed, CI as claimed. */
export function honestClaims(passing: number, ciPassed = true): Omit<Claims, 'commits'> {
  return {
    tests_passed: passing,
    tests_failed: 0,
    pushed: true,
    ci_passed: ciPassed,
    new_deps: [],
    spec_touched: false,
  };
}
