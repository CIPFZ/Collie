// Signal ladder (SPEC 11.6) and liveness detection (SPEC 11.5).
// The ladder walks soft -> grace -> hard -> grace -> kill; each step records
// worker.signaled. Liveness detection fires the ladder when the worker stalls
// (no events) or idles (events but no progress).
import { createHash } from 'node:crypto';
import { revParse, status } from './git.js';
import type { RunHandle } from './runner/index.js';

// eslint-disable-next-line no-restricted-syntax -- unit conversion, not a threshold
const MS_PER_SECOND = 1000;

export type LadderReason = 'stalled' | 'idling' | 'wallclock';
export type StopLevel = 'soft' | 'hard' | 'kill';

export interface LadderCallbacks {
  /** Records worker.signaled for each level. */
  onSignaled: (level: StopLevel, reason: LadderReason) => void;
  /** Records worker.stalled or worker.idling before starting the ladder. */
  onDetected?: (kind: 'stalled' | 'idling') => void;
}

export interface LadderOptions {
  handle: RunHandle;
  graceSecs: number;
  reason: LadderReason;
  callbacks: LadderCallbacks;
  /** Returns true when the worker process has exited. */
  isExited: () => boolean;
  /** Resolves when the worker exits; races with grace period. */
  exitPromise: Promise<void>;
  /** Injected delay for testing (SPEC constraint: tests must not wait >2s). */
  delay: (ms: number) => Promise<void>;
}

/**
 * Walks the signal ladder: soft -> grace -> hard -> grace -> kill (SPEC 11.6).
 * Each level records worker.signaled. Stops early if the worker exits during a
 * grace period.
 */
export async function runLadder(opts: LadderOptions): Promise<void> {
  const levels: StopLevel[] = ['soft', 'hard', 'kill'];
  for (const level of levels) {
    if (opts.isExited()) return;
    opts.callbacks.onSignaled(level, opts.reason);
    await opts.handle.stop(level);
    if (level === 'kill') return; // No grace after kill.
    // Wait grace_secs or until the worker exits, whichever comes first.
    await Promise.race([opts.delay(opts.graceSecs * MS_PER_SECOND), opts.exitPromise]);
  }
}

// ---------------------------------------------------------------------------
// Liveness monitor (SPEC 11.5)
// ---------------------------------------------------------------------------

/** Computes the output fingerprint: HEAD sha + git status hash (SPEC 11.5). */
export async function computeFingerprint(root: string): Promise<string> {
  const head = await revParse(root, 'HEAD');
  const ws = await status(root);
  const raw = head + '\n' + ws.entries.map((e) => `${e.code} ${e.path}`).join('\n');
  return createHash('sha256').update(raw).digest('hex');
}

export interface LivenessConfig {
  stallSecs: number;
  progressSecs: number;
  root: string;
  /** Called when a stall is detected. */
  onStalled: () => void;
  /** Called when idle is detected. */
  onIdling: () => void;
  /**
   * How often the monitor samples, in ms. Defaults to 500ms.
   * Tests may use a shorter interval.
   */
  checkIntervalMs?: number;
  /** Injected monotonic clock; defaults to Date.now (SPEC 11.5). */
  now?: () => number;
  /**
   * Injected timer; defaults to setTimeout (SPEC 11.5).
   * Tests pass a fake to avoid real delays.
   */
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /**
   * Injected output fingerprint function (SPEC 11.5). Defaults to
   * computeFingerprint(root) which calls real git. Tests inject a synchronous-
   * returning fake so the monitor never shells out to git.
   */
  fingerprint?: () => Promise<string>;
}

// eslint-disable-next-line no-restricted-syntax -- monitor default interval, not a threshold
const DEFAULT_CHECK_INTERVAL_MS = 500;

/**
 * Runs alongside the worker. Uses an injected clock (defaults to Date.now()) for
 * stall/idle measurement and an injected timer (defaults to setTimeout) for
 * scheduling checks (SPEC 11.5). Tests inject fakes to avoid real delays.
 */
export class LivenessMonitor {
  private readonly config: LivenessConfig;
  private readonly checkIntervalMs: number;
  private readonly nowFn: () => number;
  private readonly setTimerFn: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly fingerprintFn: () => Promise<string>;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastEventMs: number;
  private lastProgressMs: number;
  private lastFingerprint: string | undefined;
  private triggered = false;
  private stopped = false;

  constructor(config: LivenessConfig) {
    this.config = config;
    this.checkIntervalMs = config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    this.nowFn = config.now ?? (() => Date.now());
    this.setTimerFn = config.setTimer ?? ((cb, ms) => setTimeout(cb, ms));
    this.fingerprintFn = config.fingerprint ?? (() => computeFingerprint(config.root));
    const now = this.nowFn();
    this.lastEventMs = now;
    this.lastProgressMs = now;
  }

  /** Called on each event from the worker stream (sync). Resets the stall timer. */
  onEvent(): void {
    this.lastEventMs = this.nowFn();
  }

  /** Starts the periodic liveness check loop. */
  start(): void {
    this.scheduleCheck();
  }

  /** Stops monitoring. Safe to call multiple times. */
  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleCheck(): void {
    if (this.stopped || this.triggered) return;
    this.timer = this.setTimerFn(() => {
      void this.check();
    }, this.checkIntervalMs);
  }

  private async check(): Promise<void> {
    if (this.stopped || this.triggered) return;
    const now = this.nowFn();

    // Stall: no events for stall_secs.
    const sinceLastEvent = (now - this.lastEventMs) / MS_PER_SECOND;
    if (sinceLastEvent >= this.config.stallSecs) {
      this.triggered = true;
      this.config.onStalled();
      return;
    }

    // Idle: events arriving but fingerprint unchanged for progress_secs.
    try {
      const fp = await this.fingerprintFn();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by stop()/check() during await
      if (this.stopped || this.triggered) return; // May have been stopped while awaiting.
      if (this.lastFingerprint === undefined || fp !== this.lastFingerprint) {
        this.lastFingerprint = fp;
        this.lastProgressMs = this.nowFn();
      } else {
        const sinceProgress = (this.nowFn() - this.lastProgressMs) / MS_PER_SECOND;
        if (sinceProgress >= this.config.progressSecs) {
          this.triggered = true;
          this.config.onIdling();
          return;
        }
      }
    } catch {
      // Git commands may fail if the repo is in a transient state; skip this check.
    }
    this.scheduleCheck();
  }
}
