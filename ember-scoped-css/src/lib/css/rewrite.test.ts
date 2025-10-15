import { describe, expect, it } from 'vitest';

import { rewriteCss } from './rewrite.js';

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
    @layer components {


        li.postfix:nth-of-type(odd) {}
        li.postfix:nth-of-type(even) {}
      
    }
    "
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
      @layer components {


      @container (width > 400px) {
        h2.postfix {
          font-size: 1.5em;
        }
      }

      }
      "
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
      @layer components {


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
      }

      }
      "
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

      }
      "
    `);
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
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {


            @keyframes luna-view-navigation__postfix {
              100% {
                padding-top: 1rem;
              }
            }
          
      }
      "
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
    const rewritten = rewriteCss(css, postfix, fileName);

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
          
      }
      "
    `);
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
    const rewritten = rewriteCss(css, postfix, fileName);

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

      }
      "
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
    const rewritten = rewriteCss(css, postfix, fileName);

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

      }
      "
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
    const rewritten = rewriteCss(css, postfix, fileName);

    expect(rewritten).toMatchInlineSnapshot(`
      "/* foo.css */
      @layer components {


            @counter-style circled-alpha__postfix {
              system: fixed;
              symbols: Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ Ⓖ Ⓗ Ⓘ Ⓙ Ⓚ Ⓛ Ⓜ Ⓝ Ⓞ Ⓟ Ⓠ Ⓡ Ⓢ Ⓣ Ⓤ Ⓥ Ⓦ Ⓧ Ⓨ Ⓩ;
              suffix: " ";
            }
          
      }
      "
    `);
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
    const rewritten = rewriteCss(css, postfix, fileName);

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
          
      }
      "
    `);
  });
});
