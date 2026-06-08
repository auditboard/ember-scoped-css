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
      ".foo_postfix {
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
        ".baz_postfix .foo p.postfix {
          color: red;
        }"
      `);
  });
});

describe('lightningcss rewrite — @counter-style', () => {
  it('renames counter-style and list-style references', () => {
    const css = `
      @counter-style thumbs { system: cyclic; symbols: "A"; suffix: " "; }
      .items { list-style: thumbs; }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "@counter-style thumbs__postfix {
        system: cyclic;
        symbols: "A";
        suffix: " ";
      }

      .items_postfix {
        list-style: thumbs__postfix;
      }"
    `);
  });
});

describe('lightningcss rewrite — @keyframes', () => {
  it('renames keyframes and animation-name references', () => {
    const css = `
      p { animation-duration: 3s; animation-name: slide-in; }
      @keyframes slide-in { from { opacity: 0 } to { opacity: 1 } }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "p.postfix {
        animation-name: slide-in__postfix;
        animation-duration: 3s;
      }

      @keyframes slide-in__postfix {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }"
    `);
  });

  it('renames keyframes referenced in the animation shorthand', () => {
    const css = `
      div { animation: mymove 5s infinite; }
      @keyframes mymove { from { top: 0 } to { top: 200px } }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "div.postfix {
        animation: 5s infinite mymove__postfix;
      }

      @keyframes mymove__postfix {
        from {
          top: 0;
        }

        to {
          top: 200px;
        }
      }"
    `);
  });
});
