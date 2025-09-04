import stylelint from 'stylelint';

import noUnscopedSelectors from './rules/no-unscoped-selectors/index.js';

const rulesPlugins = [
  stylelint.createPlugin(noUnscopedSelectors.ruleName, noUnscopedSelectors),
];

export default rulesPlugins;
