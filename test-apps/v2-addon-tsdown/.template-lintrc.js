export default {
  extends: 'recommended',
  rules: {
    // we deliberately want to test this case
    'no-unnecessary-curly-parens': 'off',
    'no-forbidden-elements': ['meta', 'html', 'script'], // style removed
  },
};
