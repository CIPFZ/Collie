// Runs acceptance commands and returns structured results (SPEC 3.2, 3.5).
// Commands are always taken from parseBacklog output, never from Markdown
// source: a GFM `\|` pasted into a shell is a literal pipe (SPEC 3.2).
import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import { loadBacklog } from './backlog.js';
import type { Acceptance } from './schema/index.js';

/** POSIX shells report death by signal N as exit status 128 + N. */
// eslint-disable-next-line no-restricted-syntax -- shell convention, not a threshold
const SIGNAL_EXIT_BASE = 128;

export interface CommandOutput {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface TestCounts {
  passed: number;
  failed: number;
  skipped: number;
  /** Test files that failed to run at all; their tests are absent from the counts above. */
  files_failed: number;
}

export interface VerifyResult extends CommandOutput {
  desc: string;
  cmd: string;
  passed: boolean;
  /** One line, e.g. "47 passed, 0 failed" for a vitest run (SPEC 3.5 example). */
  summary: string;
  tests?: TestCounts;
}

export interface RunOptions {
  cwd: string;
  signal?: AbortSignal;
}

export class VerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerifyError';
  }
}

/**
 * Runs one command through the POSIX shell in its own process group, so an
 * abort reaches grandchildren (npm -> vitest) too. Never rejects on a non-zero
 * exit; rejects only when the command cannot be started or is aborted.
 */
export function runCommand(cmd: string, opts: RunOptions): Promise<CommandOutput> {
  return new Promise((resolve, reject) => {
    opts.signal?.throwIfAborted();
    const child = spawn(cmd, {
      cwd: opts.cwd,
      shell: true,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Colour codes would end up in evidence summaries.
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    const onAbort = (): void => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // The group already exited.
        }
      }
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (error) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new VerifyError(`cannot run ${JSON.stringify(cmd)}: ${error.message}`));
    });
    child.on('close', (code, signalName) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (opts.signal?.aborted === true) {
        reject(
          opts.signal.reason instanceof Error ? opts.signal.reason : new VerifyError('aborted'),
        );
        return;
      }
      const exitCode =
        code ?? SIGNAL_EXIT_BASE + (signalName === null ? 0 : constants.signals[signalName]);
      resolve({
        exit_code: exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

// eslint-disable-next-line no-control-regex -- strips ANSI SGR sequences from captured output
const ANSI = /\u001b\[[0-9;]*m/g;
const VITEST_TESTS = /^\s*Tests\s+(?<parts>.+?)\s+\(\d+\)\s*$/m;
const VITEST_FILES = /^\s*Test Files\s+(?<parts>.+?)\s+\(\d+\)\s*$/m;
const COUNT = /(?<n>\d+)\s+(?<kind>passed|failed|skipped|todo)/g;

function counts(parts: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of parts.matchAll(COUNT)) {
    const kind = m.groups?.kind ?? '';
    out[kind] = (out[kind] ?? 0) + Number(m.groups?.n ?? '0');
  }
  return out;
}

/** Extracts vitest totals from command output, or undefined when it is not a vitest run. */
export function parseTestCounts(output: string): TestCounts | undefined {
  const text = output.replace(ANSI, '');
  const tests = VITEST_TESTS.exec(text)?.groups?.parts;
  const files = VITEST_FILES.exec(text)?.groups?.parts;
  if (tests === undefined && files === undefined) return undefined;
  const t = counts(tests ?? '');
  const f = counts(files ?? '');
  return {
    passed: t.passed ?? 0,
    failed: t.failed ?? 0,
    skipped: (t.skipped ?? 0) + (t.todo ?? 0),
    files_failed: f.failed ?? 0,
  };
}

function lastLine(text: string): string | undefined {
  return text
    .replace(ANSI, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .at(-1);
}

function summarize(output: CommandOutput, tests: TestCounts | undefined): string {
  if (tests !== undefined) {
    const parts = [`${String(tests.passed)} passed`, `${String(tests.failed)} failed`];
    if (tests.skipped > 0) parts.push(`${String(tests.skipped)} skipped`);
    if (tests.files_failed > 0) parts.push(`${String(tests.files_failed)} test files failed`);
    return parts.join(', ');
  }
  return lastLine(output.stdout) ?? lastLine(output.stderr) ?? `exit ${String(output.exit_code)}`;
}

function judge(expect: Acceptance['expect'], output: CommandOutput): boolean {
  if (expect === 'exit_zero') return output.exit_code === 0;
  let pattern: RegExp;
  try {
    pattern = new RegExp(expect.stdout_matches, 'm');
  } catch (error) {
    throw new VerifyError(
      `invalid stdout_matches ${JSON.stringify(expect.stdout_matches)}: ${String(error)}`,
    );
  }
  return output.exit_code === 0 && pattern.test(output.stdout);
}

/** Runs acceptance commands one after another (CONSTRAINTS 铁律 7) in `opts.cwd`. */
export async function runAcceptance(
  acceptance: readonly Acceptance[],
  opts: RunOptions,
): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];
  for (const item of acceptance) {
    const output = await runCommand(item.cmd, opts);
    const tests = parseTestCounts(`${output.stdout}\n${output.stderr}`);
    results.push({
      desc: item.desc,
      cmd: item.cmd,
      ...output,
      passed: judge(item.expect, output),
      summary: summarize(output, tests),
      ...(tests === undefined ? {} : { tests }),
    });
  }
  return results;
}

/** Parses `<root>/docs/backlog.md` and runs the acceptance commands of `batchId` in `root`. */
export async function verifyBatch(
  root: string,
  batchId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<VerifyResult[]> {
  const batch = loadBacklog(root).find((b) => b.id === batchId);
  if (batch === undefined) throw new VerifyError(`batch ${batchId} is not in the backlog`);
  return runAcceptance(batch.acceptance, { cwd: root, ...opts });
}
