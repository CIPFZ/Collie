// SPEC 13.18: verdict commit CI recheck after evidence collection.
// When the startup CI check for the previous verdict commit returns pending or
// no_runs, R2 rechecks after evidence is collected. The recheck records
// ci.verdict_commit with when='after_evidence' when a conclusion is available.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/ci.js';
import { FakeRunner, type FakeScene } from '../src/runner/fake.js';
import type { Event, Report } from '../src/schema/index.js';
import {
  BATCH,
  fooledReviewerScene,
  honestClaims,
  Sandbox,
  workerScene,
} from './support/sandbox.js';

const FENCE = '```';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fetch that returns different CI results per sha and per call index. */
function buildFetch(
  verdictSha: string,
  verdictResults: {
    status: string;
    conclusion: string | null;
    branch: string;
  }[],
  defaultBranch = 'main',
  defaultConclusion = 'success',
): FetchLike {
  let verdictCallCount = 0;
  return (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    if (sha === verdictSha) {
      const entry = verdictResults[verdictCallCount] ?? verdictResults.at(-1);
      verdictCallCount++;
      if (entry === undefined) {
        // No runs at all
        return Promise.resolve(new Response(JSON.stringify({ total_count: 0, workflow_runs: [] })));
      }
      const run = {
        id: 100,
        workflow_id: 1,
        name: 'ci',
        event: 'push',
        head_branch: entry.branch,
        head_sha: sha,
        status: entry.status,
        conclusion: entry.conclusion,
        html_url: 'https://github.com/example/sandbox/actions/runs/100',
        created_at: '2026-11-13T07:00:00Z',
      };
      return Promise.resolve(
        new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })),
      );
    }
    // Default: head_sha queries for evidence collection
    const run = {
      id: 42,
      workflow_id: 1,
      name: 'ci',
      event: 'push',
      head_branch: defaultBranch,
      head_sha: sha,
      status: 'completed',
      conclusion: defaultConclusion,
      html_url: 'https://github.com/example/sandbox/actions/runs/42',
      created_at: '2026-11-13T07:00:00Z',
    };
    return Promise.resolve(new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })));
  };
}

/** No-runs fetch: returns empty for a specific sha on first call. */
function noRunsFetch(
  verdictSha: string,
  recheckResult: {
    status: string;
    conclusion: string | null;
    branch: string;
  } | null,
): FetchLike {
  let verdictCallCount = 0;
  return (url) => {
    const sha = new URL(url).searchParams.get('head_sha') ?? '';
    if (sha === verdictSha) {
      verdictCallCount++;
      if (verdictCallCount === 1) {
        // First call (startup): no runs
        return Promise.resolve(new Response(JSON.stringify({ total_count: 0, workflow_runs: [] })));
      }
      // Second call (recheck)
      if (recheckResult === null) {
        return Promise.resolve(new Response(JSON.stringify({ total_count: 0, workflow_runs: [] })));
      }
      const run = {
        id: 200,
        workflow_id: 1,
        name: 'ci',
        event: 'push',
        head_branch: recheckResult.branch,
        head_sha: sha,
        status: recheckResult.status,
        conclusion: recheckResult.conclusion,
        html_url: 'https://github.com/example/sandbox/actions/runs/200',
        created_at: '2026-11-13T07:00:00Z',
      };
      return Promise.resolve(
        new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })),
      );
    }
    // Default: evidence collection queries
    const run = {
      id: 42,
      workflow_id: 1,
      name: 'ci',
      event: 'push',
      head_branch: 'main',
      head_sha: sha,
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/example/sandbox/actions/runs/42',
      created_at: '2026-11-13T07:00:00Z',
    };
    return Promise.resolve(new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })));
  };
}

function honest(box: Sandbox): FakeRunner {
  return new FakeRunner([
    workerScene(box, { passing: 5, failing: 0, push: true, claims: honestClaims(5) }),
    fooledReviewerScene(box),
  ]);
}

/** A counter to make each second-run worker scene write unique content. */
let uniqueCounter = 0;

/** Worker scene that writes a unique marker file so git always has something to commit. */
function uniqueWorkerScene(box: Sandbox, push: boolean): FakeScene {
  const marker = `run-${String(++uniqueCounter)}`;
  return {
    expectRole: 'worker',
    effect: async ({ cwd }) => {
      box.write('feature.txt', 'feature\n', cwd);
      box.write(`marker-${marker}.txt`, `${marker}\n`, cwd);
      for (let i = 0; i < 5; i++) {
        box.write(`tests/t${String(i).padStart(3, '0')}.sh`, 'exit 0\n', cwd);
      }
      const head = await box.commitAll(`feat: add feature (${marker})`, cwd);
      const report: Report = {
        schema_version: 1,
        batch_id: BATCH,
        head_sha: head,
        claims: { commits: [head], ...honestClaims(5) },
        open_questions: [],
      };
      box.write(
        `.collie/batches/${BATCH}/report.md`,
        `# 批次 ${BATCH} 汇报\n\n## 做了什么\n完成。\n\n## 测试结果\n见 claims。\n\n## 偏离或疑问\n无\n\n## 下一步建议\n无\n\n${FENCE}json\n${JSON.stringify(report, null, 2)}\n${FENCE}\n`,
        cwd,
      );
      await box.commitAll(`report(collie): ${BATCH}`, cwd);
      if (push) {
        const { git: gitCmd } = await import('../src/git.js');
        await gitCmd(cwd, ['push', '-q', 'origin', 'main']);
      }
    },
    result: { exitCode: 0 },
  };
}

function ciVerdictEvents(events: readonly Event[]): Event[] {
  return events.filter((e) => e.event === 'ci.verdict_commit');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verdict CI recheck after evidence (SPEC 13.18)', () => {
  let box: Sandbox;

  beforeEach(async () => {
    box = await Sandbox.create();
  });
  afterEach(() => {
    box.dispose();
  });

  it('startup pending -> recheck success: records after_evidence event', async () => {
    // First run: produces verdict.pushed with some sha.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns pending, recheck returns success.
    const fetch = buildFetch(verdictSha, [
      { status: 'in_progress', conclusion: null, branch: 'main' },
      { status: 'completed', conclusion: 'success', branch: 'main' },
    ]);
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    const ciVerdicts = ciVerdictEvents(allEvents);
    // Should have exactly one ci.verdict_commit with when=after_evidence from the second run.
    const afterEvidence = ciVerdicts.filter((e) => e.when === 'after_evidence');
    expect(afterEvidence).toHaveLength(1);
    expect(afterEvidence[0]).toMatchObject({
      sha: verdictSha,
      conclusion: 'success',
      when: 'after_evidence',
    });
  });

  it('startup pending -> recheck failure: records after_evidence event and warns', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns pending, recheck returns failure.
    const fetch = buildFetch(verdictSha, [
      { status: 'in_progress', conclusion: null, branch: 'main' },
      { status: 'completed', conclusion: 'failure', branch: 'main' },
    ]);
    box.output.length = 0;
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    const afterEvidence = ciVerdictEvents(allEvents).filter((e) => e.when === 'after_evidence');
    expect(afterEvidence).toHaveLength(1);
    expect(afterEvidence[0]).toMatchObject({
      sha: verdictSha,
      conclusion: 'failure',
      when: 'after_evidence',
    });
    // Should print the warning.
    const output = box.output.join('');
    expect(output).toContain('previous verdict commit');
    expect(output).toContain('failure');
  });

  it('startup pending -> still pending after evidence: no ci.verdict_commit recorded', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: both startup and recheck return pending.
    const fetch = buildFetch(verdictSha, [
      { status: 'in_progress', conclusion: null, branch: 'main' },
      { status: 'in_progress', conclusion: null, branch: 'main' },
    ]);
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    // The second run should have no ci.verdict_commit events at all.
    // (First run may have one from its startup — filter by run_id.)
    const secondRunEvents = allEvents.filter((e) => {
      // Events from the second run are after the first run's run.finished
      const firstRunFinished = allEvents.findIndex(
        (ev) => ev.event === 'run.finished' && ev.verdict === 'PASS',
      );
      return allEvents.indexOf(e) > firstRunFinished;
    });
    const ciVerdicts = secondRunEvents.filter((e) => e.event === 'ci.verdict_commit');
    expect(ciVerdicts).toHaveLength(0);
  });

  it('startup completed: only one when=startup event, no recheck', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns completed success immediately.
    const fetch = buildFetch(verdictSha, [
      { status: 'completed', conclusion: 'success', branch: 'main' },
      // Should never be called for a second time
      { status: 'completed', conclusion: 'failure', branch: 'main' },
    ]);
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    // Find events from the second run.
    const firstRunFinished = allEvents.findIndex(
      (ev) => ev.event === 'run.finished' && ev.verdict === 'PASS',
    );
    const secondRunEvents = allEvents.filter((_, i) => i > firstRunFinished);
    const ciVerdicts = secondRunEvents.filter((e) => e.event === 'ci.verdict_commit');
    // Exactly one event with when=startup, no after_evidence.
    expect(ciVerdicts).toHaveLength(1);
    expect(ciVerdicts[0]).toMatchObject({
      sha: verdictSha,
      conclusion: 'success',
      when: 'startup',
    });
    const afterEvidence = ciVerdicts.filter((e) => e.when === 'after_evidence');
    expect(afterEvidence).toHaveLength(0);
  });

  it('escalation path (no report): no recheck even if startup was pending', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns pending, but worker produces no report -> escalation.
    let verdictCallCount = 0;
    const fetch: FetchLike = (url) => {
      const sha = new URL(url).searchParams.get('head_sha') ?? '';
      if (sha === verdictSha) {
        verdictCallCount++;
        // Always return pending for verdict sha
        return Promise.resolve(
          new Response(
            JSON.stringify({
              total_count: 1,
              workflow_runs: [
                {
                  id: 100,
                  workflow_id: 1,
                  name: 'ci',
                  event: 'push',
                  head_branch: 'main',
                  head_sha: sha,
                  status: 'in_progress',
                  conclusion: null,
                  html_url: 'https://github.com/example/sandbox/actions/runs/100',
                  created_at: '2026-11-13T07:00:00Z',
                },
              ],
            }),
          ),
        );
      }
      // Evidence queries: success
      const run = {
        id: 42,
        workflow_id: 1,
        name: 'ci',
        event: 'push',
        head_branch: 'main',
        head_sha: sha,
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/example/sandbox/actions/runs/42',
        created_at: '2026-11-13T07:00:00Z',
      };
      return Promise.resolve(
        new Response(JSON.stringify({ total_count: 1, workflow_runs: [run] })),
      );
    };

    // Worker that produces no report -> escalation path.
    // Must remove the leftover report from the first run so readReport fails.
    const r2 = new FakeRunner([
      {
        expectRole: 'worker',
        effect: async ({ cwd }) => {
          // Remove leftover report.md from the first run
          const { unlinkSync } = await import('node:fs');
          try {
            unlinkSync(`${cwd}/.collie/batches/${BATCH}/report.md`);
          } catch {
            // May not exist — fine
          }
          // Write a unique file but no report -> escalation
          box.write(`escalation-marker-${String(++uniqueCounter)}.txt`, 'marker\n', cwd);
          await box.commitAll('feat: no report', cwd);
        },
        result: { exitCode: 0 },
      },
    ]);
    await box.cli(['run', BATCH], r2, { fetch });

    // Escalation path: no evidence collection, so no recheck for verdict sha.
    expect(verdictCallCount).toBe(1); // Only the startup query, no recheck
    const allEvents = box.events();
    const firstRunFinished = allEvents.findIndex(
      (ev) => ev.event === 'run.finished' && ev.verdict === 'PASS',
    );
    const secondRunEvents = allEvents.filter((_, i) => i > firstRunFinished);
    const afterEvidence = secondRunEvents.filter(
      (e) => e.event === 'ci.verdict_commit' && e.when === 'after_evidence',
    );
    expect(afterEvidence).toHaveLength(0);
  });

  it('startup no_runs -> recheck success: records after_evidence event', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns no runs, recheck returns success.
    const fetch = noRunsFetch(verdictSha, {
      status: 'completed',
      conclusion: 'success',
      branch: 'main',
    });
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    const afterEvidence = ciVerdictEvents(allEvents).filter((e) => e.when === 'after_evidence');
    expect(afterEvidence).toHaveLength(1);
    expect(afterEvidence[0]).toMatchObject({
      sha: verdictSha,
      conclusion: 'success',
      when: 'after_evidence',
    });
  });

  it('startup no_runs -> recheck still no runs: no event recorded', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: both startup and recheck return no runs.
    const fetch = noRunsFetch(verdictSha, null);
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    await box.cli(['run', BATCH], r2, { fetch });

    const allEvents = box.events();
    const firstRunFinished = allEvents.findIndex(
      (ev) => ev.event === 'run.finished' && ev.verdict === 'PASS',
    );
    const secondRunEvents = allEvents.filter((_, i) => i > firstRunFinished);
    const ciVerdicts = secondRunEvents.filter((e) => e.event === 'ci.verdict_commit');
    expect(ciVerdicts).toHaveLength(0);
  });

  it('recheck does not change run conclusion or exit code', async () => {
    // First run: produces verdict.pushed.
    await box.run(honest(box));
    const pushed = box.events().find((e) => e.event === 'verdict.pushed');
    expect(pushed).toBeDefined();
    const verdictSha = pushed?.sha as string;

    // Second run: startup returns pending, recheck returns failure.
    // This should NOT change the run's conclusion (still PASS if worker/evidence is good).
    const fetch = buildFetch(verdictSha, [
      { status: 'in_progress', conclusion: null, branch: 'main' },
      { status: 'completed', conclusion: 'failure', branch: 'main' },
    ]);
    const r2 = new FakeRunner([uniqueWorkerScene(box, true), fooledReviewerScene(box)]);
    const exitCode = await box.cli(['run', BATCH], r2, { fetch });

    // Exit code should still be PASS (0).
    expect(exitCode).toBe(0);
    const allEvents = box.events();
    const runFinished = allEvents.filter((e) => e.event === 'run.finished');
    const lastFinished = runFinished.at(-1);
    expect(lastFinished?.verdict).toBe('PASS');
  });
});
