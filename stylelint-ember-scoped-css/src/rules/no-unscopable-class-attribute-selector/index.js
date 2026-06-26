import stylelint from 'stylelint';
import flattenNestedSelectorsForRule from 'stylelint/lib/utils/flattenNestedSelectorsForRule.mjs';

import buildDisplaySelector from '../../utils/buildDisplaySelector.js';
import { AT_RULES_WITH_STYLE_RULES } from '../no-unscoped-selectors/index.js';

const ruleName = 'ember-scoped-css/no-unscopable-class-attribute-selector';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (selector) =>
    `Class attribute selector "${selector}" cannot be reliably scoped. ` +
    `The \`|=\` operator does not survive class renaming, so the rule is ` +
    `scoped by a marker class only and may not match as written. Use a class ` +
    `selector (e.g. \`.foo\`) instead.`,
});

const meta = {
  url: 'https://github.com/auditboard/ember-scoped-css/tree/main/stylelint-ember-scoped-css/src/rules/no-unscopable-class-attribute-selector',
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

      for (const flattened of flattenedSelectors) {
        flattened.resolvedSelectors.each((selectorNode) => {
          if (!hasUnscopableClassAttribute(selectorNode)) {
            return;
          }

          const displaySelector = buildDisplaySelector(
            rule,
            flattened.selector.toString().trim(),
          );

          stylelint.utils.report({
            result,
            ruleName,
            message: messages.rejected(displaySelector),
            node: rule,
          });
        });
      }
    });
  };
}

function hasUnscopableClassAttribute(selectorNode) {
  let found = false;

  selectorNode.walk((node) => {
    if (
      node.type === 'attribute' &&
      node.attribute === 'class' &&
      node.operator === '|=' &&
      !isInsideGlobal(node)
    ) {
      found = true;
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
