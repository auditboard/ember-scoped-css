/**
 * @typedef {import('@glimmer/syntax').ASTPlugin} ASTPlugin
 * @typedef {import('@glimmer/syntax').ASTPluginEnvironment} ASTPluginEnvironment
 *
 */

import path from 'node:path';

import { rewriteCss } from '../lib/css/rewrite.js';
import { getCSSContentInfo, getCSSInfo } from '../lib/css/utils.js';
import { fixFilename } from '../lib/path/template-transform-paths.js';
import {
  appPath,
  cssPathFor,
  forcePosix,
  hashFromModulePath,
  isRelevantFile,
} from '../lib/path/utils.js';
import { request } from '../lib/request.js';
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
    let cwd = process.cwd();
    let isRelevant = isRelevantFile(env.filename, {
      additionalRoots: config.additionalRoots,
      cwd,
    });

    if (!isRelevant) {
      return noopPlugin;
    }

    let absolutePath = fixFilename(env.filename);
    let modulePath = appPath(absolutePath);
    let postfix = hashFromModulePath(modulePath);

    /**
     * The list of naked tag selectors found in the CSS
     *
     * @type {Set<string>}
     */
    let scopedTags = new Set();

    /**
     * The list of classes found in the CSS
     *
     * @type {Set<string>}
     */
    let scopedClasses = new Set();

    /**
     * @param {{ tags: Set<string>; classes: Set<string> }} info
     */
    function addInfo(info) {
      for (let item of info.tags) {
        scopedTags.add(item);
      }

      for (let item of info.classes) {
        scopedClasses.add(item);
      }
    }

    let cssPath = cssPathFor(absolutePath);
    let info = getCSSInfo(cssPath);
    let localCssPath = forcePosix(cssPath.replace(cwd + path.sep, ''));

    /**
     * This will be falsey if we don't have a co-located CSS file.
     * We'll still want to check for embedded <style scoped> tags though.
     */
    if (info) {
      addInfo(info);

      let cssRequest = request.colocated.create(info.id, postfix, localCssPath);

      /**
       * With this we don't need a JS plugin
       */
      env.meta.jsutils.importForSideEffect(cssRequest);
    }

    let visitors = templatePlugin({
      classes: scopedClasses,
      tags: scopedTags,
      postfix,
    });

    return {
      name: 'ember-scoped-css:template-plugin',
      visitor: {
        // Stack Manager
        ...visitors,

        /**
         * We have to eagerly get the <style scoped> contents, so we can pre-parse
         * the tags and classes to then pass to the other visitors so that they can
         * appropriately change matching classes / tags.
         */
        Template(node) {
          /**
           * We only allow a scoped <style> at the root
           */
          let styleTag = node.body.find(
            (n) => n.type === 'ElementNode' && n.tag === 'style',
          );

          if (hasScopedAttribute(styleTag)) {
            let css = textContent(styleTag);
            let info = getCSSContentInfo(css);

            addInfo(info);

            /**
             * This will be handled in ElementNode traversal
             */
            if (hasInlineAttribute(styleTag)) {
              return;
            }

            let cssRequest = request.inline.create(info.id, postfix, css);

            env.meta.jsutils.importForSideEffect(cssRequest);
          }
        },

        // Visitors broken out like this so we can conditionally
        // debug based on file path.
        AttrNode(...args) {
          return visitors.AttrNode(...args);
        },
        ElementNode(node, walker) {
          // class attribute handling
          visitors.ElementNode(node, walker);

          if (hasScopedAttribute(node)) {
            if (walker.parent?.node.type !== 'Template') {
              throw new Error(
                '<style scoped> tags must be at the root of the template, they cannot be nested',
              );
            }

            if (hasInlineAttribute(node)) {
              let text = textContent(node);
              let scopedText = rewriteCss(
                text,
                postfix,
                localCssPath,
                config.layerName,
              );

              /**
               * Traverse this and allow interpolation
               */
              node.children = [env.syntax.builders.text(scopedText)];

              return;
            }

            // Returning null removes the node
            return null;
          }

          if (hasInlineAttribute(node)) {
            throw new Error(
              `<style inline> is not valid. Please add the scoped attribute: <style scoped inline>`,
            );
          }
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

/**
 * Thanks, CardStack and @ef4 for this code.
 */
const SCOPED_ATTRIBUTE_NAME = 'scoped';
const INLINE_ATTRIBUTE_NAME = 'inline';

function hasScopedAttribute(node) {
  if (!node) return;
  if (node.tag !== 'style') return;
  if (node.type !== 'ElementNode') return;

  return node.attributes.some(
    (attribute) => attribute.name === SCOPED_ATTRIBUTE_NAME,
  );
}

function hasInlineAttribute(node) {
  if (!node) return;
  if (node.tag !== 'style') return;
  if (node.type !== 'ElementNode') return;

  return node.attributes.some(
    (attribute) => attribute.name === INLINE_ATTRIBUTE_NAME,
  );
}

function textContent(node) {
  let textChildren = node.children.filter((c) => c.type === 'TextNode');

  return textChildren.map((c) => c.chars).join('');
}
