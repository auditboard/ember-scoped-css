import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createUnplugin } from 'unplugin';

import { isScopedCSSRequest, decodeScopedCSSRequest } from '../lib/request.js';
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

/**
 * The plugin that handles CSS requests from other transform (e.g.: babel)
 *
 * This plugin takes no options because the CSS transform has already happened by the time
 * we handle it here.
 */
export default createUnplugin(() => {
  return {
    name: 'ember-scoped-css-unplugin',

    resolveId(id, importer) {
      if (isScopedCSSRequest(id)) {
        let parsed = decodeScopedCSSRequest(id);

        return {
          id: path.resolve(path.dirname(importer), parsed.id),
          meta: {
            'scoped-css': {
              css: parsed.css,
            },
          },
        };
      }
    },

    load(id) {
      let meta = this.getModuleInfo(id)?.meta?.['scoped-css'];

      if (meta) {
        return meta.css;
      }
    },
  };
});
