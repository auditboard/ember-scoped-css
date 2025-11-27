import { scopedCSS } from 'ember-scoped-css/babel';

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
