import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: [
      'src/build/index.js',
      'src/build/babel-plugin.js',
      'src/build/template-plugin.js',
    ],
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
