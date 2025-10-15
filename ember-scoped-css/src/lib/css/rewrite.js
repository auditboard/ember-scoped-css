import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { isInsideGlobal } from './utils.js';

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

  ast.walk((node) => {
    if (node.type !== 'rule') return;
    // TODO: https://github.com/auditboard/ember-scoped-css/issues/44
    //       (we should scope keyframes too)
    if (isInsideKeyframes(node)) return;

    node.selector = rewriteSelector(node.selector, postfix);
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
