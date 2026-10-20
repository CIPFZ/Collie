// The Claude adapter is tested against a scripted query() double: no SDK, no
// network (CONSTRAINTS 铁律 16). The double receives the exact options Collie
// builds, which is where the role config, abort wiring and event forwarding live.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import {
  CLAUDE_SDK_PACKAGE,
  ClaudeRunner,
  type ClaudeQuery,
  type ClaudeQueryParams,
} from '../src/runner/claude.js';
import type { RunHandle, RunOptions } from '../src/runner/index.js';

const config = loadConfig(join(import.meta.dirname, '..'));

function opts(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    role: 'worker',
    prompt: 'do the batch',
    systemPrompt: 'system',
    allowedTools: config.agent.worker.allowed_tools,
    cwd: '/repo',
    maxTurns: config.agent.worker.max_turns,
    ...overrides,
  };
}

const assistant = (text: string): unknown => ({
  type: 'assistant',
  message: { content: [{ type: 'text', text }] },
});

const success = (result = '# verdict'): unknown => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  result,
  session_id: 'session-1',
  usage: { input_tokens: 1200, output_tokens: 300 },
  total_cost_usd: 0.25,
});

/** A query double that records its params and yields a script. */
function scripted(messages: unknown[]): { query: ClaudeQuery; calls: ClaudeQueryParams[] } {
  const calls: ClaudeQueryParams[] = [];
  const query: ClaudeQuery = async function* (params) {
    calls.push(params);
    await Promise.resolve();
    for (const message of messages) yield message;
  };
  return { query, calls };
}

/** A query double that yields until the caller aborts, then rejects like the SDK does. */
function abortable(): { query: ClaudeQuery; calls: ClaudeQueryParams[] } {
  const calls: ClaudeQueryParams[] = [];
  const query: ClaudeQuery = async function* (params) {
    calls.push(params);
    yield assistant('working');
    await new Promise<void>((resolve) => {
      params.options?.abortController?.signal.addEventListener('abort', () => {
        resolve();
      });
    });
    throw new Error('aborted');
  };
  return { query, calls };
}

describe('runner-claude: options built from the role config', () => {
  it('takes model, tools and turns from the worker config, in the call cwd', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]).toEqual({
      prompt: 'do the batch',
      options: {
        model: config.agent.worker.model,
        maxTurns: config.agent.worker.max_turns,
        systemPrompt: 'system',
        allowedTools: config.agent.worker.allowed_tools,
        cwd: '/repo',
        abortController: expect.any(AbortController) as unknown,
        settingSources: [],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    });
  });

  it('uses the reviewer config for the reviewer role', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
      }),
    );
    expect(calls[0]?.options).toMatchObject({
      model: config.agent.reviewer.model,
      maxTurns: config.agent.reviewer.max_turns,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash'],
    });
  });

  it('maps resumeSessionId to the SDK resume field (SPEC 11.2)', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts({ resumeSessionId: 'session-42' }));
    expect(calls[0]?.options?.resume).toBe('session-42');
  });

  it('does not send resume when resumeSessionId is absent', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]?.options).not.toHaveProperty('resume');
  });

  it('never lets the caller raise the configured turn limit', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts({ maxTurns: 9999 }));
    expect(calls[0]?.options?.maxTurns).toBe(config.agent.worker.max_turns);
  });

  it('refuses tools outside the role whitelist', async () => {
    const { query, calls } = scripted([success()]);
    await expect(
      new ClaudeRunner(config, { query }).run(
        opts({ allowedTools: ['Read', 'Write', 'WebFetch'] }),
      ),
    ).rejects.toThrow('allowedTools Read, Write, WebFetch exceed the worker whitelist');
    expect(calls).toHaveLength(0);
  });

  it('takes permission_mode from the role config and opts in to bypass explicitly', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(config.agent.worker.permission_mode).toBe('bypassPermissions');
    expect(calls[0]?.options).toMatchObject({
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
    });
  });

  it('passes no permission options when the role sets none', async () => {
    const worker: typeof config.agent.worker = { ...config.agent.worker };
    delete worker.permission_mode;
    const plain = { ...config, agent: { ...config.agent, worker } };
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(plain, { query }).run(opts());
    expect(calls[0]?.options).not.toHaveProperty('permissionMode');
    expect(calls[0]?.options).not.toHaveProperty('allowDangerouslySkipPermissions');
  });

  it('never opts in to bypass for a non-bypass mode', async () => {
    const worker = { ...config.agent.worker, permission_mode: 'acceptEdits' as const };
    const edits = { ...config, agent: { ...config.agent, worker } };
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(edits, { query }).run(opts());
    expect(calls[0]?.options?.permissionMode).toBe('acceptEdits');
    expect(calls[0]?.options).not.toHaveProperty('allowDangerouslySkipPermissions');
  });
});

describe('runner-claude: result mapping', () => {
  it('maps a successful result to exit 0, session, usage and finalText', async () => {
    const { query } = scripted([assistant('hello'), success('the answer')]);
    const result = await new ClaudeRunner(config, { query }).run(opts());
    expect(result).toEqual({
      exitCode: 0,
      sessionId: 'session-1',
      usage: { inputTokens: 1200, outputTokens: 300 },
      finalText: 'the answer',
    });
  });

  it.each(['error_during_execution', 'error_max_turns', 'error_max_budget_usd'])(
    'maps subtype %s to exit 1 and no finalText',
    async (subtype) => {
      const { query } = scripted([
        { type: 'result', subtype, is_error: true, errors: ['x'], session_id: 's' },
      ]);
      const result = await new ClaudeRunner(config, { query }).run(opts());
      expect(result).toMatchObject({ exitCode: 1, sessionId: 's' });
      expect(result).not.toHaveProperty('finalText');
      expect(result).not.toHaveProperty('usage');
    },
  );

  it('does not hand out finalText from an is_error result even if it looks successful', async () => {
    const { query } = scripted([
      { type: 'result', subtype: 'success', is_error: true, result: 'partial' },
    ]);
    const result = await new ClaudeRunner(config, { query }).run(opts());
    expect(result).toEqual({ exitCode: 1 });
  });

  it('keeps the last result when a run reports several', async () => {
    const { query } = scripted([
      { type: 'result', subtype: 'success', is_error: false, result: 'first' },
      success('second'),
    ]);
    expect((await new ClaudeRunner(config, { query }).run(opts())).finalText).toBe('second');
  });

  it('rejects when the query ends without a result message', async () => {
    const { query } = scripted([assistant('thinking')]);
    await expect(new ClaudeRunner(config, { query }).run(opts())).rejects.toThrow(
      'ended without a result message',
    );
  });
});

describe('runner-claude: events and cancellation', () => {
  it('forwards every message to onEvent in order', async () => {
    const { query } = scripted([assistant('a'), { type: 'system', subtype: 'init' }, success()]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(opts({ onEvent: (e) => seen.push(e) }));
    expect(seen.map((m) => (m as { type: string }).type)).toEqual([
      'assistant',
      'system',
      'result',
    ]);
  });

  it('does not require an onEvent callback', async () => {
    const { query } = scripted([assistant('a'), success()]);
    await expect(new ClaudeRunner(config, { query }).run(opts())).resolves.toMatchObject({
      exitCode: 0,
    });
  });

  it('aborts the SDK controller when the caller signal aborts, and rejects with its reason', async () => {
    const { query, calls } = abortable();
    const controller = new AbortController();
    const run = new ClaudeRunner(config, { query }).run(opts({ signal: controller.signal }));
    setTimeout(() => {
      controller.abort(new Error('wallclock exceeded'));
    }, 10);
    await expect(run).rejects.toThrow('wallclock exceeded');
    expect(calls[0]?.options?.abortController?.signal.aborted).toBe(true);
  });

  it('does not start when the caller signal is already aborted', async () => {
    const { query, calls } = abortable();
    const signal = AbortSignal.abort(new Error('budget spent'));
    await expect(new ClaudeRunner(config, { query }).run(opts({ signal }))).rejects.toThrow(
      'budget spent',
    );
    // The query is never invoked: no tokens spent on a run that cannot finish.
    expect(calls).toHaveLength(0);
  });

  it('propagates a query failure unchanged', async () => {
    const query: ClaudeQuery = () => ({
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('SDK exploded')) }),
    });
    await expect(new ClaudeRunner(config, { query }).run(opts())).rejects.toThrow('SDK exploded');
  });
});

describe('runner-claude: RunHandle and stop levels (SPEC 11.2)', () => {
  it('calls onStarted with a RunHandle that has no pid (SDK has none)', async () => {
    const { query } = scripted([success()]);
    let handle: unknown;
    await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          handle = h;
        },
      }),
    );
    expect(handle).toBeDefined();
    expect(handle).not.toHaveProperty('pid');
    expect(typeof (handle as { stop: unknown }).stop).toBe('function');
  });

  it('soft stop breaks the stream without aborting the controller', async () => {
    const calls: ClaudeQueryParams[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery demands AsyncIterable
    const query: ClaudeQuery = async function* (params) {
      calls.push(params);
      yield assistant('working');
      // After onStarted fires and soft stop is called, the next yield should cause a break.
      yield assistant('more work');
      yield success('done');
    };
    let handle: RunHandle | undefined;
    const result = await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          handle = h;
          void h.stop('soft');
        },
      }),
    );
    expect(handle).toBeDefined();
    expect(result.stopReason).toBe('stopped');
    expect(result.exitCode).toBe(1);
    // The controller was NOT aborted (soft ≠ hard).
    expect(calls[0]?.options?.abortController?.signal.aborted).toBe(false);
  });

  it('hard stop aborts the controller', async () => {
    const { query, calls } = abortable();
    let handle: RunHandle | undefined;
    const run = new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          handle = h;
        },
      }),
    );
    // Let the query start, then hard stop.
    setTimeout(() => {
      void handle?.stop('hard');
    }, 10);
    await expect(run).rejects.toThrow('aborted');
    expect(calls[0]?.options?.abortController?.signal.aborted).toBe(true);
  });

  it('preserves sessionId when the SDK throws an error (SPEC 11.2)', async () => {
    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery demands AsyncIterable
    const query: ClaudeQuery = async function* () {
      yield { type: 'system', subtype: 'init', session_id: 'rescued-session' };
      yield assistant('working');
      throw new Error('connection lost');
    };
    const result = await new ClaudeRunner(config, { query }).run(opts());
    expect(result.sessionId).toBe('rescued-session');
    expect(result.exitCode).toBe(1);
    expect(result.stopReason).toBe('error');
  });

  it('maps error_max_turns to stopReason turns_exhausted', async () => {
    const { query } = scripted([
      { type: 'result', subtype: 'error_max_turns', is_error: true, session_id: 's' },
    ]);
    const result = await new ClaudeRunner(config, { query }).run(opts());
    expect(result.stopReason).toBe('turns_exhausted');
    expect(result.sessionId).toBe('s');
  });
});

describe('runner-claude: the real SDK is never loaded by these tests', () => {
  it('constructs without the SDK when a query is injected', () => {
    const { query } = scripted([success()]);
    expect(() => new ClaudeRunner(config, { query })).not.toThrow();
  });

  it("names the SDK package as the runner's platform dependency (ADR-004)", () => {
    expect(CLAUDE_SDK_PACKAGE).toBe('@anthropic-ai/claude-agent-sdk');
  });

  it('constructs with the real SDK loader without loading it', () => {
    // Loading happens on the first run only; the tests never trigger it.
    expect(() => new ClaudeRunner(config)).not.toThrow();
  });
});
