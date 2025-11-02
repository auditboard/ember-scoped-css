import path from 'node:path';
import { cwd } from 'node:process';

import { createUnplugin } from 'unplugin';

import { rewriteCss } from '../lib/css/rewrite.js';
import { decodeScopedCSSRequest, isScopedCSSRequest } from '../lib/request.js';

/**
 * The plugin that handles CSS requests for `<style>` elements and transforms
 * for existing files
 */
export default createUnplugin((options = {}) => {
  return {
    name: 'ember-scoped-css-unplugin',

    resolveId(id, importer) {
      if (isScopedCSSRequest(id)) {
        const parsed = decodeScopedCSSRequest(id);

        return {
          id: path.resolve(
            path.dirname(importer),
            `${path.basename(importer, path.extname(importer))}-${parsed.hash}.css`,
          ),
          meta: {
            'scoped-css': {
              css: parsed.css,
            },
          },
        };
      }
    },

    load(id) {
      const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

      if (meta) {
        return meta.css;
      }
    },

    transform(code, id) {
      if (id.includes('.css?scoped=')) {
        const [_, qs] = id.split('?');
        const search = new URLSearchParams(qs);

        const filePath = path.relative(id, cwd());

        return rewriteCss(
          code,
          search.get('scoped'),
          filePath,
          options.layerName,
        );
      }
    },

    // this below is actually the format for transforms, so rust based runtimes
    // operate more performant - but that didn't work by the time I wrote this
    // come back later and test again
    // transform: {
    //   filter: {
    //     id: /\.css\?scoped=([a-zA-Z0-9]+)$/
    //   },
    //   handler(code, id) {
    //     const [_, qs] = id.split('?');
    //     const search = new URLSearchParams(qs);

    //     const filePath = path.relative(id, cwd());

    //     return rewriteCss(code, search.get('scoped'), filePath, options.layerName);
    //   }
    // },
  };
});
