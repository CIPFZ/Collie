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
});
