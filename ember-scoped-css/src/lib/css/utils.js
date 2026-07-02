import { existsSync, readFileSync } from 'fs';
import postcss from 'postcss';
import scssSyntax from 'postcss-scss';
import parser from 'postcss-selector-parser';

import { md5 } from '../path/md5.js';
import { splitClassList } from '../renameClass.js';

/**
 * @param {string} css
 * @return {string} hashed down version of the CSS for disambiguating
 */
export function hash(css) {
  return `css-${md5(css)}`;
}

/**
 * Attribute selectors are scoped with one of two strategies:
 *
 * - **renamed value**: class-targeting selectors whose value names real
 *   class(es) (`[class="foo"]`, `[class~="foo"]`) are scoped by renaming the
 *   value the same way `.foo` is renamed to `.foo_postfix`. The renamed token
 *   is unique per file, so nothing else is needed.
 * - **postfix class**: every other attribute selector keeps its discriminator
 *   and is scoped by the generated postfix class — appended to the selector
 *   in the CSS and added to matching elements in the template (the same
 *   strategy bare tag selectors use: `div` becomes `div.postfix`).
 *
 * This predicate decides between the two. It is shared by the CSS rewrite
 * (which renames the selector value) and by discovery in this file (which
 * registers the value's class names for template renaming) so both sides
 * always classify a selector the same way.
 *
 * @param {import('postcss-selector-parser').Attribute} node
 * @returns {boolean}
 */
export function isRenamedClassAttribute(node) {
  return (
    node.attribute === 'class' &&
    (node.operator === '=' || node.operator === '~=') &&
    Boolean(node.value)
  );
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
 * @param {string} [lang] optional language hint (e.g. 'scss', 'sass', 'less')
 * @return {{ classes: Set<string>, tags: Set<string>, attributes: Set<string>, css: string, id: string }}
 */
export function getCSSContentInfo(css, lang) {
  const classes = new Set();
  const tags = new Set();
  const attributes = new Set();

  const parseOptions =
    lang === 'scss' || lang === 'sass' ? { syntax: scssSyntax } : {};

  const ast = postcss.parse(css, parseOptions);

  const isScss = lang === 'scss' || lang === 'sass';

  ast.walk((node) => {
    if (node.type === 'rule') {
      const selector = isScss ? resolveNestedSassSelector(node) : node.selector;

      collectSelectorInfo(selector, classes, tags, attributes);
    }
  });

  let id = hash(css);

  return { classes, tags, attributes, css, id };
}

/**
 * Resolves a nested SCSS selector by substituting `&` with the fully-resolved
 * parent selector, recursively. This converts e.g. `&--modifier` (child of
 * `.block`) into `.block--modifier`, and handles arbitrary nesting depth so
 * that `&--modifier` inside `&--modifier` inside `.block` yields
 * `.block--modifier--modifier`.
 *
 * @param {import('postcss').Rule} node
 * @return {string}
 */
function resolveNestedSassSelector(node) {
  const { selector } = node;

  if (!selector.includes('&')) {
    return selector;
  }

  const parent = node.parent;

  if (!parent || parent.type !== 'rule') {
    // No parent rule — `&` has nothing to substitute, return as-is
    return selector;
  }

  // Recursively resolve the parent first, then substitute into this selector
  const resolvedParent = resolveNestedSassSelector(parent);

  return selector.replace(/&/g, resolvedParent);
}

function collectSelectorInfo(sel, classes, tags, attributes) {
  const transform = (sls) => {
    sls.walk((selector) => {
      if (isInsideGlobal(selector)) return;

      if (selector.type === 'class') {
        classes.add(selector.value);
      } else if (selector.type === 'tag') {
        tags.add(selector.value);
      } else if (selector.type === 'attribute') {
        if (isRenamedClassAttribute(selector)) {
          // Register the value's class names so the template renames them.
          //
          // postcss-selector-parser exposes the attribute value only as an
          // opaque string, so splitting `[class="foo bar"]` into its
          // space-separated class names is on us — `splitClassList` is the
          // same tokenization `renameClass` applies.
          for (let token of splitClassList(selector.value)) {
            classes.add(token);
          }
        } else {
          // Elements carrying this attribute get the postfix class. For
          // class-target operators (^=, *=, $=, |=) and presence, the name
          // is `class`.
          //
          // CSS matches HTML attribute names case-insensitively, so store the
          // name lowercased and compare against lowercased template attribute
          // names. (Coarser than SVG's case-sensitive matching, but the two
          // sides always agree; worst case an element gets the postfix class
          // it didn't strictly need.)
          attributes.add(selector.attribute.toLowerCase());
        }
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

  it('collects attribute names for postfix-class scoping', function () {
    const css = '[disabled] [data-x="y"] { color: red; }';
    const { attributes } = getCSSContentInfo(css);

    expect(attributes).to.deep.equal(new Set(['disabled', 'data-x']));
  });

  it('treats =/~= class attribute values as renamed classes', function () {
    const css = '[class="foo bar"] [class~="baz"] { color: red; }';
    const { classes, attributes } = getCSSContentInfo(css);

    expect(classes).to.deep.equal(new Set(['foo', 'bar', 'baz']));
    expect(attributes).to.deep.equal(new Set());
  });

  it('treats other class attribute operators as postfix-class attributes', function () {
    const css = '[class^="foo"] [class*="bar"] { color: red; }';
    const { classes, attributes } = getCSSContentInfo(css);

    expect(classes).to.deep.equal(new Set());
    expect(attributes).to.deep.equal(new Set(['class']));
  });

  it('lowercases attribute names (CSS matches them case-insensitively)', function () {
    const css = '[TYPE="submit"] { color: red; }';
    const { attributes } = getCSSContentInfo(css);

    expect(attributes).to.deep.equal(new Set(['type']));
  });

  it('ignores attribute selectors inside :global', function () {
    const css = ':global([data-x]) [data-y] { color: red; }';
    const { attributes } = getCSSContentInfo(css);

    expect(attributes).to.deep.equal(new Set(['data-y']));
  });

  it('should parse SCSS nesting syntax without crashing when lang=scss', function () {
    const scss = `
      $base-color: #c6538c;
      $border-dark: rgba($base-color, 0.88);

      .parent {
        &:hover { color: $base-color; }
        .child { border: 1px solid $border-dark; }
        color: red;
      }
    `;
    const { classes } = getCSSContentInfo(scss, 'scss');

    expect([...classes]).toMatchInlineSnapshot(`
      [
        "parent",
        "child",
      ]
    `);
  });

  it('should parse SCSS nesting syntax without crashing when lang=sass', function () {
    const scss = `
      $base-color: green;
      .block {
        &--modifier { color: $base-color; }
      }
    `;
    const { classes } = getCSSContentInfo(scss, 'sass');

    expect([...classes]).toMatchInlineSnapshot(`
      [
        "block",
        "block--modifier",
      ]
    `);
  });

  it('should parse SCSS deeply nested BEM when lang=sass', function () {
    const scss = `
      $base-color: green;
      .block {
        &--modifier {
          color: $base-color;
          &--modifier {
            color: $base-color;
            &--modifier {
              color: $base-color;
            }
          }
        }
      }
    `;
    const { classes } = getCSSContentInfo(scss, 'sass');

    expect([...classes]).toMatchInlineSnapshot(`
      [
        "block",
        "block--modifier",
        "block--modifier--modifier",
        "block--modifier--modifier--modifier",
      ]
    `);
  });
}
