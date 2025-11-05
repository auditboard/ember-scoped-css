import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/build/public-exports/*.js'],
    outDir: 'dist/cjs',
    format: 'cjs',
    sourcemap: 'inline',
    dts: false,

    define: {
      'import.meta.vitest': 'false',
    },
  },
  {
    entry: ['src/runtime/test-support.ts', 'src/runtime/index.ts'],
    outDir: 'dist/runtime',
    sourcemap: true,
  },
]);
