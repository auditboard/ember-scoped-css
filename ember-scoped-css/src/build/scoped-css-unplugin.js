import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createUnplugin } from 'unplugin';

import { rewriteCss } from '../lib/css/rewrite.js';
import { request } from '../lib/request.js';

const META = {
  inline: 'scoped-css:inline',
  colocated: 'scoped-css:colocated',
}

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
       * @param {string} id the request id / what was imported
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
            [META.colocated]: {
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
        load(code, id) {
          const meta = this.getModuleInfo(id)?.meta?.[META.colocated];

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

              return response.meta[META.colocated].css;
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
    (() => {
      /**
       * @param {string} id the request id / what was imported
       */
      function buildResponse(id, filePath) {
        const parsed = request.inline.decode(id);

        const relativeFilePath = path.relative(CWD, filePath);

        const css = rewriteCss(
          parsed.css,
          parsed.postfix,
          `<inline>/${relativeFilePath}`,
          options.layerName,
        );

        const nextId = filePath.split('?')[0];

        return {
          id: nextId,
          meta: {
            [META.inline]: {
              css,
              postfix: parsed.postfix,
              fileName: relativeFilePath,
            },
          },
        };
      }

      return {
        name: 'ember-scoped-css:inline',
        resolveId(id, importer) {
          if (request.is.inline(id)) {
            const parsed = request.inline.decode(id);

            const filePath = path.resolve(
              path.dirname(importer),
              `${path.basename(importer, path.extname(importer))}-${parsed.postfix}.css`,
            );

            return buildResponse(id, filePath);
          }
        },
        // transform(code, id) {
        //   const meta = this.getModuleInfo(id)?.meta?.[META.inline];

        //   console.log('transform', { id, meta });
        //   if (meta) {
        //     return code;
        //     //return meta.css;
        //   }
        // },
        load(id) {
          const meta = this.getModuleInfo(id)?.meta?.[META.inline];

          if (meta) {
            return meta.css;
          }
        },
        // vite: {
        //   load(id) {
        //     if (request.is.inline(id)) {
        //       let filePath = id.split('?')[0];
        //       let response = buildResponse(id, filePath);

        //       return response.meta[META.inline].css;
        //     }
        //   },
        // },
      };
    })(),
  ];
});
