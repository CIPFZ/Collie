// R6 tester role (SPEC 16.10): builds the prompt, validates input, and
// launches the tester through the runner interface. The tester writes
// acceptance tests *before* the worker implements the batch.
// Depends on the runner *interface* only (CONSTRAINTS 铁律 15).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AgentRunner, RunResult } from '../runner/index.js';
import {
  BatchIdSchema,
  ScenarioSchema,
  type CollieConfig,
  type Scenario,
} from '../schema/index.js';

export const TESTER_MANUAL = 'AGENT-tester.md';

/**
 * Everything the tester may be told (SPEC 16.11): batch_id, scenarios,
 * interfaces, SPEC paths to read, and the output directory for the files.
 * Strict: an extra field is rejected at runtime.
 */
export const TesterInputSchema = z.strictObject({
  batch_id: BatchIdSchema,
  scenarios: z.array(ScenarioSchema).nonempty(),
  interfaces: z.array(z.string()),
  spec_paths: z.array(z.string().min(1)),
  out_dir: z.string().min(1),
  /** SPEC 16.12: when non-empty, the prompt includes a section listing previous red-check problems. */
  previous_problems: z.array(z.string().min(1)).optional(),
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
  // SPEC 16.11: at least one scenario must be [新].
  if (!parsed.data.scenarios.some((s: Scenario) => s.kind === 'new')) {
    throw new TesterError(
      'invalid tester input: scenarios must contain at least one "new" scenario',
    );
  }
  return parsed.data;
}

/** The three file names the tester produces (SPEC 16.10). */
const NEW_TEST_FILE = 'new.test.ts';
const KEEP_TEST_FILE = 'keep.test.ts';
const MAP_FILE = 'MAP.md';

/** Builds the tester prompt from the SPEC 16.11 allow-list only. */
export function buildTesterPrompt(input: TesterInput): string {
  const data = validInput(input);

  const newScenarios = data.scenarios.filter((s: Scenario) => s.kind === 'new');
  const keepScenarios = data.scenarios.filter((s: Scenario) => s.kind === 'keep');
  const hasKeep = keepScenarios.length > 0;

  // Build the scenarios section with two groups.
  const scenarioLines: string[] = ['## 情形', ''];
  scenarioLines.push('### 新行为', '');
  for (const s of newScenarios) {
    scenarioLines.push(`- ${s.id} ${s.text}`);
  }
  if (hasKeep) {
    scenarioLines.push('', '### 必须保持', '');
    for (const s of keepScenarios) {
      scenarioLines.push(`- ${s.id} ${s.text}`);
    }
  }

  // Build the interfaces section.
  const interfaceLines: string[] = ['## 接口', ''];
  if (data.interfaces.length > 0) {
    for (const iface of data.interfaces) {
      interfaceLines.push(`- ${iface}`);
    }
  } else {
    interfaceLines.push('（未指定）');
  }

  // Build the output section: new.test.ts and MAP.md always; keep.test.ts only when keep exists.
  const outputFiles: string[] = [
    `- \`${NEW_TEST_FILE}\`：新行为的情形`,
    `- \`${MAP_FILE}\`：对照表`,
  ];
  if (hasKeep) {
    outputFiles.splice(1, 0, `- \`${KEEP_TEST_FILE}\`：必须保持的情形`);
  }

  // Build self-check commands.
  const selfCheckCmds: string[] = [`npx vitest run ${data.out_dir}/${NEW_TEST_FILE}`];
  if (hasKeep) {
    selfCheckCmds.push(`npx vitest run ${data.out_dir}/${KEEP_TEST_FILE}`);
  }
  selfCheckCmds.push('npm run lint');
  selfCheckCmds.push('npm run typecheck');

  // SPEC 16.12: when previous_problems is non-empty, insert a section before scenarios.
  const previousProblemsLines: string[] = [];
  const prevProblems = data.previous_problems ?? [];
  if (prevProblems.length > 0) {
    previousProblemsLines.push('## 上一次没过的原因', '');
    for (const problem of prevProblems) {
      previousProblemsLines.push(`- ${problem}`);
    }
    previousProblemsLines.push('', '只改有问题的地方，改完重新自检');
  }

  const sections = [
    `# 测试批次 ${data.batch_id}`,
    ...(previousProblemsLines.length > 0 ? [previousProblemsLines.join('\n')] : []),
    scenarioLines.join('\n'),
    interfaceLines.join('\n'),
    [
      '## 可查阅的文件',
      '',
      '情形里点名了小节号的，只读那一节；不要通读',
      '',
      ...data.spec_paths.map((p) => `- \`${p}\``),
    ].join('\n'),
    [
      '## 输出',
      '',
      `输出目录：\`${data.out_dir}\``,
      '',
      '在该目录下写以下文件：',
      ...outputFiles,
      '',
      `汇报末尾 JSON 块里的 \`batch_id\` 填 \`${data.batch_id}\`。`,
      '',
      '写完后自检：',
      '',
      '```sh',
      ...selfCheckCmds,
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
