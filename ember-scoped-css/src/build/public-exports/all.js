import * as babel from '../babel-plugin.js';
import { unplugin } from '../scoped-css-unplugin.js';
import * as template from '../template-plugin.js';

export const scopedCSS = {
  vite: unplugin.vite,
  rollup: unplugin.rollup,
  babel: babel.scopedCSS,
  template: template.createPlugin,
};
