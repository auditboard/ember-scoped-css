import { configs } from '@nullvoxpopuli/eslint-configs';

export default [
  ...configs.ember(import.meta.dirname),
  {
    files: ['**/*.gjs', '**/*.gts'],
    rules: {
      // scoped-class isn't defined, yet we allow it for build time.
      // scopedClass is importable, and removed at build time as well.
      'no-undef': 'off',
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
