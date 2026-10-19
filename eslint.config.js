// ESLint flat config. Rules that enforce project constraints:
// - CONSTRAINTS 铁律 12: strict TS, no `any` (no-explicit-any + no-unsafe-*)
// - CONSTRAINTS 铁律 11 / ADR-002 §4: no bare threshold literals in src/
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

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
