import { createRequire } from 'node:module';
import { scopedCSS } from 'ember-scoped-css/babel';

import {
  babelCompatSupport,
  templateCompatSupport,
} from '@embroider/compat/babel';

const require = createRequire(import.meta.url);

export default {
  plugins: [
    ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
    [
      'babel-plugin-ember-template-compilation',
      {
        compilerPath: 'ember-source/dist/ember-template-compiler.js',
        enableLegacyModules: [
          'ember-cli-htmlbars',
          'ember-cli-htmlbars-inline-precompile',
          'htmlbars-inline-precompile',
        ],
        transforms: [...templateCompatSupport(), scopedCSS.template({})],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: require.resolve('decorator-transforms/runtime-esm'),
        },
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: import.meta.dirname,
        useESModules: true,
        regenerator: false,
      },
    ],
    ...babelCompatSupport(),
  ],

  generatorOpts: {
    compact: false,
  },
};
