import { scopedCSS } from 'ember-scoped-css/babel';

// Mirrors test-apps/v2-addon/babel.config.mjs so these tests exercise the real
// babel pipeline a consuming addon uses.
export default {
  presets: [['@babel/preset-typescript']],
  plugins: [
    ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
    scopedCSS(),
    [
      'babel-plugin-ember-template-compilation',
      {
        targetFormat: 'hbs',
        transforms: [scopedCSS.template({})],
      },
    ],
    '@embroider/addon-dev/template-colocation-plugin',
    [
      'module:decorator-transforms',
      { runtime: { import: 'decorator-transforms/runtime' } },
    ],
  ],
};
