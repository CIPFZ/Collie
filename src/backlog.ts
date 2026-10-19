// Parses docs/backlog.md into validated Batch[] (SPEC 3.2).
// The file is hand-written by R1, so the accepted format is deliberately
// narrow: anything unexpected is an error with a line number, never a guess.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BatchSchema,
  BatchStatusSchema,
  type Acceptance,
  type Batch,
  type BatchStatus,
} from './schema/index.js';

export const BACKLOG_RELATIVE_PATH = join('docs', 'backlog.md');

const OVERVIEW_HEADING = '## 队列总览';
const OVERVIEW_COLUMNS = ['优先级', '批次', '标题', '依赖', '状态'];
const ACCEPTANCE_COLUMNS = ['说明', '命令', '期望'];
/** The only expect wording accepted in v0.1; anything else is not machine-decidable. */
const EXPECT_EXIT_ZERO = 'exit 0';
/** Dependency cells meaning "none". */
const NO_DEPENDENCY = new Set(['', '—', '-', '无']);

// Labels use a full-width colon (U+FF1A); an ASCII colon is accepted too.
const COLON = '[\\uFF1A:]';
const LABEL_ITEMS = new RegExp(`^条目${COLON}$`);
const LABEL_ACCEPTANCE = new RegExp(`^验收标准${COLON}$`);
const LABEL_FORBIDDEN = new RegExp(`^额外禁止${COLON}$`);
// e.g. "优先级\uFF1A2\u3000依赖\uFF1Av01-b01": full-width colons, U+3000 between the fields.
const META_LINE = new RegExp(
  `^优先级${COLON}\\s*(?<priority>\\S+)[\\s\\u3000]+依赖${COLON}\\s*(?<deps>.*)$`,
);
const SECTION_HEADING = /^## (?<id>\S+)\s+(?<title>.+)$/;
const NUMBERED_ITEM = /^\d+\.\s+(.*)$/;
const BULLET_ITEM = /^[-*]\s+(.*)$/;
const CONTINUATION = /^\s+\S/;
const INTEGER = /^\d+$/;
const SEPARATOR_CELL = /^:?-+:?$/;
const DEPENDENCY_SEPARATOR = /[,，、]/;

export class BacklogError extends Error {
  readonly source: string;
  /** 1-based line number the error refers to, when known. */
  readonly line: number | undefined;
  readonly batchId: string | undefined;

  constructor(
    source: string,
    line: number | undefined,
    batchId: string | undefined,
    reason: string,
  ) {
    const where = line === undefined ? source : `${source}:${String(line)}`;
    super(`${where}: ${batchId === undefined ? '' : `[${batchId}] `}${reason}`);
    this.name = 'BacklogError';
    this.source = source;
    this.line = line;
    this.batchId = batchId;
  }
}

interface Line {
  text: string;
  /** 1-based. */
  no: number;
}

interface OverviewRow {
  priority: number;
  id: string;
  title: string;
  dependsOn: string[];
  status: BatchStatus;
  line: number;
}

interface Section {
  id: string;
  title: string;
  line: number;
  body: Line[];
}

/**
 * Splits a GFM table row on unescaped `|`. As in GFM, a pipe inside a code
 * span still splits the cell, so a literal pipe must be written `\|`.
 */
function splitRow(text: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === '\\' && text.charAt(i + 1) === '|') {
      current += '|';
      i++;
    } else if (ch === '|') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  // Drop the empty cells produced by the leading and trailing pipes.
  return cells.slice(1, -1).map((c) => c.trim());
}

function isTableLine(text: string): boolean {
  const t = text.trim();
  return t.startsWith('|') && t.endsWith('|');
}

interface Table {
  rows: { cells: string[]; line: number }[];
  /** Index just past the table in the scanned array. */
  end: number;
}

/** Parses the table starting at lines[start] whose header must equal `columns`. */
function parseTable(
  lines: readonly Line[],
  start: number,
  columns: readonly string[],
  source: string,
  batchId: string | undefined,
): Table {
  const header = lines[start];
  if (header === undefined || !isTableLine(header.text)) {
    const at = header?.no ?? lines.at(-1)?.no;
    throw new BacklogError(
      source,
      at,
      batchId,
      `expected a table with columns ${columns.join(' | ')}`,
    );
  }
  const names = splitRow(header.text);
  const missing = columns.filter((c) => !names.includes(c));
  if (
    missing.length > 0 ||
    names.length !== columns.length ||
    names.some((n, i) => n !== columns[i])
  ) {
    const detail =
      missing.length > 0 ? `missing column(s) ${missing.join(', ')}` : `got ${names.join(' | ')}`;
    throw new BacklogError(
      source,
      header.no,
      batchId,
      `table header must be ${columns.join(' | ')}: ${detail}`,
    );
  }
  const separator = lines[start + 1];
  if (
    separator === undefined ||
    !isTableLine(separator.text) ||
    !splitRow(separator.text).every((c) => SEPARATOR_CELL.test(c))
  ) {
    throw new BacklogError(
      source,
      separator?.no ?? header.no,
      batchId,
      'table header must be followed by a |---| separator row',
    );
  }
  const rows: Table['rows'] = [];
  let i = start + 1 + 1;
  for (; i < lines.length; i++) {
    const row = lines[i];
    if (row === undefined || !isTableLine(row.text)) break;
    const cells = splitRow(row.text);
    if (cells.length !== columns.length) {
      throw new BacklogError(
        source,
        row.no,
        batchId,
        `table row has ${String(cells.length)} cells, expected ${String(columns.length)} (escape literal pipes as \\|)`,
      );
    }
    rows.push({ cells, line: row.no });
  }
  return { rows, end: i };
}

function skipBlank(lines: readonly Line[], start: number): number {
  let i = start;
  while (i < lines.length && lines[i]?.text.trim() === '') i++;
  return i;
}

function parseDependencies(cell: string): string[] {
  const trimmed = cell.trim();
  if (NO_DEPENDENCY.has(trimmed)) return [];
  return trimmed
    .split(DEPENDENCY_SEPARATOR)
    .map((d) => d.trim())
    .filter((d) => d !== '');
}

function parseOverview(lines: readonly Line[], source: string): OverviewRow[] {
  const headingIndex = lines.findIndex((l) => l.text.trim() === OVERVIEW_HEADING);
  if (headingIndex < 0) {
    throw new BacklogError(source, undefined, undefined, `missing section "${OVERVIEW_HEADING}"`);
  }
  const table = parseTable(
    lines,
    skipBlank(lines, headingIndex + 1),
    OVERVIEW_COLUMNS,
    source,
    undefined,
  );
  const seen = new Set<string>();
  return table.rows.map(({ cells, line }) => {
    const [priorityCell = '', id = '', title = '', depsCell = '', statusCell = ''] = cells;
    if (id === '') throw new BacklogError(source, line, undefined, 'empty batch id');
    if (seen.has(id)) throw new BacklogError(source, line, id, 'duplicate batch id in overview');
    seen.add(id);
    if (!INTEGER.test(priorityCell)) {
      throw new BacklogError(
        source,
        line,
        id,
        `priority "${priorityCell}" is not a non-negative integer`,
      );
    }
    const status = BatchStatusSchema.safeParse(statusCell);
    if (!status.success) {
      throw new BacklogError(
        source,
        line,
        id,
        `status "${statusCell}" is not one of ${BatchStatusSchema.options.join(' / ')}`,
      );
    }
    return {
      priority: Number(priorityCell),
      id,
      title,
      dependsOn: parseDependencies(depsCell),
      status: status.data,
      line,
    };
  });
}

function splitSections(lines: readonly Line[]): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const line of lines) {
    if (line.text.startsWith('## ')) {
      current = undefined;
      if (line.text.trim() === OVERVIEW_HEADING) continue;
      const match = SECTION_HEADING.exec(line.text.trim());
      // A malformed heading is reported by the caller as a section without id/title.
      current = {
        id: match?.groups?.id ?? '',
        title: match?.groups?.title?.trim() ?? '',
        line: line.no,
        body: [],
      };
      sections.push(current);
    } else if (current !== undefined) {
      current.body.push(line);
    }
  }
  return sections;
}

/** Collects a numbered or bulleted list, joining indented continuation lines with "\n". */
function parseList(
  body: readonly Line[],
  start: number,
  marker: RegExp,
): { items: string[]; end: number } {
  const items: string[] = [];
  let i = skipBlank(body, start);
  for (; i < body.length; i++) {
    const text = body[i]?.text ?? '';
    const match = marker.exec(text);
    if (match !== null) {
      items.push((match[1] ?? '').trim());
    } else if (items.length > 0 && CONTINUATION.test(text)) {
      items.push(`${items.pop() ?? ''}\n${text.trim()}`);
    } else {
      break;
    }
  }
  return { items, end: i };
}

/** Extracts the command from a cell holding exactly one code span (CommonMark rules). */
function codeSpan(cell: string): string | undefined {
  const fence = /^`+/.exec(cell)?.[0];
  if (fence === undefined || !cell.endsWith(fence) || cell.length < fence.length * (1 + 1))
    return undefined;
  let content = cell.slice(fence.length, cell.length - fence.length);
  if (content.includes(fence)) return undefined;
  if (
    content.length > 1 &&
    content.startsWith(' ') &&
    content.endsWith(' ') &&
    content.trim() !== ''
  ) {
    content = content.slice(1, -1);
  }
  return content;
}

function parseAcceptance(
  cells: string[],
  line: number,
  source: string,
  batchId: string,
): Acceptance {
  const [desc = '', cmdCell = '', expectCell = ''] = cells;
  const label = `acceptance "${desc}"`;
  const cmd = codeSpan(cmdCell);
  if (cmd === undefined) {
    throw new BacklogError(
      source,
      line,
      batchId,
      `${label}: command must be a single code span, got ${JSON.stringify(cmdCell)}`,
    );
  }
  if (cmd.trim() === '') {
    throw new BacklogError(source, line, batchId, `${label}: command is empty`);
  }
  if (expectCell.replace(/\s+/g, ' ').trim() !== EXPECT_EXIT_ZERO) {
    throw new BacklogError(
      source,
      line,
      batchId,
      `${label}: expect "${expectCell}" is not machine-decidable (only "${EXPECT_EXIT_ZERO}" is accepted)`,
    );
  }
  return { desc, cmd, expect: 'exit_zero' };
}

interface SectionContent {
  priority: number | undefined;
  dependsOn: string[] | undefined;
  items: string[] | undefined;
  acceptance: Acceptance[] | undefined;
  forbidden: string[] | undefined;
}

function parseSection(section: Section, source: string): SectionContent {
  const content: SectionContent = {
    priority: undefined,
    dependsOn: undefined,
    items: undefined,
    acceptance: undefined,
    forbidden: undefined,
  };
  const { body, id } = section;
  const once = (key: keyof SectionContent, line: number, label: string): void => {
    if (content[key] !== undefined)
      throw new BacklogError(source, line, id, `duplicate "${label}" block`);
  };

  let i = 0;
  while (i < body.length) {
    const line = body[i];
    if (line === undefined) break;
    const text = line.text.trim();
    const meta = META_LINE.exec(text);
    if (meta !== null) {
      once('priority', line.no, '优先级');
      const priorityText = meta.groups?.priority ?? '';
      if (!INTEGER.test(priorityText)) {
        throw new BacklogError(
          source,
          line.no,
          id,
          `priority "${priorityText}" is not a non-negative integer`,
        );
      }
      content.priority = Number(priorityText);
      content.dependsOn = parseDependencies(meta.groups?.deps ?? '');
      i++;
    } else if (LABEL_ITEMS.test(text)) {
      once('items', line.no, '条目');
      const list = parseList(body, i + 1, NUMBERED_ITEM);
      content.items = list.items;
      i = list.end;
    } else if (LABEL_ACCEPTANCE.test(text)) {
      once('acceptance', line.no, '验收标准');
      const table = parseTable(body, skipBlank(body, i + 1), ACCEPTANCE_COLUMNS, source, id);
      content.acceptance = table.rows.map((r) => parseAcceptance(r.cells, r.line, source, id));
      i = table.end;
    } else if (LABEL_FORBIDDEN.test(text)) {
      once('forbidden', line.no, '额外禁止');
      const list = parseList(body, i + 1, BULLET_ITEM);
      content.forbidden = list.items;
      i = list.end;
    } else {
      // Free prose (notes for R4, separators) is allowed between blocks.
      i++;
    }
  }
  return content;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Parses backlog Markdown. Any invalid batch fails the whole parse. */
export function parseBacklog(text: string, source: string = BACKLOG_RELATIVE_PATH): Batch[] {
  const lines: Line[] = text.split('\n').map((t, i) => ({ text: t.replace(/\r$/, ''), no: i + 1 }));
  const overview = parseOverview(lines, source);
  const sections = splitSections(lines);
  const ids = new Set(overview.map((r) => r.id));

  const byId = new Map<string, Section>();
  for (const section of sections) {
    if (section.id === '') {
      throw new BacklogError(
        source,
        section.line,
        undefined,
        'section heading must be "## <batch_id> <title>"',
      );
    }
    if (!ids.has(section.id)) {
      throw new BacklogError(
        source,
        section.line,
        section.id,
        'section has no row in the overview table',
      );
    }
    if (byId.has(section.id)) {
      throw new BacklogError(source, section.line, section.id, 'duplicate section');
    }
    byId.set(section.id, section);
  }

  return overview.map((row) => {
    for (const dep of row.dependsOn) {
      if (dep === row.id)
        throw new BacklogError(source, row.line, row.id, 'batch depends on itself');
      if (!ids.has(dep))
        throw new BacklogError(
          source,
          row.line,
          row.id,
          `depends_on references unknown batch "${dep}"`,
        );
    }
    const section = byId.get(row.id);
    if (section === undefined) {
      throw new BacklogError(
        source,
        row.line,
        row.id,
        `missing section "## ${row.id} ${row.title}"`,
      );
    }
    if (section.title !== row.title) {
      throw new BacklogError(
        source,
        section.line,
        row.id,
        `section title "${section.title}" differs from overview title "${row.title}"`,
      );
    }
    const content = parseSection(section, source);
    if (content.priority === undefined || content.dependsOn === undefined) {
      throw new BacklogError(source, section.line, row.id, 'missing "优先级：N　依赖：…" line');
    }
    if (content.priority !== row.priority) {
      throw new BacklogError(
        source,
        section.line,
        row.id,
        `section priority ${String(content.priority)} differs from overview priority ${String(row.priority)}`,
      );
    }
    if (!sameList(content.dependsOn, row.dependsOn)) {
      throw new BacklogError(
        source,
        section.line,
        row.id,
        `section dependencies [${content.dependsOn.join(', ')}] differ from overview [${row.dependsOn.join(', ')}]`,
      );
    }
    if (content.items === undefined)
      throw new BacklogError(source, section.line, row.id, 'missing "条目：" block');
    if (content.acceptance === undefined)
      throw new BacklogError(source, section.line, row.id, 'missing "验收标准：" table');

    const candidate = {
      id: row.id,
      title: row.title,
      priority: row.priority,
      depends_on: row.dependsOn,
      items: content.items,
      acceptance: content.acceptance,
      forbidden: content.forbidden ?? [],
      status: row.status,
    };
    const parsed = BatchSchema.safeParse(candidate);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
        .join('; ');
      throw new BacklogError(source, section.line, row.id, `invalid batch: ${issues}`);
    }
    return parsed.data;
  });
}

/** Reads and parses `<root>/docs/backlog.md`. */
export function loadBacklog(root: string): Batch[] {
  const path = join(root, BACKLOG_RELATIVE_PATH);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BacklogError(path, undefined, undefined, `cannot read file: ${reason}`);
  }
  return parseBacklog(text, path);
}
