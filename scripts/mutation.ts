#!/usr/bin/env tsx
// Mutation check (SPEC 15.1): for each entry in the list, delete or change one
// judgment in src/arbiter.ts, src/gate.ts, or src/evidence.ts, then run that
// file's own unit tests. Every mutation must be caught by a failing assertion.
//
// Usage:
//   npx tsx scripts/mutation.ts          # run all
//   npx tsx scripts/mutation.ts --list   # print names
//   npx tsx scripts/mutation.ts --only name1,name2
//
// Results: caught | survived | invalid | timeout | stale
// Exit 0 only when every item is "caught".

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Result = 'caught' | 'survived' | 'invalid' | 'timeout' | 'stale';

export interface MutationItem {
  name: string;
  file: string; // relative to repo root
  original: string; // must appear exactly once in file
  replacement: string; // what to put in its place
}

// ---------------------------------------------------------------------------
// Test-file mapping (SPEC 15.1)
// ---------------------------------------------------------------------------

export function testFilesFor(file: string): string[] {
  switch (file) {
    case 'src/arbiter.ts':
      return ['test/arbiter.test.ts', 'test/progress.test.ts'];
    case 'src/gate.ts':
      return ['test/gate.test.ts'];
    case 'src/evidence.ts':
      return ['test/evidence.test.ts'];
    default:
      throw new Error(`No test mapping for ${file}`);
  }
}

// ---------------------------------------------------------------------------
// Mutation list — 44 items (SPEC 15.1)
// ---------------------------------------------------------------------------

export const MUTATIONS: MutationItem[] = [
  // ── Rule entries (9): make the rule never fire ────────────────────────
  {
    name: 'rule1-unparseable',
    file: 'src/arbiter.ts',
    original:
      "if (!input.verdict.ok) {\n    return decide(null, 'BLOCK', RULE_UNPARSEABLE, `verdict unparseable: ${input.verdict.error}`);\n  }\n  const verdict = input.verdict.value;",
    replacement:
      'const verdict = input.verdict.ok\n    ? input.verdict.value\n    : (null as unknown as Verdict);',
  },
  {
    name: 'rule2-protected',
    file: 'src/arbiter.ts',
    original: 'if (evidence.spec_diff_lines > 0) {',
    replacement: 'if (false) {',
  },
  {
    name: 'rule3-deps',
    file: 'src/arbiter.ts',
    original: 'if (copyleft.length > 0 || unapproved.length > 0) {',
    replacement: 'if (false) {',
  },
  {
    name: 'rule4-reviewer-mismatch',
    file: 'src/arbiter.ts',
    original: 'if (verdict.claim_mismatches.length > 0) {',
    replacement: 'if (false) {',
  },
  {
    name: 'rule5-push',
    file: 'src/arbiter.ts',
    original: 'if (claims.pushed && !evidence.remote_has_head) {',
    replacement: 'if (false) {',
  },
  {
    name: 'rule6-tests',
    file: 'src/arbiter.ts',
    original: 'if (!testsMatch(claims, measured)) {',
    replacement: 'if (false) {',
  },
  {
    name: 'rule7-ci',
    file: 'src/arbiter.ts',
    original:
      "claims.ci_passed &&\n    (evidence.ci_conclusion !== 'success' || evidence.ci_branch_matched !== true)",
    replacement: 'false &&\n    (false || false)',
  },
  {
    name: 'rule8-acceptance',
    file: 'src/arbiter.ts',
    original: "if (input.failedAcceptance.length > 0 && original === 'PASS') {",
    replacement: 'if (false) {',
  },
  {
    name: 'rule9-evidence',
    file: 'src/arbiter.ts',
    original:
      "original === 'PASS' &&\n    (!evidence.remote_has_head ||\n      evidence.ci_conclusion !== 'success' ||\n      evidence.ci_branch_matched !== true)",
    replacement: "original === 'PASS' &&\n    (false &&\n      false &&\n      false)",
  },

  // ── Rule conditions (17) ─────────────────────────────────────────────
  {
    name: 'rule2-denial-recorded',
    file: 'src/arbiter.ts',
    original: 'const denied: ClaimMismatch[] = claims.spec_touched\n      ? []\n      : [',
    replacement: 'const denied: ClaimMismatch[] = true\n      ? []\n      : [',
  },
  {
    name: 'rule3-copyleft-half',
    file: 'src/arbiter.ts',
    original: 'const copyleft = evidence.deps_diff.filter((d) => STRONG_COPYLEFT.test(d));',
    replacement: 'const copyleft: string[] = [];',
  },
  {
    name: 'rule3-unapproved-half',
    file: 'src/arbiter.ts',
    original:
      'const unapproved = evidence.deps_diff.filter((d) => !input.approvedDeps.includes(packageName(d)));',
    replacement: 'const unapproved: string[] = [];',
  },
  {
    name: 'rule3-denial-recorded',
    file: 'src/arbiter.ts',
    original:
      'const undeclared = evidence.deps_diff.filter((d) => !claims.new_deps.includes(packageName(d)));',
    replacement: 'const undeclared: string[] = [];',
  },
  {
    name: 'rule4-pass-to-fix',
    file: 'src/arbiter.ts',
    original: "const final = original === 'PASS' ? 'FIX' : original;",
    replacement: 'const final = original;',
  },
  {
    name: 'rules5-7-block-not-softened',
    file: 'src/arbiter.ts',
    original: "original === 'BLOCK' ? 'BLOCK' : 'FIX'",
    replacement: "'FIX'",
  },
  {
    name: 'rule6-unmeasured',
    file: 'src/arbiter.ts',
    original: 'if (measured === undefined) return false;',
    replacement: 'if (measured === undefined) return true;',
  },
  {
    name: 'rule6-zero-failed-needs-exit0',
    file: 'src/arbiter.ts',
    original: 'return !(claims.tests_failed === 0 && measured.exitCode !== 0);',
    replacement: 'return true;',
  },
  {
    name: 'rule6-failed-count-half',
    file: 'src/arbiter.ts',
    original: 'measured.passed !== claims.tests_passed || measured.failed !== claims.tests_failed',
    replacement: 'measured.passed !== claims.tests_passed',
  },
  {
    name: 'rule6-passed-count-half',
    file: 'src/arbiter.ts',
    original: 'measured.passed !== claims.tests_passed || measured.failed !== claims.tests_failed',
    replacement: 'measured.failed !== claims.tests_failed',
  },
  {
    name: 'rule7-branch-half',
    file: 'src/arbiter.ts',
    original:
      "(evidence.ci_conclusion !== 'success' || evidence.ci_branch_matched !== true)\n  ) {\n    return fix(RULE_CI,",
    replacement: "(evidence.ci_conclusion !== 'success')\n  ) {\n    return fix(RULE_CI,",
  },
  {
    name: 'rule7-conclusion-half',
    file: 'src/arbiter.ts',
    original:
      "(evidence.ci_conclusion !== 'success' || evidence.ci_branch_matched !== true)\n  ) {\n    return fix(RULE_CI,",
    replacement: '(evidence.ci_branch_matched !== true)\n  ) {\n    return fix(RULE_CI,',
  },
  {
    name: 'rule8-keeps-failed-list',
    file: 'src/arbiter.ts',
    original: 'failedAcceptance: [...input.failedAcceptance],',
    replacement: 'failedAcceptance: [],',
  },
  {
    name: 'rule9-push-third',
    file: 'src/arbiter.ts',
    original: '(!evidence.remote_has_head ||',
    replacement: '(false ||',
  },
  {
    name: 'rule9-ci-third',
    file: 'src/arbiter.ts',
    original:
      "      evidence.ci_conclusion !== 'success' ||\n      evidence.ci_branch_matched !== true)\n  ) {\n    const parts",
    replacement:
      '      false ||\n      evidence.ci_branch_matched !== true)\n  ) {\n    const parts',
  },
  {
    name: 'rule9-branch-third',
    file: 'src/arbiter.ts',
    original:
      "      evidence.ci_conclusion !== 'success' ||\n      evidence.ci_branch_matched !== true)\n  ) {\n    const parts",
    replacement:
      "      evidence.ci_conclusion !== 'success' ||\n      false)\n  ) {\n    const parts",
  },
  {
    name: 'downgraded-flag',
    file: 'src/arbiter.ts',
    original: 'downgraded: original !== null && original !== final,',
    replacement: 'downgraded: false,',
  },

  // ── Gate (9) ─────────────────────────────────────────────────────────
  {
    name: 'gate-downgraded',
    file: 'src/gate.ts',
    original: "if (input.downgraded) reasons.push('downgraded');",
    replacement: '// deleted: downgraded check',
  },
  {
    name: 'gate-claim-mismatches',
    file: 'src/gate.ts',
    original: "if (input.claimMismatches > 0) reasons.push('claim_mismatches');",
    replacement: '// deleted: claim_mismatches check',
  },
  {
    name: 'gate-ci',
    file: 'src/gate.ts',
    original:
      "if (input.ciConclusion !== 'success' || input.ciBranchMatched !== true) reasons.push('ci');",
    replacement: '// deleted: ci check',
  },
  {
    name: 'gate-ci-branch-half',
    file: 'src/gate.ts',
    original: "input.ciConclusion !== 'success' || input.ciBranchMatched !== true",
    replacement: "input.ciConclusion !== 'success'",
  },
  {
    name: 'gate-ci-conclusion-half',
    file: 'src/gate.ts',
    original: "input.ciConclusion !== 'success' || input.ciBranchMatched !== true",
    replacement: 'input.ciBranchMatched !== true',
  },
  {
    name: 'gate-deps',
    file: 'src/gate.ts',
    original: "if (input.depsDiffCount > 0) reasons.push('deps_diff');",
    replacement: '// deleted: deps_diff check',
  },
  {
    name: 'gate-spec',
    file: 'src/gate.ts',
    original: "if (input.specDiffLines > 0) reasons.push('spec_diff');",
    replacement: '// deleted: spec_diff check',
  },
  {
    name: 'gate-gaps',
    file: 'src/gate.ts',
    original: "if (input.gapsCount > 0) reasons.push('gaps');",
    replacement: '// deleted: gaps check',
  },
  {
    name: 'gate-pass-always',
    file: 'src/gate.ts',
    original: 'return { pass: reasons.length === 0, reasons };',
    replacement: 'return { pass: true, reasons };',
  },

  // ── Protected paths (9) ──────────────────────────────────────────────
  {
    name: 'protected:SPEC.md',
    file: 'src/evidence.ts',
    original: "  'SPEC.md',\n",
    replacement: '',
  },
  {
    name: 'protected:CONSTRAINTS.md',
    file: 'src/evidence.ts',
    original: "  'CONSTRAINTS.md',\n",
    replacement: '',
  },
  {
    name: 'protected:ROADMAP.md',
    file: 'src/evidence.ts',
    original: "  'ROADMAP.md',\n",
    replacement: '',
  },
  {
    name: 'protected:ROLES.md',
    file: 'src/evidence.ts',
    original: "  'ROLES.md',\n",
    replacement: '',
  },
  {
    name: 'protected::(glob)AGENT-*.md',
    file: 'src/evidence.ts',
    original: "  ':(glob)AGENT-*.md',\n",
    replacement: '',
  },
  {
    name: 'protected:docs/backlog.md',
    file: 'src/evidence.ts',
    original: "  'docs/backlog.md',\n",
    replacement: '',
  },
  {
    name: 'protected:docs/decisions',
    file: 'src/evidence.ts',
    original: "  'docs/decisions',\n",
    replacement: '',
  },
  {
    name: 'protected:docs/progress.md',
    file: 'src/evidence.ts',
    original: "  'docs/progress.md',\n",
    replacement: '',
  },
  {
    name: 'protected:.collie/collie.toml',
    file: 'src/evidence.ts',
    original: "  '.collie/collie.toml',\n",
    replacement: '',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check that the original text appears exactly once; returns 'stale' if not. */
export function checkUnique(content: string, original: string): boolean {
  if (!content.includes(original)) return false;
  const first = content.indexOf(original);
  // eslint-disable-next-line @typescript-eslint/prefer-includes -- need start-offset overload
  return content.indexOf(original, first + 1) < 0;
}

/** Classify a child process outcome into a mutation result. */
export function judgeExecResult(
  error: { killed?: boolean; status?: number | null } | null,
): Result {
  if (error === null) return 'survived';
  if (error.killed === true) return 'timeout';
  return 'caught';
}

const TIMEOUT_MS = 60_000;

function runMutation(item: MutationItem, repoRoot: string): Result {
  const filePath = join(repoRoot, item.file);
  const content = readFileSync(filePath, 'utf8');

  // Staleness: original must appear exactly once.
  if (!checkUnique(content, item.original)) return 'stale';

  // Create a temporary copy of the repo in the system temp directory.
  const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const tmpDir = mkdtempSync(join(tmpdir(), `collie-mut-${safeName}-`));
  try {
    // Copy source, test, and scripts directories, plus configs needed to compile and run tests.
    const toCopy = [
      'src',
      'test',
      'scripts',
      'tsconfig.json',
      'tsconfig.build.json',
      'vitest.config.ts',
      'package.json',
    ];
    for (const entry of toCopy) {
      const src = join(repoRoot, entry);
      if (!existsSync(src)) continue;
      cpSync(src, join(tmpDir, entry), { recursive: true });
    }
    // Symlink node_modules from the workspace (SPEC 15.1: reuse).
    const nmSrc = join(repoRoot, 'node_modules');
    if (existsSync(nmSrc)) {
      symlinkSync(nmSrc, join(tmpDir, 'node_modules'));
    }

    // Apply the mutation.
    const mutated = content.replace(item.original, item.replacement);
    writeFileSync(join(tmpDir, item.file), mutated);

    // Check that the mutation compiles.
    try {
      execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
        cwd: tmpDir,
        timeout: TIMEOUT_MS,
        stdio: 'pipe',
      });
    } catch {
      return 'invalid';
    }

    // Run the relevant tests.
    const testFiles = testFilesFor(item.file);
    try {
      execFileSync('npx', ['vitest', 'run', '--reporter=verbose', ...testFiles], {
        cwd: tmpDir,
        timeout: TIMEOUT_MS,
        stdio: 'pipe',
      });
      // Tests all passed → mutation survived.
      return 'survived';
    } catch (err: unknown) {
      const error = err as { killed?: boolean; status?: number | null };
      if (error.killed === true) {
        // Timed out — retry once.
        try {
          execFileSync('npx', ['vitest', 'run', '--reporter=verbose', ...testFiles], {
            cwd: tmpDir,
            timeout: TIMEOUT_MS,
            stdio: 'pipe',
          });
          return 'survived';
        } catch (err2: unknown) {
          const error2 = err2 as { killed?: boolean };
          if (error2.killed === true) return 'timeout';
          return 'caught';
        }
      }
      // Non-zero exit = at least one assertion failed.
      return 'caught';
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Baseline check (SPEC 15.1): run all test files once unmodified; must pass.
// ---------------------------------------------------------------------------

function runBaseline(repoRoot: string): boolean {
  const allTestFiles = [...new Set(MUTATIONS.map((m) => testFilesFor(m.file)).flat())];
  try {
    execFileSync('npx', ['vitest', 'run', '--reporter=verbose', ...allTestFiles], {
      cwd: repoRoot,
      timeout: TIMEOUT_MS * 3,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CLI (only when run directly, not when imported by tests)
// ---------------------------------------------------------------------------

import { fileURLToPath } from 'node:url';
const thisFile = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(thisFile);

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    for (const m of MUTATIONS) {
      process.stdout.write(`${m.name}\n`);
    }
    process.exit(0);
  }

  const onlyArg = args.find((_, i, a) => a[i - 1] === '--only');
  const selected = onlyArg
    ? MUTATIONS.filter((m) => onlyArg.split(',').includes(m.name))
    : MUTATIONS;

  if (selected.length === 0) {
    process.stderr.write('No mutations matched --only filter\n');
    process.exit(1);
  }

  const repoRoot = join(import.meta.dirname, '..');

  // Baseline check.
  process.stderr.write('Running baseline tests…\n');
  if (!runBaseline(repoRoot)) {
    process.stderr.write('Baseline tests failed — cannot run mutation check\n');
    process.exit(1);
  }
  process.stderr.write('Baseline OK\n\n');

  let allCaught = true;
  for (const item of selected) {
    process.stderr.write(`  ${item.name} … `);
    const result = runMutation(item, repoRoot);
    process.stderr.write(`${result}\n`);
    if (result !== 'caught') {
      allCaught = false;
      process.stdout.write(`${item.name}: ${result}\n`);
    }
  }

  process.stderr.write(allCaught ? '\nAll mutations caught ✓\n' : '\nSome mutations survived ✗\n');
  process.exit(allCaught ? 0 : 1);
}
