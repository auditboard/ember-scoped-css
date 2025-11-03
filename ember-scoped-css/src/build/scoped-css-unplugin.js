import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cwd } from 'node:process';

import { createUnplugin } from 'unplugin';

import { rewriteCss } from '../lib/css/rewrite.js';
import { request } from '../lib/request.js';

/**
 * The plugin that handles CSS requests for `<style>` elements and transforms
 * for existing files
 *
 * vite: CSS files are resolved by vite. We use their resolver to also get
 *       HMR. That is, for all non-physical CSS files, we extend vite by our
 *       resolver and also can enrich metadata to it (for better debugging)
 */
export default createUnplugin((options = {}) => {
  const CWD = process.cwd();

  return [
    /**
     * Plugin for supporting colocated styles
     *
     * e.g.:
     *  src/components/my-component.js
     *  src/components/my-component.css
     */
    (() => {
      /**
       *
       * @param {string} id the request id / what was improted
       * @param {string} filePath  path on disk
       * @returns
       */
      function buildResponse(id, filePath) {
        const parsed = request.colocated.decode(id);
        const relativeFilePath = path.relative(CWD, filePath);

        let code = readFileSync(filePath, 'utf-8');
        let css = rewriteCss(
          code,
          parsed.postfix,
          relativeFilePath,
          options.layerName,
        );

        return {
          id: filePath,
          meta: {
            'scoped-css:colocated': {
              postfix: parsed.postfix,
              fileName: relativeFilePath,
              css,
            },
          },
        };
      }

      return {
        name: 'ember-scoped-css:colocated',
        resolveId(id, importer) {
          // handles: some-file.css?scoped=[postfix]
          // this is only run in rollup, vite handles it differently
          if (request.is.colocated(id)) {
            const parsed = request.colocated.decode(id);

            const filePath = path.resolve(
              path.dirname(importer),
              path.basename(parsed.fileName),
            );

            return buildResponse(id, filePath);
          }
        },
        transform(code, id) {
          const meta = this.getModuleInfo(id)?.meta?.['scoped-css:colocated'];

          if (meta) {
            return meta.css;
          }
        },
        vite: {
          /**
           *
           * @param {string} id location on disk
           * @returns
           */
          load(id) {
            if (request.is.colocated(id)) {
              let filePath = id.split('?')[0];
              let response = buildResponse(id, filePath);

              return response.meta['scoped-css:colocated'].css;
            }
          },
        },
      };
    })(),

    /**
     * Plugin for supporting the styles from
     *
     * <template>
     *   <style>...</style>
     * </template>
     */
    {
      name: 'ember-scoped-css:inline',
      resolveId(id, importer) {
        if (request.is.inline(id)) {
          const parsed = request.inline.decode(id);

          return {
            id: path.resolve(
              path.dirname(importer),
              `${path.basename(importer, path.extname(importer))}-${parsed.id}.css`,
            ),
            meta: {
              'scoped-css:inline': {
                css: parsed.css,
                postfix: parsed.postfix,
                fileName: path.relative(cwd(), importer),
              },
            },
          };
        }
      },
      load(id) {
        const meta = this.getModuleInfo(id)?.meta?.['scoped-css:inline'];

        if (meta) {
          return meta.css;
        }
      },
      transform(code, id) {
        const meta = this.getModuleInfo(id)?.meta?.['scoped-css:inline'];

        if (meta) {
          return rewriteCss(
            code,
            meta.postfix,
            `<inline>/${meta.fileName}`,
            options.layerName,
          );
        }
      },
    },
  ];
});
