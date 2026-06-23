import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { rewriteCssWithMap, withInlineSourceMap } from '../lib/css/rewrite.js';
import { request } from '../lib/request.js';

const META = 'scoped-css:colocated';

/** File extensions that Vite can preprocess via its CSS preprocessor pipeline */
const PREPROCESSED_EXTENSIONS = new Set([
  '.scss',
  '.sass',
  '.less',
  '.styl',
  '.stylus',
]);

/**
 * Plugin for supporting colocated styles
 *
 * e.g.:
 *  src/components/my-component.js
 *  src/components/my-component.css
 */
export function colocated(options = {}) {
  const CWD = process.cwd();

  /** @type {import('vite').ResolvedConfig | undefined} */
  let viteConfig;

  /** @type {((code: string, filename: string, config: unknown) => Promise<{ code: string }>) | undefined} */
  let preprocessCSS;

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

        return buildResponse(id, filePath);
      }
    },
    load(id) {
      const meta = this.getModuleInfo(id)?.meta?.[META];

      if (meta) {
        this.addWatchFile(meta.fullPath);

        let code = readFileSync(meta.fullPath, 'utf-8');

        let { css, map } = rewriteCssWithMap(
          code,
          meta.postfix,
          meta.fileName,
          options.layerName,
        );

        /**
         * The CSS is emitted as a standalone asset (e.g. via keep-assets),
         * which doesn't propagate rollup's sourcemap chain, so the map has to
         * be inlined into the CSS itself. We still return `map` for bundlers
         * that can chain it.
         */
        return { code: withInlineSourceMap(css, map), map };
      }
    },
    vite: {
      async configResolved(config) {
        viteConfig = config;

        // Resolve Vite's preprocessCSS from the app root to ensure we find
        // the correct Vite installation (not a stale or missing one).
        try {
          const require = createRequire(path.join(config.root, 'package.json'));
          const vitePath = require.resolve('vite');
          const viteModule = await import(vitePath);

          preprocessCSS = viteModule.preprocessCSS;
        } catch {
          // Vite may not be resolvable from the config root in some setups;
          // preprocessor support for colocated .scss files will throw a clear
          // error at load time if used.
        }
      },

      /**
       * There may not be meta for this request yet.
       *
       * @param {*} id
       */
      async load(id) {
        if (request.is.colocated(id)) {
          const parsed = request.colocated.decode(id);

          let code = readFileSync(parsed.fileName, 'utf-8');
          let relativeFilePath = path.relative(CWD, parsed.fileName);

          const ext = path.extname(parsed.fileName).toLowerCase();

          if (PREPROCESSED_EXTENSIONS.has(ext)) {
            if (!viteConfig || !preprocessCSS) {
              throw new Error(
                `[ember-scoped-css] Colocated CSS file with extension '${ext}' requires Vite. ` +
                  `CSS preprocessing is only supported in Vite builds.`,
              );
            }

            const result = await preprocessCSS(
              code,
              parsed.fileName,
              viteConfig,
            );

            code = result.code;
          }

          let { css, map } = rewriteCssWithMap(
            code,
            parsed.postfix,
            relativeFilePath,
            options.layerName,
          );

          // Vite chains the map through its own CSS pipeline.
          return { code: css, map };
        }
      },
    },
  };
}
