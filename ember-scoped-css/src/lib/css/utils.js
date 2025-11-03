import { existsSync, readFileSync } from 'fs';
import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { md5 } from '../path/md5.js';

/**
 * @param {string} css
 * @return {string} hashed down version of the CSS for disambiguating
 */
export function hash(css) {
  return `css-${md5(css)}`;
}

export function isInsideGlobal(node, func) {
  const parent = node.parent;

  if (!parent) return false;
  if (parent.type === 'pseudo' && parent.value === ':global') return true;

  return isInsideGlobal(parent, func);
}

/**
 * @param {string} cssPath path to a CSS file
 */
export function getCSSInfo(cssPath) {
  if (!existsSync(cssPath)) {
    return null;
  }

  let css = readFileSync(cssPath, 'utf8');

  return getCSSContentInfo(css);
}

/**
 * We use this function to check each class used in the template
 * to see if we need to leave it alone or transform it
 *
 * @param {string} css the CSS's contents
 * @return {{ classes: Set<string>, tags: Set<string>, css: string, id: string }}
 */
export function getCSSContentInfo(css) {
  const classes = new Set();
  const tags = new Set();

  const ast = postcss.parse(css);

  ast.walk((node) => {
    if (node.type === 'rule') {
      getClassesAndTags(node.selector, classes, tags);
    }
  });

  let id = hash(css);

  return { classes, tags, css, id, hash: id.slice(4) };
}

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

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;

  it('should return classes and tags that are not in :global', function () {
    const css = '.baz :global(.foo) .bar div :global(p)  { color: red; }';
    const { classes, tags } = getCSSContentInfo(css);

    // classes should be baz and bar
    expect(classes.size).to.equal(2);
    expect([...classes]).to.have.members(['baz', 'bar']);
    expect(tags.size).to.equal(1);
    expect([...tags]).to.have.members(['div']);
  });
}
