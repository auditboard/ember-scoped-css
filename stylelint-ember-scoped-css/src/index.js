import stylelint from 'stylelint';

import noUnscopableClassAttributeSelector from './rules/no-unscopable-class-attribute-selector/index.js';
import noUnscopedSelectors from './rules/no-unscoped-selectors/index.js';

const rulesPlugins = [
  stylelint.createPlugin(noUnscopedSelectors.ruleName, noUnscopedSelectors),
  stylelint.createPlugin(
    noUnscopableClassAttributeSelector.ruleName,
    noUnscopableClassAttributeSelector,
  ),
];

export default rulesPlugins;
