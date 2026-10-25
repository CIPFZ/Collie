// Structural invariants (SPEC 3.2): grep-based checks from passed batches,
// permanently enforced via `npm test`. Each test corresponds to a batch's
// acceptance grep that must never regress.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');

describe('structural invariants (SPEC 3.2)', () => {
  it('.collie/heartbeat.json is gitignored (b02)', () => {
    // git check-ignore exits 0 when the path is ignored, 1 when not.
    execSync('git check-ignore -q .collie/heartbeat.json', { cwd: ROOT });
  });

  it('.collie/github-token is gitignored (v02-b04-fix2)', () => {
    execSync('git check-ignore -q .collie/github-token', { cwd: ROOT });
  });

  it('scenario-g.test.ts has no real timers: setInterval or setTimeout( (b04-tests)', () => {
    const content = readFileSync(join(ROOT, 'test/scenario-g.test.ts'), 'utf8');
    expect(content).not.toMatch(/setInterval|setTimeout\(/);
  });

  it('ladder.test.ts has no real timers: setInterval or setTimeout( (b04-tests)', () => {
    const content = readFileSync(join(ROOT, 'test/ladder.test.ts'), 'utf8');
    expect(content).not.toMatch(/setInterval|setTimeout\(/);
  });

  it('src/runner/claude.ts has no softStopRequested (b03)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    expect(content).not.toContain('softStopRequested');
  });

  it('src/runner/claude.ts has no extracted interrupt call (b04-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    // Extracting interrupt() from the iterable loses `this` (v02-b04-fix).
    expect(content).not.toMatch(/= *(resolvedIterable|queryIterable)\??\.interrupt;/);
  });

  it('src/ files outside src/runner/ do not import @anthropic-ai (b02)', () => {
    let output: string;
    try {
      output = execSync('grep -rlE "@anthropic-ai" src --include="*.ts"', {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
    } catch {
      // grep exit 1 = no matches at all: pass.
      return;
    }
    const leaked = output.split('\n').filter((f) => !f.startsWith('src/runner/'));
    expect(leaked, `@anthropic-ai leaked outside src/runner/: ${leaked.join(', ')}`).toHaveLength(
      0,
    );
  });

  it('src/ladder.ts has injectable fingerprint field: fingerprint?: (b04-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/ladder.ts'), 'utf8');
    expect(content).toMatch(/fingerprint\?:/);
  });

  it('heartbeat.ts uses atomic renameSync, not direct writeFileSync to path (b04-fix3)', () => {
    const content = readFileSync(join(ROOT, 'src/heartbeat.ts'), 'utf8');
    expect(content).toMatch(/renameSync/);
    // writeFileSync(path, ...) must not appear — all writes go through atomicWrite.
    // The temp-file write uses writeFileSync(tmpPath, ...) which is fine.
    expect(content).not.toMatch(/writeFileSync\(path,/);
  });

  it('runner/claude.ts uses spawnClaudeCodeProcess hook for worker pid (b04-fix3)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    expect(content).toMatch(/spawnClaudeCodeProcess/);
  });

  it('runner/claude.ts imports types from @anthropic-ai/claude-agent-sdk and has no hand-written SpawnHook interface (v02-b04-fix4)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    // Must import types from the SDK (SPEC 11.2). The import may span multiple lines.
    expect(content).toContain("from '@anthropic-ai/claude-agent-sdk'");
    expect(content).toMatch(/import type\b/);
    // Must NOT have hand-written SpawnHook interfaces.
    expect(content).not.toMatch(/interface SpawnHook/);
  });

  it('ci.resolved appears in schema, run.ts, and this invariants file (v02-b05)', () => {
    const schema = readFileSync(join(ROOT, 'src/schema/index.ts'), 'utf8');
    const run = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    expect(schema).toContain('ci.resolved');
    expect(run).toContain('ci.resolved');
  });

  it('RULE_DEFAULT = 10 in arbiter.ts (v02-b05-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/arbiter.ts'), 'utf8');
    expect(content).toMatch(/RULE_DEFAULT = 10/);
  });

  it('src/runner/claude.ts contains redact (v02-e-drill)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    expect(content).toContain('redact');
  });

  it('src/runner/claude.ts uses detached: true for worker subprocess (v02-e-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    expect(content).toContain('detached: true');
  });

  it('src/run.ts does not use baseSha: taskSha for evidence (v02-e-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    // SPEC 11.7: evidence and reviewer must use the first run's base_sha,
    // not the task commit sha. This pattern must not appear.
    expect(content).not.toMatch(/baseSha: taskSha/);
  });

  it('only src/run.ts and src/evidence.ts access .token_file (v02-e-drill)', () => {
    let output: string;
    try {
      output = execSync('grep -rlE "\\.token_file" src --include="*.ts"', {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
    } catch {
      // grep exit 1 = no matches: pass (nothing accesses token_file).
      return;
    }
    const files = output.split('\n').filter(Boolean);
    const allowed = new Set(['src/run.ts', 'src/evidence.ts']);
    const leaked = files.filter((f) => !allowed.has(f));
    expect(leaked, `token_file accessed outside allowed files: ${leaked.join(', ')}`).toHaveLength(
      0,
    );
  });
});
