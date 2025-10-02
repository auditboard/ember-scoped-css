/**
 * @typedef {import('@glimmer/syntax').ASTPlugin} ASTPlugin
 * @typedef {import('@glimmer/syntax').ASTPluginEnvironment} ASTPluginEnvironment
 *
 */

import { getCSSInfo } from '../lib/css/utils.js';
import { fixFilename } from '../lib/path/template-transform-paths.js';
import {
  appPath,
  cssPathFor,
  hashFromModulePath,
  isRelevantFile,
} from '../lib/path/utils.js';
import { makeRequest } from '../lib/request.js';
import { rewriteCss } from '../lib/rewriteCss.js';
import { templatePlugin } from '../lib/rewriteHbs.js';

const noopPlugin = {
  name: 'ember-scoped-css:noop',
  visitor: {},
};

/**
 * @returns {ASTPlugin}
 */
export function createPlugin(config) {
  /**
   *
   * @param {ASTPluginEnvironment} env
   */
  return function scopedCss(env) {
    let isRelevant = isRelevantFile(env.filename, {
      additionalRoots: config.additionalRoots,
      cwd: process.cwd(),
    });

    if (!isRelevant) {
      return noopPlugin;
    }

    let absolutePath = fixFilename(env.filename);
    let modulePath = appPath(absolutePath);

    let cssPath = cssPathFor(absolutePath);
    let info = getCSSInfo(cssPath);
    let postfix = hashFromModulePath(modulePath);

    if (!info) {
      return noopPlugin;
    }

    let scopedCss = rewriteCss(info.css, postfix, cssPath, config.layerName);
    let cssRequest = makeRequest(postfix, scopedCss);

    /**
     * With this we don't need a JS plugin
     */
    env.meta.jsutils.importForSideEffect(cssRequest);

    let visitors = templatePlugin({
      classes: info.classes,
      tags: info.tags,
      postfix,
    });

    return {
      name: 'ember-scoped-css:template-plugin',
      visitor: {
        // Stack Manager
        ...visitors,
        // Visitors broken out like this so we can conditionally
        // debug based on file path.
        AttrNode(...args) {
          return visitors.AttrNode(...args);
        },
        ElementNode(...args) {
          return visitors.ElementNode(...args);
        },
        MustacheStatement(...args) {
          return visitors.MustacheStatement(...args);
        },
        SubExpression(...args) {
          return visitors.SubExpression(...args);
        },
      },
    };
  };
}
