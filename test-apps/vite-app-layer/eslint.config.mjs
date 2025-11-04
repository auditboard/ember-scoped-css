import { ember } from 'ember-eslint';

const defaults = ember.recommended(import.meta.dirname);
export default [
  ...defaults,
  {
    ignores: ['dist', 'dist-prod'],
  },
];
