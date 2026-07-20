import { buildMacros } from '@embroider/macros/babel';
import { scopedCSS } from 'ember-scoped-css/babel';
import { fileURLToPath } from 'node:url';

const macros = buildMacros({});
const workspaceSource = fileURLToPath(new URL('../app', import.meta.url));
const sameWorkspaceSource = fileURLToPath(
  new URL('./src/additional', import.meta.url)
);
const scopedCssOptions = {
  additionalRoots: [workspaceSource, sameWorkspaceSource],
};

export default {
  plugins: [
    scopedCSS(scopedCssOptions),
    ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
    [
      'babel-plugin-ember-template-compilation',
      {
        transforms: [
          ...macros.templateMacros,
          scopedCSS.template(scopedCssOptions),
        ],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: fileURLToPath(
            import.meta.resolve('decorator-transforms/runtime-esm')
          ),
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
