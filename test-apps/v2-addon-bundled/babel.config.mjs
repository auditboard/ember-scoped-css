/**
 * This babel.config is not used for publishing.
 * It's only for the local editing experience
 * (and linting)
 */
import { buildMacros } from '@embroider/macros/babel';
import * as scopedCSS from "ember-scoped-css/build";

import {
  babelCompatSupport,
  templateCompatSupport,
} from '@embroider/compat/babel';

const macros = buildMacros();

// For scenario testing
const isCompat = Boolean(process.env.ENABLE_COMPAT_BUILD);

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
    scopedCSS.babelPlugin({}),
    [
      'babel-plugin-ember-template-compilation',
      {
        transforms: [
          ...(isCompat ? templateCompatSupport() : macros.templateMacros),
          scopedCSS.templatePlugin({}),
        ],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: import.meta.resolve('decorator-transforms/runtime-esm'),
        },
      },
    ],
    ...(isCompat ? babelCompatSupport() : macros.babelMacros),
  ],

  generatorOpts: {
    compact: false,
  },
};
