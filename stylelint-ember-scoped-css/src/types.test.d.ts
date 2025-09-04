import { type TestRule } from 'vitest-stylelint-utils';

declare global {
  // eslint-disable-next-line no-var
  var testRule: TestRule;
}

export {};
