import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { isInsideGlobal } from './utils.js';

const SEP = '__';

function isKeyframe(node) {
  return node.type === 'atrule' && node.name === 'keyframes';
}

function isRule(node) {
  return node.type === 'rule';
}

function isDeclaration(node) {
  return node.type === 'decl';
}

function rewriteKeyframe(node, postfix) {
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
  const layerNameWithDefault = layerName ?? 'components';
  const ast = postcss.parse(css);
  /**
   * originalName => postfixedName
   * @type { { [originalName: string]: string }}
   */
  const referencables = {};

  /**
   * We have to do two passes:
   * 1. postfix all the referencable syntax
   * 2. postfix as normal, but also checking values of CSS properties
   *    that could match postfixed referencables from step 1
   */

  // Step 1: find referencables
  ast.walk((node) => {
    if (isKeyframe(node)) {
      let { originalName, postfixedName } = rewriteKeyframe(node, postfix);

      referencables[originalName] = postfixedName;

      return;
    }
  });

  // Step 2: postfix and update refenced referencables
  ast.walk((node) => {
    if (isDeclaration(node)) {
      if (referencables[node.value]) {
        node.value = referencables[node.value];
      }

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

  if (!layerNameWithDefault) {
    return `/* ${fileName} */\n${rewrittenCss}\n`;
  }

  return (
    `/* ${fileName} */\n@layer ${layerNameWithDefault} {\n\n` +
    rewrittenCss +
    '\n}\n'
  );
}
