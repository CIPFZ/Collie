import { describe, expect, it } from 'vitest';
import { arbitrate, type ArbiterInput, type FailedAcceptance } from '../src/arbiter.js';
import type { Claims, Verdict } from '../src/schema/index.js';

const HEAD = 'dbe90a4036e360312e0f6d3aab6131937ca9161a';
const TEST_CMD = 'npm test';
const APPROVED = ['zod', 'smol-toml', 'yaml', 'commander', 'vitest', 'typescript'];

/** Claims that every rule accepts against `cleanVerdict`. */
const honestClaims: Claims = {
  commits: [HEAD],
  tests_passed: 47,
  tests_failed: 0,
  pushed: true,
  ci_passed: true,
  new_deps: [],
  spec_touched: false,
};

const cleanVerdict: Verdict = {
  schema_version: 1,
  batch_id: 'v01-b04',
  verdict: 'PASS',
  evidence: {
    commits_actual: [HEAD],
    verify_results: [
      { cmd: 'npm run lint', exit_code: 0, summary: 'All matched files use Prettier code style!' },
      { cmd: TEST_CMD, exit_code: 0, summary: '47 passed, 0 failed' },
    ],
    remote_has_head: true,
    ci_conclusion: 'success',
    ci_run_url: 'https://github.com/CIPFZ/Collie/actions/runs/1',
    ci_branch_matched: true,
    deps_diff: [],
    spec_diff_lines: 0,
  },
  claim_mismatches: [],
  gaps: [],
  reason: 'all evidence agrees',
};

type Evidence = Verdict['evidence'];

function input(
  overrides: {
    claims?: Partial<Claims>;
    verdict?: Partial<Verdict>;
    evidence?: Partial<Evidence>;
    failed?: FailedAcceptance[];
  } = {},
): ArbiterInput {
  const verdict: Verdict = {
    ...cleanVerdict,
    ...overrides.verdict,
    evidence: { ...cleanVerdict.evidence, ...overrides.evidence },
  };
  return {
    claims: { ...honestClaims, ...overrides.claims },
    verdict: { ok: true, value: verdict },
    approvedDeps: APPROVED,
    testCommand: TEST_CMD,
    failedAcceptance: overrides.failed ?? [],
  };
}

describe('arbiter: baseline', () => {
  it('rule 10 keeps the reviewer verdict when every claim holds', () => {
    expect(arbitrate(input())).toEqual({
      final: 'PASS',
      original: 'PASS',
      rule: 10,
      reason: 'all evidence agrees',
      mismatches: [],
      failedAcceptance: [],
      downgraded: false,
    });
  });

  it.each(['FIX', 'BLOCK'] as const)('rule 10 keeps an honest %s', (verdict) => {
    expect(arbitrate(input({ verdict: { verdict } }))).toMatchObject({
      final: verdict,
      rule: 10,
      downgraded: false,
    });
  });
});

describe('arbiter: rule 1, unparseable verdict', () => {
  it('blocks without a reviewer verdict', () => {
    const decision = arbitrate({
      ...input(),
      verdict: { ok: false, error: 'no fenced ```json block found' },
    });
    expect(decision).toMatchObject({ final: 'BLOCK', original: null, rule: 1, downgraded: false });
    expect(decision.reason).toContain('no fenced ```json block found');
  });
});

describe('arbiter: rule 2, SPEC touched', () => {
  it('blocks a PASS when spec_diff_lines > 0, recording the false spec_touched claim', () => {
    expect(arbitrate(input({ evidence: { spec_diff_lines: 3 } }))).toMatchObject({
      final: 'BLOCK',
      original: 'PASS',
      rule: 2,
      downgraded: true,
      mismatches: [
        { rule: 2, field: 'spec_touched', claimed: false, actual: { spec_diff_lines: 3 } },
      ],
    });
  });

  it('still blocks an admitted SPEC change, without a mismatch', () => {
    expect(
      arbitrate(input({ claims: { spec_touched: true }, evidence: { spec_diff_lines: 3 } })),
    ).toMatchObject({
      final: 'BLOCK',
      rule: 2,
      mismatches: [],
    });
  });
});

describe('arbiter: rule 3, dependencies', () => {
  it('passes approved dependencies in any notation', () => {
    expect(
      arbitrate(
        input({ evidence: { deps_diff: ['yaml', 'zod@^4.6.7', 'commander@15.0.0 (MIT)'] } }),
      ).rule,
    ).toBe(10);
  });

  it('blocks an unapproved dependency, naming it', () => {
    const decision = arbitrate(input({ evidence: { deps_diff: ['yaml', 'left-pad@1.3.0'] } }));
    expect(decision).toMatchObject({ final: 'BLOCK', rule: 3 });
    expect(decision.reason).toBe('unapproved dependencies: left-pad@1.3.0');
  });

  it('records undeclared dependencies as a denied new_deps claim', () => {
    const decision = arbitrate(
      input({
        claims: { new_deps: ['yaml'] },
        evidence: { deps_diff: ['yaml', 'left-pad@1.3.0'] },
      }),
    );
    expect(decision.mismatches).toEqual([
      { rule: 3, field: 'new_deps', claimed: ['yaml'], actual: ['yaml', 'left-pad@1.3.0'] },
    ]);
  });

  it('handles scoped package names', () => {
    expect(arbitrate(input({ evidence: { deps_diff: ['@evil/pkg@1.0.0'] } })).reason).toContain(
      '@evil/pkg@1.0.0',
    );
  });

  it('blocks strong copyleft even for an otherwise approved name', () => {
    const decision = arbitrate(input({ evidence: { deps_diff: ['vitest (AGPL-3.0)'] } }));
    expect(decision).toMatchObject({ final: 'BLOCK', rule: 3 });
    expect(decision.reason).toContain('strong copyleft');
  });
});

describe('arbiter: rule 4, reviewer-reported mismatches', () => {
  it('downgrades PASS to FIX', () => {
    const decision = arbitrate(input({ verdict: { claim_mismatches: [{ field: 'x' }] } }));
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'PASS',
      rule: 4,
      downgraded: true,
      mismatches: [],
    });
  });

  it('keeps a BLOCK as BLOCK', () => {
    expect(
      arbitrate(input({ verdict: { verdict: 'BLOCK', claim_mismatches: ['x'] } })),
    ).toMatchObject({
      final: 'BLOCK',
      rule: 4,
      downgraded: false,
    });
  });
});

describe('arbiter: rule 5, push claim', () => {
  it('forces FIX and records the mismatch when head_sha is not on the remote', () => {
    expect(arbitrate(input({ evidence: { remote_has_head: false } }))).toMatchObject({
      final: 'FIX',
      rule: 5,
      downgraded: true,
      mismatches: [{ rule: 5, field: 'pushed', claimed: true, actual: false }],
    });
  });

  it('does not fire when the worker did not claim to have pushed', () => {
    // Use FIX to bypass rule 9 (evidence missing only caps PASS).
    expect(
      arbitrate(
        input({
          claims: { pushed: false },
          verdict: { verdict: 'FIX' },
          evidence: { remote_has_head: false },
        }),
      ).rule,
    ).toBe(10);
  });
});

describe('arbiter: rule 6, test counts', () => {
  it('forces FIX when claimed 47 passed / 0 failed but 44 / 3 were measured', () => {
    const decision = arbitrate(
      input({
        evidence: {
          verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '44 passed, 3 failed' }],
        },
      }),
    );
    expect(decision).toMatchObject({ final: 'FIX', rule: 6, downgraded: true });
    expect(decision.mismatches).toEqual([
      {
        rule: 6,
        field: 'tests',
        claimed: { passed: 47, failed: 0 },
        actual: { passed: 44, failed: 3, exitCode: 1 },
      },
    ]);
  });

  it('forces FIX when "0 failed" is printed but the test command exited non-zero', () => {
    const decision = arbitrate(
      input({
        evidence: {
          verify_results: [
            { cmd: TEST_CMD, exit_code: 1, summary: '47 passed, 0 failed, 2 test files failed' },
          ],
        },
      }),
    );
    expect(decision).toMatchObject({ final: 'FIX', rule: 6 });
  });

  it('forces FIX when the reviewer did not run the test command at all', () => {
    const decision = arbitrate(input({ evidence: { verify_results: [] } }));
    expect(decision).toMatchObject({ final: 'FIX', rule: 6, mismatches: [{ actual: null }] });
  });

  it('accepts an honest claim of failures', () => {
    const decision = arbitrate(
      input({
        claims: { tests_passed: 44, tests_failed: 3 },
        verdict: { verdict: 'FIX' },
        evidence: {
          verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '44 passed, 3 failed' }],
        },
      }),
    );
    expect(decision).toMatchObject({ final: 'FIX', rule: 10, downgraded: false });
  });
});

describe('arbiter: rule 7, CI claim', () => {
  it.each([
    ['CI ran on another branch', { ci_branch_matched: false }],
    ['CI failed on the expected branch', { ci_conclusion: 'failure' as const }],
    ['CI result unknown', { ci_conclusion: 'unknown' as const }],
    ['branch could not be established (null)', { ci_branch_matched: null }],
  ])('forces FIX when CI was claimed green but %s', (_label, evidence) => {
    const decision = arbitrate(input({ evidence }));
    expect(decision).toMatchObject({ final: 'FIX', rule: 7, downgraded: true });
    expect(decision.mismatches[0]).toMatchObject({ rule: 7, field: 'ci_passed', claimed: true });
  });

  it('does not fire when CI was not claimed green (missing ci_passed defaults to false)', () => {
    // Use FIX verdict to bypass rule 9 (evidence missing only caps PASS).
    const decision = arbitrate(
      input({
        claims: { ci_passed: false },
        verdict: { verdict: 'FIX' },
        evidence: { ci_branch_matched: null, ci_conclusion: 'unknown' },
      }),
    );
    expect(decision.rule).toBe(10);
  });
});

describe('arbiter: rule 8, acceptance not met', () => {
  const failing: FailedAcceptance[] = [{ cmd: TEST_CMD, exit_code: 1, expect: 'exit_zero' }];

  it('downgrades an honest PASS to FIX when an acceptance command failed', () => {
    // v01-b05-smoke: honest claims, a failing command, a reviewer PASS.
    const decision = arbitrate(input({ failed: failing }));
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'PASS',
      rule: 8,
      downgraded: true,
      mismatches: [],
      failedAcceptance: failing,
    });
    expect(decision.reason).toContain('npm test');
  });

  it('covers stdout_matches failures too', () => {
    const unmatched: FailedAcceptance[] = [
      { cmd: 'node -v', exit_code: 0, expect: { stdout_matches: '^v22\\.' } },
    ];
    expect(arbitrate(input({ failed: unmatched }))).toMatchObject({ final: 'FIX', rule: 8 });
  });

  it.each(['FIX', 'BLOCK'] as const)('leaves a reviewer %s as it is', (verdict) => {
    expect(arbitrate(input({ verdict: { verdict }, failed: failing }))).toMatchObject({
      final: verdict,
      rule: 10,
      downgraded: false,
      failedAcceptance: [],
    });
  });

  it('does not fire when every acceptance command was met', () => {
    expect(arbitrate(input({ failed: [] })).rule).toBe(10);
  });
});

describe('arbiter: rule 9, evidence missing (SPEC 4.3 v02-b05)', () => {
  it('downgrades PASS to FIX when remote_has_head is false (unpushed)', () => {
    const decision = arbitrate(
      input({ claims: { pushed: false }, evidence: { remote_has_head: false } }),
    );
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'PASS',
      rule: 9,
      downgraded: true,
      mismatches: [],
    });
    expect(decision.reason).toContain('remote_has_head=false');
  });

  it('downgrades PASS to FIX when ci_conclusion is unknown', () => {
    const decision = arbitrate(
      input({
        claims: { ci_passed: false },
        evidence: { ci_conclusion: 'unknown', ci_branch_matched: null },
      }),
    );
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'PASS',
      rule: 9,
      downgraded: true,
      mismatches: [],
    });
    expect(decision.reason).toContain('ci_conclusion=unknown');
  });

  it('downgrades PASS to FIX when ci_branch_matched is not true', () => {
    const decision = arbitrate(
      input({
        claims: { ci_passed: false },
        evidence: { ci_branch_matched: false, ci_conclusion: 'success' },
      }),
    );
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'PASS',
      rule: 9,
      downgraded: true,
      mismatches: [],
    });
    expect(decision.reason).toContain('ci_branch_matched=false');
  });

  it('does not change an original FIX verdict', () => {
    const decision = arbitrate(
      input({
        verdict: { verdict: 'FIX' },
        claims: { pushed: false },
        evidence: { remote_has_head: false },
      }),
    );
    expect(decision).toMatchObject({
      final: 'FIX',
      original: 'FIX',
      rule: 10,
      downgraded: false,
    });
  });

  it('does not change an original BLOCK verdict', () => {
    const decision = arbitrate(
      input({
        verdict: { verdict: 'BLOCK' },
        claims: { pushed: false },
        evidence: { remote_has_head: false },
      }),
    );
    expect(decision).toMatchObject({
      final: 'BLOCK',
      original: 'BLOCK',
      rule: 10,
      downgraded: false,
    });
  });
});

describe('arbiter: order matters, first hit wins', () => {
  it('rule 1 beats everything', () => {
    expect(
      arbitrate({
        ...input({ evidence: { spec_diff_lines: 9 } }),
        verdict: { ok: false, error: 'x' },
      }).rule,
    ).toBe(1);
  });

  it('rule 2 (BLOCK) beats rule 5-7 (FIX)', () => {
    const decision = arbitrate(
      input({ evidence: { spec_diff_lines: 1, remote_has_head: false, ci_branch_matched: false } }),
    );
    expect(decision).toMatchObject({ final: 'BLOCK', rule: 2 });
    expect(decision.mismatches.map((m) => m.rule)).toEqual([2]);
  });

  it('rule 3 beats rule 4', () => {
    expect(
      arbitrate(
        input({ verdict: { claim_mismatches: ['x'] }, evidence: { deps_diff: ['left-pad'] } }),
      ).rule,
    ).toBe(3);
  });

  it('rule 4 beats rule 5', () => {
    expect(
      arbitrate(
        input({ verdict: { claim_mismatches: ['x'] }, evidence: { remote_has_head: false } }),
      ).rule,
    ).toBe(4);
  });

  it('rule 5 beats rule 6, which beats rule 7', () => {
    const tests = {
      verify_results: [{ cmd: TEST_CMD, exit_code: 1, summary: '44 passed, 3 failed' }],
    };
    expect(
      arbitrate(input({ evidence: { remote_has_head: false, ...tests, ci_branch_matched: false } }))
        .rule,
    ).toBe(5);
    expect(arbitrate(input({ evidence: { ...tests, ci_branch_matched: false } })).rule).toBe(6);
  });

  it('rules 5-7 (a lie) beat rule 8 (an honest failure)', () => {
    const failing: FailedAcceptance[] = [{ cmd: TEST_CMD, exit_code: 1, expect: 'exit_zero' }];
    expect(arbitrate(input({ evidence: { ci_branch_matched: false }, failed: failing })).rule).toBe(
      7,
    );
  });

  it('rule 2 (BLOCK) beats rule 8 (FIX)', () => {
    const failing: FailedAcceptance[] = [{ cmd: TEST_CMD, exit_code: 1, expect: 'exit_zero' }];
    expect(arbitrate(input({ evidence: { spec_diff_lines: 1 }, failed: failing }))).toMatchObject({
      final: 'BLOCK',
      rule: 2,
    });
  });

  it('never softens a reviewer BLOCK to FIX in rules 5-7', () => {
    expect(
      arbitrate(input({ verdict: { verdict: 'BLOCK' }, evidence: { ci_branch_matched: false } })),
    ).toMatchObject({
      final: 'BLOCK',
      rule: 7,
      downgraded: false,
    });
  });
});
