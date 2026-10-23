// The single seam between Collie and any agent CLI (SPEC 4.1, ROADMAP 0.4).
// Agent-specific concepts (session ids, permission modes, model names,
// stream formats) stay behind this interface: callers only see these types.

export type AgentRole = 'worker' | 'reviewer';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Control handle returned by the runner once it starts (SPEC 11.2).
 * R2 uses it for the signal ladder (11.6) and heartbeat pid (11.3).
 */
export interface RunHandle {
  /** Child-process pid when the runner has one; used for heartbeat and kill level. */
  pid?: number;
  /**
   * soft:  finish the current turn, session stays complete and resumable.
   * hard:  abort immediately, session may be incomplete.
   * kill:  unrecoverable termination; runner may SIGKILL the pid.
   */
  stop(level: 'soft' | 'hard' | 'kill'): Promise<void>;
}

export interface RunOptions {
  role: AgentRole;
  prompt: string;
  systemPrompt: string;
  allowedTools: string[];
  cwd: string;
  maxTurns: number;
  /** Called once per line of the agent's event stream, in order. */
  onEvent?: (event: unknown) => void;
  /**
   * Cancels the run. R2 passes AbortSignal.timeout(wallclock_secs) here (SPEC 3.3);
   * runners only forward it and must not invent their own timeout semantics.
   */
  signal?: AbortSignal;
  /** Resume a previous session (SPEC 11.2); opaque, came from RunResult.sessionId. */
  resumeSessionId?: string;
  /** Called once after the runner starts; hands R2 the control handle (SPEC 11.2). */
  onStarted?: (handle: RunHandle) => void;
  /**
   * Called as soon as the worker subprocess pid is known (SPEC 11.2, v02-b05-fix).
   * The spawn hook fires after query() begins iterating, which may be after
   * onStarted — R2 uses this, not handle.pid, for heartbeat worker_pid.
   */
  onPid?: (pid: number) => void;
  /**
   * Secret values to redact from the event stream before it reaches onEvent
   * (v02-e-drill). R2 constructs this from token_file and CI environment
   * variables; the runner applies the mask but never reads config or env itself.
   * Values shorter than 8 chars or empty are silently skipped (false-positive guard).
   */
  redact?: readonly string[];
}

export interface RunResult {
  exitCode: number;
  /** Opaque to Collie; only meaningful to the runner that produced it. */
  sessionId?: string;
  usage?: Usage;
  /**
   * The agent's final reply. The reviewer has no write tools, so its verdict
   * arrives here and R2 persists it as verdict.md (SPEC 3.5).
   */
  finalText?: string;
  /** Why the run ended abnormally (SPEC 11.2); absent on a clean finish. */
  stopReason?: 'turns_exhausted' | 'stopped' | 'error';
}

/**
 * Launches one agent run and resolves when it exits. Implementations choose
 * the model from their own configuration by `role`; it is deliberately not
 * part of RunOptions.
 */
export interface AgentRunner {
  run(opts: RunOptions): Promise<RunResult>;
}
