import path from 'node:path';

import { createUnplugin } from 'unplugin';

import { decodeScopedCSSRequest, isScopedCSSRequest } from '../lib/request.js';
/**
 * The plugin that handles CSS requests from other transform (e.g.: babel)
 *
 * This plugin takes no options because the CSS transform has already happened by the time
 * we handle it here.
 */
export default createUnplugin(() => {
  return {
    name: 'ember-scoped-css-unplugin',

    resolveId(id, importer) {
      if (isScopedCSSRequest(id)) {
        let parsed = decodeScopedCSSRequest(id);

        return {
          id: path.resolve(path.dirname(importer), parsed.postfix + '.css'),
          meta: {
            'scoped-css': {
              css: parsed.css,
            },
          },
        };
      }
    },

    load(id) {
      let meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

      if (meta) {
        return meta.css;
      }
    },
  };
});
