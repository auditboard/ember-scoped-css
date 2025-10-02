import { configs } from '@nullvoxpopuli/eslint-configs';

export default [
  ...configs.node(import.meta.dirname),
  {
    ignores: [
      'node_modules',
      'declarations',
      'dist',
      'template-registry.d.ts',
      'vitest.config.mts',
    ],
  },
  {
    files: ['./**/*.{js,ts}'],
    rules: {
      'prefer-const': 'off',
      // These lints don't support one or more of
      // - TS 5
      // - `node:` imports
      'import/namespace': 'off',
      'import/no-cycle': 'off',
      'import/named': 'off',
      'import/default': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',

      // This doesn't support modern ESM
      'n/no-missing-import': 'off',
    },
  },
  /**
   * The node base config doesn't currently support TS properly
   */
  {
    files: ['./src/runtime/test-support.ts'],
    rules: {
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
    },
  },
  {
    files: ['./test/**/*.js', '**/*.test.ts'],
    rules: {
      'n/no-unpublished-import': 'off',
      'node/no-unpublished-import': 'off',
    },
  },
];
