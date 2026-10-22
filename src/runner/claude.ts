// The only module that knows about Claude (SPEC 4.1, ROADMAP 0.4): the SDK's
// messages, option names and result shapes stop here. Callers see AgentRunner.
//
// query() is injected (defaulting to the SDK's) so tests exercise this adapter
// with a scripted double and never reach the network (CONSTRAINTS 铁律 16).
import type { CollieConfig } from '../schema/index.js';
import type { AgentRunner, RunHandle, RunOptions, RunResult, Usage } from './index.js';

/**
 * The slice of the SDK this adapter uses. Keeping it structural means the real
 * package and a test double are interchangeable, and no other module needs the
 * SDK's types.
 */
export interface ClaudeQueryOptions {
  model?: string;
  maxTurns?: number;
  systemPrompt?: string;
  allowedTools?: string[];
  cwd?: string;
  abortController?: AbortController;
  includePartialMessages?: boolean;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto';
  allowDangerouslySkipPermissions?: boolean;
  settingSources?: readonly string[];
  /** SDK resume field: pass the session id of a previous run to continue it (SPEC 11.2). */
  resume?: string;
  /** Subprocess environment; R2 strips CI tokens here (SPEC 3.1 token_file). */
  env?: Record<string, string>;
}

export interface ClaudeQueryParams {
  prompt: string;
  options?: ClaudeQueryOptions;
}

/** query() resolves to an async iterator of NDJSON messages (SDKMessage in the SDK). */
export type ClaudeQuery = (params: ClaudeQueryParams) => ClaudeQueryIterable;

/**
 * The async iterable returned by the SDK's query(). It may expose `interrupt()`
 * (SPEC 11.2, v02-b03): calling it ends the current turn gracefully, keeping the
 * session resumable. When present, stop('soft') calls and awaits it; when absent,
 * stop('soft') throws (SPEC 11.2: interrupt() is required, not optional-chained).
 */
export interface ClaudeQueryIterable extends AsyncIterable<unknown> {
  /** SDK-level interrupt: finishes the current turn, session stays complete (SPEC 11.2). */
  interrupt?: () => void | Promise<void>;
}

export interface ClaudeRunnerOptions {
  /**
   * Defaults to loading @anthropic-ai/claude-agent-sdk. Injected by tests, and by
   * hosts that vendor the SDK differently (see ADR-004: the package's licence is
   * not on the CONSTRAINTS 铁律 13 whitelist).
   */
  query?: ClaudeQuery;
  abortController?: () => AbortController;
}

/** The platform dependency this runner brings (ADR-004); the only place its name is spelled. */
export const CLAUDE_SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk';

const EXIT_OK = 0;
const EXIT_FAILED = 1;

/**
 * Loads the SDK on first use. The specifier is kept in a variable so the
 * TypeScript build does not require the package to be installed: nothing else in
 * Collie may import it (CONSTRAINTS 铁律 15), and ADR-004 governs whether it may
 * be added at all.
 */
async function loadSdkQuery(): Promise<ClaudeQuery> {
  const specifier = CLAUDE_SDK_PACKAGE;
  let sdk: unknown;
  try {
    sdk = await import(specifier);
  } catch (error) {
    throw new Error(
      `${specifier} could not be loaded (${error instanceof Error ? error.message : String(error)}); ` +
        'install it with npm (ADR-004)',
      { cause: error },
    );
  }
  const query = (sdk as { query?: unknown }).query;
  if (typeof query !== 'function') {
    throw new Error(`${specifier} does not export query()`);
  }
  return (query as (params: ClaudeQueryParams) => ClaudeQueryIterable).bind(sdk);
}

/** The default query: resolves the SDK once, then delegates. */
const lazySdkQuery: ClaudeQuery = (params) => {
  // Return an async iterable that lazily loads the SDK and delegates.
  let iterablePromise: Promise<ClaudeQueryIterable> | undefined;
  let resolvedIterable: ClaudeQueryIterable | undefined;

  function getIterable(): Promise<ClaudeQueryIterable> {
    iterablePromise ??= loadSdkQuery().then((q) => {
      resolvedIterable = q(params);
      return resolvedIterable;
    });
    return iterablePromise;
  }

  return {
    [Symbol.asyncIterator](): AsyncIterator<unknown> {
      let delegateIterator: AsyncIterator<unknown> | undefined;
      return {
        async next(): Promise<IteratorResult<unknown>> {
          if (delegateIterator === undefined) {
            const iterable = await getIterable();
            delegateIterator = iterable[Symbol.asyncIterator]();
          }
          return delegateIterator.next();
        },
      };
    },
    async interrupt(): Promise<void> {
      // SPEC 11.2: forward interrupt to the resolved SDK iterable directly on
      // the object — never extract the method, which loses `this` (v02-b04-fix).
      // The lazy wrapper may be called before the SDK loads (resolvedIterable undefined).
      if (resolvedIterable?.interrupt !== undefined) {
        await resolvedIterable.interrupt();
      }
    },
  };
};

// Message shapes read from the SDK, narrowed locally so nothing leaks out.
interface ResultMessage {
  type: 'result';
  subtype: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  errors?: string[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

function isResultMessage(message: unknown): message is ResultMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'result'
  );
}

function toUsage(usage: ResultMessage['usage']): Usage | undefined {
  if (usage === undefined) return undefined;
  return { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
}

/** Extracts session_id from any message that carries one (SPEC 11.2: never lose it). */
function extractSessionId(message: unknown): string | undefined {
  if (typeof message === 'object' && message !== null) {
    const sid = (message as { session_id?: unknown }).session_id;
    return typeof sid === 'string' ? sid : undefined;
  }
  return undefined;
}

export class ClaudeRunner implements AgentRunner {
  private readonly config: CollieConfig;
  private readonly queryFn: ClaudeQuery;
  private readonly makeAbortController: () => AbortController;

  constructor(config: CollieConfig, options: ClaudeRunnerOptions = {}) {
    this.config = config;
    this.queryFn = options.query ?? lazySdkQuery;
    this.makeAbortController = options.abortController ?? (() => new AbortController());
  }

  async run(opts: RunOptions): Promise<RunResult> {
    // The model, tools and turn limit come from the role's config (ROADMAP 0.4:
    // model names do not travel through RunOptions).
    const agent = opts.role === 'worker' ? this.config.agent.worker : this.config.agent.reviewer;
    if (opts.allowedTools.some((tool) => !agent.allowed_tools.includes(tool))) {
      throw new Error(
        `allowedTools ${opts.allowedTools.join(', ')} exceed the ${opts.role} whitelist`,
      );
    }
    const controller = this.makeAbortController();
    // An already-cancelled run never starts (SPEC 3.3: R2's wall clock).
    const forwardAbort = (): void => {
      controller.abort(opts.signal?.reason);
    };
    if (opts.signal?.aborted === true) {
      forwardAbort();
      opts.signal.throwIfAborted();
    } else {
      opts.signal?.addEventListener('abort', forwardAbort, { once: true });
    }

    // SPEC 3.1 (token_file): strip CI tokens from the subprocess environment.
    // The worker's event stream is persisted raw (Q5); tokens must not leak.
    const STRIPPED_ENV_KEYS = ['GITHUB_TOKEN', 'GH_TOKEN'];
    const sanitizedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (!STRIPPED_ENV_KEYS.includes(key) && value !== undefined) {
        sanitizedEnv[key] = value;
      }
    }

    const queryOptions: ClaudeQueryOptions = {
      // SDK isolation mode: no CLAUDE.md, settings files or hooks from the machine.
      settingSources: [],
      model: agent.model,
      // The role config is authoritative; RunOptions.maxTurns may only lower it.
      maxTurns: Math.min(opts.maxTurns, agent.max_turns),
      systemPrompt: opts.systemPrompt,
      allowedTools: [...opts.allowedTools],
      cwd: opts.cwd,
      abortController: controller,
      // SPEC 3.1: the role's permission_mode; the SDK refuses bypass without the explicit opt-in.
      ...(agent.permission_mode === undefined ? {} : { permissionMode: agent.permission_mode }),
      ...(agent.permission_mode === 'bypassPermissions'
        ? { allowDangerouslySkipPermissions: true }
        : {}),
      // SPEC 11.2: resume a previous session.
      ...(opts.resumeSessionId === undefined ? {} : { resume: opts.resumeSessionId }),
      // SPEC 3.1 (token_file): sanitized subprocess env without CI tokens.
      env: sanitizedEnv,
    };

    // Soft stop calls interrupt() on the query iterable (SPEC 11.2 v02-b03: SDK-level
    // graceful stop, session stays resumable); hard/kill aborts the controller.
    const queryIterable = this.queryFn({ prompt: opts.prompt, options: queryOptions });
    // Track whether interrupt() was requested; used after the loop to set stopReason.
    let interrupted = false;

    // SPEC 11.2: the RunHandle gives R2 control over the run.
    // The SDK does not expose a child-process pid, so pid is omitted.
    const handle: RunHandle = {
      async stop(level: 'soft' | 'hard' | 'kill'): Promise<void> {
        switch (level) {
          case 'soft': {
            interrupted = true;
            // SPEC 11.2: interrupt() is required for soft stop. If the query
            // iterable does not expose it, throw — never silently skip.
            // Call directly on the object to preserve `this` (v02-b04-fix).
            if (queryIterable.interrupt === undefined) {
              throw new Error('soft stop requires interrupt() on the query iterable (SPEC 11.2)');
            }
            await queryIterable.interrupt();
            break;
          }
          case 'hard':
            controller.abort(new Error('hard stop'));
            break;
          case 'kill':
            controller.abort(new Error('kill'));
            break;
        }
      },
    };
    opts.onStarted?.(handle);

    let result: ResultMessage | undefined;
    // Track sessionId from any message (SPEC 11.2: do not lose it on error).
    let lastSessionId: string | undefined;
    try {
      for await (const message of queryIterable) {
        opts.onEvent?.(message);
        const sid = extractSessionId(message);
        if (sid !== undefined) lastSessionId = sid;
        if (isResultMessage(message)) result = message;
      }
    } catch (error) {
      opts.signal?.removeEventListener('abort', forwardAbort);
      if (opts.signal?.aborted === true) throw opts.signal.reason;
      // SPEC 11.2: SDK errors must still return RunResult with sessionId when possible.
      if (lastSessionId !== undefined) {
        return {
          exitCode: EXIT_FAILED,
          sessionId: lastSessionId,
          stopReason: 'error',
        };
      }
      throw error;
    } finally {
      opts.signal?.removeEventListener('abort', forwardAbort);
    }

    if (result === undefined) {
      // interrupt() may end the stream before a result message arrives.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by handle.stop()
      if (interrupted) {
        return {
          exitCode: EXIT_FAILED,
          ...(lastSessionId === undefined ? {} : { sessionId: lastSessionId }),
          stopReason: 'stopped',
        };
      }
      throw new Error('the Claude query ended without a result message');
    }
    const succeeded = result.subtype === 'success' && result.is_error !== true;
    const sessionId = result.session_id ?? lastSessionId;
    // Map SDK error subtypes to stopReason (SPEC 11.2).
    const stopReason: RunResult['stopReason'] = (() => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by handle.stop()
      if (interrupted) return 'stopped';
      if (result.subtype === 'error_max_turns') return 'turns_exhausted';
      if (!succeeded && result.subtype !== 'success') return 'error';
      return undefined;
    })();
    return {
      exitCode: succeeded ? EXIT_OK : EXIT_FAILED,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(result.usage === undefined ? {} : { usage: toUsage(result.usage) }),
      // Only a successful run's final text is a deliverable (e.g. the verdict).
      ...(succeeded && result.result !== undefined ? { finalText: result.result } : {}),
      ...(stopReason === undefined ? {} : { stopReason }),
    };
  }
}
