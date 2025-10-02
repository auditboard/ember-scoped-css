import * as scopedCSS from 'ember-scoped-css/build';

/**
 * This babel.config is only used for publishing.
 *
 * For local dev experience, see the babel.config
 */
export default {
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      {
        allExtensions: true,
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
      },
    ],
    [scopedCSS.babelPlugin, {}],

    [
      'babel-plugin-ember-template-compilation',
      {
        targetFormat: 'hbs',
        transforms: [scopedCSS.templatePlugin({})],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: 'decorator-transforms/runtime-esm',
        },
      },
    ],
  ],

  generatorOpts: {
    compact: false,
  },
};
