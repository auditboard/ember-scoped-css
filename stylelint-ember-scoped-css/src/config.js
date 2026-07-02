import plugins from './index.js';

export default {
  plugins,
  rules: {
    'ember-scoped-css/no-unscoped-selectors': true,
    'ember-scoped-css/no-unscopable-class-attribute-selectors': true,
  },
};
