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

describe('lightningcss rewrite — @position-try', () => {
  it('renames @position-try and position-try-fallbacks references', () => {
    const css = `
      @position-try --custom-left { position-area: left; width: 100px; }
      .infobox { position-try-fallbacks: --custom-left; }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "@position-try --custom-left__postfix {
        position-area: left; width: 100px;
      }

      .infobox_postfix {
        position-try-fallbacks: --custom-left__postfix;
      }"
    `);
  });
});

describe('lightningcss rewrite — @property', () => {
  it('renames @property and var() references but leaves plain custom props', () => {
    const css = `
      @property --item-size { syntax: "<percentage>"; inherits: true; initial-value: 40%; }
      .container { --item-size: 20%; --item-color: orange; }
      .item { width: var(--item-size); background-color: var(--item-color); }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "@property --item-size__postfix {
        syntax: "<percentage>";
        inherits: true;
        initial-value: 40%;
      }

      .container_postfix {
        --item-size__postfix: 20%;
        --item-color: orange;
      }

      .item_postfix {
        width: var(--item-size__postfix);
        background-color: var(--item-color);
      }"
    `);
  });
});

describe('lightningcss rewrite — at-rule pass-through', () => {
  it('scopes selectors inside @container/@media but not conditions', () => {
    const css = `
      @container (width > 400px) { h2 { font-size: 1.5em; } }
      @media (min-width: 500px) { .box { color: red; } }
    `;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "@container (width > 400px) {
        h2.postfix {
          font-size: 1.5em;
        }
      }

      @media (width >= 500px) {
        .box_postfix {
          color: red;
        }
      }"
    `);
  });

  it('leaves @supports feature checks untouched', () => {
    const css = `@supports (transform-origin: 5% 5%) { .a { color: red } }`;

    expect(rewrite(css, 'postfix')).toMatchInlineSnapshot(`
      "@supports (transform-origin: 5% 5%) {
        .a_postfix {
          color: red;
        }
      }"
    `);
  });
});
