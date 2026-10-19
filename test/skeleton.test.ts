import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');

function readText(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function ruleSeverity(config: unknown, rule: string): unknown {
  if (typeof config !== 'object' || config === null || !('rules' in config)) return undefined;
  const rules: unknown = config.rules;
  if (typeof rules !== 'object' || rules === null || !(rule in rules)) return undefined;
  const entry: unknown = (rules as Record<string, unknown>)[rule];
  return Array.isArray(entry) ? entry[0] : entry;
}

describe('skeleton: package.json', () => {
  const pkg: unknown = JSON.parse(readText('package.json'));

  it('is an ESM package named collie with a Node 22 engine constraint', () => {
    expect(pkg).toMatchObject({
      name: 'collie',
      type: 'module',
      engines: { node: expect.stringMatching(/22/) as unknown },
    });
  });

  it('defines lint / typecheck / test / build scripts', () => {
    expect(pkg).toMatchObject({
      scripts: {
        lint: expect.any(String) as unknown,
        typecheck: expect.any(String) as unknown,
        test: expect.any(String) as unknown,
        build: expect.any(String) as unknown,
      },
    });
  });

  it('pins typescript to ~6.0.x (ADR-002 §2)', () => {
    expect(pkg).toMatchObject({
      devDependencies: { typescript: expect.stringMatching(/^~6\.0\./) as unknown },
    });
  });
});

describe('skeleton: .gitignore', () => {
  const lines = readText('.gitignore')
    .split('\n')
    .map((l) => l.trim());

  it.each(['node_modules/', 'dist/', '.collie/runs/', '.collie/heartbeat'])(
    'ignores %s',
    (entry) => {
      expect(lines).toContain(entry);
    },
  );
});

describe('skeleton: eslint rules', () => {
  const eslint = new ESLint({ cwd: root });

  it('treats explicit any as an error in src/ and test/ (CONSTRAINTS 铁律 12)', async () => {
    for (const file of ['src/schema/index.ts', 'test/skeleton.test.ts']) {
      const config: unknown = await eslint.calculateConfigForFile(join(root, file));
      expect(ruleSeverity(config, '@typescript-eslint/no-explicit-any')).toBe(2);
      expect(ruleSeverity(config, '@typescript-eslint/no-unsafe-assignment')).toBe(2);
    }
  });

  it('forbids numeric literals in src/ only (CONSTRAINTS 铁律 11, ADR-002 §4)', async () => {
    const src: unknown = await eslint.calculateConfigForFile(join(root, 'src/schema/index.ts'));
    const test: unknown = await eslint.calculateConfigForFile(join(root, 'test/skeleton.test.ts'));
    for (const rule of ['@typescript-eslint/no-magic-numbers', 'no-restricted-syntax']) {
      expect(ruleSeverity(src, rule)).toBe(2);
      expect(ruleSeverity(test, rule)).toBe(0);
    }
  });

  async function ruleIdsFor(code: string): Promise<(string | null)[]> {
    const [result] = await eslint.lintText(code, { filePath: join(root, 'src/schema/index.ts') });
    return (result?.messages ?? []).map((m) => m.ruleId);
  }

  it('reports explicit any in src/', async () => {
    expect(await ruleIdsFor('export const x: any = 0;\n')).toContain(
      '@typescript-eslint/no-explicit-any',
    );
  });

  it('reports an inline threshold literal in src/', async () => {
    expect(await ruleIdsFor('export const stalled = (s: number): boolean => s > 90;\n')).toContain(
      '@typescript-eslint/no-magic-numbers',
    );
  });

  it('reports a threshold hidden behind a named const in src/', async () => {
    // no-magic-numbers alone accepts this; no-restricted-syntax must catch it.
    expect(await ruleIdsFor('export const stallSecs = 90;\n')).toContain('no-restricted-syntax');
  });

  it('accepts 0 and 1 in src/', async () => {
    expect(
      await ruleIdsFor('export const first = (xs: number[]): number => xs[0] ?? -1;\n'),
    ).toEqual([]);
  });
});

describe('skeleton: import isolation (CONSTRAINTS 铁律 15)', () => {
  const eslint = new ESLint({ cwd: root });
  const SDK = "import { query } from '@anthropic-ai/claude-agent-sdk';\nexport const q = query;\n";

  async function restrictedImports(file: string, code: string): Promise<number> {
    // Only lint paths that exist so type-aware rules can resolve the file.
    const [result] = await eslint.lintText(code, { filePath: join(root, file) });
    return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports').length;
  }

  it('forbids agent SDK imports in src/ outside src/runner/', async () => {
    expect(await restrictedImports('src/schema/index.ts', SDK)).toBe(1);
    expect(await restrictedImports('src/journal.ts', SDK)).toBe(1);
  });

  it('allows agent SDK imports inside src/runner/', async () => {
    expect(await restrictedImports('src/runner/fake.ts', SDK)).toBe(0);
  });

  it.each([
    "import { FakeRunner } from '../runner/fake.js';\nexport const f = FakeRunner;\n",
    "import { FakeRunner } from '../runner/fake';\nexport const f = FakeRunner;\n",
    "export { FakeRunner } from '../runner/fake.js';\n",
    "import type { FakeScene } from '../runner/fake.js';\nexport type S = FakeScene;\n",
    SDK,
  ])('forbids the fake runner and the SDK in src/roles/: %j', async (code) => {
    expect(await restrictedImports('src/roles/worker.ts', code)).toBe(1);
  });

  it('allows the runner interface in src/roles/', async () => {
    const code =
      "import type { AgentRunner } from '../runner/index.js';\nexport type R = AgentRunner;\n";
    expect(await restrictedImports('src/roles/worker.ts', code)).toBe(0);
  });

  it('configures src/roles/ to forbid both the SDK and the fake runner', async () => {
    const config: unknown = await eslint.calculateConfigForFile(join(root, 'src/roles/worker.ts'));
    const entry =
      typeof config === 'object' && config !== null && 'rules' in config
        ? (config.rules as Record<string, unknown>)['no-restricted-imports']
        : undefined;
    expect(JSON.stringify(entry)).toContain('@anthropic-ai/*');
    expect(JSON.stringify(entry)).toContain('runner/');
  });
});

describe('skeleton: CI workflow', () => {
  it('listens on push to main (CONSTRAINTS 铁律 5)', () => {
    expect(readText('.github/workflows/ci.yml')).toMatch(/push:\s*\n\s*branches:\s*\[\s*main\s*\]/);
  });
});
