import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createUnplugin } from 'unplugin';

import getClassesTagsFromCss from '../lib/getClassesTagsFromCss.js';
import {
  cssHasAssociatedComponent,
  hashFromAbsolutePath,
  isRelevantFile,
} from '../lib/path/utils.js';
import replaceHbsInJs from '../lib/replaceHbsInJs.js';
import rewriteCss from '../lib/rewriteCss.js';
import rewriteHbs from '../lib/rewriteHbs.js';

function isJsFile(id) {
  return (
    id.endsWith('.js') ||
    id.endsWith('.ts') ||
    id.endsWith('.gjs') ||
    id.endsWith('.gts')
  );
}

function isHbsFile(id) {
  return id.endsWith('.hbs');
}

function isCssFile(id) {
  return id.endsWith('.css');
}

function asCSSPath(id) {
  const cssPath = id.endsWith('.hbs')
    ? id.replace(/\.hbs$/, '.css')
    : id.replace(/(\.hbs)?\.(js|ts|gjs|gts)$/, '.css');

  return cssPath;
}

async function transformJsFile(code, id) {
  let cssPath = asCSSPath(id);
  let cssFileName = path.basename(cssPath);

  let cssExists = existsSync(cssPath);

  // Check for pods (using styles.css)
  if (!cssExists) {
    let [, ...parts] = id.split('/').reverse();

    cssPath = [...parts.reverse(), 'styles.css'].join('/');
    cssFileName = 'styles.css';
    cssExists = existsSync(cssPath);
  }

  let css;

  if (cssExists) {
    css = await readFile(cssPath, 'utf8');
  } else {
    return {
      code,
      map: null,
    };
  }

  // add css import for js and gjs files
  code = `import './${cssFileName}';\n\n${code}`;

  // rewrite hbs in js in case it is gjs file (for gjs files hbs is already in js file)

  const rewrittenCode = replaceHbsInJs(code, (hbs, scopedClass) => {
    const { classes, tags } = getClassesTagsFromCss(css);
    const postfix = hashFromAbsolutePath(cssPath);
    const rewritten = rewriteHbs(hbs, classes, tags, postfix, scopedClass);

    return rewritten;
  });

  return {
    code: rewrittenCode,
    map: null,
  };
}

function transformCssFile(code, id, layerName) {
  if (cssHasAssociatedComponent(id)) {
    const postfix = hashFromAbsolutePath(id);

    code = rewriteCss(code, postfix, path.basename(id), layerName);
  }

  return code;
}

function gatherCSSFiles(bundle) {
  let cssFiles = [];

  for (let asset in bundle) {
    const cssAsset = asset.replace('js', 'css');

    if (!asset.endsWith('js') || !bundle[cssAsset]) {
      continue;
    }

    if (process.env.environment === 'development') {
      cssFiles.push(bundle[cssAsset].source);
      delete bundle[cssAsset];
    } else {
      const cssImport = path.basename(asset.replace('.js', '.css'));
      const importLine = `import './${cssImport}';`;

      const code = bundle[asset].code;

      // add import to js files
      if (code && code.indexOf(importLine) < 0) {
        bundle[asset].code = `${importLine}\n` + code;
      }
    }
  }

  return cssFiles;
}

let virtualAll = `virtual:scoped.css?all`;
let virtualAllId = '\0' + virtualAll;

export default createUnplugin(
  /**
   * @typedef {object} Options
   * @property {string} [layerName] the name of the layer to place the generated css. Defaults to "components"
   *
   * @param {Options} [options]
   */
  (options) => {
    let cwd = process.cwd();
    let additionalRoots = options?.additionalRoots || [];

    let manualImportAll = false;

    return {
      name: 'ember-scoped-css-unplugin',

      generateBundle(_, bundle) {
        let cssFiles = gatherCSSFiles(bundle);

        if (manualImportAll || process.env.environment === 'development') {
          this.emitFile({
            type: 'asset',
            fileName: 'scoped.css',
            source: cssFiles.join('\n'),
          });
        }
      },
      vite: {
        generateBundle() {
          /* deliberately do nothing */
        },
        transform(code, jsPath) {
          if (!isRelevantFile(jsPath, { additionalRoots, cwd })) return;

          /**
           * HBS files are actually JS files with a call to precompileTemplate
           */
          if (isHbsFile(jsPath)) {
            return transformJsFile(code, jsPath);
          } else if (isJsFile(jsPath)) {
            return transformJsFile(code, jsPath);
          } else if (isCssFile(jsPath)) {
            return transformCssFile(code, jsPath, options?.layerName);
          }
        },
      },

      resolveId(id, importer) {
        if (id === virtualAll) {
          manualImportAll = importer;
          return virtualAllId;
        }
      },

      load(id) {
        if (id === virtualAllId) {
          // We can't emit only contents for this file until we process all the other files
          // though, if we assume all CSS files are used, we could eagerly do this.
          return '';
        }
      },

      transform(code, jsPath) {
        if (!isRelevantFile(jsPath, { additionalRoots, cwd })) return;

        /**
         * HBS files are actually JS files with a call to precompileTemplate
         */
        if (isHbsFile(jsPath)) {
          return transformJsFile(code, jsPath);
        } else if (isJsFile(jsPath)) {
          return transformJsFile(code, jsPath);
        } else if (isCssFile(jsPath)) {
          let css = transformCssFile(code, jsPath, options?.layerName);

          const emittedFileName = jsPath.replace(
            path.join(process.cwd(), 'src/'),
            '',
          );

          this.emitFile({
            type: 'asset',
            fileName: emittedFileName,
            source: css,
          });

          return '';
        }
      },
    };
  },
);
