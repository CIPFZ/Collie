// Heartbeat file management (SPEC 11.3): write, update, cleanup, orphan
// detection and parallel-write rejection. The heartbeat lives at
// .collie/heartbeat.json, gitignored (it is ephemeral process state).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/** Relative path of the heartbeat file inside the repository root. */
export const HEARTBEAT_RELATIVE_PATH = join('.collie', 'heartbeat.json');

export const HeartbeatSchema = z.strictObject({
  run_id: z.string().min(1),
  batch_id: z.string().min(1),
  pid: z.number().int().positive(),
  /** SPEC 11.3: worker_pid is the RunHandle.pid from the agent process. */
  worker_pid: z.number().int().positive().optional(),
  /** SPEC 11.3: phase tracks where the run is in the pipeline. */
  phase: z.enum(['worker', 'reviewer', 'ci', 'arbiter']).optional(),
  started_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type HeartbeatData = z.infer<typeof HeartbeatSchema>;

function heartbeatPath(root: string): string {
  return join(root, HEARTBEAT_RELATIVE_PATH);
}

// eslint-disable-next-line no-restricted-syntax -- JSON indentation, not a threshold
const JSON_INDENT = 2;

/** Writes the heartbeat file at the start of a run (SPEC 11.3). */
export function writeHeartbeat(root: string, data: HeartbeatData): void {
  const path = heartbeatPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, JSON_INDENT) + '\n');
}

/** Updates only the `updated_at` timestamp (called on every event). */
export function touchHeartbeat(root: string, updatedAt: string): void {
  const path = heartbeatPath(root);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // Heartbeat was already cleaned up (race with normal exit). Nothing to touch.
    return;
  }
  const data = HeartbeatSchema.parse(JSON.parse(raw));
  writeFileSync(path, JSON.stringify({ ...data, updated_at: updatedAt }, null, JSON_INDENT) + '\n');
}

/** Removes the heartbeat file (called when a run finishes normally). */
export function removeHeartbeat(root: string): void {
  rmSync(heartbeatPath(root), { force: true });
}

/** Updates the phase and updated_at of the heartbeat file (SPEC 11.3: covers entire run). */
export function updateHeartbeatPhase(
  root: string,
  phase: HeartbeatData['phase'],
  updatedAt: string,
): void {
  const path = heartbeatPath(root);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  const data = HeartbeatSchema.parse(JSON.parse(raw));
  writeFileSync(
    path,
    JSON.stringify({ ...data, phase, updated_at: updatedAt }, null, JSON_INDENT) + '\n',
  );
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
  // SPEC 11.3: either pid or worker_pid being alive means the run is still active.
  const anyAlive =
    isProcessAlive(data.pid) || (data.worker_pid !== undefined && isProcessAlive(data.worker_pid));
  return anyAlive ? { status: 'alive', data } : { status: 'orphan', data };
}
