// Cross-boundary data structures (SPEC 3, CONSTRAINTS 铁律 14).
// Any field change must bump SCHEMA_VERSION and ship a migration.
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

/**
 * Structural invariants, not tunable thresholds (SPEC 3.2, ADR-002 §4),
 * so they live here as named constants rather than in collie.toml.
 */
export const BATCH_ITEMS_MIN = 1;
// eslint-disable-next-line no-restricted-syntax -- SPEC 3.2 / 铁律 8: at most 3 items per batch
export const BATCH_ITEMS_MAX = 3;

/**
 * SPEC 11.1: default grace_secs for the signal ladder. Used when the field is
 * absent from collie.toml (v0.2 fields are schema-optional, SPEC 11.1).
 */
// eslint-disable-next-line no-restricted-syntax -- SPEC 11.1: grace period default, named constant
export const DEFAULT_GRACE_SECS = 20;

/** JSON value, the only payload an NDJSON event line can round-trip losslessly (SPEC 3.6). */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const NonEmptyString = z.string().min(1);

/** run_id becomes a path segment under .collie/runs/, so it must not traverse (SPEC 3.6). */
export const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const RunIdSchema = z.string().regex(RUN_ID_PATTERN, 'invalid run_id');

// ---------------------------------------------------------------------------
// Config (SPEC 3.1)
// ---------------------------------------------------------------------------

/** SPEC 3.1: omitted means the SDK default (ask every time). */
export const PermissionModeSchema = z.enum(['default', 'acceptEdits', 'bypassPermissions']);
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

/** Base agent config shared by worker and reviewer (SPEC 3.1). */
const AgentConfigBase = {
  model: NonEmptyString,
  allowed_tools: z.array(NonEmptyString),
  max_turns: z.number().int().positive(),
  permission_mode: PermissionModeSchema.optional(),
};

export const AgentConfigSchema = z.strictObject(AgentConfigBase);
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Reviewer-specific config extends the base with bash_deny (SPEC 11.2, v03-b02).
 * Each entry is a regex string; invalid regex is rejected at parse time.
 */
export const ReviewerAgentConfigSchema = z.strictObject({
  ...AgentConfigBase,
  /** SPEC 11.2: Bash command deny patterns (regex). Absent or empty = no hook. */
  bash_deny: z
    .array(z.string())
    .optional()
    .default([])
    .refine(
      (patterns) => {
        for (const p of patterns) {
          try {
            new RegExp(p);
          } catch {
            return false;
          }
        }
        return true;
      },
      { message: 'bash_deny contains an invalid regular expression' },
    ),
});
export type ReviewerAgentConfig = z.infer<typeof ReviewerAgentConfigSchema>;

export const LimitsSchema = z.strictObject({
  stall_secs: z.number().int().positive(),
  progress_secs: z.number().int().positive(),
  wallclock_secs: z.number().int().positive(),
  resume_max: z.number().int().nonnegative(),
  fix_max: z.number().int().nonnegative(),
  dry_k: z.number().int().positive(),
  /** Upper bound on waiting for head_sha's CI to leave pending before R2 measures (SPEC 3.1). */
  ci_wait_secs: z.number().int().positive(),
  /** Interval between CI polls while waiting. */
  ci_poll_secs: z.number().int().positive(),
  /** SPEC 11.1: grace period between signal ladder levels; optional, defaults to 20s. */
  grace_secs: z.number().int().positive().optional().default(DEFAULT_GRACE_SECS),
});
export type Limits = z.infer<typeof LimitsSchema>;

export const CollieConfigSchema = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  project: z.strictObject({
    name: NonEmptyString,
    repo: z.url(),
  }),
  agent: z.strictObject({
    worker: AgentConfigSchema,
    reviewer: ReviewerAgentConfigSchema,
  }),
  limits: LimitsSchema,
  verify: z.strictObject({
    commands: z.array(NonEmptyString),
  }),
  ci: z.strictObject({
    provider: z.literal('github-actions'),
    expected_branch: NonEmptyString,
    /** SPEC 3.1: optional path to a file containing a read-only GitHub PAT; `~` expands to home. */
    token_file: z.string().optional(),
  }),
});
export type CollieConfig = z.infer<typeof CollieConfigSchema>;

// ---------------------------------------------------------------------------
// Batch and acceptance (SPEC 3.2)
// ---------------------------------------------------------------------------

export const AcceptanceSchema = z.strictObject({
  desc: NonEmptyString,
  cmd: NonEmptyString,
  expect: z.union([z.literal('exit_zero'), z.strictObject({ stdout_matches: NonEmptyString })]),
});
export type Acceptance = z.infer<typeof AcceptanceSchema>;

export const BatchStatusSchema = z.enum(['pending', 'running', 'passed', 'blocked']);
export type BatchStatus = z.infer<typeof BatchStatusSchema>;

export const BatchSchema = z.strictObject({
  id: NonEmptyString,
  title: NonEmptyString,
  priority: z.number().int(),
  depends_on: z.array(NonEmptyString),
  items: z.array(NonEmptyString).min(BATCH_ITEMS_MIN).max(BATCH_ITEMS_MAX),
  // A batch without any acceptance command cannot be judged by machine (SPEC 3.2).
  acceptance: z.array(AcceptanceSchema).nonempty(),
  forbidden: z.array(z.string()),
  status: BatchStatusSchema,
});
export type Batch = z.infer<typeof BatchSchema>;

// ---------------------------------------------------------------------------
// Events (SPEC 3.6)
// ---------------------------------------------------------------------------

/** Event types supported by v0.1. v0.2 types (worker.stalled, ...) are rejected. */
export const EVENT_TYPES = [
  'run.started',
  'run.finished',
  'batch.selected',
  'batch.task_written',
  'worker.started',
  'worker.finished',
  'worker.crashed',
  'reviewer.started',
  'reviewer.verdict',
  'claim.mismatch',
  'verdict.downgraded',
  'escalated',
  // v01-b05 2c: R2 gave up waiting for CI; the CI evidence is recorded as unknown.
  'ci.wait_timeout',
  // Rule 8 (SPEC 4.3): an acceptance command R2 ran did not meet its expect.
  'acceptance.failed',
  // v0.2 (SPEC 11.3, 11.4, 11.8): heartbeat orphan and dirty-workspace rescue.
  'run.orphaned',
  'worker.rescued',
  // v0.2 (SPEC 11.5, 11.6): liveness detection and signal ladder.
  'worker.stalled',
  'worker.idling',
  'worker.signaled',
  // v0.2 (SPEC 11.7): resume from a previous interrupted session.
  'worker.resumed',
  // v0.2 (SPEC 3.6): CI evidence successfully collected (R2's own measurement).
  'ci.resolved',
  // v0.3 (SPEC 12.1): R2 pushes the verdict commit after progress is written.
  'verdict.pushed',
  // v0.3 (SPEC 12.1): push failed (network, rejected); does not alter the verdict.
  'verdict.push_failed',
  // v0.3 (SPEC 12.1): startup catch-up push skipped (fields: head, reason).
  'verdict.push_skipped',
  // v0.3 (SPEC 12.1): startup CI check of the previous verdict commit.
  'ci.verdict_commit',
  // v0.3 (SPEC 11.2, v03-b02): a bash-deny hook denied a tool call.
  'tool.denied',
  // v0.3 (SPEC 12.2): dependency not satisfied during --continue queue selection.
  'batch.skipped',
  // v0.3 (SPEC 12.2): R2 updated a backlog status column during --continue mode.
  'batch.status',
  // v0.3 (SPEC 12.2): --continue queue finished; reason = exhausted / blocked / escalated / fix_max / limit / paused.
  'queue.finished',
  // v0.3 (SPEC 12.3): PASS but gate conditions not met; fields batch_id / reasons (array).
  'queue.paused',
  // v0.3 (SPEC 12.3): rule 1 BLOCK auto-retried once; fields batch_id / rule (fixed 1).
  'batch.retried',
  // v0.3 (SPEC 12.2 v03-b04-fix): emitted before each batch run in --continue;
  // fields run_id / batch_id / attempt / why (new / fix_retry / rule1_retry).
  'queue.batch_started',
] as const;

export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Extension fields are restricted to JSON values so that
 * replay(append(e)) is deep-equal to e (SPEC 3.6). An `undefined` field is
 * accepted to match the SPEC type and is dropped on serialization.
 */
export const EventSchema = z
  .object({
    ts: z.iso.datetime({ offset: true }),
    run_id: RunIdSchema,
    batch_id: NonEmptyString.optional(),
    event: EventTypeSchema,
  })
  .catchall(JsonValueSchema.optional());
export type Event = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------
// Envelopes (SPEC 3.3, 3.4)
// ---------------------------------------------------------------------------

/** Git object id, abbreviated or full (SPEC 3.4). */
export const SHA_PATTERN = /^[0-9a-f]{7,40}$/;
export const ShaSchema = z.string().regex(SHA_PATTERN, 'invalid git sha');

/** batch_id becomes a path segment under .collie/batches/, so it must not traverse. */
export const BatchIdSchema = z.string().regex(RUN_ID_PATTERN, 'invalid batch_id');

const IsoDateTime = z.iso.datetime({ offset: true });

/** task.md frontmatter (SPEC 3.3). Written by R2, read by R3. */
export const TaskFrontmatterSchema = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  run_id: RunIdSchema,
  batch_id: BatchIdSchema,
  base_sha: ShaSchema,
  created_at: IsoDateTime,
  attempt: z.number().int().positive(),
  // v0.2 (SPEC 11.7): "<run_id> <reason> <last_event>@<time>" or null.
  interrupted_at: z.string().nullable(),
  issued_by: NonEmptyString.optional(),
  revised_at: IsoDateTime.nullable().optional(),
  // v0.2 (SPEC 11.7): sha of the wip(collie) rescue commit, if any. Optional, no version bump.
  rescue_sha: ShaSchema.optional(),
});
export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;

/** Everything here is the worker's claim, not a fact (SPEC 3.4, CONSTRAINTS 铁律 4). */
export const ClaimsSchema = z.strictObject({
  commits: z.array(ShaSchema),
  tests_passed: z.number().int().nonnegative(),
  tests_failed: z.number().int().nonnegative(),
  pushed: z.boolean(),
  // Optional (SPEC 3.4): an absent claim means "not claimed", which is the
  // conservative reading for arbiter rule 7.
  ci_passed: z.boolean().optional().default(false),
  new_deps: z.array(NonEmptyString),
  spec_touched: z.boolean(),
});
export type Claims = z.infer<typeof ClaimsSchema>;

/** Trailing JSON block of report.md (SPEC 3.4). Written by R3, read by R2, never by R4. */
export const ReportSchema = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  batch_id: BatchIdSchema,
  /** Last code commit, excluding the report(collie) envelope commit. */
  head_sha: ShaSchema,
  claims: ClaimsSchema,
  open_questions: z.array(z.string()),
});
export type Report = z.infer<typeof ReportSchema>;

export const VerdictValueSchema = z.enum(['PASS', 'FIX', 'BLOCK']);
export type VerdictValue = z.infer<typeof VerdictValueSchema>;

/** SPEC 3.5: GitHub's many conclusions are folded into four. */
export const CiConclusionSchema = z.enum(['success', 'failure', 'cancelled', 'unknown']);
export type CiConclusion = z.infer<typeof CiConclusionSchema>;

/** One acceptance command as actually run by R4 (SPEC 3.5). */
export const VerifyEvidenceSchema = z.strictObject({
  cmd: NonEmptyString,
  exit_code: z.number().int(),
  summary: z.string(),
});

/** Trailing JSON block of verdict.md (SPEC 3.5). Written by R4, read by R2. */
export const VerdictSchema = z.strictObject({
  schema_version: z.literal(SCHEMA_VERSION),
  batch_id: BatchIdSchema,
  verdict: VerdictValueSchema,
  evidence: z.strictObject({
    commits_actual: z.array(ShaSchema),
    verify_results: z.array(VerifyEvidenceSchema),
    remote_has_head: z.boolean(),
    ci_conclusion: CiConclusionSchema,
    /** May be empty when no run was found. */
    ci_run_url: z.string(),
    /** null: R4 could not obtain the evidence (SPEC 3.5). */
    ci_branch_matched: z.boolean().nullable(),
    deps_diff: z.array(z.string()),
    spec_diff_lines: z.number().int().nonnegative(),
  }),
  // SPEC 3.5 does not specify item shapes; arbiter rule 4 only needs emptiness.
  claim_mismatches: z.array(JsonValueSchema),
  gaps: z.array(z.string()),
  /** Non-empty means PASS with conditions (SPEC 3.5). */
  conditions: z.array(z.string()).optional(),
  reason: z.string(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

// ---------------------------------------------------------------------------
// External: GitHub Actions REST API (GET /repos/{owner}/{repo}/actions/runs)
// ---------------------------------------------------------------------------

/** Only the fields Collie reads; GitHub adds fields freely, so unknown keys are stripped. */
export const GitHubWorkflowRunSchema = z.object({
  id: z.number().int(),
  workflow_id: z.number().int(),
  name: z.string().nullable(),
  event: z.string(),
  head_branch: z.string().nullable(),
  head_sha: z.string(),
  status: z.string().nullable(),
  conclusion: z.string().nullable(),
  html_url: z.string(),
  created_at: z.string(),
});
export type GitHubWorkflowRun = z.infer<typeof GitHubWorkflowRunSchema>;

export const GitHubWorkflowRunsSchema = z.object({
  total_count: z.number().int().nonnegative(),
  workflow_runs: z.array(GitHubWorkflowRunSchema),
});

// ---------------------------------------------------------------------------
// External: npm manifests, read at base_sha and head_sha for deps_diff
// ---------------------------------------------------------------------------

const DependencyMap = z.record(z.string(), z.string());

export const PackageJsonSchema = z.object({
  dependencies: DependencyMap.optional(),
  devDependencies: DependencyMap.optional(),
});
export type PackageJson = z.infer<typeof PackageJsonSchema>;

/** package-lock.json v2/v3: only what the licence scan needs. */
export const PackageLockSchema = z.object({
  packages: z
    .record(
      z.string(),
      z.object({ version: z.string().optional(), license: z.string().optional() }),
    )
    .optional(),
});
export type PackageLock = z.infer<typeof PackageLockSchema>;
