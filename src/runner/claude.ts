// The only module that knows about Claude (SPEC 4.1, ROADMAP 0.4): the SDK's
// messages, option names and result shapes stop here. Callers see AgentRunner.
//
// query() is injected (defaulting to the SDK's) so tests exercise this adapter
// with a scripted double and never reach the network (CONSTRAINTS 铁律 16).
//
// SPEC 11.2: types passed to the SDK are `import type` from the SDK package
// and derived with Pick / indexed access. Hand-written copies drift silently.
import { spawn } from 'node:child_process';
// prettier-ignore
import type { Options as SdkOptions, SpawnOptions as SdkSpawnOptions, SpawnedProcess as SdkSpawnedProcess, HookInput as SdkHookInput, HookJSONOutput as SdkHookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import type { CollieConfig } from '../schema/index.js';
import type { AgentRunner, RunHandle, RunOptions, RunResult, Usage } from './index.js';

/**
 * The slice of the SDK Options this adapter actually passes to query().
 * Derived from the SDK's own type so field names cannot drift (SPEC 11.2).
 */
export type ClaudeQueryOptions = Pick<
  SdkOptions,
  | 'model'
  | 'maxTurns'
  | 'systemPrompt'
  | 'tools'
  | 'allowedTools'
  | 'disallowedTools'
  | 'cwd'
  | 'abortController'
  | 'permissionMode'
  | 'allowDangerouslySkipPermissions'
  | 'settingSources'
  | 'resume'
  | 'env'
  | 'spawnClaudeCodeProcess'
  | 'hooks'
>;

/** Re-export SDK spawn types for test doubles (SPEC 11.2). */
export type SpawnOptions = SdkSpawnOptions;
export type SpawnedProcess = SdkSpawnedProcess;
/** Re-export SDK hook types for test doubles (SPEC 11.2, v03-b02). */
export type HookInput = SdkHookInput;
export type HookJSONOutput = SdkHookJSONOutput;

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
 * Minimum secret length for redaction (v02-e-drill): values shorter than this
 * are skipped to avoid false-positive replacements in the event stream.
 * This is a security floor, not a tunable threshold.
 */
// eslint-disable-next-line no-restricted-syntax -- security floor, not a SPEC threshold
const REDACT_MIN_LENGTH = 8;
const REDACT_MASK = '***';

/**
 * Replaces every occurrence of each secret (length ≥ REDACT_MIN_LENGTH) in the
 * JSON-serialised event with REDACT_MASK, then parses the result back.
 * When no secret matches (or the list is empty), returns the original object.
 */
function redactEvent(event: unknown, secrets: readonly string[]): unknown {
  if (secrets.length === 0) return event;
  let json = JSON.stringify(event);
  let changed = false;
  for (const secret of secrets) {
    if (secret === '' || secret.length < REDACT_MIN_LENGTH) continue;
    if (json.includes(secret)) {
      json = json.split(secret).join(REDACT_MASK);
      changed = true;
    }
  }
  return changed ? (JSON.parse(json) as unknown) : event;
}

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
      // SPEC 11.2 (v02-b04-fix3): three cases for the lazy wrapper.
      if (resolvedIterable === undefined) {
        // SDK not yet loaded: interrupt is a no-op, but log to stderr.
        process.stderr.write('lazySdkQuery.interrupt(): SDK not yet loaded, ignoring\n');
        return;
      }
      if (resolvedIterable.interrupt === undefined) {
        // SDK loaded but iterable has no interrupt(): must throw, not silently return.
        throw new Error('soft stop requires interrupt() on the query iterable (SPEC 11.2)');
      }
      // SPEC 11.2: forward interrupt to the resolved SDK iterable directly on
      // the object — never extract the method, which loses `this` (v02-b04-fix).
      await resolvedIterable.interrupt();
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
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /** SPEC 13.1: total cost from the SDK (v0.4). */
  total_cost_usd?: number;
  /** SPEC 13.1: number of turns from the SDK (v0.4). */
  num_turns?: number;
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
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    ...(usage.cache_creation_input_tokens !== undefined
      ? { cacheCreationInputTokens: usage.cache_creation_input_tokens }
      : {}),
    ...(usage.cache_read_input_tokens !== undefined
      ? { cacheReadInputTokens: usage.cache_read_input_tokens }
      : {}),
  };
}

/**
 * Sums two Usage objects field by field. Returns undefined when both are
 * undefined; otherwise missing sides are treated as zero.
 */
function sumUsage(a: Usage | undefined, b: Usage | undefined): Usage | undefined {
  if (a === undefined && b === undefined) return undefined;
  const left = a ?? { inputTokens: 0, outputTokens: 0 };
  const right = b ?? { inputTokens: 0, outputTokens: 0 };
  const merged: Usage = {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
  const cacheCreation =
    (left.cacheCreationInputTokens ?? 0) + (right.cacheCreationInputTokens ?? 0);
  if (
    cacheCreation > 0 ||
    left.cacheCreationInputTokens !== undefined ||
    right.cacheCreationInputTokens !== undefined
  ) {
    merged.cacheCreationInputTokens = cacheCreation;
  }
  const cacheRead = (left.cacheReadInputTokens ?? 0) + (right.cacheReadInputTokens ?? 0);
  if (
    cacheRead > 0 ||
    left.cacheReadInputTokens !== undefined ||
    right.cacheReadInputTokens !== undefined
  ) {
    merged.cacheReadInputTokens = cacheRead;
  }
  return merged;
}

/**
 * Aggregates multiple result messages into a single RunResult (SPEC 14.20).
 *
 * - Turns & token fields: sum across all messages.
 * - Cost: last message that carries a cost.
 * - Success: every message must be successful.
 * - stopReason: stopped > turns_exhausted > error > undefined (see SPEC).
 * - finalText: only when all succeed; texts joined by blank line.
 * - sessionId: last message's.
 */
function aggregateResults(
  results: readonly ResultMessage[],
  lastSessionId: string | undefined,
  interrupted: boolean,
  durationMs: number,
): RunResult {
  // Every result must be a success for the aggregate to be a success.
  const allSucceeded = results.every((r) => r.subtype === 'success' && r.is_error !== true);

  // stopReason priority: stopped (interrupted) > turns_exhausted > error.
  const stopReason: RunResult['stopReason'] = (() => {
    if (interrupted) return 'stopped';
    if (results.some((r) => r.subtype === 'error_max_turns')) return 'turns_exhausted';
    if (!allSucceeded) return 'error';
    return undefined;
  })();

  // Aggregate turns: sum of num_turns across all messages.
  const totalTurns = results.reduce(
    (sum, r) => (r.num_turns !== undefined ? sum + r.num_turns : sum),
    0,
  );
  const hasTurns = results.some((r) => r.num_turns !== undefined);

  // Aggregate usage: sum across all messages.
  let totalUsage: Usage | undefined;
  for (const r of results) {
    totalUsage = sumUsage(totalUsage, toUsage(r.usage));
  }

  // Cost: last message that carries total_cost_usd.
  let costUsd: number | undefined;
  for (const r of results) {
    if (r.total_cost_usd !== undefined) costUsd = r.total_cost_usd;
  }

  // sessionId: last message's, falling back to lastSessionId from any message.
  const sessionId = results[results.length - 1]?.session_id ?? lastSessionId;

  // finalText: only when all succeeded; join texts by blank line.
  const finalText = allSucceeded
    ? results
        .map((r) => r.result)
        .filter((t): t is string => t !== undefined)
        .join('\n\n') || undefined
    : undefined;

  return {
    exitCode: allSucceeded ? EXIT_OK : EXIT_FAILED,
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(totalUsage === undefined ? {} : { usage: totalUsage }),
    ...(finalText === undefined ? {} : { finalText }),
    ...(stopReason === undefined ? {} : { stopReason }),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(hasTurns ? { numTurns: totalTurns } : {}),
    durationMs,
  };
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
    const runStart = Date.now();
    // The model, tools and turn limit come from the role's config (ROADMAP 0.4:
    // model names do not travel through RunOptions).
    const agent = (() => {
      switch (opts.role) {
        case 'worker':
          return this.config.agent.worker;
        case 'reviewer':
          return this.config.agent.reviewer;
        case 'tester': {
          const testerCfg = this.config.agent.tester;
          if (testerCfg === undefined) {
            throw new Error(
              'tester role requires [agent.tester] in collie.toml but the section is missing',
            );
          }
          return testerCfg;
        }
      }
    })();
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

    // SPEC 11.2 (v02-b04-fix3): capture the worker subprocess pid via the
    // spawnClaudeCodeProcess hook. The hook wraps child_process.spawn, records
    // the pid, and also strips CI tokens from the spawn env (SPEC 3.1).
    // SPEC 11.2: the hook signature is (options: SpawnOptions) => SpawnedProcess.
    let workerPid: number | undefined;
    const spawnHook: NonNullable<ClaudeQueryOptions['spawnClaudeCodeProcess']> = (options) => {
      const rawEnv = options.env;
      const cleanEnv: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawEnv)) {
        if (!STRIPPED_ENV_KEYS.includes(key) && value !== undefined) {
          cleanEnv[key] = value;
        }
      }
      const child = spawn(options.command, [...options.args], {
        cwd: options.cwd,
        env: cleanEnv,
        signal: options.signal,
        // SPEC 11.3: detached so R2 can send SIGTERM to the process group.
        detached: true,
      });
      workerPid = child.pid;
      // SPEC 11.2 (v02-b05-fix): notify R2 of the worker pid immediately,
      // before onStarted — the spawn hook fires during iteration, not at setup.
      if (child.pid !== undefined) opts.onPid?.(child.pid);
      return child;
    };

    /**
     * SPEC 11.2 (v03-b02): tools the reviewer must never have, even if
     * allowedTools accidentally included them. Matches roles/reviewer.ts WRITE_TOOLS.
     */
    const REVIEWER_DISALLOWED_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];

    /**
     * SPEC 11.2 (v03-b02): PreToolUse hook for the bash command deny list.
     * Applies to reviewer and tester (SPEC 16.10); worker has no bash_deny.
     */
    const bashDenyConfig =
      opts.role === 'reviewer'
        ? this.config.agent.reviewer
        : opts.role === 'tester' && this.config.agent.tester !== undefined
          ? this.config.agent.tester
          : undefined;
    const bashDeny: RegExp[] = (bashDenyConfig?.bash_deny ?? []).map((p) => new RegExp(p));
    const hooks: ClaudeQueryOptions['hooks'] =
      (opts.role === 'reviewer' || opts.role === 'tester') && bashDeny.length > 0
        ? {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [
                  // eslint-disable-next-line @typescript-eslint/require-await -- SDK HookCallback requires Promise return
                  async (input: SdkHookInput): Promise<SdkHookJSONOutput> => {
                    const toolInput = (input as { tool_input?: unknown }).tool_input;
                    const command =
                      typeof toolInput === 'object' &&
                      toolInput !== null &&
                      typeof (toolInput as Record<string, unknown>).command === 'string'
                        ? ((toolInput as Record<string, unknown>).command as string)
                        : '';
                    for (const pattern of bashDeny) {
                      if (pattern.test(command)) {
                        // SPEC 11.2: emit tool.denied to the event stream.
                        opts.onEvent?.({
                          event: 'tool.denied',
                          role: opts.role,
                          tool: (input as { tool_name?: string }).tool_name ?? 'Bash',
                          command,
                          pattern: pattern.source,
                        });
                        return {
                          hookSpecificOutput: {
                            hookEventName: 'PreToolUse' as const,
                            permissionDecision: 'deny' as const,
                            permissionDecisionReason: `command matches bash_deny pattern /${pattern.source}/`,
                          },
                        };
                      }
                    }
                    return {};
                  },
                ],
              },
            ],
          }
        : undefined;

    const queryOptions: ClaudeQueryOptions = {
      // SDK isolation mode: no CLAUDE.md, settings files or hooks from the machine.
      settingSources: [],
      model: agent.model,
      // The role config is authoritative; RunOptions.maxTurns may only lower it.
      maxTurns: Math.min(opts.maxTurns, agent.max_turns),
      systemPrompt: opts.systemPrompt,
      // SPEC 11.2 (v03-b02): tools restricts the available set; allowedTools bypasses permission
      // prompts for those tools; both must be the same list.
      tools: [...opts.allowedTools],
      allowedTools: [...opts.allowedTools],
      // SPEC 11.2 (v03-b02): reviewer gets disallowedTools to physically block write tools.
      ...(opts.role === 'reviewer' ? { disallowedTools: REVIEWER_DISALLOWED_TOOLS } : {}),
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
      // SPEC 11.2 (v02-b04-fix3): custom subprocess spawner to capture worker pid.
      spawnClaudeCodeProcess: spawnHook,
      // SPEC 11.2 (v03-b02): reviewer bash command deny hook.
      ...(hooks === undefined ? {} : { hooks }),
    };

    // Soft stop calls interrupt() on the query iterable (SPEC 11.2 v02-b03: SDK-level
    // graceful stop, session stays resumable); hard/kill aborts the controller.
    const queryIterable = this.queryFn({ prompt: opts.prompt, options: queryOptions });
    // Track whether interrupt() was requested; used after the loop to set stopReason.
    let interrupted = false;

    // SPEC 11.2: the RunHandle gives R2 control over the run.
    // pid is set by the spawnClaudeCodeProcess hook when the SDK spawns the subprocess.
    const handle: RunHandle = {
      get pid(): number | undefined {
        return workerPid;
      },
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
            // SPEC 11.2 (v02-b04-fix3): SIGKILL the worker subprocess if we have its pid.
            if (workerPid !== undefined) {
              try {
                process.kill(workerPid, 'SIGKILL');
              } catch {
                // Process already dead — expected after normal exit.
              }
            }
            controller.abort(new Error('kill'));
            break;
        }
      },
    };
    opts.onStarted?.(handle);

    // SPEC 14.20: collect all result messages (a session may emit more than one).
    const results: ResultMessage[] = [];
    // Track sessionId from any message (SPEC 11.2: do not lose it on error).
    let lastSessionId: string | undefined;
    const secrets = opts.redact ?? [];
    try {
      for await (const message of queryIterable) {
        const redacted = redactEvent(message, secrets);
        opts.onEvent?.(redacted);
        const sid = extractSessionId(message);
        if (sid !== undefined) lastSessionId = sid;
        if (isResultMessage(message)) results.push(message);
      }
    } catch (error) {
      opts.signal?.removeEventListener('abort', forwardAbort);
      if (opts.signal?.aborted === true) throw opts.signal.reason;
      // SPEC 14.18 / 14.20: when result messages were received before the SDK
      // threw, aggregate them and carry back cost, turns, usage and sessionId.
      if (results.length > 0) {
        const durationMs = Date.now() - runStart;
        // The throw means the run failed regardless of individual results.
        const agg = aggregateResults(results, lastSessionId, interrupted, durationMs);
        // Force failure: exitCode non-zero, strip finalText (destructure to omit).
        // SPEC 14.22: failed runs always carry a stop reason; when the aggregate
        // has none (all results were successful before the throw), record 'error'.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping finalText
        const { finalText: _stripped, ...rest } = agg;
        return { ...rest, exitCode: EXIT_FAILED, stopReason: rest.stopReason ?? 'error' };
      }
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

    if (results.length === 0) {
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
    // SPEC 14.20: aggregate all collected result messages.
    const durationMs = Date.now() - runStart;
    return aggregateResults(results, lastSessionId, interrupted, durationMs);
  }
}
