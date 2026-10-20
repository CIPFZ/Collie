import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner, FakeRunnerError, type FakeScene } from '../src/runner/fake.js';
import type { AgentRunner, RunOptions } from '../src/runner/index.js';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'collie-fake-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function opts(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    role: 'worker',
    prompt: 'do the batch',
    systemPrompt: 'you are R3',
    allowedTools: ['Read', 'Write'],
    cwd,
    maxTurns: 120,
    ...overrides,
  };
}

describe('runner-fake: scripted results', () => {
  it('implements AgentRunner and returns scenes in order', async () => {
    const runner: AgentRunner = new FakeRunner([
      { result: { exitCode: 0, sessionId: 's-1', usage: { inputTokens: 10, outputTokens: 5 } } },
      { result: { exitCode: 3 } },
    ]);
    await expect(runner.run(opts())).resolves.toEqual({
      exitCode: 0,
      sessionId: 's-1',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    await expect(runner.run(opts({ role: 'reviewer' }))).resolves.toEqual({ exitCode: 3 });
  });

  it('throws when the script is exhausted instead of returning silently', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runner.run(opts());
    await expect(runner.run(opts())).rejects.toThrow(FakeRunnerError);
    await expect(runner.run(opts())).rejects.toThrow(/script exhausted: call 3/);
  });

  it('rejects with the scripted error to simulate a crash, after side effects', async () => {
    const runner = new FakeRunner([
      { files: { 'half.txt': 'partial' }, error: new Error('agent crashed') },
    ]);
    await expect(runner.run(opts())).rejects.toThrow('agent crashed');
    expect(readFileSync(join(cwd, 'half.txt'), 'utf8')).toBe('partial');
  });

  it('enforces expectRole', async () => {
    const runner = new FakeRunner([{ expectRole: 'worker', result: { exitCode: 0 } }]);
    await expect(runner.run(opts({ role: 'reviewer' }))).rejects.toThrow(
      'scene 0 expects role worker, got reviewer',
    );
  });

  it('returns finalText, the channel for the reviewer verdict', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0, finalText: '# verdict' } }]);
    await expect(runner.run(opts({ role: 'reviewer' }))).resolves.toEqual({
      exitCode: 0,
      finalText: '# verdict',
    });
  });

  it('returns a copy so callers cannot mutate the script', async () => {
    const scene: FakeScene = { result: { exitCode: 0 } };
    const runner = new FakeRunner([scene, scene]);
    const first = await runner.run(opts());
    first.exitCode = 9;
    await expect(runner.run(opts())).resolves.toEqual({ exitCode: 0 });
  });
});

describe('runner-fake: side effects', () => {
  it('writes scene files under cwd, creating directories', async () => {
    const runner = new FakeRunner([
      {
        files: { '.collie/batches/v01-b03/report.md': '# report\n', 'SPEC.md': 'tampered\n' },
        result: { exitCode: 0 },
      },
    ]);
    await runner.run(opts());
    expect(readFileSync(join(cwd, '.collie/batches/v01-b03/report.md'), 'utf8')).toBe('# report\n');
    expect(readFileSync(join(cwd, 'SPEC.md'), 'utf8')).toBe('tampered\n');
  });

  it.each(['/etc/passwd', '../outside.txt', 'a/../../outside.txt', ''])(
    'rejects scene file path %j at construction',
    (path) => {
      expect(() => new FakeRunner([{ files: { [path]: 'x' }, result: { exitCode: 0 } }])).toThrow(
        FakeRunnerError,
      );
    },
  );

  it('streams scripted events to onEvent in order', async () => {
    const seen: unknown[] = [];
    const runner = new FakeRunner([{ events: [{ type: 'a' }, 'b', 3], result: { exitCode: 0 } }]);
    await runner.run(opts({ onEvent: (e) => seen.push(e) }));
    expect(seen).toEqual([{ type: 'a' }, 'b', 3]);
  });

  it('tolerates events without an onEvent callback', async () => {
    const runner = new FakeRunner([{ events: ['x'], result: { exitCode: 0 } }]);
    await expect(runner.run(opts())).resolves.toEqual({ exitCode: 0 });
  });

  it('runs the effect after files are written, with cwd and the call options', async () => {
    const order: string[] = [];
    const runner = new FakeRunner([
      {
        files: { 'out.txt': 'written' },
        events: ['e'],
        effect: async ({ cwd: effectCwd, opts: effectOpts }) => {
          await Promise.resolve();
          order.push(`effect:${String(existsSync(join(effectCwd, 'out.txt')))}:${effectOpts.role}`);
        },
        result: { exitCode: 0 },
      },
    ]);
    await runner.run(opts({ onEvent: () => order.push('event') }));
    expect(order).toEqual(['event', 'effect:true:worker']);
  });
});

describe('runner-fake: call recording', () => {
  it('records every call with its full parameters', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }, { result: { exitCode: 0 } }]);
    const tools = ['Read', 'Glob'];
    await runner.run(
      opts({ role: 'reviewer', allowedTools: tools, maxTurns: 60, onEvent: () => undefined }),
    );
    tools.push('Write');
    await runner.run(opts());
    expect(runner.calls).toEqual([
      {
        role: 'reviewer',
        prompt: 'do the batch',
        systemPrompt: 'you are R3',
        allowedTools: ['Read', 'Glob'],
        cwd,
        maxTurns: 60,
        hasOnEvent: true,
        hasSignal: false,
        hasOnStarted: false,
      },
      {
        role: 'worker',
        prompt: 'do the batch',
        systemPrompt: 'you are R3',
        allowedTools: ['Read', 'Write'],
        cwd,
        maxTurns: 120,
        hasOnEvent: false,
        hasSignal: false,
        hasOnStarted: false,
      },
    ]);
    expect(runner.remaining).toBe(0);
  });

  it('records calls that fail too', async () => {
    const runner = new FakeRunner([]);
    await expect(runner.run(opts())).rejects.toThrow(FakeRunnerError);
    expect(runner.calls).toHaveLength(1);
  });
});

describe('runner-fake: cancellation (SPEC 3.3)', () => {
  it('records that a signal was passed', async () => {
    const runner = new FakeRunner([{ result: { exitCode: 0 } }]);
    await runner.run(opts({ signal: new AbortController().signal }));
    expect(runner.calls[0]?.hasSignal).toBe(true);
  });

  it('refuses to start when the signal is already aborted, without side effects', async () => {
    const controller = new AbortController();
    controller.abort(new Error('wallclock exceeded'));
    const runner = new FakeRunner([{ files: { 'out.txt': 'x' }, result: { exitCode: 0 } }]);
    await expect(runner.run(opts({ signal: controller.signal }))).rejects.toThrow(
      'wallclock exceeded',
    );
    expect(existsSync(join(cwd, 'out.txt'))).toBe(false);
  });

  it('rejects when the signal aborts during the scene', async () => {
    const controller = new AbortController();
    const runner = new FakeRunner([
      {
        effect: () => {
          controller.abort(new Error('timed out mid-run'));
        },
        result: { exitCode: 0 },
      },
    ]);
    await expect(runner.run(opts({ signal: controller.signal }))).rejects.toThrow(
      'timed out mid-run',
    );
  });
});
