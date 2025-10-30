'use strict';

module.exports = {
  extends: 'recommended',
  checkHbsTemplateLiterals: false,
  overrides: [
    {
      files: ['**/*'],
      rules: {
        'no-forbidden-elements': false,
      },
    },
  ],
};
