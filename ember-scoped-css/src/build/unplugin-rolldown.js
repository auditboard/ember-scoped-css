import path, { basename } from 'node:path';

// eslint-disable-next-line n/no-unpublished-import
import { Lang, parse } from '@ast-grep/napi';

import { request } from '../lib/request.js';

/**
 * JSDoc type imports
 *
 * @typedef {import('@ast-grep/napi/lang/JavaScript').default} JavaScriptTypes
 * @template T
 * @typedef {import('@ast-grep/napi/types/staticTypes').Kinds<T>} Kinds
 * @typedef {import('@ast-grep/napi').SgNode<JavaScriptTypes>} SgNode
 * @typedef {import('rolldown').Plugin} Plugin
 * @typedef {import('rolldown').OutputChunk} OutputChunk
 * @typedef {import('rolldown').NormalizedOutputOptions} NormalizedOutputOptions
 * @typedef {import('rolldown').OutputBundle} OutputBundle
 * @typedef {import('rolldown').OutputOptions} OutputOptions
 *
 * @typedef {Set<string> | undefined} CSSFiles
 * @typedef {SgNode<JavaScriptTypes> | undefined} NodePos
 */

/**
 * @name extractStyleImports
 * @description Extract CSS imports (including CSS Modules) from source code
 * @example
 * const s = 'import "./index.css"; import styles from "./Button.module.css";'
 * const arr = extractStyleImports(s) // ["./index.css", "./Button.module.css"]
 * @param code - The source code to analyze
 * @returns An array of CSS import paths
 */
const extractStyleImports = (code) => {
  const styleImports = [];

  // Match CSS file extensions (including CSS Modules)
  const cssExtensions = /\.css(?:\?[^'"]*)?/;

  // Pattern 1: import './style.css' or import 'style.css'
  const sideEffectImportRegex = /import\s+(['"])(.*?)\1/g;

  // Pattern 2: import styles from './style.module.css'
  const namedImportRegex =
    /import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+(['"])(.*?)\2/g;

  // Pattern 3: import { something } from './style.css'
  const destructuredImportRegex = /import\s+{[^}]+}\s+from\s+(['"])(.*?)\1/g;

  // Check side-effect imports
  let match;

  while ((match = sideEffectImportRegex.exec(code)) !== null) {
    const importPath = match[2];

    if (cssExtensions.test(importPath)) {
      styleImports.push(importPath);
    }
  }

  // Check named imports (e.g., CSS modules)
  while ((match = namedImportRegex.exec(code)) !== null) {
    const importPath = match[3];

    if (cssExtensions.test(importPath)) {
      styleImports.push(importPath);
    }
  }

  // Check destructured imports
  while ((match = destructuredImportRegex.exec(code)) !== null) {
    const importPath = match[2];

    if (cssExtensions.test(importPath)) {
      styleImports.push(importPath);
    }
  }

  return styleImports;
};

/**
 */
export function rolldown() {
  // Track style imports per module
  /** @type {Map<string, string[]>} */
  const styleImportMap = new Map();
  // Track which modules are included in which chunks
  /** @type {Map<string, string>} */
  const moduleToChunkMap = new Map();

  return {
    name: 'ember-scoped-css:tsdown',

    rolldown: {
      // Set default config for better library bundling
      outputOptions(outputOptions) {
        // Prevent hoisting transitive imports to avoid tree-shaking issues
        if (typeof outputOptions.hoistTransitiveImports !== 'boolean') {
          return {
            ...outputOptions,
            hoistTransitiveImports: false,
          };
        }

        return outputOptions;
      },

      // Capture style imports before they're stripped by the build
      transform: {
        order: 'post',
        handler(code, id) {
          if (!/\.g(t|j)s$/.test(id)) {
            return null;
          }

          const styleImports = extractStyleImports(code);

          if (styleImports.length > 0) {
            const sanitizedStyleImports = styleImports.map(cssImport => {
              if (request.is.colocated(cssImport)) {
                const parsed = request.colocated.decode(cssImport);

                return path.join(path.dirname(id),path.basename(parsed.fileName));
              }

              if (request.is.inline(cssImport)) {
                const parsed = request.inline.decode(cssImport);

                return path.join(path.dirname(id), `inline-${parsed.hash}.css`);

              }

              return cssImport;
            })

            styleImportMap.set(id, sanitizedStyleImports);
          }


          return null;
        },
      },

      // Track which modules end up in which chunks
      renderChunk(code, chunk) {
        // Store the relationship between modules and chunks
        for (const moduleId of Object.keys(chunk.modules)) {
          moduleToChunkMap.set(moduleId, chunk.fileName);
        }

        return null;
      },

      /**
       *
       * @param {NormalizedOutputOptions} options
       * @param {OutputBundle} bundle
       */
      generateBundle(options, bundle) {
        // Gather all CSS files that have been bundled
        const outputCssFiles = new Set();

        for (const file of Object.keys(bundle)) {
          if (file.endsWith('.css')) {
            outputCssFiles.add(file);
          }
        }

        // Build a map of chunk -> CSS files
        // This aggregates ALL style imports from ALL modules in each chunk
        /** @type Map<string, Set<string>> */
        const chunkCssMap = new Map();

        for (const [moduleId, styleImports] of styleImportMap.entries()) {
          const chunkName = moduleToChunkMap.get(moduleId);

          if (chunkName) {
            if (!chunkCssMap.has(chunkName)) {
              chunkCssMap.set(chunkName, new Set());
            }

            const chunkCss = chunkCssMap.get(chunkName);

            for (const styleImport of styleImports) {
              // Remove query parameters
              const cleanPath = styleImport.split('?')[0];

              // Get the base filename
              const fileName = basename(cleanPath);

              // that's the trick we need to do here:
              // rolldown has no complete knowledge about our virtual CSS files
              // It can't map from the imported module to the chunk that this
              // module ends up in, to the CSS file in which scoped-css ends up
              // in. So we do help a little in the mapping here.
              // We check from the chunk that the importing module ends up and
              // check if there is a similar file, but with CSS extension.
              // Mostly that will do the job and we can put the import statement
              // back in later
              const importedFrom = moduleToChunkMap.entries().find(([filePath]) => {
                return filePath === styleImport;
              });

              if (importedFrom) {
                const importedFromFile = importedFrom[1];
                const cssFileName = importedFromFile.replace(/\.(m|c)?js$/, '.css');

                if (outputCssFiles.has(cssFileName)) {
                  chunkCss.add(cssFileName)
                }
              }

              // Try to find matching CSS file in output
              const possibleMatches = Array.from(outputCssFiles).filter(
                (cssFile) => {
                  const cssBaseName = basename(cssFile);

                  // Exact filename match (including .module.css files)
                  return cssBaseName === fileName;
                },
              );

              // If we found exact matches, add them
              if (possibleMatches.length > 0) {
                possibleMatches.forEach((match) => chunkCss.add(match));
              } else if (outputCssFiles.size === 1) {
                // If there's only one CSS file in the output, assume all styles
                // are bundled into it (common case for libraries)
                const [singleCssFile] = Array.from(outputCssFiles);

                chunkCss.add(singleCssFile);
              }
            }
          }
        }


        // Inject CSS imports into chunks
        /** @type {OutputChunk} */
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') {
            continue;
          }

          const outputChunk = chunk;

          // Skip non-JavaScript files (like .d.ts files)
          if (
            !outputChunk.fileName.endsWith('.js') &&
            !outputChunk.fileName.endsWith('.mjs') &&
            !outputChunk.fileName.endsWith('.cjs')
          ) {
            continue;
          }

          /** @type {CSSFiles} */
          const cssFiles = chunkCssMap.get(outputChunk.fileName);

          if (!cssFiles || cssFiles.size === 0) {
            continue;
          }



          /** @type {Kinds<JavaScriptTypes>[]} */
          const excludeTokens = ['import_statement', 'expression_statement'];

          // Find the position to inject CSS imports
          /** @type {NodePos} */
          const node = parse(Lang.JavaScript, outputChunk.code)
            .root()
            .children()
            .find((node) => !excludeTokens.includes(node.kind()));

          const position = node?.range().start.index ?? 0;

          // Inject CSS imports at the top of the chunk
          let code = outputChunk.code;
          /** @type {string[]} */
          const injections = [];

          for (const cssFileName of cssFiles) {
            // Resolve the CSS file path relative to the chunk
            let cssFilePath = cssFileName;

            // If it's a relative import, keep it relative
            if (cssFilePath.startsWith('./') || cssFilePath.startsWith('../')) {
              // Already relative, use as-is
            } else {
              // Make it relative
              cssFilePath = `./${cssFilePath}`;
            }

            const injection =
              options.format === 'es'
                ? `import '${cssFilePath}';`
                : `require('${cssFilePath}');`;

            injections.push(injection);
          }

          if (injections.length > 0) {
            code =
              code.slice(0, position) +
              injections.join('\n') +
              '\n' +
              code.slice(position);
          }

          // Update code
          outputChunk.code = code;
        }
      },
    },
  };
}
