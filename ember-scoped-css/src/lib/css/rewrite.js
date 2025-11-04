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
function rewriteReferencable(node, postfix) {
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

export function rewriteCss(css, postfix, fileName, layerName) {
  const ast = postcss.parse(css);
  /**
   * kind => originalName => postfixedName
   * @type {{ [kind: string]: { [originalName: string]: string }}}
   */
  const referencables = {
    keyframes: {},
    'counter-style': {},
    'position-try': {},
    property: {},
  };

  const availableReferencables = new Set(Object.keys(referencables));

  function isReferencable(node) {
    if (node.type !== 'atrule') return;

    return availableReferencables.has(node.name);
  }

  function updateDirectReferences(node) {
    if (!node.value) return;

    for (let [, map] of Object.entries(referencables)) {
      if (map[node.value]) {
        node.value = map[node.value];
      }
    }
  }

  function updateShorthandContents(node) {
    if (node.prop === 'animation') {
      let parts = node.value.split(' ');
      let match = parts.filter((x) => referencables.keyframes[x]);

      if (match.length) {
        match.forEach((x) => {
          let replacement = referencables.keyframes[x];

          if (!replacement) return;

          node.value = node.value.replace(x, replacement);
        });
      }
    }

    for (let [lookFor, replaceWith] of Object.entries(referencables.property)) {
      let lookForVar = `var(${lookFor})`;
      let replaceWithVar = `var(${replaceWith})`;

      node.value = node.value.replace(lookForVar, replaceWithVar);
    }
  }

  /**
   * We have to do two passes:
   * 1. postfix all the referencable syntax
   * 2. postfix as normal, but also checking values of CSS properties
   *    that could match postfixed referencables from step 1
   */

  // Step 1: find referencables
  ast.walk((node) => {
    /**
     * @keyframes, @counter-style, etc
     */
    if (isReferencable(node)) {
      let name = node.name;
      let { originalName, postfixedName } = rewriteReferencable(node, postfix);

      referencables[name][originalName] = postfixedName;

      return;
    }
  });

  // Step 2: postfix and update refenced referencables
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

  const rewrittenCss = ast.toString();

  return [
    `/* ${fileName} */`,
    layerName ? `@layer ${layerName} {` : '',
    rewrittenCss.trimEnd(),
    layerName ? `}` : '',
  ].filter(Boolean).join('\n');
}
