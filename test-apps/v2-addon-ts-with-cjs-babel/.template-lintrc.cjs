'use strict';

module.exports = {
  extends: 'recommended',
  overrides: [
    {
      files: ['**/*'],
      rules: {
        'no-forbidden-elements': false,
      },
    },
  ],
};
