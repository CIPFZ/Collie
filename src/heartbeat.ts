// Heartbeat file management (SPEC 11.3): write, update, cleanup, orphan
// detection and parallel-write rejection. The heartbeat lives at
// .collie/heartbeat.json, gitignored (it is ephemeral process state).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/** Relative path of the heartbeat file inside the repository root. */
export const HEARTBEAT_RELATIVE_PATH = join('.collie', 'heartbeat.json');

/** SPEC 11.3: phase of the current run, updated as the pipeline progresses. */
export const HeartbeatPhaseSchema = z.enum(['worker', 'reviewer', 'ci', 'arbiter']);
export type HeartbeatPhase = z.infer<typeof HeartbeatPhaseSchema>;

export const HeartbeatSchema = z.strictObject({
  run_id: z.string().min(1),
  batch_id: z.string().min(1),
  pid: z.number().int().positive(),
  /** SPEC 11.3: RunHandle.pid of the worker subprocess, if available. */
  worker_pid: z.number().int().positive().optional(),
  /** SPEC 11.3: pid of the guard daemon that kills the worker when R2 dies. */
  guard_pid: z.number().int().positive().optional(),
  /** SPEC 11.3: current pipeline phase (worker | reviewer | ci | arbiter). */
  phase: HeartbeatPhaseSchema,
  started_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type HeartbeatData = z.infer<typeof HeartbeatSchema>;

function heartbeatPath(root: string): string {
  return join(root, HEARTBEAT_RELATIVE_PATH);
}

// eslint-disable-next-line no-restricted-syntax -- JSON indentation, not a threshold
const JSON_INDENT = 2;

/**
 * Writes content atomically: write to a temp file in the same directory,
 * then rename. rename() on the same filesystem is atomic on POSIX, so a
 * concurrent reader never sees a partial/empty file (SPEC 11.3 v02-b04-fix3).
 */
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = filePath + '.tmp';
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, filePath);
}

/** Writes the heartbeat file at the start of a run (SPEC 11.3). */
export function writeHeartbeat(root: string, data: HeartbeatData): void {
  const hbFile = heartbeatPath(root);
  mkdirSync(dirname(hbFile), { recursive: true });
  atomicWrite(hbFile, JSON.stringify(data, null, JSON_INDENT) + '\n');
}

/** Updates only the `updated_at` timestamp (called on every event). */
export function touchHeartbeat(root: string, updatedAt: string): void {
  const hbFile = heartbeatPath(root);
  let raw: string;
  try {
    raw = readFileSync(hbFile, 'utf8');
  } catch {
    // Heartbeat was already cleaned up (race with normal exit). Nothing to touch.
    return;
  }
  const data = HeartbeatSchema.parse(JSON.parse(raw));
  atomicWrite(hbFile, JSON.stringify({ ...data, updated_at: updatedAt }, null, JSON_INDENT) + '\n');
}

/**
 * Updates selected fields of the heartbeat (SPEC 11.3): used for phase
 * transitions and adding worker_pid after the runner starts.
 */
export function updateHeartbeat(
  root: string,
  updates: {
    phase?: HeartbeatPhase;
    worker_pid?: number | null;
    guard_pid?: number;
    updated_at: string;
  },
): void {
  const hbFile = heartbeatPath(root);
  let raw: string;
  try {
    raw = readFileSync(hbFile, 'utf8');
  } catch {
    // Heartbeat was already cleaned up. Nothing to update.
    return;
  }
  const data = HeartbeatSchema.parse(JSON.parse(raw));
  // worker_pid=null means "remove the field" (SPEC 11.3: reviewer phase clears worker_pid).
  const merged = {
    ...data,
    ...(updates.phase !== undefined ? { phase: updates.phase } : {}),
    ...(updates.worker_pid === null
      ? {}
      : updates.worker_pid !== undefined
        ? { worker_pid: updates.worker_pid }
        : {}),
    ...(updates.guard_pid !== undefined ? { guard_pid: updates.guard_pid } : {}),
    updated_at: updates.updated_at,
  };
  // If worker_pid is explicitly set to null, remove it from the merged object.
  if (updates.worker_pid === null) {
    delete (merged as Record<string, unknown>).worker_pid;
  }
  atomicWrite(hbFile, JSON.stringify(merged, null, JSON_INDENT) + '\n');
}

/** Removes the heartbeat file (called when a run finishes normally). */
export function removeHeartbeat(root: string): void {
  rmSync(heartbeatPath(root), { force: true });
}

/** Checks whether a process with the given pid is alive. */
function isProcessAlive(pid: number): boolean {
  try {
    // kill(pid, 0) tests existence without sending a signal.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export type HeartbeatCheck =
  | { status: 'none' }
  | { status: 'orphan'; data: HeartbeatData }
  | { status: 'alive'; data: HeartbeatData };

/**
 * Startup check (SPEC 11.3): if the heartbeat file exists and the pid is dead,
 * the previous run was killed (orphan). If the pid is alive, another instance
 * is running (refuse to start). If the file is absent, nothing to do.
 */
export function checkHeartbeat(root: string): HeartbeatCheck {
  const path = heartbeatPath(root);
  if (!existsSync(path)) return { status: 'none' };
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { status: 'none' };
  }
  let parsed: ReturnType<typeof HeartbeatSchema.safeParse>;
  try {
    parsed = HeartbeatSchema.safeParse(JSON.parse(raw));
  } catch {
    // Corrupted JSON: remove and treat as missing.
    rmSync(path, { force: true });
    return { status: 'none' };
  }
  if (!parsed.success) {
    // Corrupted heartbeat: treat as orphan with a synthetic data block so
    // the caller can record the event and clean up.
    rmSync(path, { force: true });
    return { status: 'none' };
  }
  const data = parsed.data;
  // SPEC 11.3: if any of pid / worker_pid / guard_pid is alive,
  // another instance is running — refuse to start.
  const pidAlive = isProcessAlive(data.pid);
  const workerPidAlive = data.worker_pid !== undefined && isProcessAlive(data.worker_pid);
  const guardPidAlive = data.guard_pid !== undefined && isProcessAlive(data.guard_pid);
  return pidAlive || workerPidAlive || guardPidAlive
    ? { status: 'alive', data }
    : { status: 'orphan', data };
}
