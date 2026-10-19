import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runIdAt } from '../src/cli.js';
import { loadConfig, parseConfig } from '../src/config.js';
import { git, log } from '../src/git.js';
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
});
