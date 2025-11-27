import { createUnplugin } from 'unplugin';

import { colocated } from './unplugin-colocated.js';
import { inline } from './unplugin-inline.js';
import { rolldown } from './unplugin-rolldown.js';

/**
 * The plugin that handles CSS requests for `<style>` elements and transforms
 * for existing files
 *
 * vite: CSS files are resolved by vite. We use their resolver to also get
 *       HMR. That is, for all non-physical CSS files, we extend vite by our
 *       resolver and also can enrich metadata to it (for better debugging)
 */
export const unplugin = createUnplugin((options = {}) => {
  return [colocated(options), inline(options), rolldown()];
});
