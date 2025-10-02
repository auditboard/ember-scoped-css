import * as scopedCSS from 'ember-scoped-css/build';

export default {
  presets: [['@babel/preset-typescript']],
  plugins: [
    ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
    scopedCSS.babelPlugin,
    [
      'babel-plugin-ember-template-compilation',
      {
        targetFormat: 'hbs',
        transforms: [scopedCSS.templatePlugin({})],
      },
    ],
    '@embroider/addon-dev/template-colocation-plugin',
    [
      'module:decorator-transforms',
      { runtime: { import: 'decorator-transforms/runtime' } },
    ],
  ],
};
