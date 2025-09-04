import { getTestRule } from 'vitest-stylelint-utils';

global.testRule = getTestRule({ plugins: ['./'] });
