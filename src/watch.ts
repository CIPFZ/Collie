// `collie watch` (SPEC 13.5): follow a run's journal in real time.
// Read-only by contract: never writes the journal, never touches the heartbeat,
// never signals anyone (SPEC 13.5). Clock, sleep and the data source are all
// injected so tests drive it without real timers.
import type { Event } from './schema/index.js';
import { buildStatus, formatCurrentSection, type RunData } from './view.js';

/* eslint-disable-next-line no-restricted-syntax -- unit conversion, not a threshold */
const MS_PER_SECOND = 1000;

/** SPEC 13.5: default polling interval for `collie watch`. */
/* eslint-disable-next-line no-restricted-syntax -- SPEC 13.5 default, not a tunable threshold */
export const DEFAULT_INTERVAL_SECS = 2;

/** Queue runs are distinguished by their run_id prefix (SPEC 3.6 path-safe ids). */
const QUEUE_RUN_PREFIX = 'q-';

export interface WatchDeps {
  root: string;
  /** `--once`: print the current frame and return immediately (SPEC 13.5). */
  once: boolean;
  /** `--interval <seconds>` (SPEC 13.5; CLI default DEFAULT_INTERVAL_SECS). */
  intervalSecs: number;
  /** `--timeout <seconds>`; null means no timeout (SPEC 13.5). */
  timeoutSecs: number | null;
  /** `limits.stall_secs` from collie.toml (SPEC 3.1, used by SPEC 13.5). */
  stallSecs: number;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** Data source, injected by the CLI as `view.loadRuns` (SPEC 13.5). */
  load: (root: string) => readonly RunData[];
  out: (text: string) => void;
}

interface ActiveRun {
  runId: string;
  isQueue: boolean;
  /** Parsed run.started timestamp; 0 when unparsable. */
  startedMs: number;
}

function isQueueRun(runId: string): boolean {
  return runId.startsWith(QUEUE_RUN_PREFIX);
}

function parsedTs(ts: string): number {
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? 0 : ms;
}

function hasEvent(events: readonly Event[], type: string): boolean {
  return events.some((e) => e.event === type);
}

function findRun(runs: readonly RunData[], runId: string): Event[] | null {
  for (const rd of runs) {
    if (rd.runId === runId && rd.status === 'ok') return rd.events;
  }
  return null;
}

/**
 * Runs that have started and not yet reached their terminal event:
 * `queue.finished` for queue runs, `run.finished` for batch runs (SPEC 13.5).
 */
function activeRuns(runs: readonly RunData[]): ActiveRun[] {
  const active: ActiveRun[] = [];
  for (const rd of runs) {
    if (rd.status !== 'ok') continue;
    const started = rd.events.find((e) => e.event === 'run.started');
    if (started === undefined) continue;
    const isQueue = isQueueRun(rd.runId);
    const terminal = isQueue ? 'queue.finished' : 'run.finished';
    if (hasEvent(rd.events, terminal)) continue;
    active.push({ runId: rd.runId, isQueue, startedMs: parsedTs(started.ts) });
  }
  return active;
}

/** Latest by run.started; queue runs win over batch runs while a queue is alive. */
function pickFollow(actives: readonly ActiveRun[]): ActiveRun | null {
  const latest = (list: ActiveRun[]): ActiveRun | null => {
    let best: ActiveRun | null = null;
    for (const a of list) {
      if (best === null || a.startedMs >= best.startedMs) best = a;
    }
    return best;
  };
  const queue = latest(actives.filter((a) => a.isQueue));
  if (queue !== null) return queue;
  return latest(actives.filter((a) => !a.isQueue));
}

/** Timestamp of a run's last event, in ms; falls back to `fallback`. */
function lastEventMsOf(runs: readonly RunData[], runId: string, fallback: number): number {
  const events = findRun(runs, runId);
  if (events === null || events.length === 0) return fallback;
  const last = events[events.length - 1];
  return last === undefined ? fallback : parsedTs(last.ts);
}

/** One line per event (SPEC 13.5); values are escaped so a line stays a line. */
function eventLine(event: Event): string {
  const shown = new Set(['ts', 'run_id', 'batch_id', 'event']);
  const fields = Object.entries(event)
    .filter(([key, value]) => !shown.has(key) && value !== undefined)
    .map(([key, value]) => {
      if (typeof value === 'string' && !value.includes('\n') && !value.includes('\r')) {
        return `${key}=${value}`;
      }
      return `${key}=${JSON.stringify(value)}`;
    });
  const head = `${event.ts} ${event.run_id} ${event.event}`;
  return fields.length === 0 ? head : `${head} ${fields.join(' ')}`;
}

/** The `status` current section (SPEC 13.2) for a fresh frame. */
function frameText(runs: readonly RunData[], now: Date): string {
  if (runs.length === 0) return 'no runs recorded\n';
  const view = buildStatus(runs, [], now);
  return formatCurrentSection(view.current);
}

/**
 * Changes only when the current run or its phase changes (SPEC 13.5), so the
 * per-poll durations in the frame do not make every poll look like a change.
 */
function frameKey(runs: readonly RunData[]): string {
  if (runs.length === 0) return 'empty';
  // `now` is irrelevant to state / run / phase; pass a fixed instant.
  const c = buildStatus(runs, [], new Date(0)).current;
  return [c.state, c.runId ?? '-', c.phase ?? '-', c.lastRunId ?? '-', c.lastVerdict ?? '-'].join(
    ':',
  );
}

/**
 * Polls the journal until a run finishes (SPEC 13.5).
 * Returns 0 on run.finished / queue.finished / --once / timeout, the only exits
 * the SPEC defines. Never writes anything.
 */
export async function watch(deps: WatchDeps): Promise<number> {
  const startMs = deps.now().getTime();
  const initial = deps.load(deps.root);

  if (deps.once) {
    deps.out(frameText(initial, deps.now()));
    return 0;
  }

  // Everything already on disk is history: only events appearing after the
  // watch started count as "new" (SPEC 13.5). Runs that show up later start at 0.
  const seen = new Map<string, number>();
  for (const rd of initial) {
    if (rd.status === 'ok') seen.set(rd.runId, rd.events.length);
  }

  let followed = pickFollow(activeRuns(initial));
  let lastEventMs = followed === null ? startMs : lastEventMsOf(initial, followed.runId, startMs);
  let lastKey = frameKey(initial);
  deps.out(frameText(initial, deps.now()));
  if (followed === null) deps.out('waiting for a new run\n');
  let stallReported = false;

  for (;;) {
    if (
      deps.timeoutSecs !== null &&
      deps.now().getTime() - startMs >= deps.timeoutSecs * MS_PER_SECOND
    ) {
      return 0;
    }
    await deps.sleep(deps.intervalSecs * MS_PER_SECOND);

    const runs = deps.load(deps.root);

    // New events in journal order; the silence before one is marked on its line.
    const fresh: Event[] = [];
    for (const rd of runs) {
      if (rd.status !== 'ok') continue;
      const already = seen.get(rd.runId) ?? 0;
      for (let i = already; i < rd.events.length; i++) {
        const e = rd.events[i];
        if (e === undefined) continue;
        const ts = parsedTs(e.ts);
        const gapSecs = Math.floor((ts - lastEventMs) / MS_PER_SECOND);
        const silent = gapSecs >= deps.stallSecs ? `  [silent ${String(gapSecs)}s]` : '';
        lastEventMs = Math.max(lastEventMs, ts);
        fresh.push(e);
        deps.out(`${eventLine(e)}${silent}\n`);
      }
      seen.set(rd.runId, rd.events.length);
    }
    if (fresh.length > 0) stallReported = false;

    const actives = activeRuns(runs);
    if (followed === null) {
      const next = pickFollow(actives);
      if (next !== null) {
        followed = next;
        lastEventMs = lastEventMsOf(runs, next.runId, deps.now().getTime());
      }
    } else if (followed.isQueue) {
      const events = findRun(runs, followed.runId);
      if (events !== null && hasEvent(events, 'queue.finished')) {
        deps.out(frameText(runs, deps.now()));
        return 0;
      }
    } else {
      const events = findRun(runs, followed.runId);
      if (events !== null && hasEvent(events, 'run.finished')) {
        const queue = pickFollow(actives.filter((a) => a.isQueue));
        if (queue === null) {
          deps.out(frameText(runs, deps.now()));
          return 0;
        }
        // A queue owns this batch run: keep following the queue (SPEC 13.5).
        followed = queue;
        lastEventMs = lastEventMsOf(runs, queue.runId, deps.now().getTime());
      }
    }

    // Phase change → print the current section once (SPEC 13.5).
    const key = frameKey(runs);
    if (key !== lastKey) {
      deps.out(frameText(runs, deps.now()));
      lastKey = key;
    }

    // Silence beyond stall_secs with no new event → mark the seconds (SPEC 13.5).
    if (followed !== null && fresh.length === 0 && !stallReported) {
      const silenceSecs = Math.floor((deps.now().getTime() - lastEventMs) / MS_PER_SECOND);
      if (silenceSecs >= deps.stallSecs) {
        deps.out(
          `${deps.now().toISOString()} silent ${String(silenceSecs)}s (> ${String(deps.stallSecs)}s)\n`,
        );
        stallReported = true;
      }
    }
  }
}
