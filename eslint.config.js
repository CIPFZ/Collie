// ESLint flat config. Rules that enforce project constraints:
// - CONSTRAINTS 铁律 12: strict TS, no `any` (no-explicit-any + no-unsafe-*)
// - CONSTRAINTS 铁律 11 / ADR-002 §4: no bare threshold literals in src/
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const SDK_IMPORTS = {
  group: ['@anthropic-ai/*', '@anthropic-ai/**'],
  message: 'Agent SDKs may only be imported inside src/runner/ (CONSTRAINTS 铁律 15).',
};
const WORKER_ROLE_IMPORTS = {
  regex: '(^|/)worker(\\.js)?$',
  message:
    'The reviewer must never reach the worker role or its report reader (SPEC 4.2, CONSTRAINTS 铁律 6).',
};
const FAKE_RUNNER_IMPORTS = {
  regex: '(^|/)(runner/)?fake(\\.js)?$',
  message:
    'Roles must depend on runner/index.ts only, never the fake runner (CONSTRAINTS 铁律 15).',
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.collie/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // ADR-002 §4: thresholds live in .collie/collie.toml. Structural constants
      // in src/schema/ are exempted locally with an eslint-disable justification.
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: [0, 1, -1], ignoreEnums: true, detectObjects: true },
      ],
      // no-magic-numbers never reports `const x = 90` (a named declaration is
      // its notion of compliance), so it alone cannot keep thresholds out of
      // code. Ban every numeric literal other than 0 and 1 outright.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[raw=/^[0-9.]/]:not([raw='0']):not([raw='1'])",
          message:
            'Numeric literal in src/: thresholds belong in .collie/collie.toml (CONSTRAINTS 铁律 11).',
        },
      ],
    },
  },
  {
    // CONSTRAINTS 铁律 15 / SPEC 4.1: agent SDKs are reachable only through src/runner/.
    files: ['src/**/*.ts'],
    ignores: ['src/runner/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [SDK_IMPORTS] }],
    },
  },
  {
    // Roles depend on the runner interface only: no SDK, no fake runner.
    // This block overrides the one above for src/roles/, so it repeats SDK_IMPORTS.
    files: ['src/roles/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [SDK_IMPORTS, FAKE_RUNNER_IMPORTS] }],
    },
  },
  {
    // Overrides the src/roles/ block for the reviewer, so it repeats both patterns.
    files: ['src/roles/reviewer.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [SDK_IMPORTS, FAKE_RUNNER_IMPORTS, WORKER_ROLE_IMPORTS] },
      ],
    },
  },
  {
    // Tests assert SPEC default values verbatim, so they are not under
    // the no-magic-numbers rule (SPEC 2.3).
    files: ['test/**/*.ts', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  prettier,
);
