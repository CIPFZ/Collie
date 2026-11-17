// Tests for the tester role module (SPEC 16.10, v046-b02).
// Uses FakeRunner — no real agent, no network (CONSTRAINTS 铁律 16).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeRunner } from '../src/runner/fake.js';
import type { RunResult } from '../src/runner/index.js';
import {
  TESTER_MANUAL,
  TesterError,
  TesterInputSchema,
  buildTesterPrompt,
  runTester,
  type TesterInput,
} from '../src/roles/tester.js';
import { templateConfig } from './support/template-config.js';

const config = templateConfig();

function validInput(overrides: Partial<TesterInput> = {}): TesterInput {
  return {
    batch_id: 'v046-b02',
    scenarios: [
      { id: 'S1', kind: 'new', text: 'do something new' },
      { id: 'S2', kind: 'new', text: 'do another new thing' },
      { id: 'K1', kind: 'keep', text: 'keep this behavior' },
    ],
    interfaces: ['src/feature.ts exportName'],
    spec_paths: ['SPEC.md'],
    out_dir: 'test/acceptance/v046-b02',
    ...overrides,
  };
}

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'collie-tester-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const OK_RESULT: RunResult = { exitCode: 0, finalText: 'done' };

describe('tester: TESTER_MANUAL constant', () => {
  it('equals AGENT-tester.md', () => {
    expect(TESTER_MANUAL).toBe('AGENT-tester.md');
  });
});

describe('tester: TesterInputSchema validation', () => {
  it('accepts a valid input with exactly five fields', () => {
    const result = TesterInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('rejects an extra field (strict object)', () => {
    const result = TesterInputSchema.safeParse({ ...validInput(), extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects when batch_id is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring to remove batch_id
    const { batch_id, ...rest } = validInput();
    const result = TesterInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects when out_dir is empty', () => {
    const result = TesterInputSchema.safeParse(validInput({ out_dir: '' }));
    expect(result.success).toBe(false);
  });
});

describe('tester: buildTesterPrompt', () => {
  it('includes the batch_id in the prompt', () => {
    const prompt = buildTesterPrompt(validInput());
    expect(prompt).toContain('v046-b02');
  });

  it('includes scenario text verbatim', () => {
    const prompt = buildTesterPrompt(
      validInput({
        scenarios: [{ id: 'S1', kind: 'new', text: 'exact scenario text here' }],
      }),
    );
    expect(prompt).toContain('exact scenario text here');
  });

  it('includes SPEC paths', () => {
    const prompt = buildTesterPrompt(validInput({ spec_paths: ['SPEC.md', 'CONSTRAINTS.md'] }));
    expect(prompt).toContain('SPEC.md');
    expect(prompt).toContain('CONSTRAINTS.md');
  });

  it('includes output directory and the three file names', () => {
    const prompt = buildTesterPrompt(validInput({ out_dir: 'test/acceptance/v099' }));
    expect(prompt).toContain('test/acceptance/v099');
    expect(prompt).toContain('new.test.ts');
    expect(prompt).toContain('keep.test.ts');
    expect(prompt).toContain('MAP.md');
  });

  it('includes self-check vitest commands and lint/typecheck when only new scenarios', () => {
    const prompt = buildTesterPrompt(
      validInput({
        out_dir: 'test/acceptance/v099',
        scenarios: [
          { id: 'S1', kind: 'new', text: 'new feature A' },
          { id: 'S2', kind: 'new', text: 'new feature B' },
        ],
      }),
    );
    expect(prompt).toContain('npx vitest run test/acceptance/v099/new.test.ts');
    expect(prompt).not.toContain('keep.test.ts');
    expect(prompt).toContain('npm run lint');
    expect(prompt).toContain('npm run typecheck');
  });

  it('includes keep.test.ts and its self-check command when keep scenarios exist', () => {
    const prompt = buildTesterPrompt(
      validInput({
        out_dir: 'test/acceptance/v099',
        scenarios: [
          { id: 'S1', kind: 'new', text: 'new behavior' },
          { id: 'K1', kind: 'keep', text: 'must keep this' },
        ],
      }),
    );
    expect(prompt).toContain('npx vitest run test/acceptance/v099/new.test.ts');
    expect(prompt).toContain('npx vitest run test/acceptance/v099/keep.test.ts');
    expect(prompt).toContain('keep.test.ts');
    expect(prompt).toContain('npm run lint');
    expect(prompt).toContain('npm run typecheck');
  });

  it('throws TesterError on invalid input', () => {
    expect(() => buildTesterPrompt({ ...validInput(), batch_id: '' })).toThrow(TesterError);
  });
});

describe('tester: runTester launches the agent correctly', () => {
  it('calls runner.run with role tester and the tester config', async () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, TESTER_MANUAL), '# tester manual');
    const runner = new FakeRunner([{ result: OK_RESULT, expectRole: 'tester' }]);
    await runTester(runner, config, validInput(), cwd);
    expect(runner.calls).toHaveLength(1);
    const call = runner.calls[0];
    expect(call).toBeDefined();
    expect(call?.role).toBe('tester');
    expect(call?.systemPrompt).toBe('# tester manual');
    const tester = config.agent.tester;
    expect(tester).toBeDefined();
    expect(call?.maxTurns).toBe(tester?.max_turns);
    expect(call?.allowedTools).toEqual(tester?.allowed_tools);
  });

  it('throws TesterError when config has no [agent.tester] section', async () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, TESTER_MANUAL), '# tester manual');
    const noTester = {
      ...config,
      agent: { worker: config.agent.worker, reviewer: config.agent.reviewer },
    };
    const runner = new FakeRunner([{ result: OK_RESULT }]);
    await expect(runTester(runner, noTester, validInput(), cwd)).rejects.toThrow('[agent.tester]');
    await expect(runTester(runner, noTester, validInput(), cwd)).rejects.toThrow(TesterError);
  });

  it('passes the prompt containing the batch_id to the runner', async () => {
    const cwd = tempDir();
    writeFileSync(join(cwd, TESTER_MANUAL), '# manual');
    const runner = new FakeRunner([{ result: OK_RESULT }]);
    await runTester(runner, config, validInput({ batch_id: 'v099-b01' }), cwd);
    expect(runner.calls[0]?.prompt).toContain('v099-b01');
  });
});

describe('tester: source does not reference report.md', () => {
  it('tester.ts source code does not contain report.md', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'roles', 'tester.ts'), 'utf8');
    expect(src).not.toContain('report.md');
  });
});

describe('tester: scenarios in the prompt', () => {
  it('only-new scenarios: prompt does not mention keep.test.ts anywhere', () => {
    const prompt = buildTesterPrompt(
      validInput({
        scenarios: [
          { id: 'S1', kind: 'new', text: 'new feature A' },
          { id: 'S2', kind: 'new', text: 'new feature B' },
        ],
      }),
    );
    expect(prompt).not.toContain('keep.test.ts');
    expect(prompt).toContain('new.test.ts');
    expect(prompt).toContain('MAP.md');
  });

  it('with keep scenarios: keep.test.ts and its self-check command are present', () => {
    const prompt = buildTesterPrompt(
      validInput({
        scenarios: [
          { id: 'S1', kind: 'new', text: 'new feature A' },
          { id: 'K1', kind: 'keep', text: 'must keep this' },
        ],
      }),
    );
    expect(prompt).toContain('keep.test.ts');
    expect(prompt).toContain('npx vitest run test/acceptance/v046-b02/keep.test.ts');
  });

  it('新行为 group appears before 必须保持 group', () => {
    const prompt = buildTesterPrompt(
      validInput({
        scenarios: [
          { id: 'S1', kind: 'new', text: 'new feature' },
          { id: 'K1', kind: 'keep', text: 'keep behavior' },
        ],
      }),
    );
    const newIdx = prompt.indexOf('### 新行为');
    const keepIdx = prompt.indexOf('### 必须保持');
    expect(newIdx).toBeGreaterThanOrEqual(0);
    expect(keepIdx).toBeGreaterThan(newIdx);
  });

  it('interfaces section shows （未指定） when empty', () => {
    const prompt = buildTesterPrompt(validInput({ interfaces: [] }));
    expect(prompt).toContain('（未指定）');
  });

  it('self-check commands include npm run lint and npm run typecheck', () => {
    const prompt = buildTesterPrompt(validInput());
    const shBlock = prompt.slice(prompt.indexOf('```sh'));
    expect(shBlock).toContain('npm run lint');
    expect(shBlock).toContain('npm run typecheck');
  });
});
