import stylelint from 'stylelint';

import noUnscopableClassAttributeSelectors from './rules/no-unscopable-class-attribute-selectors/index.js';
import noUnscopedSelectors from './rules/no-unscoped-selectors/index.js';

const rulesPlugins = [
  stylelint.createPlugin(noUnscopedSelectors.ruleName, noUnscopedSelectors),
  stylelint.createPlugin(
    noUnscopableClassAttributeSelectors.ruleName,
    noUnscopableClassAttributeSelectors,
  ),
];

export default rulesPlugins;
