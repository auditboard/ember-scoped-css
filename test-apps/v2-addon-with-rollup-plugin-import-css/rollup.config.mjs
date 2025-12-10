import { Addon } from '@embroider/addon-dev/rollup';
import { babel } from '@rollup/plugin-babel';
import { defineConfig } from 'rollup';
import css from 'rollup-plugin-import-css';

import { scopedCSS } from 'ember-scoped-css/rollup';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

export default defineConfig({
  output: addon.output(),
  plugins: [
    scopedCSS({ layerName: 'my-layer-name' }),
    addon.publicEntrypoints(['**/*.js']),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.gjs', '.gts'],
    }),
    addon.gjs(),
    addon.dependencies(),
    css({ output: 'styles.css', copyRelativeAssets: true }),
    addon.clean(),
  ],
});
