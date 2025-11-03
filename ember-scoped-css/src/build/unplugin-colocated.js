import { readFileSync } from 'node:fs';
import path from 'node:path';

import { rewriteCss } from '../lib/css/rewrite.js';
import { request } from '../lib/request.js';

const META = 'scoped-css:colocated';

/**
 * Plugin for supporting colocated styles
 *
 * e.g.:
 *  src/components/my-component.js
 *  src/components/my-component.css
 */
export function colocated(options = {}) {
  const CWD = process.cwd();

  /**
   *
   * @param {string} id the request id / what was imported
   * @param {string} filePath  path on disk
   * @returns
   */
  function buildResponse(id, filePath) {
    const parsed = request.colocated.decode(id);
    const relativeFilePath = path.relative(CWD, filePath);

    return {
      id: filePath,
      meta: {
        [META]: {
          postfix: parsed.postfix,
          fileName: relativeFilePath,
          fullPath: filePath,
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

        /**
         * Rollup doesn't normally watch CSS files
         */
        this.addWatchFile(filePath);

        return buildResponse(id, filePath);
      }
    },
    load(id) {
      const meta = this.getModuleInfo(id)?.meta?.[META];

      if (meta) {
        let code = readFileSync(meta.fullPath, 'utf-8');

        let css = rewriteCss(
          code,
          meta.postfix,
          meta.fileName,
          options.layerName,
        );

        return css;
      }
    },
    vite: {
      /**
       * There may not be meta for this request yet.
       *
       * @param {*} id
       */
      load(id) {
        if (request.is.colocated(id)) {
          const parsed = request.colocated.decode(id);

          let code = readFileSync(parsed.fileName, 'utf-8');
          let relativeFilePath = path.relative(CWD, parsed.fileName);

          let css = rewriteCss(
            code,
            parsed.postfix,
            relativeFilePath,
            options.layerName,
          );

          return css;
        }
      },
    },
  };
}
