import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import isInsideGlobal from './isInsideGlobal.js';

function rewriteSelector(sel, postfix) {
  const transform = (selectors) => {
    selectors.walk((selector) => {
      if (selector.type === 'class' && !isInsideGlobal(selector)) {
        selector.value += '_' + postfix;
      } else if (selector.type === 'tag' && !isInsideGlobal(selector)) {
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
    if (node.type === 'rule' && !isInsideKeyframes(node)) {
      node.selector = rewriteSelector(node.selector, postfix);
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

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should rewrite css', function () {
    const css = '.foo { color: red; }';
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, false);

    expect(rewritten).to.equal(`/* foo.css */\n.foo_postfix { color: red; }\n`);
  });

  it('should use a custom layer', function () {
    const css = '.foo { color: red; }';
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'utils');

    expect(rewritten).to.equal(
      `/* foo.css */\n@layer utils {\n\n.foo_postfix { color: red; }\n}\n`,
    );
  });

  it('shouldnt rewrite global', function () {
    const css = '.baz :global(.foo p) .bar { color: red; }';
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).to.equal(
      `/* foo.css */\n@layer components {\n\n.baz_postfix .foo p .bar_postfix { color: red; }\n}\n`,
    );
  });

  it(`shouldn't rewrite keyframes`, function () {
    const css = `
      @keyframes luna-view-navigation {
        100% {
          padding-top: 1rem;
        }
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).to.equal(
      `/* foo.css */\n@layer components {\n\n${css}\n}\n`,
    );
  });
}

export default rewriteCss;
