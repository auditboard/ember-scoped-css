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
 *
 * vite: CSS files are resolved by vite. We use their resolver to also get
 *       HMR. That is, for all non-physical CSS files, we extend vite by our
 *       resolver and also can enrich metadata to it (for better debugging)
 */
export default createUnplugin((options = {}) => {
  return [
    {
      name: 'ember-scoped-css:colocated',
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
      },
      load(id) {
        // this is only for vite
        if (isSeparateCSSFileRequest(id)) {
          const parsed = decodeSeparateCSSFileRequest(id);

          return readFileSync(parsed.fileName, 'utf-8');
        }
      },
      transform(code, id) {
        if (isSeparateCSSFileRequest(id)) {
          const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];
          const parsed = decodeSeparateCSSFileRequest(id);
          const filePath = meta?.fileName ?? path.relative(cwd(), id);

          return rewriteCss(code, parsed.postfix, filePath, options.layerName);
        }
      },
    },
    {
      name: 'ember-scoped-css:inline',
      resolveId(id, importer) {
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
        const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

        if (meta) {
          return meta.css;
        }
      },
      transform(code, id) {
        const meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

        if (meta) {
          return rewriteCss(
            code,
            meta.postfix,
            `${meta.origin === ORIGIN.Style ? '<inline>/' : ''}${meta.fileName}`,
            options.layerName,
          );
        }
      },
    },
  ];
});
