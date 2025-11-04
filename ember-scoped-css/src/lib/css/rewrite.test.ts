import { describe, expect, it } from 'vitest';

import { rewriteCss } from './rewrite.js';

it('should rewrite css', function () {
  const css = '.foo { color: red; }';
  const postfix = 'postfix';
  const fileName = 'foo.css';
  const rewritten = rewriteCss(css, postfix, fileName);

  expect(rewritten).to.equal(`/* foo.css */\n.foo_postfix { color: red; }`);
});

it('should use a custom layer', function () {
  const css = '.foo { color: red; }';
  const postfix = 'postfix';
  const fileName = 'foo.css';
  const rewritten = rewriteCss(css, postfix, fileName, 'utils');

  expect(rewritten).toMatchInlineSnapshot(`
    "/* foo.css */
    @layer utils {
    .foo_postfix { color: red; }
    }"
  `);
});

it(`understands nth-of-type syntax`, function () {
  const css = `
    li:nth-of-type(odd) {}
    li:nth-of-type(even) {}
  `;

  const postfix = 'postfix';
  const fileName = 'foo.css';
  const rewritten = rewriteCss(css, postfix, fileName);

  expect(rewritten).toMatchInlineSnapshot(`
    "/* foo.css */

        li.postfix:nth-of-type(odd) {}
        li.postfix:nth-of-type(even) {}"
  `);
});

describe('@container', () => {
  it('works', () => {
    const css = `
@container (width > 400px) {
  h2 {
    font-size: 1.5em;
  }
}
`;
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */

      @container (width > 400px) {
        h2.postfix {
          font-size: 1.5em;
        }
      }"
    `);
  });

  it('handles parameters', () => {
    const css = `
/* With an optional <container-name> */
@container tall (height > 30rem) {
  p {
    line-height: 1.6;
  }
}

/* With a <scroll-state> */
@container scroll-state(scrollable: top) {
  .back-to-top-link {
    visibility: visible;
  }
}

/* With a <container-name> and a <scroll-state> */
@container sticky-heading scroll-state(stuck: top) {
  h2 {
    background: purple;
    color: white;
  }
}
`;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */

      /* With an optional <container-name> */
      @container tall (height > 30rem) {
        p.postfix {
          line-height: 1.6;
        }
      }

      /* With a <scroll-state> */
      @container scroll-state(scrollable: top) {
        .back-to-top-link_postfix {
          visibility: visible;
        }
      }

      /* With a <container-name> and a <scroll-state> */
      @container sticky-heading scroll-state(stuck: top) {
        h2.postfix {
          background: purple;
          color: white;
        }
      }"
    `);
  });
});

describe('@media', () => {
  it('works', () => {
    const css = `
@media (height >= 680px), screen and (orientation: portrait) {
  .foo { color: red; }
}
`;
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'utils');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer utils {

      @media (height >= 680px), screen and (orientation: portrait) {
        .foo_postfix { color: red; }
      }
      }"`);
  });
});

describe('@keyframe', () => {
  it(`rewrites`, function () {
    const css = `
      @keyframes luna-view-navigation {
        100% {
          padding-top: 1rem;
        }
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {

            @keyframes luna-view-navigation__postfix {
              100% {
                padding-top: 1rem;
              }
            }
}"
    `);
  });

  it(`references are also scoped`, function () {
    const css = `
      p {
        animation-duration: 3s;
        animation-name: slide-in;
      }

      @keyframes slide-in {
        from {
          translate: 150vw 0;
          scale: 200% 1;
        }

        to {
          translate: 0 0;
          scale: 100% 1;
        }
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

            p.postfix {
              animation-duration: 3s;
              animation-name: slide-in__postfix;
            }

            @keyframes slide-in__postfix {
              from {
                translate: 150vw 0;
                scale: 200% 1;
              }

              to {
                translate: 0 0;
                scale: 100% 1;
              }
            }
}"`);
  });

  it('handles multiple references and keyframes', () => {
    const css = `
      p {
        animation-duration: 3s;
        animation-name: slide-in;
      }
      p.hello {
        animation-duration: 5s;
        animation-name: slide-in;
      }
      p span {
        display: inline-block;
        animation-duration: 3s;
        animation-name: grow-shrink;
      }

      @keyframes slide-in {
        from {
          translate: 150vw 0;
          scale: 200% 1;
        }

        to {
          translate: 0 0;
          scale: 100% 1;
        }
      }

      @keyframes grow-shrink {
        25%,
        75% {
          scale: 100%;
        }

        50% {
          scale: 200%;
          color: magenta;
        }
      }
      `;
    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {

            p.postfix {
              animation-duration: 3s;
              animation-name: slide-in__postfix;
            }
            p.postfix.hello_postfix {
              animation-duration: 5s;
              animation-name: slide-in__postfix;
            }
            p.postfix span.postfix {
              display: inline-block;
              animation-duration: 3s;
              animation-name: grow-shrink__postfix;
            }

            @keyframes slide-in__postfix {
              from {
                translate: 150vw 0;
                scale: 200% 1;
              }

              to {
                translate: 0 0;
                scale: 100% 1;
              }
            }

            @keyframes grow-shrink__postfix {
              25%,
              75% {
                scale: 100%;
              }

              50% {
                scale: 200%;
                color: magenta;
              }
            }
      }"
    `);
  });

  it('works in shorthand combo-declarations', () => {
    const css = `
      div {
        width: 100px;
        height: 100px;
        background: red;
        position: relative;
        animation: mymove 5s infinite;
      }

      @keyframes mymove {
        from {top: 0px;}
        to {top: 200px;}
      }
      `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {

            div.postfix {
              width: 100px;
              height: 100px;
              background: red;
              position: relative;
              animation: mymove__postfix 5s infinite;
            }

            @keyframes mymove__postfix {
              from {top: 0px;}
              to {top: 200px;}
            }
      }"
`);
  });
});

describe('@counter-style', () => {
  it('rewrites', () => {
    const css = `
      @counter-style circled-alpha {
        system: fixed;
        symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ;
        suffix: " ";
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {

            @counter-style circled-alpha__postfix {
              system: fixed;
              symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ;
              suffix: " ";
            }
}"`);
  });

  it('updates references', () => {
    const css = `
      @counter-style circled-alpha {
        system: fixed;
        symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ;
        suffix: " ";
      }

      .items {
        list-style: circled-alpha;
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

              @counter-style circled-alpha__postfix {
                system: fixed;
                symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ;
                suffix: " ";
              }

              .items_postfix {
                list-style: circled-alpha__postfix;
              }
}"`);
  });
});

describe('@position-try', () => {
  it('rewrites', () => {
    const css = `
      @position-try --custom-left {
        position-area: left;
        width: 100px;
        margin-right: 10px;
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

            @position-try --custom-left__postfix {
              position-area: left;
              width: 100px;
              margin-right: 10px;
            }
}"`);
  });

  it('updates references', () => {
    const css = `
      @position-try --custom-left {
        position-area: left;
        width: 100px;
        margin-right: 10px;
      }

      .infobox {
        position-try-fallbacks:
          --custom-left;
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

              @position-try --custom-left__postfix {
                position-area: left;
                width: 100px;
                margin-right: 10px;
              }

              .infobox_postfix {
                position-try-fallbacks:
                  --custom-left__postfix;
              }
}"`);
  });
});

describe('@property', () => {
  it('rewrites', () => {
    const css = `
      @property --item-size {
        syntax: "<percentage>";
        inherits: true;
        initial-value: 40%;
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

            @property --item-size__postfix {
              syntax: "<percentage>";
              inherits: true;
              initial-value: 40%;
            }
}"`);
  });

  it('updates references', () => {
    const css = `
      @property --item-size {
        syntax: "<percentage>";
        inherits: true;
        initial-value: 40%;
      }

      .container {
        display: flex;
        height: 200px;
        border: 1px dashed black;

        /* set custom property values on parent */
        --item-size: 20%;
        --item-color: orange;
      }

      /* use custom properties to set item size and background color */
      .item {
        width: var(--item-size);
        height: var(--item-size);
        background-color: var(--item-color);
      }
    `;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
@layer components {

            @property --item-size__postfix {
              syntax: "<percentage>";
              inherits: true;
              initial-value: 40%;
            }

            .container_postfix {
              display: flex;
              height: 200px;
              border: 1px dashed black;

              /* set custom property values on parent */
              --item-size: 20%;
              --item-color: orange;
            }

            /* use custom properties to set item size and background color */
            .item_postfix {
              width: var(--item-size__postfix);
              height: var(--item-size__postfix);
              background-color: var(--item-color);
            }
}"`);
  });
});

describe('@supports', () => {
  it('does nothing for feature checking', () => {
    const css = `
    @supports (transform-origin: 5% 5%) {}
    @supports selector(h2 > p) {}
`;

    const postfix = 'postfix';
    const fileName = 'foo.css';
    const rewritten = rewriteCss(css, postfix, fileName, 'components');

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {

          @supports (transform-origin: 5% 5%) {}
          @supports selector(h2 > p) {}
      }"`);
  });
});
