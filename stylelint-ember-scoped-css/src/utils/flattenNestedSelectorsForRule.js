// stylelint has no public API for resolving a rule's selectors against its
// ancestors, so we reach for the internal util. stylelint 17 renamed it from
// flattenNestedSelectorsForRule to resolveNestedSelectorsForRule; both take
// (rule, result) and return the same {selector, resolvedSelectors, nested}
// shape, so try the current name first and fall back to the old one.
const { default: flattenNestedSelectorsForRule } = await import(
  'stylelint/lib/utils/resolveNestedSelectorsForRule.mjs'
).catch(() => import('stylelint/lib/utils/flattenNestedSelectorsForRule.mjs'));

export default flattenNestedSelectorsForRule;
