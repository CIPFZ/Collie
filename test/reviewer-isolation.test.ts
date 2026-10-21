// SPEC 4.2: the reviewer never receives the worker's report body, history or
// session id. These tests pin that guarantee at compile time, at run time, in
// the assembled prompt, in the source, and in the lint configuration.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterEach, beforeAll, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import {
  buildReviewerPrompt,
  ReviewerError,
  runReviewer,
  type ReviewerInput,
} from '../src/roles/reviewer.js';
import { FakeRunner } from '../src/runner/fake.js';

const repoRoot = join(import.meta.dirname, '..');
const config = loadConfig(repoRoot);
const SECRET = 'SECRET-REPORT-BODY-7f3a';
const WORKER_SESSION = 'worker-session-SECRET-91c2';

const input: ReviewerInput = {
  batch_id: 'v01-b03',
  base_sha: '96d2c1c0000000000000000000000000000000aa',
  head_sha: '080377c8e7829a2298b7e8b54c031138da69785e',
  items: ['verify + git + ci', 'reviewer role'],
  acceptance: [
    { desc: '全部测试通过', cmd: 'npm test', expect: 'exit_zero' },
    {
      desc: 'roles 不直接依赖 SDK 或 fake',
      cmd: 'test -d src/roles && ! grep -rE "from [\'\\"](@anthropic-ai|\\.\\./runner/fake|\\./fake)" src/roles/',
      expect: 'exit_zero',
    },
  ],
  spec_paths: ['SPEC.md#3.5', 'SPEC.md#4.2'],
};

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collie-reviewer-iso-'));
  copyFileSync(join(repoRoot, 'AGENT-reviewer.md'), join(root, 'AGENT-reviewer.md'));
  // A worker report sits on disk next to the reviewer, as it does in a real run.
  mkdirSync(join(root, '.collie', 'batches', 'v01-b03'), { recursive: true });
  writeFileSync(
    join(root, '.collie', 'batches', 'v01-b03', 'report.md'),
    `# 汇报\n${SECRET}\nsession ${WORKER_SESSION}\n`,
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('reviewer-isolation: compile time', () => {
  it('accepts exactly the SPEC 4.2 allow-list of input fields', () => {
    expectTypeOf<keyof ReviewerInput>().toEqualTypeOf<
      'batch_id' | 'base_sha' | 'head_sha' | 'items' | 'acceptance' | 'spec_paths'
    >();
  });

  it('rejects a report body passed as an extra field (typecheck fails without these errors)', () => {
    expect(() =>
      // @ts-expect-error -- ReviewerInput has no report field
      buildReviewerPrompt({ ...input, report: SECRET }),
    ).toThrow(ReviewerError);
    expect(() =>
      // @ts-expect-error -- ReviewerInput has no session field
      buildReviewerPrompt({ ...input, sessionId: WORKER_SESSION }),
    ).toThrow(ReviewerError);
  });

  it('takes no parameter that could carry a report', () => {
    expect(buildReviewerPrompt.length).toBe(1);
  });
});

describe('reviewer-isolation: run time', () => {
  it.each(['report', 'reportBody', 'report_md', 'history', 'sessionId', 'session_id'])(
    'rejects an extra %s field smuggled in through a variable',
    async (key) => {
      // A computed key escapes TypeScript's excess-property check.
      const smuggled: ReviewerInput = { ...input, [key]: SECRET };
      expect(() => buildReviewerPrompt(smuggled)).toThrow(`invalid reviewer input`);
      const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
      await expect(runReviewer(runner, config, smuggled, root)).rejects.toThrow(ReviewerError);
      expect(runner.calls).toHaveLength(0);
    },
  );
});

describe('reviewer-isolation: what the reviewer actually receives', () => {
  it('never contains the report body or worker session, even with report.md on disk', async () => {
    const runner = new FakeRunner([{ expectRole: 'reviewer', result: { exitCode: 0 } }]);
    await runReviewer(runner, config, input, root);
    const [call] = runner.calls;
    expect(call).toBeDefined();
    for (const text of [call?.prompt ?? '', call?.systemPrompt ?? '']) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain(WORKER_SESSION);
    }
  });

  it('contains the diff pointer, items, parsed commands verbatim and SPEC paths', () => {
    const prompt = buildReviewerPrompt(input);
    expect(prompt).toContain(
      '`96d2c1c0000000000000000000000000000000aa..080377c8e7829a2298b7e8b54c031138da69785e`',
    );
    expect(prompt).toContain('1. verify + git + ci');
    // The un-escaped form, not the GFM table form (SPEC 3.2).
    expect(prompt).toContain('(@anthropic-ai|\\.\\./runner/fake|\\./fake)');
    expect(prompt).not.toContain('\\|');
    expect(prompt).toContain('- `SPEC.md#4.2`');
  });

  it('uses AGENT-reviewer.md as the system prompt', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runReviewer(runner, config, input, root);
    expect(runner.calls[0]?.systemPrompt).toBe(
      readFileSync(join(repoRoot, 'AGENT-reviewer.md'), 'utf8'),
    );
  });
});

describe('reviewer-isolation: no write capability', () => {
  it('runs with the configured reviewer whitelist, which has no write tools', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runReviewer(runner, config, input, root);
    expect(runner.calls[0]?.allowedTools).toEqual(['Read', 'Glob', 'Grep', 'Bash']);
  });

  it.each(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])(
    'refuses to launch when the whitelist grants %s',
    async (tool) => {
      const tainted = {
        ...config,
        agent: {
          ...config.agent,
          reviewer: { ...config.agent.reviewer, allowed_tools: ['Read', tool] },
        },
      };
      const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
      await expect(runReviewer(runner, tainted, input, root)).rejects.toThrow(
        `reviewer must not have write tools, got ${tool}`,
      );
      expect(runner.calls).toHaveLength(0);
    },
  );
});

describe('reviewer-isolation: source and lint', () => {
  const source = readFileSync(join(repoRoot, 'src', 'roles', 'reviewer.ts'), 'utf8');
  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: repoRoot });
  });

  it('never reads a report or imports the worker role', () => {
    expect(source).not.toMatch(/readReport|REPORT_FILE_NAME|report\.md|reportPath/);
    expect(source).not.toMatch(/from '\.\/worker(\.js)?'/);
  });

  it('cannot import the worker role: ESLint rejects it', async () => {
    const code = "import { readReport } from './worker.js';\nexport const r = readReport;\n";
    const [result] = await eslint.lintText(code, {
      filePath: join(repoRoot, 'src', 'roles', 'reviewer.ts'),
    });
    expect((result?.messages ?? []).map((m) => m.ruleId)).toContain('no-restricted-imports');
  }, 60_000);
});
