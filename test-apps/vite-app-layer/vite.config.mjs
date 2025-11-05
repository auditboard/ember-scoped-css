import { defineConfig } from 'vite';
import { extensions, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { scopedCSS } from 'ember-scoped-css/vite';

export default defineConfig({
  resolve: {
    extensions,
  },
  plugins: [
    scopedCSS({ layerName: 'project-name' }),
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
