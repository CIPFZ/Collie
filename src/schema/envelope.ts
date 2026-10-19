// Reading and writing the Markdown envelopes (SPEC 3.3-3.5, ROLES 7): task.md
// carries YAML frontmatter; report.md and verdict.md end in a fenced JSON block.
import YAML from 'yaml';
import { TaskFrontmatterSchema, type TaskFrontmatter } from './index.js';

export class EnvelopeError extends Error {
  /** 1-based line the error refers to, when known. */
  readonly line: number | undefined;

  constructor(reason: string, line?: number) {
    super(line === undefined ? reason : `line ${String(line)}: ${reason}`);
    this.name = 'EnvelopeError';
    this.line = line;
  }
}

const FRONTMATTER_DELIMITER = '---';

/** Renders validated frontmatter between `---` lines, keys in SPEC 3.3 order. */
export function renderFrontmatter(frontmatter: TaskFrontmatter): string {
  const data = TaskFrontmatterSchema.parse(frontmatter);
  return `${FRONTMATTER_DELIMITER}\n${YAML.stringify(data)}${FRONTMATTER_DELIMITER}\n`;
}

/** Splits a document into its raw YAML frontmatter and the remaining body. */
export function splitFrontmatter(markdown: string): { yaml: string; body: string } {
  const lines = markdown.split('\n');
  if (lines[0]?.trimEnd() !== FRONTMATTER_DELIMITER) {
    throw new EnvelopeError('document does not start with a --- frontmatter line', 1);
  }
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === FRONTMATTER_DELIMITER);
  if (end < 0) throw new EnvelopeError('frontmatter is not closed by a --- line', 1);
  return { yaml: lines.slice(1, end).join('\n'), body: lines.slice(end + 1).join('\n') };
}

/** Parses and validates task.md frontmatter (SPEC 3.3). */
export function parseTaskFrontmatter(markdown: string): TaskFrontmatter {
  const { yaml } = splitFrontmatter(markdown);
  let raw: unknown;
  try {
    raw = YAML.parse(yaml);
  } catch (error) {
    throw new EnvelopeError(
      `invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = TaskFrontmatterSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new EnvelopeError(`invalid task frontmatter: ${issues.join('; ')}`);
  }
  return result.data;
}

export interface FencedBlock {
  /** First word of the info string, lower-cased ('' when absent). */
  lang: string;
  content: string;
  /** 1-based line of the opening fence. */
  line: number;
}

// CommonMark fences: up to 3 spaces of indent, then 3+ backticks or tildes.
const OPENING_FENCE = /^ {0,3}(?<fence>`{3,}|~{3,})(?<info>.*)$/;

/**
 * All fenced code blocks, outermost only: a ```json block quoted inside a
 * ````markdown block is content, not a block. An unclosed fence is an error,
 * since for an envelope it means the document is truncated.
 */
export function fencedBlocks(markdown: string): FencedBlock[] {
  const lines = markdown.split('\n').map((l) => l.replace(/\r$/, ''));
  const blocks: FencedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = OPENING_FENCE.exec(lines[i] ?? '');
    const fence = open?.groups?.fence;
    const info = open?.groups?.info ?? '';
    // A backtick fence's info string may not contain backticks (CommonMark 4.5).
    if (fence === undefined || (fence.startsWith('`') && info.includes('`'))) {
      i++;
      continue;
    }
    const closing = new RegExp(
      `^ {0,3}${fence.startsWith('`') ? '`' : '~'}{${String(fence.length)},}\\s*$`,
    );
    const start = i;
    let end = start + 1;
    while (end < lines.length && !closing.test(lines[end] ?? '')) end++;
    if (end >= lines.length) {
      throw new EnvelopeError(`fenced block opened with ${fence} is never closed`, start + 1);
    }
    blocks.push({
      lang: (info.trim().split(/\s+/)[0] ?? '').toLowerCase(),
      content: lines.slice(start + 1, end).join('\n'),
      line: start + 1,
    });
    i = end + 1;
  }
  return blocks;
}

/** The last ```json block, or undefined when there is none. */
export function lastJsonBlock(markdown: string): FencedBlock | undefined {
  return fencedBlocks(markdown)
    .filter((b) => b.lang === 'json')
    .at(-1);
}
