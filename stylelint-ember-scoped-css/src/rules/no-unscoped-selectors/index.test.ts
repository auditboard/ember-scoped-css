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
    {
      code: '[attr] {}',
      message: rule.messages.rejected('[attr]'),
    },
    {
      code: '[attr] [attr2] {}',
      message: rule.messages.rejected('[attr] [attr2]'),
    },
    {
      code: ':has([attr]) {}',
      message: rule.messages.rejected(':has([attr])'),
    },
    {
      code: ':has(.class, [attr]) {}',
      message: rule.messages.rejected(':has(.class, [attr])'),
    },
    {
      code: ':is([attr]) {}',
      message: rule.messages.rejected(':is([attr])'),
    },
    {
      code: ':is(.class, [attr]) {}',
      message: rule.messages.rejected(':is(.class, [attr])'),
    },
    {
      code: ':is(:global([data-test]), [attr]) {}',
      message: rule.messages.rejected(':is(:global([data-test]), [attr])'),
    },

    {
      code: ':where([attr]) {}',
      message: rule.messages.rejected(':where([attr])'),
    },
    {
      code: ':where(.class, [attr]) {}',
      message: rule.messages.rejected(':where(.class, [attr])'),
    },
    {
      code: ':not(.class) {}',
      message: rule.messages.rejected(':not(.class)'),
    },

    // At rules
    {
      code: '@media (min-width: 768px) { [attr] {} }',
      message: rule.messages.rejected('@media (min-width: 768px) { [attr] }'),
    },
    {
      code: '@container (min-width: 300px) { [attr] {} }',
      message: rule.messages.rejected(
        '@container (min-width: 300px) { [attr] }',
      ),
    },

    // Nesting
    {
      code: '[attr] { [attr2] {} }',
      warnings: [
        {
          message: rule.messages.rejected('[attr] { [attr2] }'),
        },
      ],
    },
    {
      code: '.parent { :not(&) {} }',
      message: rule.messages.rejected('.parent { :not(&) }'),
    },

    // Multiple selectors
    {
      code: `.class, [attr], :not(.class) {}`,
      warnings: [
        {
          message: rule.messages.rejected('[attr]'),
        },
        {
          message: rule.messages.rejected(':not(.class)'),
        },
      ],
    },
  ],
});
