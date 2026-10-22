#!/usr/bin/env node
// Collie CLI (SPEC 5): init / run <batch_id> / show <batch_id>.
// `main` takes its collaborators as arguments so tests drive it with the fake
// runner and a fetch double; only the entry point at the bottom touches the
// real process.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FakeRunner } from './runner/fake.js';
import { Command, CommanderError } from 'commander';
import { loadBacklog } from './backlog.js';
import { loadConfig } from './config.js';
import type { Clock, FetchLike } from './ci.js';
import { CONFIG_RELATIVE_PATH, parseConfig } from './config.js';
import { git } from './git.js';
import { createJournal, EVENTS_FILE_NAME, RUNS_RELATIVE_DIR } from './journal.js';
import { EXIT_CODES, readEnvelope, runBatch } from './run.js';
import { ClaudeRunner } from './runner/claude.js';
import type { AgentRunner } from './runner/index.js';
import { RunIdSchema, type Event } from './schema/index.js';

/** How `collie run` obtains its runner (SPEC 5: default is the real one). */
export type RunnerChoice =
  { kind: 'injected'; runner: AgentRunner | undefined } | { kind: 'claude' } | { kind: 'fake' };

export interface CliDeps {
  cwd: string;
  /** 'injected' lets tests supply a runner; the CLI entry point chooses between claude and fake. */
  runner: RunnerChoice | AgentRunner | undefined;
  fetch: FetchLike;
  now: () => Date;
  out: (text: string) => void;
  err: (text: string) => void;
  /** Git remote checked for "pushed". */
  remote?: string;
  /** Test hook: overrides the worker's wall-clock signal (disables internal wallclock timer). */
  workerSignal?: AbortSignal;
  /** Test hook: time source for the CI wait. */
  clock?: Clock;
  /** Test hook: injected delay for signal ladder grace periods (SPEC 11.6). */
  ladderDelay?: (ms: number) => Promise<void>;
  /** Test hook: override liveness monitor check interval (ms). */
  livenessIntervalMs?: number;
  /** Test hook: injected monotonic clock for the liveness monitor (SPEC 11.5). */
  livenessNow?: () => number;
  /** Test hook: injected timer for the liveness monitor (SPEC 11.5). */
  livenessSetTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Test hook: injected fingerprint function for the liveness monitor (SPEC 11.5, v02-b04-fix). */
  livenessFingerprint?: (root: string) => Promise<string>;
}

const TEMPLATE = join(import.meta.dirname, '..', 'templates', 'collie.toml');
const ISO_SECONDS = /^(?<y>\d{4})-(?<mo>\d{2})-(?<d>\d{2})T(?<h>\d{2}):(?<mi>\d{2}):(?<s>\d{2})/;
const GITIGNORE_ENTRIES = ['.collie/runs/', '.collie/heartbeat.json', '.collie/github-token'];
const GITHUB_SSH = /^git@github\.com:(?<path>[^\s]+?)(?:\.git)?$/;
const GITHUB_HTTPS = /^https:\/\/github\.com\/(?<path>[^\s]+?)(?:\.git)?\/?$/;

function tomlString(value: string): string {
  return JSON.stringify(value);
}

/** run_id from the clock, e.g. r-20261019-114606 (SPEC 3.6 path-safe). */
export function runIdAt(date: Date): string {
  const t = ISO_SECONDS.exec(date.toISOString())?.groups;
  if (t === undefined) throw new Error(`unexpected timestamp ${date.toISOString()}`);
  return RunIdSchema.parse(
    `r-${t.y ?? ''}${t.mo ?? ''}${t.d ?? ''}-${t.h ?? ''}${t.mi ?? ''}${t.s ?? ''}`,
  );
}

async function originUrl(cwd: string): Promise<string | undefined> {
  try {
    const url = (await git(cwd, ['remote', 'get-url', 'origin'])).trim();
    const path = GITHUB_SSH.exec(url)?.groups?.path ?? GITHUB_HTTPS.exec(url)?.groups?.path;
    return path === undefined ? undefined : `https://github.com/${path}`;
  } catch {
    return undefined;
  }
}

async function init(
  deps: CliDeps,
  opts: { name?: string; repo?: string; force?: boolean },
): Promise<number> {
  const target = join(deps.cwd, CONFIG_RELATIVE_PATH);
  if (existsSync(target) && opts.force !== true) {
    deps.err(`${CONFIG_RELATIVE_PATH} already exists; use --force to overwrite\n`);
    return EXIT_CODES.ERROR;
  }
  const repo = opts.repo ?? (await originUrl(deps.cwd));
  if (repo === undefined) {
    deps.err('cannot derive a GitHub repository URL from remote "origin"; pass --repo <url>\n');
    return EXIT_CODES.ERROR;
  }
  const name = opts.name ?? basename(deps.cwd);
  const text = readFileSync(TEMPLATE, 'utf8')
    .replace('"{{name}}"', tomlString(name))
    .replace('"{{repo}}"', tomlString(repo));
  parseConfig(text, CONFIG_RELATIVE_PATH);

  mkdirSync(join(deps.cwd, '.collie', 'batches'), { recursive: true });
  writeFileSync(target, text);
  const gitignore = join(deps.cwd, '.gitignore');
  const existing = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : '';
  const lines = new Set(existing.split('\n').map((l) => l.trim()));
  const missing = GITIGNORE_ENTRIES.filter((e) => !lines.has(e));
  if (missing.length > 0) {
    const sep = existing === '' || existing.endsWith('\n') ? '' : '\n';
    writeFileSync(gitignore, `${existing}${sep}${missing.join('\n')}\n`);
  }
  deps.out(`created ${CONFIG_RELATIVE_PATH} for ${name} (${repo})\n`);
  return EXIT_CODES.PASS;
}

/** Resolves a runner choice; the real runner reads its configuration when constructed. */
export function resolveRunner(
  choice: RunnerChoice | AgentRunner | undefined,
  root: string,
): AgentRunner | undefined {
  if (choice === undefined) return undefined;
  if ('run' in choice) return choice;
  switch (choice.kind) {
    case 'injected':
      return choice.runner;
    case 'fake':
      // No scripted scenes, so every run fails loudly: the FakeRunner contract.
      return new FakeRunner([]);
    case 'claude':
      return new ClaudeRunner(loadConfig(root));
  }
}

async function run(
  deps: CliDeps,
  batchId: string,
  runnerChoice?: RunnerChoice | AgentRunner,
): Promise<number> {
  const runner = resolveRunner(runnerChoice ?? deps.runner, deps.cwd);
  if (runner === undefined) {
    deps.err('no agent runner is available\n');
    return EXIT_CODES.ERROR;
  }
  const runId = runIdAt(deps.now());
  const outcome = await runBatch({
    root: deps.cwd,
    batchId,
    runId,
    runner,
    fetch: deps.fetch,
    remote: deps.remote ?? 'origin',
    now: deps.now,
    ...(deps.workerSignal === undefined ? {} : { workerSignal: deps.workerSignal }),
    ...(deps.clock === undefined ? {} : { clock: deps.clock }),
    ...(deps.ladderDelay === undefined ? {} : { ladderDelay: deps.ladderDelay }),
    ...(deps.livenessIntervalMs === undefined
      ? {}
      : { livenessIntervalMs: deps.livenessIntervalMs }),
    ...(deps.livenessNow === undefined ? {} : { livenessNow: deps.livenessNow }),
    ...(deps.livenessSetTimer === undefined ? {} : { livenessSetTimer: deps.livenessSetTimer }),
    ...(deps.livenessFingerprint === undefined
      ? {}
      : { livenessFingerprint: deps.livenessFingerprint }),
  });
  const how =
    outcome.decision === undefined
      ? (outcome.escalation ?? '')
      : `rule ${String(outcome.decision.rule)}: ${outcome.decision.reason}`;
  deps.out(`${batchId} ${runId}: ${outcome.final} (${how})\n`);
  return outcome.exitCode;
}

/** Events of every run that touched `batchId`, oldest run first. */
function batchEvents(root: string, batchId: string): Event[] {
  const runsDir = join(root, RUNS_RELATIVE_DIR);
  if (!existsSync(runsDir)) return [];
  const journal = createJournal(root);
  return readdirSync(runsDir)
    .filter(
      (runId) =>
        RunIdSchema.safeParse(runId).success && existsSync(join(runsDir, runId, EVENTS_FILE_NAME)),
    )
    .sort()
    .flatMap((runId) => journal.replay(runId))
    .filter((e) => e.batch_id === batchId);
}

/** Event fields shown as an indented block under the event line, not inline. */
const BLOCK_FIELDS = new Set(['final_text']);

function describeEvent(event: Event): string {
  const { ts, run_id: runId, event: type } = event;
  const shown = new Set(['ts', 'run_id', 'batch_id', 'event']);
  const fields = Object.entries(event).filter(([k, v]) => !shown.has(k) && v !== undefined);
  const detail = fields
    .filter(([k]) => !BLOCK_FIELDS.has(k))
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  const blocks = fields
    .filter(([k]) => BLOCK_FIELDS.has(k))
    .map(([k, v]) => {
      const text = typeof v === 'string' ? v : JSON.stringify(v);
      return `\n    ${k}:\n${text
        .split('\n')
        .map((line) => `      ${line}`)
        .join('\n')}`;
    })
    .join('');
  return `${ts} ${runId} ${type}${detail === '' ? '' : ` ${detail}`}${blocks}`;
}

function section(title: string, body: string | undefined): string {
  return `== ${title} ==\n${body === undefined ? '(none)\n' : body.endsWith('\n') ? body : `${body}\n`}\n`;
}

function show(deps: CliDeps, batchId: string): number {
  const batch = loadBacklog(deps.cwd).find((b) => b.id === batchId);
  if (batch === undefined) {
    deps.err(`batch ${batchId} is not in docs/backlog.md\n`);
    return EXIT_CODES.ERROR;
  }
  // SPEC 3.2: the parsed form is the only form in which commands may be run.
  const commands = batch.acceptance
    .map(
      (a, i) =>
        `${String(i + 1)}. ${a.desc} (expect ${a.expect === 'exit_zero' ? 'exit 0' : JSON.stringify(a.expect)})\n   ${a.cmd}`,
    )
    .join('\n');
  deps.out(
    section(
      `${batch.id} ${batch.title} [${batch.status}]`,
      `acceptance commands (parsed, run these verbatim):\n${commands}`,
    ),
  );
  deps.out(section('task.md', readEnvelope(deps.cwd, batchId, 'task.md')));
  deps.out(section('report.md', readEnvelope(deps.cwd, batchId, 'report.md')));
  deps.out(section('verdict.md', readEnvelope(deps.cwd, batchId, 'verdict.md')));
  const events = batchEvents(deps.cwd, batchId);
  deps.out(
    section(
      'decision trail (events.ndjson)',
      events.length === 0 ? undefined : events.map(describeEvent).join('\n'),
    ),
  );
  return EXIT_CODES.PASS;
}

const SMOKE_PROMPT = 'Reply with the single word ok.';
const SMOKE_MAX_TURNS = 1;

/**
 * Smoke-test the configured runner (SPEC v02-b04-fix4). Fires a single turn
 * with no tools and a trivial prompt. Does NOT write journal or touch batches.
 */
async function smoke(deps: CliDeps, runnerChoice?: RunnerChoice): Promise<number> {
  const runner = resolveRunner(runnerChoice ?? deps.runner, deps.cwd);
  if (runner === undefined) {
    deps.err('no agent runner is available\n');
    return EXIT_CODES.ERROR;
  }
  try {
    const result = await runner.run({
      role: 'worker',
      prompt: SMOKE_PROMPT,
      systemPrompt: '',
      allowedTools: [],
      cwd: deps.cwd,
      maxTurns: SMOKE_MAX_TURNS,
    });
    const parts = [`smoke ok: exitCode=${String(result.exitCode)}`];
    if (result.sessionId !== undefined) parts.push(`sessionId=${result.sessionId}`);
    if (result.usage !== undefined) parts.push(`usage=${JSON.stringify(result.usage)}`);
    deps.out(`${parts.join(' ')}\n`);
    return EXIT_CODES.PASS;
  } catch (error) {
    deps.err(`smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_CODES.ERROR;
  }
}

/** Parses argv (without node and script) and runs one command; resolves with the exit code. */
export async function main(argv: readonly string[], deps: CliDeps): Promise<number> {
  let code: number = EXIT_CODES.ERROR;
  const program = new Command('collie')
    .description('Glue between agents and engineering (SPEC 1.2)')
    .exitOverride()
    .configureOutput({ writeOut: deps.out, writeErr: deps.err });

  program
    .command('init')
    .description('create .collie/ and collie.toml from the template')
    .option('--name <name>', 'project name (default: directory name)')
    .option('--repo <url>', 'GitHub repository URL (default: from remote origin)')
    .option('--force', 'overwrite an existing collie.toml')
    .action(async (opts: { name?: string; repo?: string; force?: boolean }) => {
      code = await init(deps, opts);
    });
  program
    .command('run')
    .description(
      'run one batch: worker -> reviewer -> arbiter (exit 0 PASS / 10 FIX / 20 BLOCK / 1 error)',
    )
    .argument('<batch_id>')
    .option('--runner <kind>', 'agent runner: claude (default) or fake')
    .action(async (batchId: string, opts: { runner?: string }) => {
      const kind = opts.runner;
      if (kind !== undefined && kind !== 'claude' && kind !== 'fake') {
        deps.err(`unknown runner ${JSON.stringify(kind)}; use claude or fake\n`);
        code = EXIT_CODES.ERROR;
        return;
      }
      // Without the flag, the runner the caller wired in (the real one from the entry point).
      code = await run(deps, batchId, kind === undefined ? undefined : { kind });
    });
  program
    .command('show')
    .description('print task / report / verdict and the decision trail of a batch')
    .argument('<batch_id>')
    .action((batchId: string) => {
      code = show(deps, batchId);
    });
  program
    .command('smoke')
    .description(
      'smoke-test the configured runner: maxTurns 1, no tools, prompt "Reply with the single word ok."',
    )
    .option('--runner <kind>', 'agent runner: claude (default) or fake')
    .action(async (opts: { runner?: string }) => {
      const kind = opts.runner;
      if (kind !== undefined && kind !== 'claude' && kind !== 'fake') {
        deps.err(`unknown runner ${JSON.stringify(kind)}; use claude or fake\n`);
        code = EXIT_CODES.ERROR;
        return;
      }
      code = await smoke(deps, kind === undefined ? undefined : { kind });
    });

  try {
    await program.parseAsync([...argv], { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      // --help and --version exit 0; usage errors are Collie errors.
      return error.exitCode === 0 ? 0 : EXIT_CODES.ERROR;
    }
    deps.err(`collie: ${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_CODES.ERROR;
  }
  return code;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  // `collie show x | head` closes stdout early; that is not an error.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') throw error;
  });
  const [, , ...args] = process.argv;
  void main(args, {
    cwd: process.cwd(),
    runner: { kind: 'claude' },
    fetch: (url, init) => fetch(url, init),
    now: () => new Date(),
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
  }).then((code) => {
    process.exitCode = code;
  });
}
