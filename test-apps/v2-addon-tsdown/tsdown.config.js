import { Addon } from '@embroider/addon-dev/rollup';

import { babel } from '@rollup/plugin-babel';
import { scopedCSS } from 'ember-scoped-css/rollup';
import { defineConfig } from 'tsdown';
import { injectCssPlugin } from '@bosh-code/tsdown-plugin-inject-css';

const addon = new Addon({
  srcDir: 'src',
  destDir: 'dist',
});

export default defineConfig({
  entry: ['src/index.js', 'src/test.js'],
  sourcemap: true,
  clean: true,
  plugins: [
    scopedCSS(),
    addon.dependencies(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.js', '.ts', '.gjs', '.gts'],
    }),
    addon.gjs(),
    injectCssPlugin(),
  ],
});
