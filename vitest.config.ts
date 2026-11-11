import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000, // SPEC 13.11: beforeAll that runs a full round can exceed the 10s default
  },
});
