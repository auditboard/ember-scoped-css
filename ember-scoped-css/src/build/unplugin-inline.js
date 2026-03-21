import { createRequire } from 'node:module';
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

  /** @type {import('vite').ResolvedConfig | undefined} */
  let viteConfig;

  /** @type {((code: string, filename: string, config: unknown) => Promise<{ code: string }>) | undefined} */
  let preprocessCSS;

  /**
   * @param {string} id the request id / what was imported
   */
  function buildResponse(id, filePath) {
    const parsed = request.inline.decode(id);

    const relativeFilePath = path.relative(CWD, filePath);

    return {
      id: filePath.split('?')[0],
      meta: {
        [META]: {
          rawCss: parsed.css,
          postfix: parsed.postfix,
          fileName: relativeFilePath,
          lang: parsed.lang,
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
    async load(id) {
      const meta = this.getModuleInfo(id)?.meta?.[META];

      if (meta) {
        let rawCss = meta.rawCss;

        if (meta.lang) {
          if (!viteConfig || !preprocessCSS) {
            throw new Error(
              `[ember-scoped-css] <style scoped lang="${meta.lang}"> requires Vite. ` +
                `CSS preprocessing via the 'lang' attribute is only supported in Vite builds.`,
            );
          }

          const fakeFilename = `${meta.fileName}.${meta.lang}`;
          const result = await preprocessCSS(rawCss, fakeFilename, viteConfig);

          rawCss = result.code;
        }

        const css = rewriteCss(
          rawCss,
          meta.postfix,
          `<inline>/${meta.fileName}`,
          options.layerName,
        );

        return css;
      }
    },
    vite: {
      async configResolved(config) {
        viteConfig = config;

        // Resolve Vite's preprocessCSS from the app root to ensure we find
        // the correct Vite installation (not a stale or missing one).
        try {
          const require = createRequire(config.root);
          const vitePath = require.resolve('vite');
          const viteModule = await import(vitePath);

          preprocessCSS = viteModule.preprocessCSS;
        } catch {
          // Vite may not be resolvable from the config root in some setups;
          // lang= support will throw a clear error at load time if used.
        }
      },
    },
  };
}
