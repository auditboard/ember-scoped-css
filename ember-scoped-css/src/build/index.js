export { default as babelPlugin } from './babel-plugin.js';
export { default as scopedCssUnplugin } from './scoped-css-unplugin.js';
export { createPlugin as templatePlugin } from './template-plugin.js';

import { default as scopedCssUnplugin } from './scoped-css-unplugin.js';

export const rollupPlugin = scopedCssUnplugin.rollup;
