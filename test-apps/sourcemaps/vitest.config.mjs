import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    // The rollup builds + babel toolchain are not the fastest; give them room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
