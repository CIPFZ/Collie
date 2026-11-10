// SPEC 13.1 (v04-b01): journal field tests — run a complete batch with a fake
// runner, then inspect the journal for each new observability field.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Event } from '../src/schema/index.js';
import { Sandbox, fooledReviewerScene, honestClaims, workerScene } from './support/sandbox.js';

// -----------------------------------------------------------------------
// Group 1: runner provides usage/cost/turns — all fields must appear.
// -----------------------------------------------------------------------
describe('journal-fields: runner provides usage data (SPEC 13.1)', () => {
  let box: Sandbox;
  let events: Event[];

  beforeAll(async () => {
    box = await Sandbox.create();
    const worker = workerScene(box, {
      passing: 3,
      failing: 0,
      push: true,
      claims: honestClaims(3),
    });
    // Inject SPEC 13.1 fields into the worker scene result.
    worker.result = {
      exitCode: 0,
      usage: {
        inputTokens: 5000,
        outputTokens: 1200,
        cacheCreationInputTokens: 800,
        cacheReadInputTokens: 300,
      },
      numTurns: 42,
      costUsd: 1.5,
      durationMs: 12345,
    };
    const reviewer = fooledReviewerScene(box);
    // Inject SPEC 13.1 fields into the reviewer scene result.
    const reviewerFinalText = reviewer.result?.finalText;
    reviewer.result = {
      exitCode: 0,
      finalText: reviewerFinalText,
      usage: { inputTokens: 2000, outputTokens: 500 },
      numTurns: 15,
      costUsd: 0.75,
      durationMs: 6789,
    };
    const { FakeRunner } = await import('../src/runner/fake.js');
    await box.run(new FakeRunner([worker, reviewer]));
    events = box.events();
  });

  afterAll(() => {
    box.dispose();
  });

  it('worker.started carries the model field', () => {
    const e = events.find((ev) => ev.event === 'worker.started');
    expect(e).toBeDefined();
    expect(e?.model).toBeTypeOf('string');
    expect((e?.model as string).length).toBeGreaterThan(0);
  });

  it('worker.finished carries num_turns, cost_usd, duration_ms, and usage', () => {
    const e = events.find((ev) => ev.event === 'worker.finished');
    expect(e).toBeDefined();
    expect(e?.num_turns).toBe(42);
    expect(e?.cost_usd).toBe(1.5);
    expect(e?.duration_ms).toBe(12345);
    // usage sub-fields
    const usage = e?.usage as Record<string, unknown> | undefined;
    expect(usage).toBeDefined();
    expect(usage?.input_tokens).toBe(5000);
    expect(usage?.output_tokens).toBe(1200);
    expect(usage?.cache_creation_input_tokens).toBe(800);
    expect(usage?.cache_read_input_tokens).toBe(300);
  });

  it('reviewer.started carries the model field', () => {
    const e = events.find((ev) => ev.event === 'reviewer.started');
    expect(e).toBeDefined();
    expect(e?.model).toBeTypeOf('string');
    expect((e?.model as string).length).toBeGreaterThan(0);
  });

  it('reviewer.finished exists with exit_code and running-level fields', () => {
    const e = events.find((ev) => ev.event === 'reviewer.finished');
    expect(e).toBeDefined();
    expect(e?.exit_code).toBe(0);
    expect(e?.num_turns).toBe(15);
    expect(e?.cost_usd).toBe(0.75);
    expect(e?.duration_ms).toBe(6789);
    const usage = e?.usage as Record<string, unknown> | undefined;
    expect(usage).toBeDefined();
    expect(usage?.input_tokens).toBe(2000);
    expect(usage?.output_tokens).toBe(500);
  });

  it('evidence.collected appears with summary fields', () => {
    const e = events.find((ev) => ev.event === 'evidence.collected');
    expect(e).toBeDefined();
    expect(e?.commits).toBeTypeOf('number');
    expect(e?.acceptance_passed).toBeTypeOf('number');
    expect(e?.acceptance_total).toBeTypeOf('number');
    expect(e?.spec_diff_lines).toBe(0);
    expect(e?.remote_has_head).toBe(true);
  });

  it('run.finished carries rule and reason from the arbiter', () => {
    const e = events.findLast((ev) => ev.event === 'run.finished');
    expect(e).toBeDefined();
    // A PASS verdict uses rule 10 (RULE_DEFAULT) in the arbiter.
    expect(e?.rule).toBeTypeOf('number');
    expect(e?.reason).toBeTypeOf('string');
  });

  it('reviewer.verdict carries gaps array', () => {
    const e = events.find((ev) => ev.event === 'reviewer.verdict');
    expect(e).toBeDefined();
    // The fooledReviewerScene returns empty gaps, so the field should be absent
    // (SPEC 13.1: only written when non-empty).
    // But the verdict value should be present.
    expect(e?.verdict).toBe('PASS');
  });
});

// -----------------------------------------------------------------------
// Group 2: runner does NOT provide usage — fields must be absent, not zero.
// -----------------------------------------------------------------------
describe('journal-fields: runner omits usage data (SPEC 13.1)', () => {
  let box: Sandbox;
  let events: Event[];

  beforeAll(async () => {
    box = await Sandbox.create();
    const worker = workerScene(box, {
      passing: 2,
      failing: 0,
      push: true,
      claims: honestClaims(2),
    });
    // No usage, numTurns, costUsd, or durationMs on result.
    worker.result = { exitCode: 0 };
    const reviewer = fooledReviewerScene(box);
    // Reviewer also has no usage — rebuild result without it.
    reviewer.result = { exitCode: 0, finalText: reviewer.result?.finalText };
    const { FakeRunner } = await import('../src/runner/fake.js');
    await box.run(new FakeRunner([worker, reviewer]));
    events = box.events();
  });

  afterAll(() => {
    box.dispose();
  });

  it('worker.finished omits num_turns when runner does not provide it', () => {
    const e = events.find((ev) => ev.event === 'worker.finished');
    expect(e).toBeDefined();
    expect(e).not.toHaveProperty('num_turns');
    expect(e).not.toHaveProperty('cost_usd');
    expect(e).not.toHaveProperty('duration_ms');
    expect(e).not.toHaveProperty('usage');
  });

  it('reviewer.finished omits running-level fields when runner omits them', () => {
    const e = events.find((ev) => ev.event === 'reviewer.finished');
    expect(e).toBeDefined();
    expect(e?.exit_code).toBe(0);
    expect(e).not.toHaveProperty('num_turns');
    expect(e).not.toHaveProperty('cost_usd');
    expect(e).not.toHaveProperty('duration_ms');
    expect(e).not.toHaveProperty('usage');
  });
});
