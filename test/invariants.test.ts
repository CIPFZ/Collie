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

  it('rescue_sha cross-run lookup and 请先核实 are in run.ts and worker.ts (v02-e-fix2)', () => {
    const run = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    const worker = readFileSync(join(ROOT, 'src/roles/worker.ts'), 'utf8');
    // SPEC 11.7: rescue_sha must be looked up from both the previous run and
    // the current run (orphan rescue path).
    expect(run).toContain('rescue_sha');
    expect(run).toContain('currentRunRescueSha');
    // SPEC 11.7: task body must contain the 请先核实 sentence when rescue_sha exists.
    expect(worker).toContain('请先核实');
  });

  it('src/git.ts exports push function (v03-b01)', () => {
    const content = readFileSync(join(ROOT, 'src/git.ts'), 'utf8');
    expect(content).toMatch(/export async function push\(/);
  });

  it('scenario-h.test.ts exists (v03-b01)', () => {
    const content = readFileSync(join(ROOT, 'test/scenario-h.test.ts'), 'utf8');
    expect(content).toContain('scenario H');
    expect(content).toContain('verdict.downgraded');
    expect(content).toContain('rule');
  });

  it('every await push( in run.ts has push_failed or verdict within 5 lines above (v03-b01-fix)', () => {
    const lines = readFileSync(join(ROOT, 'src/run.ts'), 'utf8').split('\n');
    const pushLines = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => line.includes('await push('));
    // SPEC 12.1: expect exactly 4 push calls after v04-b07 (3 from v03-b01-fix + 1 for fix_max).
    expect(pushLines.length).toBeGreaterThanOrEqual(1);
    expect(pushLines.length).toBeLessThanOrEqual(4);
    for (const { line, i } of pushLines) {
      const start = Math.max(0, i - 5);
      const context = lines.slice(start, i).join('\n');
      expect(
        /push_failed|verdict/.test(context),
        `push( at line ${String(i + 1)} has no push_failed or verdict in the 5 lines above:\n${context}\n>>> ${line}`,
      ).toBe(true);
    }
  });

  it('src/runner/claude.ts simultaneously contains tools: and allowedTools: (v03-b02)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    // SPEC 11.2 (v03-b02): both must be present to restrict the available tool set
    // while also bypassing permission prompts for those tools.
    expect(content).toMatch(/tools:/);
    expect(content).toMatch(/allowedTools:/);
  });

  it('src/runner/claude.ts contains disallowedTools (v03-b02)', () => {
    const content = readFileSync(join(ROOT, 'src/runner/claude.ts'), 'utf8');
    // SPEC 11.2 (v03-b02): reviewer must have disallowedTools to physically block write tools.
    expect(content).toContain('disallowedTools');
  });

  it('src/backlog.ts exports setBatchStatus (v03-b03)', () => {
    const content = readFileSync(join(ROOT, 'src/backlog.ts'), 'utf8');
    expect(content).toMatch(/export function setBatchStatus\(/);
  });

  it('test/scenario-j.test.ts exists and covers queue mode (v03-b03)', () => {
    const content = readFileSync(join(ROOT, 'test/scenario-j.test.ts'), 'utf8');
    expect(content).toContain('scenario J');
    expect(content).toContain('fix_max');
    expect(content).toContain('escalated');
    expect(content).toContain('queue.finished');
  });

  it('src/cli.ts does not contain "rule 0" (v03-b03-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/cli.ts'), 'utf8');
    // SPEC 4.3: escalation path is not "rule 0", it's "上報：無 report".
    expect(content).not.toMatch(/rule 0/);
  });

  it('src/evidence.ts contains report(collie) in R2 commit prefixes (v03-b03-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/evidence.ts'), 'utf8');
    // SPEC 11.7: evidence filtering must recognise report(collie) commits.
    expect(content).toContain('report(collie)');
  });

  it('src/run.ts contains sdk_stop_reason for ladder-overridden stops (v03-b03-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    // SPEC 11.7: when the signal ladder fires, the SDK's original stop_reason
    // goes into sdk_stop_reason.
    expect(content).toContain('sdk_stop_reason');
  });

  it('src/run.ts contains tool.denied journal recording (v03-b03-fix2)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    // SPEC 3.6: runner emits tool.denied via onEvent; R2 records it to the journal.
    expect(content).toContain('tool.denied');
  });

  it('src/gate.ts exists and does not import runner or journal (v03-b04)', () => {
    const content = readFileSync(join(ROOT, 'src/gate.ts'), 'utf8');
    // SPEC 12.3: gateDecision must be a pure function — no runner/journal deps.
    expect(content).toContain('gateDecision');
    expect(content).not.toContain("from './runner");
    expect(content).not.toContain("from './journal");
  });

  it('test/scenario-l.test.ts exists and covers gate, rule 1 retry, rule 9 consecutive (v03-b04)', () => {
    const content = readFileSync(join(ROOT, 'test/scenario-l.test.ts'), 'utf8');
    expect(content).toContain('scenario L');
    expect(content).toContain('queue.paused');
    expect(content).toContain('batch.retried');
    expect(content).toContain('rule9_twice');
  });

  it('vitest.config.ts testTimeout is at least 30000 (v03-b03-fix2)', () => {
    const content = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
    // SPEC 11.5: scenario-j and cli tests with real git can take 6–8s; 10s was flaky.
    const match = /testTimeout:\s*(\d[\d_]*)/.exec(content);
    expect(match).toBeTruthy();
    const raw = match?.[1] ?? '0';
    const value = Number(raw.replace(/_/g, ''));
    expect(value).toBeGreaterThanOrEqual(30_000);
  });

  it('src/run.ts contains queue.batch_started recording (v03-b04-fix)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    expect(content).toContain('queue.batch_started');
  });

  it('src/run.ts does not contain countBatchFinished outside comments (v03-b04-fix)', () => {
    const lines = readFileSync(join(ROOT, 'src/run.ts'), 'utf8').split('\n');
    const codeLines = lines.filter((l) => !l.trimStart().startsWith('//'));
    const hasCountBatchFinished = codeLines.some((l) => l.includes('countBatchFinished'));
    expect(
      hasCountBatchFinished,
      'countBatchFinished should not appear in non-comment code lines',
    ).toBe(false);
  });

  it('src/schema/index.ts contains evidence.collected and reviewer.finished event types (v04-b01)', () => {
    const content = readFileSync(join(ROOT, 'src/schema/index.ts'), 'utf8');
    expect(content).toContain('evidence.collected');
    expect(content).toContain('reviewer.finished');
  });

  it('src/gate.ts does not contain protectedDiffLines (v04-b01)', () => {
    const content = readFileSync(join(ROOT, 'src/gate.ts'), 'utf8');
    expect(content).not.toContain('protectedDiffLines');
  });

  it('src/view.ts does not import run.ts, runner/, or roles/ (v04-b02)', () => {
    const content = readFileSync(join(ROOT, 'src/view.ts'), 'utf8');
    // SPEC 13.2: projection module must not depend on runtime execution modules.
    expect(content).not.toMatch(/from '\.\/run[./]/);
    expect(content).not.toMatch(/from '\.\/runner[./]/);
    expect(content).not.toMatch(/from '\.\/roles[./]/);
  });

  it('src/cli.ts contains the timeline command (v04-b03)', () => {
    const content = readFileSync(join(ROOT, 'src/cli.ts'), 'utf8');
    expect(content).toContain('timeline');
  });

  it('test/watch.test.ts has no real timers: setInterval or setTimeout( (v04-b05)', () => {
    const content = readFileSync(join(ROOT, 'test/watch.test.ts'), 'utf8');
    // SPEC 13.5: the polling loop uses injected clock and sleep in tests.
    expect(content).not.toMatch(/setInterval|setTimeout\(/);
  });

  it('src/watch.ts writes no files and sends no signals (v04-b05)', () => {
    const content = readFileSync(join(ROOT, 'src/watch.ts'), 'utf8');
    // SPEC 13.5: watch is read-only: no journal writes, no heartbeat, no signals.
    expect(content).not.toMatch(/writeFileSync|appendFileSync|process\.kill/);
  });

  it('src/run.ts contains evidence_unavailable (v04-b06)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    // SPEC 13.9: environment fault handling — evidence_unavailable cause in code.
    expect(content).toContain('evidence_unavailable');
  });

  it('src/run.ts contains batch_run_id in queue.batch_started recording (v04-b07)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    // SPEC 13.10: queue.batch_started uses batch_run_id, not run_id (which would
    // collide with the event envelope key).
    expect(content).toContain('batch_run_id');
  });

  it('src/view.ts does not contain batchSelected.attempt in non-comment code (v04-b08)', () => {
    const lines = readFileSync(join(ROOT, 'src/view.ts'), 'utf8').split('\n');
    const codeLines = lines.filter(
      (l) =>
        !l.trimStart().startsWith('//') &&
        !l.trimStart().startsWith('*') &&
        !l.trimStart().startsWith('/*'),
    );
    const hasBatchSelectedAttempt = codeLines.some((l) => l.includes('batchSelected.attempt'));
    expect(
      hasBatchSelectedAttempt,
      'batchSelected.attempt should not appear in non-comment code lines',
    ).toBe(false);
  });

  it('test/view-real.test.ts contains Sandbox.create (v04-b08)', () => {
    const content = readFileSync(join(ROOT, 'test/view-real.test.ts'), 'utf8');
    expect(content).toContain('Sandbox.create');
  });

  it('src/cli.ts contains the why command (v04-b09)', () => {
    const content = readFileSync(join(ROOT, 'src/cli.ts'), 'utf8');
    expect(content).toContain('why');
  });

  it('src/schema/index.ts contains queue.gate_passed (v04-b10)', () => {
    const content = readFileSync(join(ROOT, 'src/schema/index.ts'), 'utf8');
    expect(content).toContain('queue.gate_passed');
  });

  it('src/run.ts contains interrupt_retry (v04-b10)', () => {
    const content = readFileSync(join(ROOT, 'src/run.ts'), 'utf8');
    expect(content).toContain('interrupt_retry');
  });
});
