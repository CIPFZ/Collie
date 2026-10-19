// Append-only event journal at .collie/runs/<run_id>/events.ndjson (SPEC 3.6).
// It is R2's only state source (CONSTRAINTS 铁律 23): replay must either
// return exactly what was appended or fail loudly with a line number.
import {
  closeSync,
  fstatSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { EventSchema, RunIdSchema, type Event } from './schema/index.js';

export const RUNS_RELATIVE_DIR = join('.collie', 'runs');
export const EVENTS_FILE_NAME = 'events.ndjson';

const NEWLINE = '\n';

export class JournalError extends Error {
  readonly path: string;
  /** 1-based line number of the offending line, when the error is about one line. */
  readonly line: number | undefined;

  constructor(path: string, line: number | undefined, reason: string) {
    super(line === undefined ? `${path}: ${reason}` : `${path}:${String(line)}: ${reason}`);
    this.name = 'JournalError';
    this.path = path;
    this.line = line;
  }
}

export interface Journal {
  /** Validates `event` and appends it as one line to its run's events.ndjson. */
  append(event: Event): void;
  /** Reads back every event of `runId` in append order; [] if the run has no journal yet. */
  replay(runId: string): Event[];
}

/** Path of a run's journal. Rejects run ids that are not a safe path segment. */
export function eventsPath(root: string, runId: string): string {
  const parsed = RunIdSchema.safeParse(runId);
  if (!parsed.success) {
    throw new JournalError(
      join(root, RUNS_RELATIVE_DIR),
      undefined,
      `invalid run_id ${JSON.stringify(runId)}`,
    );
  }
  return join(root, RUNS_RELATIVE_DIR, parsed.data, EVENTS_FILE_NAME);
}

function describeIssues(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

/**
 * One event as one NDJSON line. JSON.stringify already escapes \n and \r;
 * U+2028/U+2029 are escaped too because some line readers treat them as
 * line terminators.
 */
function serialize(event: Event): string {
  const line = JSON.stringify(event)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  if (line.includes(NEWLINE) || line.includes('\r')) {
    throw new Error('serialized event contains a raw line break');
  }
  return line;
}

/** True when the file is empty or its last byte is a newline. */
function endsCleanly(fd: number): boolean {
  const { size } = fstatSync(fd);
  if (size === 0) return true;
  const last = Buffer.alloc(1);
  readSync(fd, last, 0, 1, size - 1);
  return last.toString('utf8') === NEWLINE;
}

function append(root: string, event: Event): void {
  const parsed = EventSchema.safeParse(event);
  if (!parsed.success) {
    const path = RunIdSchema.safeParse(event.run_id).success
      ? eventsPath(root, event.run_id)
      : join(root, RUNS_RELATIVE_DIR);
    throw new JournalError(
      path,
      undefined,
      `refusing to append invalid event: ${describeIssues(parsed.error)}`,
    );
  }
  const path = eventsPath(root, parsed.data.run_id);
  const line = serialize(parsed.data);

  mkdirSync(dirname(path), { recursive: true });
  // 'a+' is O_APPEND: every write lands at the end, the file is never rewritten.
  const fd = openSync(path, 'a+');
  try {
    // A torn last line (crash mid-write) would swallow the next event. Repairing it
    // means rewriting the file, so refuse instead and leave the evidence intact.
    if (!endsCleanly(fd)) {
      throw new JournalError(path, undefined, 'last line is truncated; refusing to append');
    }
    writeSync(fd, line + NEWLINE);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function replay(root: string, runId: string): Event[] {
  const path = eventsPath(root, runId);
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  if (content === '') return [];

  const lines = content.split(NEWLINE);
  // A well-formed journal ends with a newline, leaving one empty trailing element.
  const complete = lines.at(-1) === '';
  if (complete) lines.pop();

  return lines.map((text, index) => {
    const lineNo = index + 1;
    if (!complete && lineNo === lines.length) {
      throw new JournalError(path, lineNo, 'truncated line (missing trailing newline)');
    }
    if (text.trim() === '') {
      throw new JournalError(path, lineNo, 'empty line');
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new JournalError(path, lineNo, `invalid JSON: ${reason}`);
    }
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) {
      throw new JournalError(path, lineNo, `invalid event: ${describeIssues(parsed.error)}`);
    }
    if (parsed.data.run_id !== runId) {
      throw new JournalError(
        path,
        lineNo,
        `run_id ${JSON.stringify(parsed.data.run_id)} does not belong to run ${JSON.stringify(runId)}`,
      );
    }
    return parsed.data;
  });
}

/** Journal rooted at the repository root `root`. */
export function createJournal(root: string): Journal {
  return {
    append: (event) => {
      append(root, event);
    },
    replay: (runId) => replay(root, runId),
  };
}
