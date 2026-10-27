// Unit tests for gateDecision (SPEC 12.3): seven conditions, each independently tested.
import { describe, expect, it } from 'vitest';
import { gateDecision, type GateInput } from '../src/gate.js';

/** All conditions satisfied: the queue should continue. */
function passingInput(): GateInput {
  return {
    downgraded: false,
    claimMismatches: 0,
    ciConclusion: 'success',
    ciBranchMatched: true,
    depsDiffCount: 0,
    specDiffLines: 0,
    protectedDiffLines: 0,
    gapsCount: 0,
  };
}

describe('gateDecision (SPEC 12.3)', () => {
  it('passes when all seven conditions are satisfied', () => {
    const result = gateDecision(passingInput());
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fails with "downgraded" when verdict was downgraded', () => {
    const result = gateDecision({ ...passingInput(), downgraded: true });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('downgraded');
  });

  it('fails with "claim_mismatches" when claim mismatches exist', () => {
    const result = gateDecision({ ...passingInput(), claimMismatches: 2 });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('claim_mismatches');
  });

  it('fails with "ci" when ci conclusion is not success', () => {
    const result = gateDecision({ ...passingInput(), ciConclusion: 'unknown' });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('ci');
  });

  it('fails with "ci" when ci branch is not matched', () => {
    const result = gateDecision({ ...passingInput(), ciBranchMatched: false });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('ci');
  });

  it('fails with "ci" when ci branch matched is null', () => {
    const result = gateDecision({ ...passingInput(), ciBranchMatched: null });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('ci');
  });

  it('fails with "deps_diff" when dependency diffs exist', () => {
    const result = gateDecision({ ...passingInput(), depsDiffCount: 1 });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('deps_diff');
  });

  it('fails with "spec_diff" when spec diff lines are non-zero', () => {
    const result = gateDecision({ ...passingInput(), specDiffLines: 5 });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('spec_diff');
  });

  it('fails with "protected" when protected diff lines are non-zero', () => {
    const result = gateDecision({ ...passingInput(), protectedDiffLines: 3 });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('protected');
  });

  it('fails with "gaps" when reviewer gaps exist', () => {
    const result = gateDecision({ ...passingInput(), gapsCount: 1 });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('gaps');
  });

  it('collects multiple reasons when multiple conditions fail', () => {
    const result = gateDecision({
      ...passingInput(),
      downgraded: true,
      gapsCount: 3,
      ciConclusion: 'failure',
    });
    expect(result.pass).toBe(false);
    expect(result.reasons).toContain('downgraded');
    expect(result.reasons).toContain('gaps');
    expect(result.reasons).toContain('ci');
    expect(result.reasons).toHaveLength(3);
  });
});
