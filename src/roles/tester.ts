// R6 tester role (SPEC 16.10): builds the prompt, validates input, and
// launches the tester through the runner interface. The tester writes
// acceptance tests *before* the worker implements the batch.
// Depends on the runner *interface* only (CONSTRAINTS 铁律 15).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentRunner, RunResult } from '../runner/index.js';
import { BatchIdSchema, type CollieConfig } from '../schema/index.js';

export const TESTER_MANUAL = 'AGENT-tester.md';

/**
 * Everything the tester may be told (SPEC 16.10): batch_id, the raw items,
 * SPEC paths to read, and the output directory for the three files.
 * Strict: an extra field is rejected at runtime.
 */
export const TesterInputSchema = z.strictObject({
  batch_id: BatchIdSchema,
  items: z.array(z.string().min(1)),
  spec_paths: z.array(z.string().min(1)),
  out_dir: z.string().min(1),
});
export type TesterInput = z.infer<typeof TesterInputSchema>;

export class TesterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TesterError';
  }
}

function validInput(input: TesterInput): TesterInput {
  const parsed = TesterInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`,
    );
    throw new TesterError(`invalid tester input: ${issues.join('; ')}`);
  }
  return parsed.data;
}

/** The three file names the tester produces (SPEC 16.10). */
const NEW_TEST_FILE = 'new.test.ts';
const KEEP_TEST_FILE = 'keep.test.ts';
const MAP_FILE = 'MAP.md';

/** Builds the tester prompt from the SPEC 16.10 allow-list only. */
export function buildTesterPrompt(input: TesterInput): string {
  const data = validInput(input);
  const sections = [
    `# 测试批次 ${data.batch_id}`,
    [
      '## 本批次条目',
      '',
      ...(data.items.length > 0
        ? data.items.map((item, i) => `${String(i + 1)}. ${item.split('\n').join('\n   ')}`)
        : ['（未提供）']),
    ].join('\n'),
    ['## 需要自行阅读的 SPEC 章节', '', ...data.spec_paths.map((p) => `- \`${p}\``)].join('\n'),
    [
      '## 输出',
      '',
      `输出目录：\`${data.out_dir}\``,
      '',
      '在该目录下写三个文件：',
      `- \`${NEW_TEST_FILE}\`：条目里标为「新行为」的情形`,
      `- \`${KEEP_TEST_FILE}\`：条目里标为「必须保持」的情形（没有就不写）`,
      `- \`${MAP_FILE}\`：对照表`,
      '',
      '写完后自检：',
      '',
      '```sh',
      `npx vitest run ${data.out_dir}/${NEW_TEST_FILE}`,
      `npx vitest run ${data.out_dir}/${KEEP_TEST_FILE}`,
      '```',
    ].join('\n'),
  ];
  return `${sections.join('\n\n')}\n`;
}

/**
 * Launches the tester through `runner` with the R6 manual and the tester
 * tool whitelist. The tester has write tools (unlike the reviewer) but
 * git write operations are blocked by bash_deny (same as reviewer).
 *
 * @throws TesterError when config has no [agent.tester] section.
 */
export async function runTester(
  runner: AgentRunner,
  cfg: CollieConfig,
  input: TesterInput,
  cwd: string,
): Promise<RunResult> {
  const testerCfg = cfg.agent.tester;
  if (testerCfg === undefined) {
    throw new TesterError(
      'tester role requires [agent.tester] in collie.toml but the section is missing',
    );
  }
  const prompt = buildTesterPrompt(input);
  const systemPrompt = readFileSync(join(cwd, TESTER_MANUAL), 'utf8');
  return runner.run({
    role: 'tester',
    prompt,
    systemPrompt,
    allowedTools: [...testerCfg.allowed_tools],
    cwd,
    maxTurns: testerCfg.max_turns,
  });
}
