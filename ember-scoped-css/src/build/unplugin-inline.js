import path from 'node:path';

import { rewriteCss } from '../lib/css/rewrite.js';
import { request } from '../lib/request.js';

const META = 'scoped-css:inline';

/**
 * Plugin for supporting the styles from
 *
 * <template>
 *   <style>...</style>
 * </template>
 *
 * This plugin can't have HMR for CSS because changes to the CSS content alters the template content
 */
export function inline(options = {}) {
  const CWD = process.cwd();

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
          `${path.basename(importer, path.extname(importer))}-${parsed.hash}.css`,
        );

        return buildResponse(id, filePath);
      }
    },
    load(id) {
      const meta = this.getModuleInfo(id)?.meta?.[META.inline];

      if (meta) {
        return meta.css;
      }
    },
  };
}
