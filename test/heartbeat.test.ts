// Heartbeat lifecycle: write, touch, update, remove, orphan detection, parallel rejection.
// No network, no real runner (CONSTRAINTS 铁律 16).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkHeartbeat,
  HEARTBEAT_RELATIVE_PATH,
  HeartbeatSchema,
  removeHeartbeat,
  touchHeartbeat,
  updateHeartbeat,
  writeHeartbeat,
  type HeartbeatData,
} from '../src/heartbeat.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collie-hb-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function hbPath(): string {
  return join(root, HEARTBEAT_RELATIVE_PATH);
}

function validData(overrides: Partial<HeartbeatData> = {}): HeartbeatData {
  return {
    run_id: 'r-test',
    batch_id: 'v99-b01',
    pid: process.pid,
    phase: 'worker',
    started_at: '2026-10-20T12:00:00Z',
    updated_at: '2026-10-20T12:00:00Z',
    ...overrides,
  };
}

describe('heartbeat: write and read back', () => {
  it('creates the file with all required fields', () => {
    writeHeartbeat(root, validData());
    expect(existsSync(hbPath())).toBe(true);
    const data = HeartbeatSchema.parse(JSON.parse(readFileSync(hbPath(), 'utf8')));
    expect(data.run_id).toBe('r-test');
    expect(data.batch_id).toBe('v99-b01');
    expect(data.pid).toBe(process.pid);
  });

  it('creates parent directories when needed', () => {
    writeHeartbeat(root, validData());
    expect(existsSync(hbPath())).toBe(true);
  });
});

describe('heartbeat: touch updates only updated_at', () => {
  it('advances updated_at without changing other fields', () => {
    writeHeartbeat(root, validData());
    touchHeartbeat(root, '2026-10-20T12:05:00Z');
    const data = HeartbeatSchema.parse(JSON.parse(readFileSync(hbPath(), 'utf8')));
    expect(data.updated_at).toBe('2026-10-20T12:05:00Z');
    expect(data.started_at).toBe('2026-10-20T12:00:00Z');
    expect(data.run_id).toBe('r-test');
  });

  it('is a no-op when the heartbeat file is already gone', () => {
    // No file written — touchHeartbeat should not throw.
    expect(() => {
      touchHeartbeat(root, '2026-10-20T12:05:00Z');
    }).not.toThrow();
  });
});

describe('heartbeat: remove', () => {
  it('deletes the file', () => {
    writeHeartbeat(root, validData());
    removeHeartbeat(root);
    expect(existsSync(hbPath())).toBe(false);
  });

  it('is idempotent (second remove does not throw)', () => {
    removeHeartbeat(root);
    expect(() => {
      removeHeartbeat(root);
    }).not.toThrow();
  });
});

describe('heartbeat: checkHeartbeat', () => {
  it('returns "none" when no heartbeat file exists', () => {
    expect(checkHeartbeat(root)).toEqual({ status: 'none' });
  });

  it('returns "alive" when the pid is our own process', () => {
    writeHeartbeat(root, validData({ pid: process.pid }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('alive');
    expect(result.status === 'alive' && result.data.pid).toBe(process.pid);
  });

  it('returns "orphan" when the pid does not exist', () => {
    // Use a pid that almost certainly doesn't exist.
    writeHeartbeat(root, validData({ pid: 999999 }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('orphan');
    expect(result.status === 'orphan' && result.data.run_id).toBe('r-test');
  });

  it('returns "none" for a corrupted heartbeat file', () => {
    mkdirSync(join(root, '.collie'), { recursive: true });
    writeFileSync(hbPath(), '{ not valid json');
    // Should not throw, just treat as missing.
    expect(checkHeartbeat(root).status).toBe('none');
  });

  it('returns "none" for an empty heartbeat file without throwing (atomic write race, SPEC 11.3)', () => {
    mkdirSync(join(root, '.collie'), { recursive: true });
    writeFileSync(hbPath(), '');
    // An empty file can occur if a crash interrupts between create and rename.
    // checkHeartbeat must handle it gracefully (SPEC 11.3 v02-b04-fix3).
    expect(() => checkHeartbeat(root)).not.toThrow();
    expect(checkHeartbeat(root).status).toBe('none');
  });

  it('returns "none" for a half-truncated JSON heartbeat file without throwing (SPEC 11.3)', () => {
    mkdirSync(join(root, '.collie'), { recursive: true });
    writeFileSync(hbPath(), '{ "run_id": "r-test", "batch_id"');
    // Truncated JSON from a crash mid-write. Must not throw (SPEC 11.3 v02-b04-fix3).
    expect(() => checkHeartbeat(root)).not.toThrow();
    expect(checkHeartbeat(root).status).toBe('none');
  });

  it('returns "alive" when the worker_pid is alive even if pid is dead (dual-pid check, SPEC 11.3)', () => {
    writeHeartbeat(root, validData({ pid: 999999, worker_pid: process.pid }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('alive');
  });

  it('returns "orphan" when both pid and worker_pid are dead', () => {
    writeHeartbeat(root, validData({ pid: 999999, worker_pid: 999998 }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('orphan');
  });
});

describe('heartbeat: updateHeartbeat changes phase and worker_pid', () => {
  it('updates the phase without changing other fields', () => {
    writeHeartbeat(root, validData({ phase: 'worker' }));
    updateHeartbeat(root, { phase: 'reviewer', updated_at: '2026-10-20T12:10:00Z' });
    const data = HeartbeatSchema.parse(JSON.parse(readFileSync(hbPath(), 'utf8')));
    expect(data.phase).toBe('reviewer');
    expect(data.updated_at).toBe('2026-10-20T12:10:00Z');
    expect(data.run_id).toBe('r-test');
    expect(data.pid).toBe(process.pid);
  });

  it('adds worker_pid to an existing heartbeat', () => {
    writeHeartbeat(root, validData());
    updateHeartbeat(root, { worker_pid: 42, updated_at: '2026-10-20T12:05:00Z' });
    const data = HeartbeatSchema.parse(JSON.parse(readFileSync(hbPath(), 'utf8')));
    expect(data.worker_pid).toBe(42);
    expect(data.updated_at).toBe('2026-10-20T12:05:00Z');
  });

  it('is a no-op when the heartbeat file does not exist', () => {
    expect(() => {
      updateHeartbeat(root, { phase: 'ci', updated_at: '2026-10-20T12:10:00Z' });
    }).not.toThrow();
  });
});

describe('heartbeat: reviewer phase parallel start rejected (SPEC 11.3)', () => {
  it('refuses to start when heartbeat is in reviewer phase and pid is alive', () => {
    writeHeartbeat(root, validData({ phase: 'reviewer', pid: process.pid }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('alive');
    // R2 would throw: "another Collie instance is running"
    expect(result.status === 'alive' && result.data.phase).toBe('reviewer');
  });

  it('refuses to start when heartbeat is in ci phase and pid is alive', () => {
    writeHeartbeat(root, validData({ phase: 'ci', pid: process.pid }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('alive');
    expect(result.status === 'alive' && result.data.phase).toBe('ci');
  });

  it('refuses to start when heartbeat is in arbiter phase and pid is alive', () => {
    writeHeartbeat(root, validData({ phase: 'arbiter', pid: process.pid }));
    const result = checkHeartbeat(root);
    expect(result.status).toBe('alive');
    expect(result.status === 'alive' && result.data.phase).toBe('arbiter');
  });
});
