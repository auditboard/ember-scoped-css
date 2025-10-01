import { configs } from '@nullvoxpopuli/eslint-configs';

export default [
  ...configs.ember(import.meta.dirname),
  {
    ignores: ['dist', 'dist-prod', 'fixtures', 'node_modules'],
  },
  {
    files: ['**/*.gjs', '**/*.gts'],
    rules: {
      // not relevant for what we're testing
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['rollup.config.mjs'],
    rules: {
      // does not support package.json#exports
      'import/named': 'off',
    },
  },
];
