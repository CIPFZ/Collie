// The single seam between Collie and any agent CLI (SPEC 4.1, ROADMAP 0.4).
// Agent-specific concepts (session ids, permission modes, model names,
// stream formats) stay behind this interface: callers only see these types.

export type AgentRole = 'worker' | 'reviewer';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
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
}

export interface RunResult {
  exitCode: number;
  /** Opaque to Collie; only meaningful to the runner that produced it. */
  sessionId?: string;
  usage?: Usage;
}

/**
 * Launches one agent run and resolves when it exits. Implementations choose
 * the model from their own configuration by `role`; it is deliberately not
 * part of RunOptions.
 */
export interface AgentRunner {
  run(opts: RunOptions): Promise<RunResult>;
}
