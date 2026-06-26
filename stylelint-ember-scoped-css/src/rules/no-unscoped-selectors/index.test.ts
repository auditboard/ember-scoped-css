import { getTestRule } from 'vitest-stylelint-utils';

import rule from './index.js';

const testRule = getTestRule({ plugins: ['./'] });

testRule({
  ruleName: rule.ruleName,
  config: [true],
  accept: [
    { code: '.class {}' },
    { code: '.class [attr] {}' },
    { code: 'tag {}' },
    { code: 'tag [attr] {}' },
    { code: '[attr] .class {}' },
    { code: '[attr] tag {}' },
    { code: ':has(.class) {}' },
    { code: ':has(.class, tag) {}' },
    { code: ':has(tag) {}' },
    { code: ':is(.class) {}' },
    { code: ':is(.class, tag) {}' },
    { code: ':is(tag) {}' },
    { code: ':where(.class) {}' },
    { code: ':where(.class, tag) {}' },
    { code: ':where(tag) {}' },

    // Attribute selectors are scoped (marker class, or renamed value for class)
    { code: '[attr] {}' },
    { code: '[attr] [attr2] {}' },
    { code: 'tag[attr] {}' },
    { code: '[data-state="open"][role="dialog"] {}' },
    { code: '[class~="foo"] {}' },
    { code: ':has([attr]) {}' },
    { code: ':has(.class, [attr]) {}' },
    { code: ':is([attr]) {}' },
    { code: ':is(.class, [attr]) {}' },
    { code: ':is(:global([data-test]), [attr]) {}' },
    { code: ':where([attr]) {}' },
    { code: ':where(.class, [attr]) {}' },

    // Global
    { code: ':global(.class) {}' },
    { code: ':global(tag) {}' },
    { code: ':global([attr]) {}' },
    { code: '.foo :global([bar]) {}' },
    { code: ':global(.x) [attr] {}' },
    { code: '[attr] :global(.y) {}' },
    { code: ':root {}' },
    { code: ':root[attr] {}' },

    // At rules
    { code: '@keyframes spin { 0% {} 100% {} }' },
    { code: '@page :first {}' },
    { code: '@media (min-width: 768px) { .class {} }' },
    { code: '@media (min-width: 768px) { tag {} }' },
    { code: '@container (min-width: 300px) { .class {} }' },
    { code: '@container (min-width: 300px) { tag {} }' },

    // Nesting
    { code: '.parent { [attr] {} }' },
    { code: '[attr] { .parent {} }' },
  ],
  reject: [
    // `:not(...)` is not treated as scoped, so a selector consisting only of a
    // negation is still unscoped. This also surfaces the standalone-negation
    // limitation to users (see docs/css-isolation.md).
    {
      code: ':not(.class) {}',
      message: rule.messages.rejected(':not(.class)'),
    },
    {
      code: ':not([attr]) {}',
      message: rule.messages.rejected(':not([attr])'),
    },
    {
      code: '.parent { :not(&) {} }',
      message: rule.messages.rejected('.parent { :not(&) }'),
    },

    // Multiple selectors: the attribute compound is now scoped, only the
    // standalone negation remains unscoped.
    {
      code: `.class, [attr], :not(.class) {}`,
      warnings: [
        {
          message: rule.messages.rejected(':not(.class)'),
        },
      ],
    },
  ],
});
