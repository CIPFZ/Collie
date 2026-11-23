import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 300_000, // SPEC 16.22: slow machines need ~160s for beforeEach hooks; no assertion depends on this value
  },
});
