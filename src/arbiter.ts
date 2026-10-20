// Deterministic verdict arbitration (SPEC 4.3, ROLES 2 R2). The reviewer's
// verdict is an input, not the answer: protected-file edits, unapproved
// dependencies and claims contradicted by evidence override it. Rules are
// evaluated in order and the first hit decides.
import type { Acceptance, Claims, Verdict, VerdictValue } from './schema/index.js';

/** A claim the worker made that R4's evidence contradicts (SPEC 3.6 claim.mismatch). */
export interface ClaimMismatch {
  rule: number;
  field: string;
  claimed: unknown;
  actual: unknown;
}

export interface ArbiterInput {
  /** From a validated report.md; runs without one never reach arbitration (SPEC 6). */
  claims: Claims;
  /** Parsed verdict, or the reason it could not be parsed (rule 1). */
  verdict: { ok: true; value: Verdict } | { ok: false; error: string };
  /** Runtime dependencies approved by ADR; anything else in deps_diff blocks (rule 3). */
  approvedDeps: readonly string[];
  /** Command whose verify_results entry carries the test counts (rule 6). */
  testCommand: string;
  /**
   * Acceptance commands R2 ran that did not meet their expect (rule 8), judged
   * by verify.ts against the full stdout, which the evidence summary lacks.
   */
  failedAcceptance: readonly FailedAcceptance[];
}

/** One acceptance command that R2 measured as not satisfied (SPEC 3.6 acceptance.failed). */
export interface FailedAcceptance {
  cmd: string;
  exit_code: number;
  expect: Acceptance['expect'];
}

export interface ArbiterDecision {
  final: VerdictValue;
  /** The reviewer's own verdict, when it could be parsed. */
  original: VerdictValue | null;
  /** 1-8, the rule that decided. */
  rule: number;
  reason: string;
  /**
   * Claims contradicted by evidence, journaled as claim.mismatch: rules 5-7 per
   * SPEC 4.3, plus the denied claim behind a rule 2 or 3 BLOCK.
   */
  mismatches: ClaimMismatch[];
  /** Rule 8: unmet acceptance commands, journaled as acceptance.failed. */
  failedAcceptance: FailedAcceptance[];
  downgraded: boolean;
}

// Rule numbers of SPEC 4.3; named so the decision log reads like the SPEC.
/* eslint-disable no-restricted-syntax -- SPEC 4.3 rule numbers */
const RULE_UNPARSEABLE = 1;
const RULE_SPEC_TOUCHED = 2;
const RULE_DEPENDENCIES = 3;
const RULE_REVIEWER_MISMATCHES = 4;
const RULE_PUSH = 5;
const RULE_TESTS = 6;
const RULE_CI = 7;
const RULE_ACCEPTANCE = 8;
const RULE_DEFAULT = 9;
/* eslint-enable no-restricted-syntax */

/** Strong copyleft licences that block in any dependency tree (ADR-003). */
const STRONG_COPYLEFT = /\b(?:A?GPL|SSPL)\b/i;

const TESTS_LINE = /(?<passed>\d+) passed, (?<failed>\d+) failed/;

/** Package name of a deps_diff entry such as "yaml", "yaml@^2.9.1" or "@scope/pkg@1 (MIT)". */
function packageName(entry: string): string {
  const trimmed = entry.trim().split(/\s/)[0] ?? '';
  const at = trimmed.indexOf('@', 1);
  return at < 0 ? trimmed : trimmed.slice(0, at);
}

interface MeasuredTests {
  passed: number;
  failed: number;
  exitCode: number;
}

/** Test counts R4 measured for the test command, or undefined when it reported none. */
function measuredTests(verdict: Verdict, testCommand: string): MeasuredTests | undefined {
  const entry = verdict.evidence.verify_results.find((r) => r.cmd === testCommand);
  const groups = entry === undefined ? undefined : TESTS_LINE.exec(entry.summary)?.groups;
  if (entry === undefined || groups === undefined) return undefined;
  return {
    passed: Number(groups.passed),
    failed: Number(groups.failed),
    exitCode: entry.exit_code,
  };
}

/**
 * Claimed counts hold only if they equal the measured ones and the claim of
 * "no failures" is backed by a zero exit: vitest can print "0 failed" while a
 * test file failed to load (v01-b03 report).
 */
function testsMatch(claims: Claims, measured: MeasuredTests | undefined): boolean {
  if (measured === undefined) return false;
  if (measured.passed !== claims.tests_passed || measured.failed !== claims.tests_failed)
    return false;
  return !(claims.tests_failed === 0 && measured.exitCode !== 0);
}

function decide(
  original: VerdictValue | null,
  final: VerdictValue,
  rule: number,
  reason: string,
  mismatches: ClaimMismatch[] = [],
): ArbiterDecision {
  return {
    final,
    original,
    rule,
    reason,
    mismatches,
    failedAcceptance: [],
    downgraded: original !== null && original !== final,
  };
}

/** Applies SPEC 4.3 rules 1-8 in order; the first hit decides. */
export function arbitrate(input: ArbiterInput): ArbiterDecision {
  // Rule 1: an unparseable verdict is never trusted.
  if (!input.verdict.ok) {
    return decide(null, 'BLOCK', RULE_UNPARSEABLE, `verdict unparseable: ${input.verdict.error}`);
  }
  const verdict = input.verdict.value;
  const { evidence } = verdict;
  const original = verdict.verdict;
  const { claims } = input;

  // Rule 2: protected files changed. The BLOCK does not depend on what was claimed,
  // but a denial is recorded so the evidence chain shows the false claim.
  if (evidence.spec_diff_lines > 0) {
    const denied: ClaimMismatch[] = claims.spec_touched
      ? []
      : [
          {
            rule: RULE_SPEC_TOUCHED,
            field: 'spec_touched',
            claimed: false,
            actual: { spec_diff_lines: evidence.spec_diff_lines },
          },
        ];
    return decide(
      original,
      'BLOCK',
      RULE_SPEC_TOUCHED,
      `protected files changed by ${String(evidence.spec_diff_lines)} lines`,
      denied,
    );
  }

  // Rule 3: unapproved runtime dependency, or strong copyleft anywhere.
  const copyleft = evidence.deps_diff.filter((d) => STRONG_COPYLEFT.test(d));
  const unapproved = evidence.deps_diff.filter((d) => !input.approvedDeps.includes(packageName(d)));
  if (copyleft.length > 0 || unapproved.length > 0) {
    const parts = [
      ...(unapproved.length > 0 ? [`unapproved dependencies: ${unapproved.join(', ')}`] : []),
      ...(copyleft.length > 0 ? [`strong copyleft: ${copyleft.join(', ')}`] : []),
    ];
    const undeclared = evidence.deps_diff.filter((d) => !claims.new_deps.includes(packageName(d)));
    const denied: ClaimMismatch[] =
      undeclared.length === 0
        ? []
        : [
            {
              rule: RULE_DEPENDENCIES,
              field: 'new_deps',
              claimed: claims.new_deps,
              actual: evidence.deps_diff,
            },
          ];
    return decide(original, 'BLOCK', RULE_DEPENDENCIES, parts.join('; '), denied);
  }

  // Rule 4: the reviewer itself found claims that do not hold.
  if (verdict.claim_mismatches.length > 0) {
    const final = original === 'PASS' ? 'FIX' : original;
    return decide(
      original,
      final,
      RULE_REVIEWER_MISMATCHES,
      `reviewer reported ${String(verdict.claim_mismatches.length)} claim mismatch(es)`,
    );
  }

  // Rules 5-7 compare a claim with evidence; each hit forces FIX and records the mismatch.
  // BLOCK from the reviewer is never softened to FIX.
  const fix = (rule: number, reason: string, mismatch: ClaimMismatch): ArbiterDecision =>
    decide(original, original === 'BLOCK' ? 'BLOCK' : 'FIX', rule, reason, [mismatch]);

  // Rule 5: claimed pushed, but head_sha is not on the remote branch.
  if (claims.pushed && !evidence.remote_has_head) {
    return fix(RULE_PUSH, 'claimed pushed, but head_sha is not on the remote', {
      rule: RULE_PUSH,
      field: 'pushed',
      claimed: true,
      actual: false,
    });
  }

  // Rule 6: claimed test counts differ from the measured ones (or none were measured).
  const measured = measuredTests(verdict, input.testCommand);
  if (!testsMatch(claims, measured)) {
    return fix(
      RULE_TESTS,
      `claimed test counts differ from "${input.testCommand}" as run by the reviewer`,
      {
        rule: RULE_TESTS,
        field: 'tests',
        claimed: { passed: claims.tests_passed, failed: claims.tests_failed },
        actual: measured ?? null,
      },
    );
  }

  // Rule 7: claimed CI green, but CI did not succeed on the expected branch,
  // or that could not be established at all (ci_branch_matched null, SPEC 3.5).
  if (
    claims.ci_passed &&
    (evidence.ci_conclusion !== 'success' || evidence.ci_branch_matched !== true)
  ) {
    return fix(RULE_CI, 'claimed CI passed, but it did not pass on the expected branch', {
      rule: RULE_CI,
      field: 'ci_passed',
      claimed: true,
      actual: {
        ci_conclusion: evidence.ci_conclusion,
        ci_branch_matched: evidence.ci_branch_matched,
      },
    });
  }

  // Rule 8: acceptance is a precondition of PASS that no reviewer explanation waives
  // (SPEC 4.3, v01-b05-smoke: an honest worker, a failing npm test, a reviewer PASS).
  if (input.failedAcceptance.length > 0 && original === 'PASS') {
    return {
      ...decide(
        original,
        'FIX',
        RULE_ACCEPTANCE,
        `${String(input.failedAcceptance.length)} acceptance command(s) not met: ${input.failedAcceptance.map((f) => f.cmd).join('; ')}`,
      ),
      failedAcceptance: [...input.failedAcceptance],
    };
  }

  // Rule 9.
  return decide(original, original, RULE_DEFAULT, verdict.reason);
}
