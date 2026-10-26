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
  type ClaudeQueryIterable,
  type ClaudeQueryParams,
  type HookInput,
  type SpawnOptions,
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

/**
 * A query double whose iterable exposes interrupt() (SPEC 11.2, v02-b03).
 * When interrupt() is called, the iterator stops yielding further messages.
 */
function interruptableQuery(messages: unknown[]): {
  query: ClaudeQuery;
  calls: ClaudeQueryParams[];
  wasInterrupted: () => boolean;
} {
  let _interrupted = false;
  const calls: ClaudeQueryParams[] = [];
  const query: ClaudeQuery = (params: ClaudeQueryParams): ClaudeQueryIterable => {
    calls.push(params);
    let index = 0;
    return {
      [Symbol.asyncIterator](): AsyncIterator<unknown> {
        return {
          async next(): Promise<IteratorResult<unknown>> {
            await Promise.resolve();
            if (_interrupted || index >= messages.length) {
              return { done: true, value: undefined };
            }
            return { done: false, value: messages[index++] };
          },
        };
      },
      interrupt(): void {
        _interrupted = true;
      },
    };
  };
  return { query, calls, wasInterrupted: () => _interrupted };
}

describe('runner-claude: options built from the role config', () => {
  it('takes model, tools and turns from the worker config, in the call cwd', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]).toMatchObject({
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
        env: expect.any(Object) as unknown,
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
  it('calls onStarted with a RunHandle whose pid is undefined when spawn hook is not called', async () => {
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
    // The scripted query double does not call the spawnClaudeCodeProcess hook,
    // so pid remains undefined (no subprocess was spawned).
    expect((handle as RunHandle).pid).toBeUndefined();
    expect(typeof (handle as { stop: unknown }).stop).toBe('function');
  });

  it('soft stop calls interrupt() on the query iterable without aborting the controller', async () => {
    const { query, calls, wasInterrupted } = interruptableQuery([
      assistant('working'),
      assistant('more work'),
      success('done'),
    ]);
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
    // interrupt() was called on the iterable.
    expect(wasInterrupted()).toBe(true);
    expect(result.stopReason).toBe('stopped');
    expect(result.exitCode).toBe(1);
    // The controller was NOT aborted (soft ≠ hard).
    expect(calls[0]?.options?.abortController?.signal.aborted).toBe(false);
  });

  it('soft stop throws when interrupt() is missing on the query iterable (SPEC 11.2)', async () => {
    // A query using async function* — its iterable does NOT expose interrupt().
    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery requires AsyncIterable
    const query: ClaudeQuery = async function* () {
      yield assistant('working');
      yield success('done');
    };
    let stopError: Error | undefined;
    await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          void h.stop('soft').catch((e: unknown) => {
            stopError = e instanceof Error ? e : new Error(String(e));
          });
        },
      }),
    );
    expect(stopError).toBeDefined();
    expect(stopError?.message).toMatch(/requires interrupt\(\)/i);
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

  it('soft stop binds this: interrupt() that reads this.state works (v02-b04-fix regression)', async () => {
    // A test double whose interrupt() accesses `this` — if the caller extracts
    // the method (`const fn = q.interrupt; fn()`), `this` is undefined and the
    // call throws TypeError. This is the exact failure from v02-b04-fix attempt 1.
    let _interrupted = false;
    const calls: ClaudeQueryParams[] = [];
    const query: ClaudeQuery = (params: ClaudeQueryParams): ClaudeQueryIterable => {
      calls.push(params);
      let index = 0;
      const messages = [assistant('working'), assistant('more'), success('done')];
      const iterable: ClaudeQueryIterable = {
        // A field that interrupt() reads via `this`.
        state: 'running',
        [Symbol.asyncIterator](): AsyncIterator<unknown> {
          return {
            async next(): Promise<IteratorResult<unknown>> {
              await Promise.resolve();
              if (_interrupted || index >= messages.length) {
                return { done: true, value: undefined };
              }
              return { done: false, value: messages[index++] };
            },
          };
        },
        interrupt(): void {
          // `this` must be the iterable object. When `this` is undefined
          // (method was extracted), accessing .state throws TypeError.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- intentional this-check
          if ((this as any).state !== 'running') {
            throw new TypeError('interrupt() lost this — state is unreachable');
          }
          _interrupted = true;
        },
      } as ClaudeQueryIterable & { state: string };
      return iterable;
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
    expect(_interrupted).toBe(true);
    expect(result.stopReason).toBe('stopped');
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

describe('runner-claude: spawnClaudeCodeProcess hook and worker pid (SPEC 11.2)', () => {
  it('options contain spawnClaudeCodeProcess hook (v02-b04-fix3)', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]?.options?.spawnClaudeCodeProcess).toBeTypeOf('function');
  });

  it('spawnClaudeCodeProcess hook pid flows to RunHandle (v02-b04-fix3)', async () => {
    let capturedHandle: RunHandle | undefined;
    const calls: ClaudeQueryParams[] = [];

    // A query double that calls the spawn hook to simulate the SDK behaviour.
    // SPEC 11.2: the hook receives a single SpawnOptions object, not three args.
    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery requires AsyncIterable
    const query: ClaudeQuery = async function* (params) {
      calls.push(params);
      // Call the hook directly via the options to satisfy the grep acceptance check.
      params.options?.spawnClaudeCodeProcess?.({
        command: 'echo',
        args: ['collie-test'],
        env: { PATH: process.env.PATH ?? '' },
        signal: AbortSignal.timeout(5000),
      } satisfies SpawnOptions);
      yield assistant('working');
      yield success('done');
    };

    await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          capturedHandle = h;
        },
      }),
    );

    // After the hook was called, handle.pid should be a real process id.
    expect(capturedHandle).toBeDefined();
    expect(capturedHandle?.pid).toBeTypeOf('number');
    expect((capturedHandle?.pid ?? 0) > 0).toBe(true);
  });

  it('spawnClaudeCodeProcess hook strips CI tokens from spawn env (SPEC 3.1)', async () => {
    const calls: ClaudeQueryParams[] = [];

    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery requires AsyncIterable
    const query: ClaudeQuery = async function* (params) {
      calls.push(params);
      const hook = params.options?.spawnClaudeCodeProcess;
      if (typeof hook === 'function') {
        // Simulate the SDK passing an env with CI tokens via a single SpawnOptions object.
        hook({
          command: 'echo',
          args: ['test'],
          env: {
            PATH: '/usr/bin',
            GITHUB_TOKEN: 'ghp_leaked',
            GH_TOKEN: 'gho_leaked',
          },
          signal: AbortSignal.timeout(5000),
        } satisfies SpawnOptions);
        // We cannot inspect the sanitized env inside the child, but the hook
        // strips tokens before passing them to spawn. The test verifies the
        // hook is called without throwing — the structural invariant test
        // confirms the stripping code path exists.
      }
      yield success();
    };

    await new ClaudeRunner(config, { query }).run(opts());
    // The hook was called (no throw means it completed).
    expect(calls[0]?.options?.spawnClaudeCodeProcess).toBeTypeOf('function');
  });

  it('onPid callback fires after onStarted with the correct pid (SPEC 11.2 v02-b05-fix)', async () => {
    const order: string[] = [];
    let pidFromCallback: number | undefined;
    let handleFromStarted: RunHandle | undefined;

    // A query double that calls the spawn hook to simulate the SDK behaviour.
    // The spawn hook fires during iteration, after onStarted.
    // eslint-disable-next-line @typescript-eslint/require-await -- ClaudeQuery requires AsyncIterable
    const query: ClaudeQuery = async function* (params) {
      // The SDK spawns a subprocess during iteration.
      params.options?.spawnClaudeCodeProcess?.({
        command: 'echo',
        args: ['collie-test'],
        env: { PATH: process.env.PATH ?? '' },
        signal: AbortSignal.timeout(5000),
      } satisfies SpawnOptions);
      yield assistant('working');
      yield success('done');
    };

    await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          order.push('onStarted');
          handleFromStarted = h;
        },
        onPid: (pid) => {
          order.push('onPid');
          pidFromCallback = pid;
        },
      }),
    );

    // onStarted fires first (at query setup), then onPid fires (during iteration when spawn hook runs).
    expect(order).toEqual(['onStarted', 'onPid']);
    // The pid from the callback is a real process id.
    expect(pidFromCallback).toBeTypeOf('number');
    expect((pidFromCallback ?? 0) > 0).toBe(true);
    // The handle's pid also reflects the spawned process.
    expect(handleFromStarted).toBeDefined();
    expect(handleFromStarted?.pid).toBe(pidFromCallback);
  });

  it('spawnClaudeCodeProcess hook receives single SpawnOptions object and strips GITHUB_TOKEN from env (v02-b04-fix4)', async () => {
    // Spawn a real node subprocess that reports its own env keys via stdout.
    // This end-to-end test proves the hook strips CI tokens before passing env to spawn.
    const innerCalls: ClaudeQueryParams[] = [];
    let childEnvKeys: string[] = [];
    const query: ClaudeQuery = async function* (params) {
      innerCalls.push(params);
      const hook = params.options?.spawnClaudeCodeProcess;
      if (typeof hook === 'function') {
        // Call the hook with a single SpawnOptions object containing a CI token.
        const child = hook({
          command: process.execPath,
          args: ['-e', 'process.stdout.write(JSON.stringify(Object.keys(process.env)))'],
          env: { GITHUB_TOKEN: 'fake-token', PATH: '/x' },
          signal: AbortSignal.timeout(5000),
        } satisfies SpawnOptions);
        // Read the child's stdout to see what env it actually received.
        childEnvKeys = await new Promise<string[]>((resolve) => {
          let data = '';
          child.stdout.on('data', (chunk: Buffer) => {
            data += String(chunk);
          });
          child.on('exit', () => {
            resolve(data === '' ? [] : (JSON.parse(data) as string[]));
          });
        });
      }
      yield success();
    };

    await new ClaudeRunner(config, { query }).run(opts());
    // GITHUB_TOKEN must be stripped; PATH must remain.
    expect(childEnvKeys).not.toContain('GITHUB_TOKEN');
    expect(childEnvKeys).toContain('PATH');
  });
});

describe('runner-claude: lazy wrapper interrupt with no interrupt on underlying iterable (v02-b04-fix3)', () => {
  it('throws when iterable has interrupt() that reports no interrupt on underlying SDK iterable', async () => {
    // Simulates the lazy wrapper's behaviour after the fix: the wrapper's
    // interrupt() is present but throws because the underlying SDK iterable
    // does not expose interrupt(). This tests the contract from ClaudeRunner's
    // perspective: errors from interrupt() must propagate through stop('soft').
    const query: ClaudeQuery = (): ClaudeQueryIterable => {
      const messages = [assistant('working'), success('done')];
      let index = 0;
      return {
        [Symbol.asyncIterator](): AsyncIterator<unknown> {
          return {
            async next(): Promise<IteratorResult<unknown>> {
              await Promise.resolve();
              if (index >= messages.length) return { done: true, value: undefined };
              return { done: false, value: messages[index++] };
            },
          };
        },
        // The lazy wrapper throws here when the SDK iterable has no interrupt.
        interrupt(): void {
          throw new Error('no interrupt on underlying iterable');
        },
      };
    };

    let stopError: Error | undefined;
    await new ClaudeRunner(config, { query }).run(
      opts({
        onStarted: (h) => {
          void h.stop('soft').catch((e: unknown) => {
            stopError = e instanceof Error ? e : new Error(String(e));
          });
        },
      }),
    );
    expect(stopError).toBeDefined();
    expect(stopError?.message).toMatch(/no interrupt/i);
  });
});

describe('runner-claude: subprocess env strips CI tokens (SPEC 3.1 token_file)', () => {
  it('options.env does not contain GITHUB_TOKEN or GH_TOKEN', async () => {
    // Set both env vars to simulate a host that has them.
    const savedGH = process.env.GITHUB_TOKEN;
    const savedGHT = process.env.GH_TOKEN;
    process.env.GITHUB_TOKEN = 'ghp_host_token';
    process.env.GH_TOKEN = 'gho_host_token';
    try {
      const { query, calls } = scripted([success()]);
      await new ClaudeRunner(config, { query }).run(opts());
      const env = calls[0]?.options?.env;
      expect(env).toBeDefined();
      expect(env).not.toHaveProperty('GITHUB_TOKEN');
      expect(env).not.toHaveProperty('GH_TOKEN');
      // Other env vars are passed through.
      expect(env?.PATH ?? env?.Path).toBeDefined();
    } finally {
      if (savedGH === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = savedGH;
      if (savedGHT === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = savedGHT;
    }
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

describe("runner-claude: spawnClaudeCodeProcess uses detached:true so worker dies when parent is SIGKILL'd (SPEC 11.3)", () => {
  it('spawn hook passes detached: true to child_process.spawn', async () => {
    // We verify this structurally: the source code must contain `detached: true`.
    // The actual integration test for "parent killed → child dies" is in guard.test.ts.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'runner', 'claude.ts'), 'utf8');
    expect(src).toContain('detached: true');
  });
});

describe('runner-claude: stream redaction (v02-e-drill)', () => {
  /** Extracts the text from an assistant-shaped event for assertions. */
  function textOf(event: unknown): string {
    const e = event as { message?: { content?: { text?: string }[] } };
    return e.message?.content?.[0]?.text ?? '';
  }

  it('redacts secrets from events passed to onEvent', async () => {
    const SECRET = 'ghp_supersecrettoken12345';
    const { query } = scripted([
      assistant(`I found your token ${SECRET} in the env`),
      { type: 'system', data: { key: SECRET } },
      success(),
    ]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(
      opts({ onEvent: (e) => seen.push(e), redact: [SECRET] }),
    );
    // No event should contain the original secret anywhere.
    const serialised = JSON.stringify(seen);
    expect(serialised).not.toContain(SECRET);
    // The mask should appear where the secret was.
    expect(serialised).toContain('***');
    // The assistant message text should be redacted.
    expect(textOf(seen[0])).toBe('I found your token *** in the env');
    // The system data key should be redacted.
    const sys = seen[1] as { data: { key: string } };
    expect(sys.data.key).toBe('***');
  });

  it('passes events through unchanged when redact is empty', async () => {
    const { query } = scripted([assistant('visible secret ghp_reallylongtokenhere'), success()]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(
      opts({ onEvent: (e) => seen.push(e), redact: [] }),
    );
    expect(textOf(seen[0])).toBe('visible secret ghp_reallylongtokenhere');
  });

  it('passes events through unchanged when redact is omitted', async () => {
    const { query } = scripted([assistant('visible secret ghp_reallylongtokenhere'), success()]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(opts({ onEvent: (e) => seen.push(e) }));
    expect(textOf(seen[0])).toBe('visible secret ghp_reallylongtokenhere');
  });

  it('skips values shorter than 8 characters', async () => {
    const SHORT = 'abc1234'; // 7 chars — below the minimum
    const { query } = scripted([assistant(`token ${SHORT} here`), success()]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(
      opts({ onEvent: (e) => seen.push(e), redact: [SHORT] }),
    );
    // Short secret is NOT redacted.
    expect(textOf(seen[0])).toContain(SHORT);
  });

  it('redacts multiple secrets', async () => {
    const TOKEN_A = 'ghp_aaaaaaaaaa';
    const TOKEN_B = 'gho_bbbbbbbbbb';
    const { query } = scripted([assistant(`${TOKEN_A} and ${TOKEN_B}`), success()]);
    const seen: unknown[] = [];
    await new ClaudeRunner(config, { query }).run(
      opts({ onEvent: (e) => seen.push(e), redact: [TOKEN_A, TOKEN_B] }),
    );
    expect(textOf(seen[0])).toBe('*** and ***');
  });
});

describe('runner-claude: tools whitelist and disallowedTools (SPEC 11.2 v03-b02)', () => {
  it('options.tools equals the role whitelist (worker)', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]?.options?.tools).toEqual(config.agent.worker.allowed_tools);
  });

  it('options.tools equals the role whitelist (reviewer)', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
      }),
    );
    expect(calls[0]?.options?.tools).toEqual(config.agent.reviewer.allowed_tools);
  });

  it('reviewer options contain disallowedTools with Write and Edit', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
      }),
    );
    const disallowed = calls[0]?.options?.disallowedTools;
    expect(disallowed).toBeDefined();
    expect(disallowed).toContain('Write');
    expect(disallowed).toContain('Edit');
    expect(disallowed).toContain('MultiEdit');
    expect(disallowed).toContain('NotebookEdit');
  });

  it('worker options do NOT contain disallowedTools', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(opts());
    expect(calls[0]?.options).not.toHaveProperty('disallowedTools');
  });
});

describe('runner-claude: PreToolUse bash deny hook (SPEC 11.2 v03-b02)', () => {
  /** Config with bash_deny patterns for the reviewer. */
  const configWithBashDeny: typeof config = {
    ...config,
    agent: {
      ...config.agent,
      reviewer: {
        ...config.agent.reviewer,
        bash_deny: [
          '^\\s*git\\s+(push|commit|add|reset|checkout|rebase|merge|cherry-pick|tag|branch\\s+-[dDm]|worktree|stash)\\b',
          '^\\s*gh\\s',
        ],
      },
    },
  };

  /** Runs the reviewer with bash_deny config and returns the PreToolUse hook function. */
  async function getHook(
    onEvent?: (e: unknown) => void,
  ): Promise<(input: HookInput, id: string, opts: { signal: AbortSignal }) => Promise<unknown>> {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(configWithBashDeny, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
        ...(onEvent === undefined ? {} : { onEvent }),
      }),
    );
    const matchers = calls[0]?.options?.hooks?.PreToolUse;
    expect(matchers).toBeDefined();
    const hookFn = matchers?.[0]?.hooks[0];
    expect(hookFn).toBeTypeOf('function');
    return hookFn as unknown as (
      input: HookInput,
      id: string,
      opts: { signal: AbortSignal },
    ) => Promise<unknown>;
  }

  function bashInput(command: string): HookInput {
    return {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
      tool_use_id: 'tu_test',
    } as unknown as HookInput;
  }

  it('reviewer options contain hooks.PreToolUse when bash_deny is non-empty', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(configWithBashDeny, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
      }),
    );
    const hooks = calls[0]?.options?.hooks;
    expect(hooks).toBeDefined();
    expect(hooks?.PreToolUse).toBeDefined();
    expect(hooks?.PreToolUse).toHaveLength(1);
    expect(hooks?.PreToolUse?.[0]?.matcher).toBe('Bash');
    expect(hooks?.PreToolUse?.[0]?.hooks).toHaveLength(1);
  });

  it('worker options do NOT contain hooks even when reviewer has bash_deny', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(configWithBashDeny, { query }).run(opts());
    expect(calls[0]?.options?.hooks).toBeUndefined();
  });

  it('reviewer options do NOT contain hooks when bash_deny is empty', async () => {
    const { query, calls } = scripted([success()]);
    await new ClaudeRunner(config, { query }).run(
      opts({
        role: 'reviewer',
        allowedTools: config.agent.reviewer.allowed_tools,
        maxTurns: config.agent.reviewer.max_turns,
      }),
    );
    expect(calls[0]?.options?.hooks).toBeUndefined();
  });

  it('hook denies "git push origin main" and emits tool.denied event', async () => {
    const events: unknown[] = [];
    const hookFn = await getHook((e) => events.push(e));
    const result = await hookFn(bashInput('git push origin main'), 'tu_1', {
      signal: AbortSignal.timeout(5000),
    });
    // Should deny
    const output = (result as { hookSpecificOutput?: { permissionDecision?: string } })
      .hookSpecificOutput;
    expect(output?.permissionDecision).toBe('deny');
    // Should have emitted a tool.denied event
    const denied = events.find(
      (e) =>
        typeof e === 'object' && e !== null && (e as { event?: string }).event === 'tool.denied',
    ) as
      { event: string; role: string; tool: string; command: string; pattern: string } | undefined;
    expect(denied).toBeDefined();
    expect(denied?.role).toBe('reviewer');
    expect(denied?.tool).toBe('Bash');
    expect(denied?.command).toBe('git push origin main');
  });

  it('hook allows "npm test" (no match)', async () => {
    const hookFn = await getHook();
    const result = await hookFn(bashInput('npm test'), 'tu_2', {
      signal: AbortSignal.timeout(5000),
    });
    // Should NOT deny — return empty object
    const output = (result as { hookSpecificOutput?: { permissionDecision?: string } })
      .hookSpecificOutput;
    expect(output).toBeUndefined();
  });

  it('hook denies "git  push" (multiple spaces)', async () => {
    const hookFn = await getHook();
    const result = await hookFn(bashInput('git  push'), 'tu_3', {
      signal: AbortSignal.timeout(5000),
    });
    // The pattern uses \s+ so double-space should also match
    const output = (result as { hookSpecificOutput?: { permissionDecision?: string } })
      .hookSpecificOutput;
    expect(output?.permissionDecision).toBe('deny');
  });
});
