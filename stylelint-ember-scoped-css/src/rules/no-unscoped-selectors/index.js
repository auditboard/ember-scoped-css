import stylelint from 'stylelint';
import flattenNestedSelectorsForRule from 'stylelint/lib/utils/flattenNestedSelectorsForRule.mjs';

import buildDisplaySelector from '../../utils/buildDisplaySelector.js';

export const AT_RULES_WITH_STYLE_RULES = new Set([
  'container',
  'layer',
  'media',
  'scope',
  'supports',
]);

const ruleName = 'ember-scoped-css/no-unscoped-selectors';

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (selector) => `Unscoped selector "${selector}" found in scoped CSS`,
});

const meta = {
  url: 'https://github.com/auditboard/ember-scoped-css/tree/main/stylelint-ember-scoped-css/src/rules/no-unscoped-selectors',
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
      // Skip rules inside of at-rules that are not known to contain style rules.
      // This skips rules like `100%` inside of `@keyframes`.
      if (
        rule.parent?.type === 'atrule' &&
        !AT_RULES_WITH_STYLE_RULES.has(rule.parent.name)
      ) {
        return;
      }

      // Skip rules (no direct declarations but has child rules)
      const hasDirectDecls = rule.nodes.some((node) => node.type === 'decl');
      const hasChildRules = rule.nodes.some((node) => node.type === 'rule');

      if (!hasDirectDecls && hasChildRules) {
        return;
      }

      // To simplify the algorithm, we use a util function to flatten nested selectors
      // with all ancestor rules.
      const flattenedSelectors = flattenNestedSelectorsForRule(rule, result);

      for (const flattened of flattenedSelectors) {
        flattened.resolvedSelectors.each((selectorNode) => {
          if (isScopedSelector(selectorNode)) {
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

function isScopedSelector(selectorNode) {
  if (selectorNode.type !== 'selector') {
    throw new Error('Expected a selector node');
  }

  return selectorNode.nodes.some((node) => {
    if (node.type === 'class' || node.type === 'tag') {
      return true;
    } else if (node.type === 'pseudo') {
      return isScopedFunctionalPseudo(node);
    } else {
      return false;
    }
  });
}

function isScopedFunctionalPseudo(pseudoNode) {
  const name = pseudoNode.value;

  if (name === ':global' || name === ':root') {
    return true;
  }

  if (name === ':has' || name === ':is' || name === ':where') {
    return pseudoNode.nodes.every(isScopedSelector);
  }

  return false;
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default rule;
