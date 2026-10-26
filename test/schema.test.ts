import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AcceptanceSchema,
  BATCH_ITEMS_MAX,
  BatchSchema,
  CollieConfigSchema,
  EVENT_TYPES,
  EventSchema,
  SCHEMA_VERSION,
  type Acceptance,
  type Batch,
  type CollieConfig,
  type Event,
} from '../src/schema/index.js';

/** Serialize -> parse -> validate, as every cross-boundary value travels. */
function roundTrip<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

function issuePaths(schema: z.ZodType, value: unknown): string[] {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
}

const validConfig: CollieConfig = {
  schema_version: 1,
  project: { name: 'collie', repo: 'https://github.com/CIPFZ/Collie' },
  agent: {
    worker: {
      model: 'claude-opus-4-6',
      allowed_tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      max_turns: 120,
    },
    reviewer: {
      model: 'claude-opus-4-6',
      allowed_tools: ['Read', 'Glob', 'Grep', 'Bash'],
      max_turns: 60,
      bash_deny: [],
    },
  },
  limits: {
    stall_secs: 90,
    progress_secs: 900,
    wallclock_secs: 3600,
    resume_max: 2,
    fix_max: 2,
    dry_k: 2,
    ci_wait_secs: 1800,
    ci_poll_secs: 30,
    grace_secs: 20,
  },
  verify: { commands: ['npm run lint', 'npm run typecheck', 'npm test'] },
  ci: { provider: 'github-actions', expected_branch: 'main' },
};

const exitZero: Acceptance = { desc: 'tests pass', cmd: 'npm test', expect: 'exit_zero' };
const stdoutMatch: Acceptance = {
  desc: 'version printed',
  cmd: 'node -v',
  expect: { stdout_matches: '^v22\\.' },
};

const validBatch: Batch = {
  id: 'v01-b03',
  title: 'reviewer and arbiter',
  priority: 3,
  depends_on: ['v01-b02'],
  items: ['verify', 'reviewer', 'arbiter'],
  acceptance: [exitZero, stdoutMatch],
  forbidden: ['no constrained decoding'],
  status: 'pending',
};

const validEvent: Event = {
  ts: '2026-10-16T12:00:00.000Z',
  run_id: 'r-0007',
  batch_id: 'v01-b03',
  event: 'claim.mismatch',
  field: 'tests_passed',
  claimed: 47,
  actual: { passed: 44, failed: 3 },
  notes: ['line\nbreak', null, true],
};

describe('schema: version', () => {
  it('SCHEMA_VERSION is 1 (SPEC 3)', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe('schema: CollieConfig round-trip', () => {
  it('round-trips a valid config', () => {
    expect(roundTrip(CollieConfigSchema, validConfig)).toEqual(validConfig);
  });

  it('rejects a wrong schema_version', () => {
    expect(issuePaths(CollieConfigSchema, { ...validConfig, schema_version: 2 })).toEqual([
      'schema_version',
    ]);
  });

  it('rejects a missing section', () => {
    const noLimits: Partial<CollieConfig> = { ...validConfig };
    delete noLimits.limits;
    expect(issuePaths(CollieConfigSchema, noLimits)).toEqual(['limits']);
  });

  it('rejects a mistyped threshold with its field path', () => {
    const bad = { ...validConfig, limits: { ...validConfig.limits, stall_secs: '90' } };
    expect(issuePaths(CollieConfigSchema, bad)).toEqual(['limits.stall_secs']);
  });

  it('rejects non-integer and non-positive thresholds', () => {
    expect(
      issuePaths(CollieConfigSchema, {
        ...validConfig,
        limits: { ...validConfig.limits, wallclock_secs: 1.5, dry_k: 0 },
      }),
    ).toEqual(['limits.wallclock_secs', 'limits.dry_k']);
  });

  it('rejects unknown keys (strict) so typos are not silently ignored', () => {
    const typo = { ...validConfig, limits: { ...validConfig.limits, stal_secs: 90 } };
    expect(issuePaths(CollieConfigSchema, typo)).toEqual(['limits']);
  });

  it('rejects an unsupported CI provider and a non-URL repo', () => {
    expect(
      issuePaths(CollieConfigSchema, {
        ...validConfig,
        project: { ...validConfig.project, repo: 'not a url' },
        ci: { ...validConfig.ci, provider: 'gitlab' },
      }),
    ).toEqual(['project.repo', 'ci.provider']);
  });

  it('accepts valid bash_deny regex patterns in reviewer config', () => {
    const withPatterns = {
      ...validConfig,
      agent: {
        ...validConfig.agent,
        reviewer: {
          ...validConfig.agent.reviewer,
          bash_deny: ['^\\s*git\\s+push\\b', '^\\s*gh\\s'],
        },
      },
    };
    expect(CollieConfigSchema.safeParse(withPatterns).success).toBe(true);
  });

  it('rejects invalid regex in bash_deny', () => {
    const withBadRegex = {
      ...validConfig,
      agent: {
        ...validConfig.agent,
        reviewer: {
          ...validConfig.agent.reviewer,
          bash_deny: ['(unclosed'],
        },
      },
    };
    const result = CollieConfigSchema.safeParse(withBadRegex);
    expect(result.success).toBe(false);
  });

  it('defaults bash_deny to empty array when omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to omit
    const { bash_deny: _bd, ...reviewerWithout } = validConfig.agent.reviewer;
    const withoutBashDeny = {
      ...validConfig,
      agent: {
        ...validConfig.agent,
        reviewer: reviewerWithout,
      },
    };
    const result = CollieConfigSchema.safeParse(withoutBashDeny);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.agent.reviewer.bash_deny).toEqual([]);
    }
  });
});

describe('schema: Acceptance round-trip', () => {
  it.each([
    ['exit_zero', exitZero],
    ['stdout_matches', stdoutMatch],
  ])('round-trips expect=%s', (_label, value) => {
    expect(roundTrip(AcceptanceSchema, value)).toEqual(value);
  });

  it.each([
    ['exit_nonzero literal (SPEC 3.2 forbids)', { ...exitZero, expect: 'exit_nonzero' }],
    ['empty command', { ...exitZero, cmd: '' }],
    ['missing cmd', { desc: 'x', expect: 'exit_zero' }],
    ['extra key in expect object', { ...exitZero, expect: { stdout_matches: 'x', code: 0 } }],
    ['empty stdout_matches', { ...exitZero, expect: { stdout_matches: '' } }],
  ])('rejects %s', (_label, value) => {
    expect(AcceptanceSchema.safeParse(value).success).toBe(false);
  });
});

describe('schema: Batch round-trip', () => {
  it('round-trips a valid batch', () => {
    expect(roundTrip(BatchSchema, validBatch)).toEqual(validBatch);
  });

  it('accepts exactly BATCH_ITEMS_MAX items and rejects one more (SPEC 3.2)', () => {
    expect(BATCH_ITEMS_MAX).toBe(3);
    const items = Array.from({ length: BATCH_ITEMS_MAX }, (_v, i) => `item ${String(i)}`);
    expect(BatchSchema.safeParse({ ...validBatch, items }).success).toBe(true);
    expect(issuePaths(BatchSchema, { ...validBatch, items: [...items, 'one more'] })).toEqual([
      'items',
    ]);
  });

  it('rejects zero items and zero acceptance commands', () => {
    expect(issuePaths(BatchSchema, { ...validBatch, items: [], acceptance: [] })).toEqual([
      'items',
      'acceptance',
    ]);
  });

  it('rejects a status outside the enum', () => {
    expect(issuePaths(BatchSchema, { ...validBatch, status: '已签发 task' })).toEqual(['status']);
  });

  it('reports nested acceptance errors with their index', () => {
    const acceptance = [exitZero, { ...stdoutMatch, cmd: 42 }];
    expect(issuePaths(BatchSchema, { ...validBatch, acceptance })).toEqual(['acceptance.1.cmd']);
  });
});

describe('schema: Event round-trip', () => {
  it('round-trips an event with JSON extension fields', () => {
    expect(roundTrip(EventSchema, validEvent)).toEqual(validEvent);
  });

  it.each(EVENT_TYPES)('accepts v0.1 event type %s', (event) => {
    expect(EventSchema.safeParse({ ...validEvent, event }).success).toBe(true);
  });

  it.each(['worker.hypothetical'])('rejects unknown event type %s', (event) => {
    expect(issuePaths(EventSchema, { ...validEvent, event })).toEqual(['event']);
  });

  it('defines the v0.1 event types plus v0.2 and v0.3 types added so far', () => {
    expect(EVENT_TYPES).toHaveLength(29);
    expect(EVENT_TYPES).toContain('ci.wait_timeout');
    expect(EVENT_TYPES).toContain('acceptance.failed');
    // v0.2 additions (SPEC 11.3–11.6)
    expect(EVENT_TYPES).toContain('run.orphaned');
    expect(EVENT_TYPES).toContain('worker.rescued');
    expect(EVENT_TYPES).toContain('worker.stalled');
    expect(EVENT_TYPES).toContain('worker.idling');
    expect(EVENT_TYPES).toContain('worker.signaled');
    // v0.2 additions (SPEC 11.7, 3.6)
    expect(EVENT_TYPES).toContain('worker.resumed');
    expect(EVENT_TYPES).toContain('ci.resolved');
    // v0.3 additions (SPEC 12.1)
    expect(EVENT_TYPES).toContain('verdict.pushed');
    expect(EVENT_TYPES).toContain('verdict.push_failed');
    expect(EVENT_TYPES).toContain('verdict.push_skipped');
    expect(EVENT_TYPES).toContain('ci.verdict_commit');
    // v0.3 additions (SPEC 11.2, v03-b02)
    expect(EVENT_TYPES).toContain('tool.denied');
    // v0.3 additions (SPEC 12.2)
    expect(EVENT_TYPES).toContain('batch.skipped');
    expect(EVENT_TYPES).toContain('batch.status');
    expect(EVENT_TYPES).toContain('queue.finished');
  });

  it.each(['../escape', 'a/b', '', '.hidden', 'r 1'])('rejects unsafe run_id %j', (run_id) => {
    expect(issuePaths(EventSchema, { ...validEvent, run_id })).toEqual(['run_id']);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(issuePaths(EventSchema, { ...validEvent, ts: '2026/10/16 12:00' })).toEqual(['ts']);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['function', () => 1],
    ['bigint', BigInt(1)],
    ['Date', new Date(0)],
    ['nested undefined in array', [undefined]],
  ])('rejects a non-JSON extension value (%s)', (_label, value) => {
    expect(EventSchema.safeParse({ ...validEvent, payload: value }).success).toBe(false);
  });
});
