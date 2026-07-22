import { babel } from '@rollup/plugin-babel';
import { ember, extensions } from '@embroider/vite';
import { scopedCSS } from 'ember-scoped-css/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['@glimmer/component', 'ember-source'],
    extensions,
  },
  plugins: [
    scopedCSS(),
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
