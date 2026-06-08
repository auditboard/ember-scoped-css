import { describe, expect, it } from 'vitest';

import { getContentInfo, rewrite } from './lightningcss.js';

describe('lightningcss getContentInfo', () => {
  it('extracts classes and tags, skipping :global contents', () => {
    const css = '.baz :global(.foo) .bar div :global(p) { color: red; }';
    const { classes, tags } = getContentInfo(css);

    expect([...classes].sort()).toEqual(['bar', 'baz']);
    expect([...tags]).toEqual(['div']);
  });
});

describe('lightningcss rewrite — selectors', () => {
  it('postfixes classes', () => {
    expect(rewrite('.foo { color: red; }', 'postfix')).toMatchInlineSnapshot(`
      ".foo__postfix {
        color: red;
      }"
    `);
  });

  it('rewrites tag to tag.postfix', () => {
    expect(rewrite('div { color: red; }', 'postfix')).toMatchInlineSnapshot(`
      "div.postfix {
        color: red;
      }"
    `);
  });

  it('handles nth-of-type', () => {
    expect(rewrite('li:nth-of-type(odd) { color: red; }', 'postfix'))
      .toMatchInlineSnapshot(`
      "li.postfix:nth-of-type(odd) {
        color: red;
      }"
    `);
  });

  it('unwraps :global and leaves its contents unscoped', () => {
    expect(rewrite('.baz :global(.foo) p { color: red; }', 'postfix'))
      .toMatchInlineSnapshot(`
      ".baz__postfix .foo p.postfix {
        color: red;
      }"
    `);
  });
});
