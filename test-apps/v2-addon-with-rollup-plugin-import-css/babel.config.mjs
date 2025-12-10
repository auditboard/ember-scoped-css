import { scopedCSS } from 'ember-scoped-css/babel';

export default {
  presets: [['@babel/preset-typescript']],
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      { onlyRemoveTypeImports: true, allowDeclareFields: true },
    ],
    scopedCSS({ layerName: 'my-layer-name' }),
    [
      'module:babel-plugin-ember-template-compilation',
      {
        targetFormat: 'hbs',
        transforms: [scopedCSS.template({ layerName: 'my-layer-name' })],
      },
    ],
    [
      'module:decorator-transforms',
      { runtime: { import: 'decorator-transforms/runtime' } },
    ],
  ],
};
