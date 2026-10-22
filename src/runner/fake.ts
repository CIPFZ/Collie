// Scripted AgentRunner for tests (SPEC 4.1, CONSTRAINTS 铁律 16). Each run()
// consumes the next scene in order: it may write files into cwd, emit stream
// events, run an arbitrary effect (e.g. a git commit), then resolve or reject.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import type { AgentRole, AgentRunner, RunHandle, RunOptions, RunResult } from './index.js';

export interface FakeSceneContext {
  cwd: string;
  opts: RunOptions;
  /** Control handle for this run; the effect can call handle.stop('kill') to self-terminate (SPEC 11.9 scenario E). */
  handle: RunHandle;
  /** Resolves when any non-ignored stop level is received. Effects can await this to simulate a stalled worker. */
  stopped: Promise<'soft' | 'hard' | 'kill'>;
}

interface FakeSceneBase {
  /** When set, a call with a different role fails instead of consuming the scene. */
  expectRole?: AgentRole;
  /** Files to write, keyed by path relative to opts.cwd. */
  files?: Record<string, string>;
  /** Passed to opts.onEvent one by one, after files are written. */
  events?: unknown[];
  /** Runs after files and events; use it for side effects such as git commits. */
  effect?: (ctx: FakeSceneContext) => void | Promise<void>;
  /** When true, stop('soft') is ignored; only hard/kill terminate (SPEC 11.2). */
  ignoreSoft?: boolean;
  /** Pid exposed via the RunHandle; defaults to process.pid when omitted. */
  pid?: number;
}

/** One scripted run: it either resolves with `result` or rejects with `error` (a crash). */
export type FakeScene = FakeSceneBase &
  ({ result: RunResult; error?: never } | { error: Error; result?: never });

/** A recorded call. Arrays are copied so later mutation by the caller is not hidden. */
export interface RecordedCall {
  role: AgentRole;
  prompt: string;
  systemPrompt: string;
  allowedTools: string[];
  cwd: string;
  maxTurns: number;
  hasOnEvent: boolean;
  hasSignal: boolean;
  hasOnStarted: boolean;
  resumeSessionId?: string;
}

export class FakeRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FakeRunnerError';
  }
}

function safeRelative(path: string): string {
  const normalized = normalize(path);
  if (path === '' || isAbsolute(path) || normalized === '..' || normalized.startsWith(`..${sep}`)) {
    throw new FakeRunnerError(`scene file path must stay inside cwd: ${JSON.stringify(path)}`);
  }
  return normalized;
}

export class FakeRunner implements AgentRunner {
  private readonly scenes: readonly FakeScene[];
  private readonly recorded: RecordedCall[] = [];

  constructor(scenes: readonly FakeScene[]) {
    for (const scene of scenes) {
      for (const path of Object.keys(scene.files ?? {})) safeRelative(path);
    }
    this.scenes = scenes;
  }

  /** Every call made so far, in order, including ones that failed. */
  get calls(): readonly RecordedCall[] {
    return this.recorded;
  }

  /** Scenes not yet consumed. */
  get remaining(): number {
    return this.scenes.length - this.recorded.length;
  }

  async run(opts: RunOptions): Promise<RunResult> {
    const index = this.recorded.length;
    this.recorded.push({
      role: opts.role,
      prompt: opts.prompt,
      systemPrompt: opts.systemPrompt,
      allowedTools: [...opts.allowedTools],
      cwd: opts.cwd,
      maxTurns: opts.maxTurns,
      hasOnEvent: opts.onEvent !== undefined,
      hasSignal: opts.signal !== undefined,
      hasOnStarted: opts.onStarted !== undefined,
      ...(opts.resumeSessionId === undefined ? {} : { resumeSessionId: opts.resumeSessionId }),
    });

    // SPEC 3.1 (token_file): strip CI tokens during the run, so effects
    // (which run in-process) cannot see them. Restored in the finally block.
    const savedGithubToken = process.env.GITHUB_TOKEN;
    const savedGhToken = process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;

    try {
      // Like a real runner, refuse to start once cancelled.
      opts.signal?.throwIfAborted();

      const scene = this.scenes[index];
      if (scene === undefined) {
        throw new FakeRunnerError(
          `script exhausted: call ${String(index + 1)} (role ${opts.role}) has no scene; ${String(this.scenes.length)} scripted`,
        );
      }
      if (scene.expectRole !== undefined && scene.expectRole !== opts.role) {
        throw new FakeRunnerError(
          `scene ${String(index)} expects role ${scene.expectRole}, got ${opts.role}`,
        );
      }

      // Three-level stop (SPEC 11.2): the handle records the highest level received.
      let stopLevel: 'soft' | 'hard' | 'kill' | undefined;
      let stopResolve: ((level: 'soft' | 'hard' | 'kill') => void) | undefined;
      const stoppedPromise = new Promise<'soft' | 'hard' | 'kill'>((r) => {
        stopResolve = r;
      });
      const handle: RunHandle = {
        ...(scene.pid === undefined ? { pid: process.pid } : { pid: scene.pid }),
        // eslint-disable-next-line @typescript-eslint/require-await -- interface requires Promise<void>
        async stop(level: 'soft' | 'hard' | 'kill'): Promise<void> {
          if (level === 'soft' && scene.ignoreSoft === true) return;
          stopLevel = level;
          stopResolve?.(level);
        },
      };
      opts.onStarted?.(handle);

      for (const [path, content] of Object.entries(scene.files ?? {})) {
        const target = join(opts.cwd, safeRelative(path));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      }
      for (const event of scene.events ?? []) opts.onEvent?.(event);
      await scene.effect?.({ cwd: opts.cwd, opts, handle, stopped: stoppedPromise });

      // A stop during the scene (e.g. the effect called handle.stop('kill'))
      // terminates with stopReason before checking the signal.
      if (stopLevel !== undefined) {
        const base = scene.result ?? { exitCode: 1 };
        return { ...base, stopReason: 'stopped' };
      }

      opts.signal?.throwIfAborted();

      if (scene.error !== undefined) throw scene.error;
      return { ...scene.result };
    } finally {
      // Restore stripped CI tokens (SPEC 3.1).
      if (savedGithubToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = savedGithubToken;
      if (savedGhToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = savedGhToken;
    }
  }
}
