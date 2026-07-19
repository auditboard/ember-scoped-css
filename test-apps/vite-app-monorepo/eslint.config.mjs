import { ember } from 'ember-eslint';

const defaults = ember.recommended(process.cwd());

export default [
  ...defaults,
  {
    ignores: ['**/dist/**'],
  },
];
