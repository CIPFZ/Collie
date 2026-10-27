// SPEC 12.3: gate decision — pure function that decides "continue or stop" after
// a batch PASSes in --continue mode. The seven conditions are self-contained:
// no runner import, no journal import, no side effects.

/**
 * Input for the gate decision. All fields come from the batch's arbiter outcome,
 * evidence, journal events, and verdict. The caller collects them; this function
 * only interprets them.
 *
 * SPEC 12.3 lists seven conditions; the input carries exactly the data needed.
 */
export interface GateInput {
  /** Whether any `verdict.downgraded` event was recorded for this batch (rule 9 or 8 rescue). */
  downgraded: boolean;
  /** Count of `claim.mismatch` events for this batch. */
  claimMismatches: number;
  /** CI conclusion from `ci.resolved` or evidence (SPEC 3.5 ci_conclusion). */
  ciConclusion: string;
  /** CI branch match from evidence (SPEC 3.5 ci_branch_matched). */
  ciBranchMatched: boolean | null;
  /** Number of dependency diff entries (evidence.deps_diff.length). */
  depsDiffCount: number;
  /** Lines of spec diff (evidence.spec_diff_lines). */
  specDiffLines: number;
  /**
   * Lines of protected-path diff. In the current evidence model this equals
   * specDiffLines, but the gate treats it as a logically separate condition
   * per SPEC 12.3 ("受保护路径改动为 0 行").
   */
  protectedDiffLines: number;
  /** Count of reviewer gaps (verdict.gaps.length). */
  gapsCount: number;
}

export interface GateResult {
  /** True when all seven conditions are satisfied and the queue may continue. */
  pass: boolean;
  /** Reason codes for each unsatisfied condition (SPEC 12.3 field names). */
  reasons: string[];
}

/**
 * SPEC 12.3: evaluates the seven "auto-release" conditions after a PASS.
 *
 * Conditions (all must hold for pass=true):
 *   1. No verdict.downgraded in this batch          -> 'downgraded'
 *   2. claim_mismatches empty                       -> 'claim_mismatches'
 *   3. ci success + branch matched                  -> 'ci'
 *   4. deps_diff empty                              -> 'deps_diff'
 *   5. spec_diff_lines === 0                        -> 'spec_diff'
 *   6. protected path changes === 0                 -> 'protected'
 *   7. reviewer gaps empty                          -> 'gaps'
 */
export function gateDecision(input: GateInput): GateResult {
  const reasons: string[] = [];

  // 1. No verdict.downgraded
  if (input.downgraded) reasons.push('downgraded');

  // 2. claim_mismatches empty
  if (input.claimMismatches > 0) reasons.push('claim_mismatches');

  // 3. CI success + branch matched
  if (input.ciConclusion !== 'success' || input.ciBranchMatched !== true) reasons.push('ci');

  // 4. deps_diff empty
  if (input.depsDiffCount > 0) reasons.push('deps_diff');

  // 5. spec_diff_lines === 0
  if (input.specDiffLines > 0) reasons.push('spec_diff');

  // 6. protected path changes === 0
  if (input.protectedDiffLines > 0) reasons.push('protected');

  // 7. reviewer gaps empty
  if (input.gapsCount > 0) reasons.push('gaps');

  return { pass: reasons.length === 0, reasons };
}
