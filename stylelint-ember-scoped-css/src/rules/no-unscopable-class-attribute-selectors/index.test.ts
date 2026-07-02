import { getTestRule } from 'vitest-stylelint-utils';

import rule from './index.js';

const testRule = getTestRule({ plugins: ['./'] });

testRule({
  ruleName: rule.ruleName,
  config: [true],
  accept: [
    { code: '.class {}' },
    { code: '[class~="foo"] {}' },
    { code: '[class="foo"] {}' },
    { code: '[class^="foo"] {}' },
    { code: '[class*="foo"] {}' },
    { code: '[data-state|="open"] {}' },
    { code: '[lang|="en"] {}' },

    // Explicitly global is never scoped, so there is nothing to warn about.
    { code: ':global([class|="foo"]) {}' },
    { code: ':global([class$="foo"]) {}' },

    // At rules without style rules.
    { code: '@keyframes spin { 0% {} 100% {} }' },
  ],
  reject: [
    {
      code: '[class|="foo"] {}',
      message: rule.messages.rejected('[class|="foo"]', '|='),
    },
    {
      code: '[class$="foo"] {}',
      message: rule.messages.rejected('[class$="foo"]', '$='),
    },
    {
      code: '.parent [class|="foo"] {}',
      message: rule.messages.rejected('.parent [class|="foo"]', '|='),
    },
    {
      code: ':is([class|="foo"]) {}',
      message: rule.messages.rejected(':is([class|="foo"])', '|='),
    },

    // At rules
    {
      code: '@media (min-width: 768px) { [class|="foo"] {} }',
      message: rule.messages.rejected(
        '@media (min-width: 768px) { [class|="foo"] }',
        '|=',
      ),
    },

    // Nesting
    {
      code: '.parent { [class|="foo"] {} }',
      message: rule.messages.rejected('.parent { [class|="foo"] }', '|='),
    },

    // A multi-selector parent resolves the inner rule once per parent, but
    // the violation belongs to the inner rule — exactly one warning.
    {
      code: '.a, .b { [class|="foo"] {} }',
      message: rule.messages.rejected('.a, .b { [class|="foo"] }', '|='),
    },
  ],
});
