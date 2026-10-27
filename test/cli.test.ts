import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUDIT_EXIT, runIdAt } from '../src/cli.js';
import { loadConfig, parseConfig } from '../src/config.js';
import { git, log } from '../src/git.js';
import { EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from '../src/journal.js';
import { REVIEWER_STREAM_FILE_NAME } from '../src/run.js';
import { FakeRunner } from '../src/runner/fake.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

const repoRoot = join(import.meta.dirname, '..');

describe('cli: init template', () => {
  it('renders to exactly the SPEC 3.1 config the repository uses (no drift)', () => {
    const text = readFileSync(join(repoRoot, 'templates', 'collie.toml'), 'utf8')
      .replace('"{{name}}"', '"collie"')
      .replace('"{{repo}}"', '"https://github.com/CIPFZ/Collie"');
    expect(parseConfig(text, 'template')).toEqual(loadConfig(repoRoot));
  });
});

describe('cli: run ids', () => {
  it('derives a path-safe run id from the clock', () => {
    expect(runIdAt(new Date('2026-10-19T11:46:06.789Z'))).toBe('r-20261019-114606');
  });
});

describe('cli: init, show and the R2 commits', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('init refuses to overwrite an existing collie.toml', async () => {
    expect(await box.cli(['init'], undefined)).toBe(1);
    expect(box.output.join('')).toContain('already exists');
  });

  it('init derives the repo from an SSH origin and keeps .gitignore entries unique', async () => {
    await git(box.root, ['remote', 'set-url', 'origin', 'git@github.com:Acme/widgets.git']);
    expect(await box.cli(['init', '--force', '--name', 'widgets'], undefined)).toBe(0);
    const config = loadConfig(box.root);
    expect(config.project).toEqual({ name: 'widgets', repo: 'https://github.com/Acme/widgets' });
    expect(config.limits).toEqual(loadConfig(repoRoot).limits);
    expect(
      box
        .read('.gitignore')
        .split('\n')
        .filter((l) => l === '.collie/runs/'),
    ).toHaveLength(1);
  });

  it('init asks for --repo when origin is not GitHub', async () => {
    await git(box.root, ['remote', 'set-url', 'origin', 'https://gitlab.example/a/b.git']);
    expect(await box.cli(['init', '--force'], undefined)).toBe(1);
    expect(box.output.join('')).toContain('pass --repo <url>');
  });

  it('show prints acceptance commands in their parsed form', async () => {
    expect(await box.cli(['show', BATCH], undefined)).toBe(0);
    const shown = box.output.join('');
    expect(shown).toContain('acceptance commands (parsed, run these verbatim):');
    expect(shown).toContain('   sh run-tests.sh');
    expect(shown).toContain('== report.md ==\n(none)');
  });

  it('show rejects an unknown batch with exit 1', async () => {
    expect(await box.cli(['show', 'v99-b99'], undefined)).toBe(1);
  });

  it('run commits the task envelope before the worker and verdict + progress after', async () => {
    const before = (await git(box.root, ['rev-parse', 'HEAD'])).trim();
    const r = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    expect(await box.run(r)).toBe(0);
    const subjects = (await log(box.root, before, 'HEAD')).map((c) => c.subject);
    expect(subjects).toEqual([
      `docs: issue ${BATCH} task envelope`,
      'feat: add feature with tests',
      `report(collie): ${BATCH}`,
      `progress: ${BATCH} PASS`,
    ]);
    expect(
      (await git(box.root, ['show', '--name-only', '--format=', 'HEAD'])).trim().split('\n').sort(),
    ).toEqual([`.collie/batches/${BATCH}/verdict.md`, 'docs/progress.md']);
  });

  it('run keeps the hand-written part of docs/progress.md', async () => {
    const r = new FakeRunner([
      workerScene(box, { passing: 2, failing: 0, push: true, claims: honestClaims(2, true) }),
      fooledReviewerScene(box),
    ]);
    await box.run(r);
    const progress = box.read('docs/progress.md');
    expect(progress.startsWith('# 进度\n\n人工维护的内容，Collie 不得改动。\n')).toBe(true);
    expect(progress).toContain(`### ${BATCH} · r-20261019-120000 · PASS`);
  });

  it('run --runner fake uses an unscripted fake that fails loudly (wiring check)', async () => {
    expect(await box.cli(['run', BATCH, '--runner', 'fake'], undefined)).toBe(20);
    expect(box.events().find((e) => e.event === 'worker.crashed')).toMatchObject({
      error: expect.stringContaining('script exhausted') as unknown,
    });
  });

  it('escalation path summary does not print "rule 0:" (v03-b03-fix)', async () => {
    // A worker that produces no report triggers the escalation path.
    const r = new FakeRunner([{ result: { exitCode: 0 } }]);
    const code = await box.run(r);
    expect(code).toBe(20);
    const output = box.output.join('');
    // Must NOT contain "rule 0:" in the summary line.
    expect(output).not.toContain('rule 0:');
    // Must contain the new "上报：无 report" format.
    expect(output).toContain('上报：无 report');
  });

  it('run rejects an unknown --runner', async () => {
    expect(await box.cli(['run', BATCH, '--runner', 'gpt'], undefined)).toBe(1);
    expect(box.output.join('')).toContain('unknown runner "gpt"');
  });

  it('smoke succeeds with a fake runner that returns a RunResult', async () => {
    const r = new FakeRunner([
      {
        result: {
          exitCode: 0,
          sessionId: 'smoke-session',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      },
    ]);
    expect(await box.cli(['smoke'], r)).toBe(0);
    const output = box.output.join('');
    expect(output).toContain('smoke ok');
    expect(output).toContain('exitCode=0');
    expect(output).toContain('sessionId=smoke-session');
    expect(output).toContain('usage=');
  });

  it('smoke returns exit 1 when the runner throws', async () => {
    const r = new FakeRunner([{ error: new Error('cannot connect') }]);
    expect(await box.cli(['smoke'], r)).toBe(1);
    const output = box.output.join('');
    expect(output).toContain('smoke failed');
    expect(output).toContain('cannot connect');
  });
});

describe('cli: audit reviewer tool whitelist (SPEC 11.2 v03-b02)', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  const RUN_ID = 'r-20261019-120000';

  /** Write a reviewer.stream.ndjson with the given lines as raw JSON. */
  function writeStream(lines: unknown[]): void {
    const dir = join(box.root, RUNS_RELATIVE_DIR, RUN_ID);
    mkdirSync(dir, { recursive: true });
    const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
    writeFileSync(join(dir, REVIEWER_STREAM_FILE_NAME), content);
  }

  it('exit 0 when init tools match reviewer whitelist', async () => {
    const config = loadConfig(box.root);
    const tools = config.agent.reviewer.allowed_tools;
    writeStream([
      { type: 'system', subtype: 'init', tools },
      { type: 'result', subtype: 'success' },
    ]);
    expect(await box.cli(['audit', RUN_ID], undefined)).toBe(AUDIT_EXIT.MATCH);
    expect(box.output.join('')).toContain('tools match');
  });

  it('exit 1 when init tools do not match reviewer whitelist', async () => {
    writeStream([
      { type: 'system', subtype: 'init', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'] },
      { type: 'result', subtype: 'success' },
    ]);
    expect(await box.cli(['audit', RUN_ID], undefined)).toBe(AUDIT_EXIT.MISMATCH);
    const output = box.output.join('');
    expect(output).toContain('mismatch');
    expect(output).toContain('extra: Write');
  });

  it('exit 2 when reviewer.stream.ndjson is missing', async () => {
    expect(await box.cli(['audit', RUN_ID], undefined)).toBe(AUDIT_EXIT.NO_DATA);
    // SPEC (v03-b03-fix): message says "nothing to audit" for escalation/crash path.
    expect(box.output.join('')).toContain('nothing to audit');
  });

  it('exit 2 when no init message exists in the stream', async () => {
    writeStream([
      { type: 'assistant', content: [{ type: 'text', text: 'hello' }] },
      { type: 'result', subtype: 'success' },
    ]);
    expect(await box.cli(['audit', RUN_ID], undefined)).toBe(AUDIT_EXIT.NO_DATA);
    expect(box.output.join('')).toContain('no init message');
  });
});

describe('cli: show --queue (v03-b04-fix)', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });

  afterEach(() => {
    box.dispose();
  });

  it('prints the queue journal timeline for a given q-run_id', async () => {
    const qRunId = 'q-20261019120000';
    const dir = join(box.root, RUNS_RELATIVE_DIR, qRunId);
    mkdirSync(dir, { recursive: true });
    const events = [
      {
        ts: '2026-10-19T12:00:00Z',
        run_id: qRunId,
        event: 'queue.batch_started',
        batch_id: 'v99-b01',
        attempt: 1,
        why: 'new',
      },
      {
        ts: '2026-10-19T12:00:01Z',
        run_id: qRunId,
        event: 'queue.finished',
        reason: 'exhausted',
        batches: [{ batch_id: 'v99-b01', run_id: 'r-20261019120000', verdict: 'PASS' }],
        paused_count: 0,
      },
    ];
    writeFileSync(
      join(dir, EVENTS_FILE_NAME),
      events.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );
    expect(await box.cli(['show', '--queue', qRunId], undefined)).toBe(0);
    const output = box.output.join('');
    expect(output).toContain('queue.batch_started');
    expect(output).toContain('queue.finished');
    expect(output).toContain(qRunId);
  });

  it('returns exit 1 when no journal exists for the queue run id', async () => {
    expect(await box.cli(['show', '--queue', 'q-99999999999999'], undefined)).toBe(1);
    expect(box.output.join('')).toContain('no journal found');
  });
});
