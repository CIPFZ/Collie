// SPEC 14.1: tests for audit integration into the run pipeline.
// - `audit.result` recorded after reviewer in both modes
// - `--continue` stops on mismatch (exit 30)
// - `match` does not stop
// - `no_init` does not stop
// - runs without a reviewer do not record audit.result
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeRunner, type FakeScene, type FakeSceneContext } from '../src/runner/fake.js';
import type { Report, Verdict } from '../src/schema/index.js';
import { Sandbox, BATCH, TEST_CMD } from './support/sandbox.js';
import { git } from '../src/git.js';

const FENCE = '```';

/**
 * Fake SDK init event that the reviewer onEvent appends to the stream file.
 * The tools list must match the reviewer whitelist in templates/collie.toml.
 */
const REVIEWER_INIT_EVENT = {
  type: 'system',
  subtype: 'init',
  tools: ['Read', 'Glob', 'Grep', 'Bash'],
};

/** Builds a multi-batch backlog with a single pending batch. */
function pendingBacklog(batchId: string): string {
  return [
    '# backlog',
    '',
    '## 队列总览',
    '',
    '| 优先级 | 批次 | 标题 | 依赖 | 状态 |',
    '|---|---|---|---|---|',
    `| 1 | ${batchId} | 示例功能 | — | pending |`,
    '',
    `## ${batchId} 示例功能`,
    '',
    `优先级：1\u3000依赖：无`,
    '',
    '条目：',
    '1. 实现 feature.txt 并补测试',
    '',
    '验收标准：',
    '',
    '| 说明 | 命令 | 期望 |',
    '|---|---|---|',
    `| 全部测试通过 | \`${TEST_CMD}\` | exit 0 |`,
    `| 功能文件存在 | \`test -f feature.txt\` | exit 0 |`,
    '',
  ].join('\n');
}

/** Worker scene that commits passing code and a valid report. */
function workerScene(box: Sandbox, batchId: string, push: boolean): FakeScene {
  return {
    expectRole: 'worker',
    effect: async ({ cwd }: FakeSceneContext) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write('tests/t000.sh', 'exit 0\n', cwd);
      const head = await box.commitAll('feat: add feature with tests', cwd);
      const report: Report = {
        schema_version: 1,
        batch_id: batchId,
        head_sha: head,
        claims: {
          commits: [head],
          tests_passed: 1,
          tests_failed: 0,
          pushed: push,
          ci_passed: false,
          new_deps: [],
          spec_touched: false,
        },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${batchId}/report.md`,
        `# 批次 ${batchId} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${batchId}`, cwd);
      if (push) await git(cwd, ['push', '-q', 'origin', 'main']);
    },
    result: { exitCode: 0 },
  };
}

/** Reviewer that produces a matching verdict (tools match whitelist). */
function reviewerPassScene(batchId: string): FakeScene {
  const body: Verdict = {
    schema_version: 1,
    batch_id: batchId,
    verdict: 'PASS',
    evidence: {
      commits_actual: [],
      verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed' }],
      remote_has_head: true,
      ci_conclusion: 'success',
      ci_run_url: '',
      ci_branch_matched: true,
      deps_diff: [],
      spec_diff_lines: 0,
    },
    claim_mismatches: [],
    gaps: [],
    reason: 'looks good',
  };
  return {
    expectRole: 'reviewer',
    events: [REVIEWER_INIT_EVENT],
    result: {
      exitCode: 0,
      finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
    },
  };
}

describe('queue audit integration', { timeout: 60_000 }, () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
    box.write('docs/backlog.md', pendingBacklog(BATCH));
    await box.commitAll('chore: pending backlog');
  });

  afterEach(() => {
    box.dispose();
  });

  it('match: audit.result recorded, queue continues', async () => {
    const runner = new FakeRunner([workerScene(box, BATCH, true), reviewerPassScene(BATCH)]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    const events = box.events();
    const auditEvt = events.find((e) => e.event === 'audit.result');
    expect(auditEvt).toBeTruthy();
    expect(auditEvt?.outcome).toBe('match');
    // Queue should NOT be paused.
    expect(events.some((e) => e.event === 'queue.paused')).toBe(false);
  });

  it('mismatch with PASS verdict: audit.result recorded as mismatch', async () => {
    // Reviewer scene with extra tool "Exec" not in the whitelist → mismatch.
    const body: Verdict = {
      schema_version: 1,
      batch_id: BATCH,
      verdict: 'PASS',
      evidence: {
        commits_actual: [],
        verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 0,
      },
      claim_mismatches: [],
      gaps: [],
      reason: 'looks good',
    };
    const mismatchScene: FakeScene = {
      expectRole: 'reviewer',
      events: [
        { type: 'system', subtype: 'init', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Exec'] },
      ],
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
      },
    };
    const runner = new FakeRunner([workerScene(box, BATCH, true), mismatchScene]);

    // --continue mode: mismatch should cause queue.paused with audit_mismatch, exit 30.
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(30);

    const events = box.events();
    const auditEvt = events.find((e) => e.event === 'audit.result');
    expect(auditEvt).toBeTruthy();
    expect(auditEvt?.outcome).toBe('mismatch');
    // Queue should be paused with audit_mismatch reason.
    const pauseEvt = events.find((e) => e.event === 'queue.paused');
    expect(pauseEvt).toBeTruthy();
  });

  it('mismatch with FIX verdict: audit_mismatch pauses queue', async () => {
    // Reviewer scene with extra tool → mismatch.
    const body: Verdict = {
      schema_version: 1,
      batch_id: BATCH,
      verdict: 'FIX',
      evidence: {
        commits_actual: [],
        verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 0,
      },
      claim_mismatches: [],
      gaps: ['some gap'],
      reason: 'needs fixes',
    };
    const mismatchScene: FakeScene = {
      expectRole: 'reviewer',
      events: [
        { type: 'system', subtype: 'init', tools: ['Read', 'Glob', 'Grep', 'Bash', 'Exec'] },
      ],
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n需要修复。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
      },
    };
    const runner = new FakeRunner([workerScene(box, BATCH, true), mismatchScene]);

    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(30);

    const events = box.events();
    const auditEvts = events.filter((e) => e.event === 'audit.result');
    expect(auditEvts.length).toBeGreaterThan(0);
    expect(auditEvts[0]?.outcome).toBe('mismatch');
  });

  it('no_init does not stop the queue', async () => {
    // Reviewer without init event → no_init audit result.
    const body: Verdict = {
      schema_version: 1,
      batch_id: BATCH,
      verdict: 'PASS',
      evidence: {
        commits_actual: [],
        verify_results: [{ cmd: TEST_CMD, exit_code: 0, summary: '1 passed' }],
        remote_has_head: true,
        ci_conclusion: 'success',
        ci_run_url: '',
        ci_branch_matched: true,
        deps_diff: [],
        spec_diff_lines: 0,
      },
      claim_mismatches: [],
      gaps: [],
      reason: 'looks good',
    };
    const noInitReviewer: FakeScene = {
      expectRole: 'reviewer',
      // Emit a non-init event so the stream file exists but has no init.
      events: [{ type: 'assistant', message: 'hello' }],
      result: {
        exitCode: 0,
        finalText: `# 裁决\n\n通过。\n\n${FENCE}json\n${JSON.stringify(body, null, 2)}\n${FENCE}\n`,
      },
    };
    const runner = new FakeRunner([workerScene(box, BATCH, true), noInitReviewer]);
    const code = await box.cli(['run', '--continue'], runner);
    expect(code).toBe(0);

    const events = box.events();
    // audit.result should be no_init.
    const auditEvt = events.find((e) => e.event === 'audit.result');
    expect(auditEvt).toBeTruthy();
    expect(auditEvt?.outcome).toBe('no_init');
    // Queue should NOT be paused on audit_mismatch.
    const pauseEvts = events.filter((e) => e.event === 'queue.paused');
    const hasAuditPause = pauseEvts.some((e) => {
      const reasons = e.reasons;
      return Array.isArray(reasons) && (reasons as string[]).includes('audit_mismatch');
    });
    expect(hasAuditPause).toBe(false);
  });

  it('runs without reviewer do not record audit.result', async () => {
    // Worker that doesn't produce a report → escalation path, no reviewer.
    const runner = new FakeRunner([
      {
        expectRole: 'worker',
        effect: () => {
          // No report written → escalation.
        },
        result: { exitCode: 0 },
      },
    ]);
    const code = await box.cli(['run', BATCH], runner);
    // The run should BLOCK due to no report.
    expect(code).toBe(20);
    const events = box.events();
    // No audit.result should be recorded (escalation path, no reviewer).
    expect(events.some((e) => e.event === 'audit.result')).toBe(false);
  });
});
