// Tests for batch authorisation: named protected paths do not count toward
// spec_diff_lines (SPEC 16.21, v046-b32).
// Uses Sandbox & FakeRunner, following the pattern in test/tester-step.test.ts.
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
import { afterEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import { main, type CliDeps } from '../src/cli.js';
import { git, revParse } from '../src/git.js';
import { createJournal } from '../src/journal.js';
import { FakeRunner } from '../src/runner/fake.js';
import type { FakeScene, FakeSceneContext } from '../src/runner/fake.js';
import type { Event, Report, Verdict } from '../src/schema/index.js';

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

// ---------------------------------------------------------------------------
// Backlog builders
// ---------------------------------------------------------------------------

function backlogWithAuth(allowedPaths: string[]): string {
  const authSection =
    allowedPaths.length > 0
      ? ['', '可改的受保护路径：', ...allowedPaths.map((p) => `- ${p}`)].join('\n')
      : '';
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| 1 | ${BATCH} | 示例功能 | — | running |`,
    '',
    `## ${BATCH} 示例功能`,
    '',
    '优先级：1　依赖：无',
    '',
    '条目：',
    '1. 实现 feature.txt 并补测试',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    `| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |`,
    '| 功能文件存在 | `test -f feature.txt` | exit 0 |',
    authSection,
  ].join('\n');
}

const BACKLOG_NO_AUTH = backlogWithAuth([]);
const BACKLOG_AUTH_VITEST = backlogWithAuth(['vitest.config.ts']);

// ---------------------------------------------------------------------------
// AuthSandbox — like Sandbox but accepts a custom backlog
// ---------------------------------------------------------------------------

function restore(
  name: 'GIT_CONFIG_GLOBAL' | 'GIT_CONFIG_NOSYSTEM',
  value: string | undefined,
): void {
  if (value !== undefined) process.env[name] = value;
  else if (name === 'GIT_CONFIG_GLOBAL') delete process.env.GIT_CONFIG_GLOBAL;
  else delete process.env.GIT_CONFIG_NOSYSTEM;
}

class AuthSandbox {
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
    this.dir = mkdtempSync(join(tmpdir(), 'collie-auth-'));
    this.root = join(this.dir, 'project');
    this.remote = join(this.dir, 'origin.git');
  }

  static async create(backlog: string): Promise<AuthSandbox> {
    const box = new AuthSandbox();
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

    for (const file of ['AGENT-worker.md', 'AGENT-reviewer.md', 'CONSTRAINTS.md']) {
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
    // Create protected files so they exist in the base commit
    box.write('vitest.config.ts', '// vitest base\n');
    box.write('eslint.config.js', '// eslint base\n');
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
// Helpers: fake scenes
// ---------------------------------------------------------------------------

/** Worker that commits code + an authorised protected file, writes report, pushes. */
function workerWithAuthFile(
  box: AuthSandbox,
  opts: { editVitest?: boolean; editEslint?: boolean } = {},
): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      if (opts.editVitest !== false) {
        box.write('vitest.config.ts', '// vitest changed\nexport default {};\n', cwd);
      }
      if (opts.editEslint === true) {
        box.write('eslint.config.js', '// eslint changed\nexport default [];\n', cwd);
      }
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
          ci_passed: false,
          new_deps: [],
          spec_touched: false,
        },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# report\n\n## 做了什么\n完成。\n\n## 测试结果\n1 passed.\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/** A reviewer scene that just says PASS. */
function reviewerPass(): FakeScene {
  const verdict: Verdict = {
    schema_version: 1,
    batch_id: BATCH,
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
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(verdict, null, 2)}\n${FENCE}\n`,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('batch authorisation: named protected paths do not count', () => {
  let box: AuthSandbox | undefined;

  afterEach(() => {
    box?.dispose();
  });

  it('authorised vitest.config.ts: spec_diff_lines=0, authorized_diff_lines>0, PASS', async () => {
    box = await AuthSandbox.create(BACKLOG_AUTH_VITEST);
    const runner = new FakeRunner([
      workerWithAuthFile(box, { editVitest: true, editEslint: false }),
      reviewerPass(),
    ]);
    const code = await box.run(runner);
    expect(code).toBe(0); // PASS

    const events = box.events();
    const evidenceEvt = events.find((e) => e.event === 'evidence.collected');
    expect(evidenceEvt).toBeDefined();
    expect(evidenceEvt?.spec_diff_lines).toBe(0);
    expect(typeof evidenceEvt?.authorized_diff_lines).toBe('number');
    expect((evidenceEvt?.authorized_diff_lines as number) > 0).toBe(true);
  });

  it('authorised vitest.config.ts but worker also edits eslint.config.js (not authorised): spec_diff_lines>0', async () => {
    box = await AuthSandbox.create(BACKLOG_AUTH_VITEST);
    const runner = new FakeRunner([
      workerWithAuthFile(box, { editVitest: true, editEslint: true }),
      reviewerPass(),
    ]);
    const code = await box.run(runner);
    // Rule 2 fires: spec_diff_lines > 0 from eslint.config.js → downgraded
    // The exit code may be 10 (FIX) or 20 (BLOCK) depending on arbiter.
    expect(code).toBeGreaterThan(0);

    const events = box.events();
    const evidenceEvt = events.find((e) => e.event === 'evidence.collected');
    expect(evidenceEvt).toBeDefined();
    expect((evidenceEvt?.spec_diff_lines as number) > 0).toBe(true);
  });

  it('no authorisation: worker edits vitest.config.ts → spec_diff_lines>0, no authorized_diff_lines', async () => {
    box = await AuthSandbox.create(BACKLOG_NO_AUTH);
    const runner = new FakeRunner([
      workerWithAuthFile(box, { editVitest: true, editEslint: false }),
      reviewerPass(),
    ]);
    const code = await box.run(runner);
    // Rule 2 fires: spec_diff_lines > 0 → downgraded
    expect(code).toBeGreaterThan(0);

    const events = box.events();
    const evidenceEvt = events.find((e) => e.event === 'evidence.collected');
    expect(evidenceEvt).toBeDefined();
    expect((evidenceEvt?.spec_diff_lines as number) > 0).toBe(true);
    // No authorized_diff_lines when the batch has no authorisation
    expect(evidenceEvt?.authorized_diff_lines).toBeUndefined();
  });
});
