import { configs } from '@nullvoxpopuli/eslint-configs';

export default [
  ...configs.ember(import.meta.dirname),
  {
    files: ['**/*.gts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
