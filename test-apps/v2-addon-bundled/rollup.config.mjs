import { babel } from '@rollup/plugin-babel';
import { Addon } from '@embroider/addon-dev/rollup';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

import { scopedCssUnplugin } from 'ember-scoped-css/build';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const babelConfig = resolve(rootDirectory, './babel.publish.config.cjs');

export default {
  // This provides defaults that work well alongside `publicEntrypoints` below.
  // You can augment this if you need to.
  output: addon.output(),

  plugins: [
    addon.publicEntrypoints(['index.js']),
    addon.dependencies(),
    babel({
      extensions: ['.js', '.gjs', '.ts', '.gts'],
      babelHelpers: 'bundled',
      configFile: babelConfig,
    }),
    addon.gjs(),
    (() => {
      let virtualId = 'virtual:from-virtual';
      let privateId = '\0' + virtualId;

      return {
        name: 'example-virtual',
        resolveId(id) {
          console.log(id);
          if (id === virtualId) {
            return privateId;
          }
        },
        load(id) {
          if (id === privateId) {
            return `export * from '${process.cwd()}/src/from-virtual/example.gts';`;
          }
        },
      };
    })(),
    scopedCssUnplugin.rollup(),

    addon.clean(),
  ],
};
