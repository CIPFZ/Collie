import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJournal, eventsPath, JournalError, type Journal } from '../src/journal.js';
import type { Event } from '../src/schema/index.js';

const RUN = 'r-0007';

let root: string;
let journal: Journal;
let file: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'collie-journal-'));
  journal = createJournal(root);
  file = eventsPath(root, RUN);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function ev(event: Event['event'], extra: Record<string, unknown> = {}, runId = RUN): Event {
  return {
    ts: '2026-10-16T12:00:00.000Z',
    run_id: runId,
    batch_id: 'v01-b03',
    event,
    ...extra,
  };
}

/** A few well-formed events to place before injected corruption. */
function appendGood(count: number): void {
  const types: Event['event'][] = [
    'run.started',
    'batch.selected',
    'batch.task_written',
    'worker.started',
  ];
  for (let i = 0; i < count; i++)
    journal.append(ev(types[i % types.length] ?? 'run.started', { seq: i }));
}

function replayError(runId = RUN): JournalError {
  try {
    journal.replay(runId);
  } catch (error) {
    expect(error).toBeInstanceOf(JournalError);
    if (error instanceof JournalError) return error;
  }
  throw new Error('expected replay to throw JournalError');
}

describe('journal: append and replay', () => {
  it('stores events at .collie/runs/<run_id>/events.ndjson, creating directories', () => {
    expect(file).toBe(join(root, '.collie', 'runs', RUN, 'events.ndjson'));
    expect(existsSync(dirname(file))).toBe(false);
    journal.append(ev('run.started'));
    expect(existsSync(file)).toBe(true);
  });

  it('replays every event in append order with identical content', () => {
    const events = [
      ev('run.started'),
      ev('batch.selected', { priority: 3 }),
      ev('worker.finished', { exit_code: 0, usage: { input_tokens: 10, output_tokens: 2 } }),
      ev('claim.mismatch', {
        field: 'tests_passed',
        claimed: 47,
        actual: 44,
        details: [1, 'two', null, false],
      }),
      ev('run.finished', {}, RUN),
    ];
    for (const e of events) journal.append(e);
    expect(journal.replay(RUN)).toStrictEqual(events);
  });

  it('writes exactly one line per event', () => {
    appendGood(4);
    const text = readFileSync(file, 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(5);
  });

  it('keeps runs in separate files', () => {
    journal.append(ev('run.started', {}, 'r-a'));
    journal.append(ev('run.started', {}, 'r-b'));
    journal.append(ev('run.finished', {}, 'r-a'));
    expect(journal.replay('r-a').map((e) => e.event)).toEqual(['run.started', 'run.finished']);
    expect(journal.replay('r-b').map((e) => e.event)).toEqual(['run.started']);
  });

  it('returns [] for a run without a journal file', () => {
    expect(journal.replay('r-never')).toEqual([]);
  });

  it('accepts every v0.1 event type and rejects v0.2 types without writing', () => {
    journal.append(ev('escalated'));
    const before = readFileSync(file, 'utf8');
    expect(() => {
      journal.append(ev('worker.stalled' as Event['event']));
    }).toThrow(JournalError);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('rejects invalid events without creating a file', () => {
    expect(() => {
      journal.append(ev('run.started', { ts: 'yesterday' }));
    }).toThrow(/refusing to append invalid event: ts/);
    expect(existsSync(file)).toBe(false);
  });

  it('rejects non-JSON extension values without writing', () => {
    expect(() => {
      journal.append(ev('run.started', { when: new Date(0) }));
    }).toThrow(JournalError);
    expect(() => {
      journal.append(ev('run.started', { n: Number.NaN }));
    }).toThrow(JournalError);
    expect(existsSync(file)).toBe(false);
  });

  it('drops undefined extension fields, matching the SPEC 3.6 JsonValue | undefined type', () => {
    journal.append(ev('run.started', { maybe: undefined }));
    const [replayed] = journal.replay(RUN);
    expect(replayed).toEqual(ev('run.started'));
    expect(replayed && 'maybe' in replayed).toBe(false);
  });

  it.each(['../escape', 'a/b', '..', ''])(
    'rejects unsafe run_id %j for both append and replay',
    (runId) => {
      expect(() => {
        journal.append(ev('run.started', {}, runId));
      }).toThrow(JournalError);
      expect(() => journal.replay(runId)).toThrow(JournalError);
    },
  );
});

describe('journal: line breaks inside values never break NDJSON framing', () => {
  const nasty = {
    lf: 'first\nsecond',
    crlf: 'first\r\nsecond',
    cr: 'first\rsecond',
    lineSeparator: 'first\u2028second',
    paragraphSeparator: 'first\u2029second',
    nested: { list: ['a\nb', { deep: 'c\r\nd\u2028e' }] },
    trailingBackslash: 'path\\\u2028',
  };

  it('stores each event on a single physical line', () => {
    journal.append(ev('worker.crashed', nasty));
    journal.append(ev('run.finished'));
    const text = readFileSync(file, 'utf8');
    expect(text.split('\n')).toHaveLength(3);
    expect(text).not.toMatch(/[\r\u2028\u2029]/);
  });

  it('reads the values back exactly', () => {
    journal.append(ev('worker.crashed', nasty));
    expect(journal.replay(RUN)).toStrictEqual([ev('worker.crashed', nasty)]);
  });
});

describe('journal: append-only', () => {
  it('keeps every earlier byte as a prefix after each append, on the same inode', () => {
    let previous = '';
    let inode: number | undefined;
    for (let i = 0; i < 5; i++) {
      journal.append(ev('worker.started', { seq: i }));
      const current = readFileSync(file, 'utf8');
      expect(current.startsWith(previous)).toBe(true);
      expect(current.length).toBeGreaterThan(previous.length);
      const { ino } = statSync(file);
      inode ??= ino;
      expect(ino).toBe(inode);
      previous = current;
    }
  });

  it('only uses append/read fs primitives and opens with O_APPEND (source check)', () => {
    const source = readFileSync(join(import.meta.dirname, '..', 'src', 'journal.ts'), 'utf8');
    const fsImport = /import \{([^}]*)\} from 'node:fs'/.exec(source);
    const imported = (fsImport?.[1] ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    expect(imported.length).toBeGreaterThan(0);
    const allowed = [
      'closeSync',
      'fstatSync',
      'fsyncSync',
      'mkdirSync',
      'openSync',
      'readFileSync',
      'readSync',
      'writeSync',
    ];
    for (const name of imported) expect(allowed).toContain(name);
    const flags = [...source.matchAll(/openSync\([^,]+,\s*'([^']+)'\)/g)].map((m) => m[1]);
    expect(flags).toEqual(['a+']);
  });
});

describe('journal: corrupted lines fail replay with the line number', () => {
  it('reports an empty line in the middle', () => {
    appendGood(1);
    appendFileSync(file, '\n');
    appendGood(1);
    const err = replayError();
    expect(err.line).toBe(2);
    expect(err.message).toBe(`${file}:2: empty line`);
  });

  it('reports a whitespace-only line', () => {
    appendGood(2);
    appendFileSync(file, '   \n');
    expect(replayError().line).toBe(3);
  });

  it('reports a line that is not JSON', () => {
    appendGood(2);
    appendFileSync(file, '{"ts": "2026-10-16T12:00:00Z", oops}\n');
    appendGood(1);
    const err = replayError();
    expect(err.line).toBe(3);
    expect(err.message).toMatch(new RegExp(`^${escapeRegExp(file)}:3: invalid JSON: `));
  });

  it('reports a line that is JSON but not a valid event, with the field path', () => {
    appendGood(1);
    appendFileSync(file, `${JSON.stringify({ ...ev('run.started'), event: 'worker.stalled' })}\n`);
    const err = replayError();
    expect(err.line).toBe(2);
    expect(err.message).toMatch(/:2: invalid event: event: /);
  });

  it('reports a non-object JSON line', () => {
    appendGood(3);
    appendFileSync(file, '[1,2,3]\n');
    expect(replayError().line).toBe(4);
  });

  it('reports an event whose run_id belongs to another run', () => {
    appendGood(2);
    appendFileSync(file, `${JSON.stringify(ev('run.started', {}, 'r-other'))}\n`);
    const err = replayError();
    expect(err.line).toBe(3);
    expect(err.message).toMatch(/:3: run_id "r-other" does not belong to run "r-0007"/);
  });

  it('reports a truncated final line (crash mid-write)', () => {
    appendGood(3);
    appendFileSync(file, '{"ts":"2026-10-16T12:00:00.000Z","run_id":"r-00');
    const err = replayError();
    expect(err.line).toBe(4);
    expect(err.message).toMatch(/:4: truncated line/);
  });

  it('reports a final line missing its newline even if it parses as JSON', () => {
    appendGood(1);
    appendFileSync(file, JSON.stringify(ev('run.finished')));
    expect(replayError().line).toBe(2);
  });

  it('reports the first corrupted line when there are several', () => {
    appendGood(1);
    appendFileSync(file, 'garbage\n\n');
    expect(replayError().line).toBe(2);
  });

  it('refuses to append after a truncated line and leaves the file untouched', () => {
    appendGood(2);
    appendFileSync(file, '{"partial":');
    const before = readFileSync(file, 'utf8');
    expect(() => {
      journal.append(ev('run.finished'));
    }).toThrow(/last line is truncated; refusing to append/);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('appends normally to a pre-existing well-formed file', () => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(ev('run.started'))}\n`);
    journal.append(ev('run.finished'));
    expect(journal.replay(RUN).map((e) => e.event)).toEqual(['run.started', 'run.finished']);
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
