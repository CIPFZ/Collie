// Guard daemon tests (SPEC 11.3): the worker subprocess must die when R2 dies.
// Uses a fake child process (node -e) and the real guard daemon; SIGKILL the
// R2 substitute, then assert the child dies within 5 seconds.
// No network, no real model, no real runner (CONSTRAINTS 铁律 16).
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { spawnGuardDaemon } from '../src/run.js';

/** Checks whether a process is alive. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const WAIT_TIMEOUT_MS = 8000;
const POLL_MS = 200;

/**
 * Waits up to `timeoutMs` for a pid to become dead, polling every POLL_MS.
 * Returns true if the process died within the timeout.
 */
async function waitForDeath(pid: number, timeoutMs = WAIT_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise<void>((r) => setTimeout(r, POLL_MS));
  }
  return !isAlive(pid);
}

/** Spawns a node process that sleeps forever, detached. Returns its pid. */
function spawnSleeper(): number {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const pid = child.pid;
  if (pid === undefined) throw new Error('sleeper did not start');
  return pid;
}

// Pids to clean up on test failure.
const pidsToClean: number[] = [];

afterEach(() => {
  for (const pid of pidsToClean) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already dead.
    }
  }
  pidsToClean.length = 0;
});

describe("guard daemon: worker subprocess dies when parent is SIGKILL'd (SPEC 11.3)", () => {
  it('guard kills the worker when the parent substitute dies', async () => {
    // 1. Spawn a "worker" that just sleeps forever.
    const workerPid = spawnSleeper();
    pidsToClean.push(workerPid);

    // 2. Spawn a "parent substitute" (fake R2) that also sleeps.
    const parentPid = spawnSleeper();
    pidsToClean.push(parentPid);

    // 3. Spawn the real guard daemon watching the parent and worker.
    const guardPid = spawnGuardDaemon(parentPid, workerPid);
    pidsToClean.push(guardPid);

    // Verify all three are alive.
    expect(isAlive(workerPid)).toBe(true);
    expect(isAlive(parentPid)).toBe(true);
    expect(isAlive(guardPid)).toBe(true);

    // 4. SIGKILL the parent substitute.
    process.kill(parentPid, 'SIGKILL');
    // SIGKILL is async on Linux; wait for the parent to actually die.
    const parentDied = await waitForDeath(parentPid);
    expect(parentDied).toBe(true);

    // 5. Assert the worker dies within 5 seconds (guard polls every 2s).
    const died = await waitForDeath(workerPid);
    expect(died, "worker should die within 5 seconds after parent is SIGKILL'd").toBe(true);

    // Guard should also have exited.
    const guardDied = await waitForDeath(guardPid);
    expect(guardDied).toBe(true);
  });

  it('guard exits cleanly when the worker is already dead', async () => {
    // Spawn a worker that exits immediately.
    const shortLived = spawn(process.execPath, ['-e', 'process.exit(0)'], {
      detached: true,
      stdio: 'ignore',
    });
    shortLived.unref();
    const workerPid = shortLived.pid;
    if (workerPid === undefined) throw new Error('short-lived process did not start');
    // Wait for it to exit.
    await new Promise<void>((resolve) => {
      shortLived.on('exit', resolve);
    });
    expect(isAlive(workerPid)).toBe(false);

    // Spawn a fake parent.
    const parentPid = spawnSleeper();
    pidsToClean.push(parentPid);

    // Guard should still start (SIGKILL on a dead pid is harmless).
    const guardPid = spawnGuardDaemon(parentPid, workerPid);
    pidsToClean.push(guardPid);

    // SIGKILL the parent. Guard tries to kill an already-dead worker — no error.
    process.kill(parentPid, 'SIGKILL');
    const guardDied = await waitForDeath(guardPid);
    expect(guardDied, 'guard should exit after parent dies even if worker is already dead').toBe(
      true,
    );
  });
});
