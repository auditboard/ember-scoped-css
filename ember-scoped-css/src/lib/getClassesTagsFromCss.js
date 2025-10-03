import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import isInsideGlobal from './isInsideGlobal.js';

function getClassesAndTags(sel, classes, tags) {
  const transform = (sls) => {
    sls.walk((selector) => {
      if (selector.type === 'class' && !isInsideGlobal(selector)) {
        classes.add(selector.value);
      } else if (selector.type === 'tag' && !isInsideGlobal(selector)) {
        tags.add(selector.value);
      }
    });
  };

  parser(transform).processSync(sel);
}

/**
 * We use this function to check each class used in the template
 * to see if we need to leave it alone or transform it
 */
export default function getClassesTagsFromCss(css) {
  const classes = new Set();
  const tags = new Set();

  const ast = postcss.parse(css);

  ast.walk((node) => {
    if (node.type === 'rule') {
      getClassesAndTags(node.selector, classes, tags);
    }
  });

  return { classes, tags, css };
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should return classes and tags that are not in :global', function () {
    const css = '.baz :global(.foo) .bar div :global(p)  { color: red; }';
    const { classes, tags } = getClassesTagsFromCss(css);

    // classes should be baz and bar
    expect(classes.size).to.equal(2);
    expect([...classes]).to.have.members(['baz', 'bar']);
    expect(tags.size).to.equal(1);
    expect([...tags]).to.have.members(['div']);
  });
}
