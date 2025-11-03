import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cwd } from 'node:process';

import { createUnplugin } from 'unplugin';

import { rewriteCss } from '../lib/css/rewrite.js';
import {
  decodeSeparateCSSFileRequest,
  decodeStyleElementCSSRequest,
  isSeparateCSSFileRequest,
  isStyleElementCSSRequest,
} from '../lib/request.js';

const ORIGIN = {
  File: 'separate-file',
  Style: 'style-element',
};

/**
 * The plugin that handles CSS requests for `<style>` elements and transforms
 * for existing files
 */
export default createUnplugin((options = {}) => {
  return {
    name: 'ember-scoped-css-unplugin',

    // vite: CSS files are resolved by vite. We use their resolver to also get
    // HMR. That is, for all non-physical CSS files, we extend vite by our
    // resolver and also can enrich metadata to it (for better debugging)
    resolveId(id, importer) {
      // handles: some-file.css?scoped=[postfix]
      // this is only run in rollup, vite handles it differently
      if (isSeparateCSSFileRequest(id)) {
        const parsed = decodeSeparateCSSFileRequest(id);

        // we change the id and drop the query string, this makes it so rollup
        // understands it at CSS and can load it appropriately
        return {
          id: path.resolve(
            path.dirname(importer),
            path.basename(parsed.fileName),
          ),
          meta: {
            'scoped-css': {
              postfix: parsed.postfix,
              origin: ORIGIN.File,
              fileName: parsed.fileName,
            },
          },
        };
      }

      if (isStyleElementCSSRequest(id)) {
        const parsed = decodeStyleElementCSSRequest(id);

        return {
          id: path.resolve(
            path.dirname(importer),
            `${path.basename(importer, path.extname(importer))}-${parsed.hash}.css`,
          ),
          meta: {
            'scoped-css': {
              css: parsed.css,
              postfix: parsed.postfix,
              origin: ORIGIN.Style,
              fileName: path.relative(cwd(), importer),
            },
          },
        };
      }
    },

    load(id) {
      // this is only for vite
      if (isSeparateCSSFileRequest(id)) {
        const parsed = decodeSeparateCSSFileRequest(id);

        return readFileSync(parsed.fileName, 'utf-8');
      }

      // this is for the `<style>` tag related loading
      const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

      if (meta) {
        return meta.css;
      }
    },

    transform(code, id) {
      // rollup: transform separate CSS file
      // vite: transform <style> CSS
      const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

      if (meta) {
        return rewriteCss(
          code,
          meta.postfix,
          `${meta.origin === ORIGIN.Style ? '<inline>/' : ''}${meta.fileName}`,
          options.layerName,
        );
      }

      // vite: transform separate CSS file
      if (isSeparateCSSFileRequest(id)) {
        const parsed = decodeSeparateCSSFileRequest(id);
        const filePath = meta.fileName ?? path.relative(cwd(), id);

        return rewriteCss(code, parsed.postfix, filePath, options.layerName);
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
