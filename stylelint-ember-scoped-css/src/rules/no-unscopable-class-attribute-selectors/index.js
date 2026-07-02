import stylelint from 'stylelint';
import flattenNestedSelectorsForRule from 'stylelint/lib/utils/flattenNestedSelectorsForRule.mjs';

import buildDisplaySelector from '../../utils/buildDisplaySelector.js';
import { AT_RULES_WITH_STYLE_RULES } from '../no-unscoped-selectors/index.js';

const ruleName = 'ember-scoped-css/no-unscopable-class-attribute-selectors';

const OPERATOR_REASONS = {
  '|=':
    'The `|=` operator does not survive class renaming, so the rule is ' +
    'scoped by the generated class only and may not match as written.',
  '$=':
    'The generated class is appended to the end of the `class` attribute, ' +
    'so a `$=` value can never match once the rule is scoped.',
};

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (selector, operator) =>
    `Class attribute selector "${selector}" cannot be reliably scoped. ` +
    `${OPERATOR_REASONS[operator]} Use a class ` +
    `selector (e.g. \`.foo\`) instead.`,
});

const meta = {
  url: 'https://github.com/auditboard/ember-scoped-css/tree/main/stylelint-ember-scoped-css/src/rules/no-unscopable-class-attribute-selectors',
};

function rule(primary) {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true, false],
    });

    if (!validOptions) {
      return;
    }

    root.walkRules((rule) => {
      // Skip rules inside of at-rules that are not known to contain style rules
      // (e.g. `100%` inside `@keyframes`).
      if (
        rule.parent?.type === 'atrule' &&
        !AT_RULES_WITH_STYLE_RULES.has(rule.parent.name)
      ) {
        return;
      }

      // Skip rules with no direct declarations but child rules (nesting parents).
      const hasDirectDecls = rule.nodes.some((node) => node.type === 'decl');
      const hasChildRules = rule.nodes.some((node) => node.type === 'rule');

      if (!hasDirectDecls && hasChildRules) {
        return;
      }

      const flattenedSelectors = flattenNestedSelectorsForRule(rule, result);

      // A nested rule resolves once per parent selector (`.a, .b { [x] {} }`
      // yields two entries carrying the same inner selector), but the
      // violation belongs to the inner rule itself — report each offending
      // selector once.
      const reported = new Set();

      for (const flattened of flattenedSelectors) {
        const unresolvedSelector = flattened.selector.toString().trim();

        if (reported.has(unresolvedSelector)) {
          continue;
        }

        flattened.resolvedSelectors.each((selectorNode) => {
          const operator = findUnscopableClassAttribute(selectorNode);

          if (!operator || reported.has(unresolvedSelector)) {
            return;
          }

          reported.add(unresolvedSelector);

          const displaySelector = buildDisplaySelector(
            rule,
            unresolvedSelector,
          );

          stylelint.utils.report({
            result,
            ruleName,
            message: messages.rejected(displaySelector, operator),
            node: rule,
          });
        });
      }
    });
  };
}

/**
 * Returns the offending operator (`|=` or `$=`) if the selector contains a
 * class attribute selector that cannot be reliably scoped, or null.
 */
function findUnscopableClassAttribute(selectorNode) {
  let found = null;

  selectorNode.walk((node) => {
    if (
      node.type === 'attribute' &&
      node.attribute === 'class' &&
      (node.operator === '|=' || node.operator === '$=') &&
      !isInsideGlobal(node)
    ) {
      found = node.operator;
    }
  });

  return found;
}

function isInsideGlobal(node) {
  let parent = node.parent;

  while (parent) {
    if (parent.type === 'pseudo' && parent.value === ':global') {
      return true;
    }

    parent = parent.parent;
  }

  return false;
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default rule;
