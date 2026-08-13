import emberTemplateCompilation from 'babel-plugin-ember-template-compilation';
import decoratorTransforms from 'decorator-transforms';

import { scopedCSS } from 'ember-scoped-css/babel';

const scopedCSSOptions = {};

/**
 * This babel.config is only used for the tsdown (publish) build; the ember()
 * plugin in tsdown.config.mjs points at it explicitly.
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
    scopedCSS(scopedCSSOptions),
    [
      // referenced by import rather than name: v4 is ESM-only, which babel's
      // string-name plugin resolution cannot load
      emberTemplateCompilation,
      {
        targetFormat: 'hbs',
        transforms: [scopedCSS.template(scopedCSSOptions)],
      },
    ],
    [
      // referenced by import rather than name: ESM-only, which babel's
      // string-name plugin resolution cannot load
      decoratorTransforms,
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
