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
});
