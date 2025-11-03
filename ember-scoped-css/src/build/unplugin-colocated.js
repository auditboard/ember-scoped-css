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
    load(id) {
      const meta = this.getModuleInfo(id)?.meta?.[META.colocated];

      if (meta) {
        return meta.css;
      }
    },
    vite: {
      /**
       * @param {string} id location on disk
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
}
