// The only module that knows about Claude (SPEC 4.1, ROADMAP 0.4): the SDK's
// messages, option names and result shapes stop here. Callers see AgentRunner.
//
// query() is injected (defaulting to the SDK's) so tests exercise this adapter
// with a scripted double and never reach the network (CONSTRAINTS 铁律 16).
import type { CollieConfig } from '../schema/index.js';
import type { AgentRunner, RunOptions, RunResult, Usage } from './index.js';

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
}

export interface ClaudeQueryParams {
  prompt: string;
  options?: ClaudeQueryOptions;
}

/** query() resolves to an async iterator of NDJSON messages (SDKMessage in the SDK). */
export type ClaudeQuery = (params: ClaudeQueryParams) => AsyncIterable<unknown>;

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
  return (query as (params: ClaudeQueryParams) => AsyncIterable<unknown>).bind(sdk);
}

/** The default query: resolves the SDK once, then delegates. */
const lazySdkQuery: ClaudeQuery = async function* (params) {
  const query = await loadSdkQuery();
  yield* query(params);
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
    };

    let result: ResultMessage | undefined;
    try {
      for await (const message of this.queryFn({ prompt: opts.prompt, options: queryOptions })) {
        opts.onEvent?.(message);
        if (isResultMessage(message)) result = message;
      }
    } catch (error) {
      opts.signal?.removeEventListener('abort', forwardAbort);
      if (opts.signal?.aborted === true) throw opts.signal.reason;
      throw error;
    } finally {
      opts.signal?.removeEventListener('abort', forwardAbort);
    }

    if (result === undefined) {
      throw new Error('the Claude query ended without a result message');
    }
    const succeeded = result.subtype === 'success' && result.is_error !== true;
    return {
      exitCode: succeeded ? EXIT_OK : EXIT_FAILED,
      ...(result.session_id === undefined ? {} : { sessionId: result.session_id }),
      ...(result.usage === undefined ? {} : { usage: toUsage(result.usage) }),
      // Only a successful run's final text is a deliverable (e.g. the verdict).
      ...(succeeded && result.result !== undefined ? { finalText: result.result } : {}),
    };
  }
}
