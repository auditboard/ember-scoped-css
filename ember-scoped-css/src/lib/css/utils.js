import { existsSync, readFileSync } from 'fs';

import { getContentInfo } from './lightningcss.js';
import { compileToCss } from './preprocess.js';

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
 * @param {string} [lang] optional language hint (e.g. 'scss', 'sass')
 * @param {string} [fromFile] absolute path of the file containing the CSS,
 *   used to resolve relative `@use`/`@import` during compilation
 * @return {{ classes: Set<string>, tags: Set<string>, css: string, id: string }}
 */
export function getCSSContentInfo(css, lang, fromFile) {
  if (lang && lang !== 'css') {
    css = compileToCss(css, lang, fromFile);
  }

  return getContentInfo(css);
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

  it('should parse indented syntax when lang=sass', function () {
    const sassSource = [
      '$base-color: green',
      '.block',
      '  color: $base-color',
      '  &--modifier',
      '    color: red',
    ].join('\n');
    const { classes } = getCSSContentInfo(sassSource, 'sass');

    expect([...classes]).toMatchInlineSnapshot(`
      [
        "block",
        "block--modifier",
      ]
    `);
  });

  it('should parse deeply nested BEM when lang=sass', function () {
    const sassSource = [
      '$base-color: green',
      '.block',
      '  color: $base-color',
      '  &--modifier',
      '    color: $base-color',
      '    &--modifier',
      '      color: $base-color',
      '      &--modifier',
      '        color: $base-color',
    ].join('\n');
    const { classes } = getCSSContentInfo(sassSource, 'sass');

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
