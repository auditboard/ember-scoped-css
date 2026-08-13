import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    // the build runs once in beforeAll and tsdown takes a few seconds
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
