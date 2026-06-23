/**
 * Important docs:
 * - https://developer.mozilla.org/en-US/docs/Web/CSS/
 */
import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { isInsideGlobal } from './utils.js';

const SEP = '__';

function isRule(node) {
  return node.type === 'rule';
}

function isDeclaration(node) {
  return node.type === 'decl';
}

/**
 * NOTE: "keyframes" is a singular definition, in that it's a block containing keyframes
 *       using `@keyframes {}` with only one thing on the inside doesn't make sense.
 */
function rewriteReferenceable(node, postfix) {
  let originalName = node.params;
  let postfixedName = node.params + SEP + postfix;

  node.params = postfixedName;

  return {
    originalName,
    postfixedName,
  };
}

function rewriteSelector(sel, postfix) {
  const transform = (selectors) => {
    selectors.walk((selector) => {
      if (isInsideGlobal(selector)) return;

      // We never want to touch psuedo selectors since we and the user doesn't own them.
      if (selector.type === 'psuedo') return;

      // :nth-of-type has special syntax where the values passed to nth-of-type()
      // must either be exactly "odd", "even", or a simple formula
      //
      // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-of-type
      if (isNthOfType(selector)) return;

      if (selector.type === 'class') {
        selector.value += '_' + postfix;
      } else if (selector.type === 'tag') {
        selector.replaceWith(
          parser.tag({ value: selector.value }),
          parser.className({ value: postfix }),
        );
      }
    });

    // remove :global
    selectors.walk((selector) => {
      if (selector.type === 'pseudo' && selector.value === ':global') {
        selector.replaceWith(...selector.nodes);
      }
    });
  };
  const transformed = parser(transform).processSync(sel);

  return transformed;
}

function isNthOfType(node) {
  if (!node) return false;

  return node.parent?.value === ':nth-of-type' || isNthOfType(node.parent);
}

function isInsideKeyframes(node) {
  const parent = node.parent;

  if (!parent) return false;
  if (parent.type === 'atrule' && parent.name === 'keyframes') return true;

  return isInsideKeyframes(parent);
}

/**
 * Parse `css` and apply the scoping transforms (postfixing selectors,
 * referenceables, etc) in place. Returns the mutated PostCSS AST.
 *
 * `fileName` is passed as PostCSS's `from` so generated sourcemaps point at the
 * original file.
 */
function parseAndScope(css, postfix, fileName) {
  const ast = postcss.parse(css, { from: fileName });
  /**
   * kind => originalName => postfixedName
   * @type {{ [kind: string]: { [originalName: string]: string }}}
   */
  const referenceables = {
    keyframes: {},
    'counter-style': {},
    'position-try': {},
    property: {},
  };

  const availableReferenceables = new Set(Object.keys(referenceables));

  function isReferenceable(node) {
    if (node.type !== 'atrule') return;

    return availableReferenceables.has(node.name);
  }

  function updateDirectReferences(node) {
    if (!node.value) return;

    for (let [, map] of Object.entries(referenceables)) {
      if (map[node.value]) {
        node.value = map[node.value];
      }
    }
  }

  function updateShorthandContents(node) {
    if (node.prop === 'animation') {
      let parts = node.value.split(' ');
      let match = parts.filter((x) => referenceables.keyframes[x]);

      if (match.length) {
        match.forEach((x) => {
          let replacement = referenceables.keyframes[x];

          if (!replacement) return;

          node.value = node.value.replace(x, replacement);
        });
      }
    }

    for (let [lookFor, replaceWith] of Object.entries(
      referenceables.property,
    )) {
      let lookForVar = `var(${lookFor})`;
      let replaceWithVar = `var(${replaceWith})`;

      node.value = node.value.replace(lookForVar, replaceWithVar);
    }
  }

  /**
   * We have to do two passes:
   * 1. postfix all the referenceable syntax
   * 2. postfix as normal, but also checking values of CSS properties
   *    that could match postfixed referenceables from step 1
   */

  // Step 1: find referenceables
  ast.walk((node) => {
    /**
     * @keyframes, @counter-style, etc
     */
    if (isReferenceable(node)) {
      let name = node.name;
      let { originalName, postfixedName } = rewriteReferenceable(node, postfix);

      referenceables[name][originalName] = postfixedName;

      return;
    }
  });

  // Step 2: postfix and update referenced referenceables
  ast.walk((node) => {
    if (isDeclaration(node)) {
      updateDirectReferences(node);
      updateShorthandContents(node);

      return;
    }

    if (isRule(node)) {
      /**
       * The inner-contents of a keyframe are percentages, rather than selectors
       */
      if (isInsideKeyframes(node)) return;

      node.selector = rewriteSelector(node.selector, postfix);

      return;
    }
  });

  return ast;
}

/**
 * Wrap the rewritten CSS with the leading filename comment and optional
 * `@layer`. Returns the final CSS plus the number of lines prepended before the
 * rewritten content (so a sourcemap can be shifted to match).
 */
function assemble(rewrittenCss, fileName, layerName) {
  const prefix = [
    `/* ${fileName} */`,
    layerName ? `@layer ${layerName} {` : '',
  ].filter(Boolean);

  const css =
    [...prefix, rewrittenCss.trimEnd(), layerName ? `}` : '']
      .filter(Boolean)
      .join('\n') + '\n';

  return { css, prefixLines: prefix.length };
}

export function rewriteCss(css, postfix, fileName, layerName) {
  const ast = parseAndScope(css, postfix, fileName);

  return assemble(ast.toString(), fileName, layerName).css;
}

/**
 * Like {@link rewriteCss}, but also returns a source map (v3 JSON) that maps the
 * rewritten CSS back to the original `fileName`.
 *
 * @returns {{ css: string, map: import('postcss').default.SourceMapOptions extends never ? object : object }}
 */
export function rewriteCssWithMap(css, postfix, fileName, layerName) {
  const ast = parseAndScope(css, postfix, fileName);

  const result = ast.toResult({
    from: fileName,
    map: { inline: false, annotation: false, sourcesContent: true },
  });

  const { css: finalCss, prefixLines } = assemble(
    result.css,
    fileName,
    layerName,
  );
  const map = result.map.toJSON();

  /**
   * `assemble` prepends `prefixLines` generated lines (the filename comment and
   * optional `@layer {`). A sourcemap `mappings` string is `;`-delimited per
   * generated line, so prepending that many `;` shifts every mapping down to
   * line up with the assembled output.
   */
  map.mappings = ';'.repeat(prefixLines) + map.mappings;

  return { css: finalCss, map };
}

/**
 * Append an inline `sourceMappingURL` comment (base64 data URI) to `css`.
 *
 * Needed for bundler paths that emit the CSS as a standalone asset without
 * propagating sourcemaps themselves (e.g. `@embroider/addon-dev`'s
 * `keep-assets`): the map has to ride along inside the CSS itself.
 */
export function withInlineSourceMap(css, map) {
  const base64 = Buffer.from(JSON.stringify(map), 'utf8').toString('base64');

  return (
    `${css.trimEnd()}\n` +
    `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64} */\n`
  );
}
