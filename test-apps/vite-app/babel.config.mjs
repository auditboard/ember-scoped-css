import { buildMacros } from '@embroider/macros/babel';
import { scopedCSS } from 'ember-scoped-css/babel';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const macros = buildMacros({});

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
        transforms: [scopedCSS.template({})],
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
    ...macros.babelMacros,
  ],

  generatorOpts: {
    compact: false,
  },
};
