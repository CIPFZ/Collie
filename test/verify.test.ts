import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Acceptance } from '../src/schema/index.js';
import {
  parseTestCounts,
  runAcceptance,
  runCommand,
  verifyBatch,
  VerifyError,
} from '../src/verify.js';

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'collie-verify-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function exitZero(cmd: string, desc = cmd): Acceptance {
  return { desc, cmd, expect: 'exit_zero' };
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(path: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8').trim();
      if (text !== '') return text;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`timed out waiting for ${path}`);
}

describe('verify: runCommand', () => {
  it('captures exit code, stdout and stderr without rejecting on failure', async () => {
    await expect(runCommand('echo out; echo err 1>&2; exit 3', { cwd })).resolves.toEqual({
      exit_code: 3,
      stdout: 'out\n',
      stderr: 'err\n',
    });
  });

  it('runs in the given cwd', async () => {
    writeFileSync(join(cwd, 'marker'), '');
    expect((await runCommand('test -f marker', { cwd })).exit_code).toBe(0);
  });

  it('supports shell syntax used by acceptance commands (!, &&, pipes)', async () => {
    expect((await runCommand('! false && printf "a|b" | grep -q "a|b"', { cwd })).exit_code).toBe(
      0,
    );
  });

  it('reports death by signal as 128 + N', async () => {
    expect((await runCommand('kill -TERM $$', { cwd })).exit_code).toBe(128 + 15);
  });

  it('disables colour in child processes', async () => {
    expect((await runCommand('printf "%s" "$NO_COLOR"', { cwd })).stdout).toBe('1');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const signal = AbortSignal.abort(new Error('budget spent'));
    await expect(runCommand('true', { cwd, signal })).rejects.toThrow('budget spent');
  });

  it('kills the whole process group on abort, including grandchildren', async () => {
    // POSIX only: CI's /bin/sh is dash. The inner shell records its pid, then
    // exec replaces it with sleep, so the file holds the grandchild's pid.
    const controller = new AbortController();
    const started = Date.now();
    const run = runCommand(`sh -c 'echo $$ > grandchild.pid; exec sleep 30' & wait`, {
      cwd,
      signal: controller.signal,
    });
    const grandchild = Number(await waitForFile(join(cwd, 'grandchild.pid')));
    expect(isAlive(grandchild)).toBe(true);
    controller.abort(new Error('wallclock exceeded'));
    await expect(run).rejects.toThrow('wallclock exceeded');
    expect(Date.now() - started).toBeLessThan(5000);
    await new Promise((r) => setTimeout(r, 100));
    expect(isAlive(grandchild)).toBe(false);
  });
});

describe('verify: parseTestCounts', () => {
  it('reads an all-green vitest run', () => {
    const out = ' Test Files  10 passed (10)\n      Tests  248 passed (248)\n';
    expect(parseTestCounts(out)).toEqual({ passed: 248, failed: 0, skipped: 0, files_failed: 0 });
  });

  it('reads failures and skips in any order', () => {
    const out =
      ' Test Files  1 failed | 3 passed (4)\n      Tests  3 failed | 44 passed | 2 skipped (49)\n';
    expect(parseTestCounts(out)).toEqual({ passed: 44, failed: 3, skipped: 2, files_failed: 1 });
  });

  it('keeps test files that failed to load, whose tests are missing from the Tests line', () => {
    // Real output when a config error stopped two files from loading.
    const out = ' Test Files  2 failed | 8 passed (10)\n      Tests  204 passed (204)\n';
    expect(parseTestCounts(out)).toEqual({ passed: 204, failed: 0, skipped: 0, files_failed: 2 });
  });

  it('ignores ANSI colour codes', () => {
    const out =
      '\u001b[2m Test Files \u001b[22m \u001b[1m\u001b[32m1 passed\u001b[39m\u001b[22m (1)\n\u001b[2m      Tests \u001b[22m \u001b[1m\u001b[31m2 failed\u001b[39m\u001b[22m | 5 passed (7)\n';
    expect(parseTestCounts(out)).toEqual({ passed: 5, failed: 2, skipped: 0, files_failed: 0 });
  });

  it('returns undefined for non-vitest output', () => {
    expect(parseTestCounts('All matched files use Prettier code style!\n')).toBeUndefined();
  });
});

describe('verify: runAcceptance', () => {
  it('runs commands in order and judges exit_zero', async () => {
    const results = await runAcceptance(
      [exitZero('true', 'ok'), exitZero('echo nope; exit 1', 'bad')],
      { cwd },
    );
    expect(results.map((r) => [r.desc, r.exit_code, r.passed, r.summary])).toEqual([
      ['ok', 0, true, 'exit 0'],
      ['bad', 1, false, 'nope'],
    ]);
  });

  it('summarizes with the last output line, falling back to stderr', async () => {
    const [result] = await runAcceptance([exitZero('echo boom 1>&2; exit 2')], { cwd });
    expect(result?.summary).toBe('boom');
  });

  it('attaches vitest counts and a SPEC 3.5 style summary', async () => {
    const fake =
      "printf ' Test Files  1 failed (1)\\n      Tests  3 failed | 44 passed (47)\\n'; exit 1";
    const [result] = await runAcceptance([exitZero(fake, 'npm test')], { cwd });
    expect(result?.tests).toEqual({ passed: 44, failed: 3, skipped: 0, files_failed: 1 });
    expect(result?.summary).toBe('44 passed, 3 failed, 1 test files failed');
    expect(result?.passed).toBe(false);
  });

  it('judges stdout_matches on exit 0 plus a regex match', async () => {
    const results = await runAcceptance(
      [
        { desc: 'm', cmd: 'echo v22.1.0', expect: { stdout_matches: '^v22\\.' } },
        { desc: 'n', cmd: 'echo v20.1.0', expect: { stdout_matches: '^v22\\.' } },
        { desc: 'e', cmd: 'echo v22.1.0; exit 1', expect: { stdout_matches: '^v22\\.' } },
      ],
      { cwd },
    );
    expect(results.map((r) => r.passed)).toEqual([true, false, false]);
  });

  it('rejects an invalid stdout_matches pattern', async () => {
    await expect(
      runAcceptance([{ desc: 'x', cmd: 'true', expect: { stdout_matches: '(' } }], { cwd }),
    ).rejects.toThrow(VerifyError);
  });

  it('stops at an abort instead of running the remaining commands', async () => {
    const controller = new AbortController();
    const items = [exitZero('touch first'), exitZero('touch second')];
    const run = runAcceptance(items, { cwd, signal: controller.signal });
    controller.abort(new Error('stop'));
    await expect(run).rejects.toThrow('stop');
  });
});

describe('verify: verifyBatch uses the parseBacklog form of each command (SPEC 3.2)', () => {
  // The command cell is written with a GFM-escaped pipe, as R1 must write it.
  const ESCAPED = "grep -qE '^(a\\|b)$' marker.txt";
  const UNESCAPED = "grep -qE '^(a|b)$' marker.txt";

  function writeBacklog(): void {
    mkdirSync(join(cwd, 'docs'));
    writeFileSync(join(cwd, 'marker.txt'), 'b\n');
    writeFileSync(
      join(cwd, 'docs', 'backlog.md'),
      [
        '## 队列总览',
        '',
        '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
        '|---|---|---|---|---|',
        '| 1 | v99-b01 | 管道转义 | — | running |',
        '',
        '## v99-b01 管道转义',
        '',
        '优先级：1\u3000依赖：无',
        '',
        '条目：',
        '1. item',
        '',
        '验收标准：',
        '',
        '| 说明 | 命令 | 期望 |',
        '|---|---|---|',
        `| 交替匹配 | \`${ESCAPED}\` | exit 0 |`,
        '',
      ].join('\n'),
    );
  }

  it('runs the un-escaped command and passes', async () => {
    writeBacklog();
    const [result] = await verifyBatch(cwd, 'v99-b01');
    expect(result?.cmd).toBe(UNESCAPED);
    expect(result?.passed).toBe(true);
  });

  it('documents why: the raw Markdown text fails the same check', async () => {
    writeBacklog();
    // With `\|` grep -E matches a literal pipe, so the alternation never matches.
    expect((await runCommand(ESCAPED, { cwd })).exit_code).toBe(1);
  });

  it('rejects an unknown batch id', async () => {
    writeBacklog();
    await expect(verifyBatch(cwd, 'v99-b02')).rejects.toThrow(
      'batch v99-b02 is not in the backlog',
    );
  });
});
