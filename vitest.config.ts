import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000, // SPEC 15.3: high-load machines hit 30s; no assertion depends on this value
  },
});
