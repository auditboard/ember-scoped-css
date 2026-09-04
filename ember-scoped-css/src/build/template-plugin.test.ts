import * as babel from '@babel/core';
import { stripIndent } from 'common-tags';
import { Preprocessor } from 'content-tag';
import jscodeshift from 'jscodeshift';
import { describe, expect, it, vi } from 'vitest';

import { createPlugin } from './template-plugin.js';

const p = new Preprocessor();

async function transform(file: string, config = {}) {
  const { code: js } = p.process(file);
  const result = await babel.transformAsync(js, {
    plugins: [
      [
        'babel-plugin-ember-template-compilation',
        {
          targetFormat: 'hbs',
          transforms: [createPlugin(config)],
        },
      ],
    ],
    filename: 'src/components/example-component.gjs',
    babelrc: false,
    configFile: false,
  });

  return result?.code;
}

function virtualImportUrlsOf(file: string | null | undefined) {
  if (!file) return [];

  let j = jscodeshift;

  let result: string[] = [];

  j(file)
    .find(j.ImportDeclaration, {
      source: {
        value: (value: string) => value.includes('.ember-scoped.css?css='),
      },
    })
    .forEach((path) => {
      let source = path.node.source.value;

      if (typeof source === 'string') {
        result.push(source);
      }
    });

  return result;
}

function templateContentsOf(file: string | null | undefined) {
  if (!file) return [];

  let j = jscodeshift;

  let result: string[] = [];

  j(file)
    .find(j.CallExpression, { callee: { name: 'precompileTemplate' } })
    .forEach((path) => {
      let first = path.node.arguments[0];

      if (first?.type === 'StringLiteral' || first?.type === 'Literal') {
        if (typeof first.value === 'string') {
          result.push(stripIndent(first.value));
        }
      }
    });

  return result;
}

describe('no transformation needed', () => {
  describe('plain style tag', () => {
    it('vanilla', async () => {
      let output = await transform(`
        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style>
                .foo {
                    color: red;
                }
            </style>
        </template>;
    `);

      expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo">
        <h1>Hello, World!</h1>
    </div>
    <style>
        .foo {
            color: red;
        }
    </style>",
    ]
  `);
    });

    it('with @scope', async () => {
      let output = await transform(`
        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style>
                .foo {
                    color: red;
                }
            </style>
        </template>;
    `);

      expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo">
        <h1>Hello, World!</h1>
    </div>
    <style>
        .foo {
            color: red;
        }
    </style>",
    ]
  `);
    });
  });
});

it('scoped transforms correctly', async () => {
  let output = await transform(`
        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped>
                .foo {
                    color: red;
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
      [
        "<div class="foo_e65d154a1">
          <h1>Hello, World!</h1>
      </div>",
      ]
    `);
});

it('scoped with @scope transforms correctly', async () => {
  let output = await transform(`
        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                @scope {
                  .foo {
                      color: red;
                  }
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo_e65d154a1">
                    <h1>Hello, World!</h1>
                </div>
                <style scoped inline>/* src/components/example-component.css */

                    @scope {
                      .foo_e65d154a1 {
                          color: red;
                      }
                    }
    </style>",
    ]
  `);
});

it('scoped inline transforms correctly', async () => {
  let output = await transform(`
        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                .foo {
                    color: red;
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo_e65d154a1">
                    <h1>Hello, World!</h1>
                </div>
                <style scoped inline>/* src/components/example-component.css */

                    .foo_e65d154a1 {
                        color: red;
                    }
    </style>",
    ]
  `);
});

describe('lang attribute (SCSS preprocessor)', () => {
  it('scoped lang="scss" emits virtual import with lang param and rewrites classes', async () => {
    let output = await transform(`
      export const Foo = <template>
        <div class="foo">hi</div>
        <style scoped lang="scss">
          .foo {
            &:hover { color: blue; }
            color: red;
          }
        </style>
      </template>;
    `);

    // The style tag should be removed (it's a virtual module, not inline)
    expect(templateContentsOf(output)).toMatchInlineSnapshot(`
      [
        "<div class="foo_e65d154a1">hi</div>",
      ]
    `);

    // The virtual module import should include &lang=scss
    expect(virtualImportUrlsOf(output)).toMatchInlineSnapshot(`
      [
        "./e65d154a1___css-3fbbf8c13a5ef6f5c5395268df4e8f37.ember-scoped.css?css=%0A%20%20%20%20%20%20%20%20%20%20.foo%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%26%3Ahover%20%7B%20color%3A%20blue%3B%20%7D%0A%20%20%20%20%20%20%20%20%20%20%20%20color%3A%20red%3B%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&lang=scss",
      ]
    `);
  });

  it('scoped inline lang="scss" is downgraded to non-inline (warning emitted, style tag removed)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let output = await transform(`
      export const Foo = <template>
        <div class="foo">hi</div>
        <style scoped inline lang="scss">
          .foo {
            &:hover { color: blue; }
            color: red;
          }
        </style>
      </template>;
    `);

    // The style tag should be removed (downgraded to non-inline)
    expect(templateContentsOf(output)).toMatchInlineSnapshot(`
      [
        "<div class="foo_e65d154a1">hi</div>",
      ]
    `);

    // A virtual module import should have been emitted with lang=scss
    expect(virtualImportUrlsOf(output)).toMatchInlineSnapshot(`
      [
        "./e65d154a1___css-3fbbf8c13a5ef6f5c5395268df4e8f37.ember-scoped.css?css=%0A%20%20%20%20%20%20%20%20%20%20.foo%20%7B%0A%20%20%20%20%20%20%20%20%20%20%20%20%26%3Ahover%20%7B%20color%3A%20blue%3B%20%7D%0A%20%20%20%20%20%20%20%20%20%20%20%20color%3A%20red%3B%0A%20%20%20%20%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20%20%20&lang=scss",
      ]
    `);

    // A warning should have been logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '<style scoped inline lang="scss"> is not supported',
      ),
    );

    warnSpy.mockRestore();
  });

  it('handles scoped lang="scss" BEM constructs', async () => {
    let output = await transform(`
    export const Foo = <template>
      <div class="block block--modifier">hi</div>
      <style scoped lang="scss">
        .block {
          &--modifier { color: green; }
        }
      </style>
    </template>;
  `);

    expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="block_e65d154a1 block--modifier_e65d154a1">hi</div>",
    ]
  `);
  });

  it('handles deeply nested BEM constructs', async () => {
    let output = await transform(`
    export const Foo = <template>
      <div class="block block--modifier block--modifier--modifier block--modifier--modifier--modifier">hi</div>
      <style scoped lang="scss">
        .block {
          &--modifier {
            color: green;
            &--modifier {
              color: green;
              &--modifier {
                color: green;
              }
            }
          }
        }
      </style>
    </template>;
  `);

    expect(templateContentsOf(output)).toMatchInlineSnapshot(`
      [
        "<div class="block_e65d154a1 block--modifier_e65d154a1 block--modifier--modifier_e65d154a1 block--modifier--modifier--modifier_e65d154a1">hi</div>",
      ]
    `);
  });
});

/**
 * https://github.com/auditboard/ember-scoped-css/issues/423
 */
describe('a scoped <style> is found regardless of what precedes it', () => {
  it('extracts the scoped CSS when a global <style> comes first', async () => {
    let output = await transform(`
      export const Foo = <template>
        <div class="scoped">hi</div>
        <style>
          .global { color: red; }
        </style>
        <style scoped>
          .scoped { color: blue; }
        </style>
      </template>;
    `);

    expect(templateContentsOf(output)).toMatchInlineSnapshot(`
      [
        "<div class="scoped_e65d154a1">hi</div>
      <style>
        .global { color: red; }
      </style>",
      ]
    `);
    expect(virtualImportUrlsOf(output)).toMatchInlineSnapshot(`
      [
        "./e65d154a1___css-68ede36d709bfa7f8a2994e1702ef010.ember-scoped.css?css=%0A%20%20%20%20%20%20%20%20%20%20.scoped%20%7B%20color%3A%20blue%3B%20%7D%0A%20%20%20%20%20%20%20%20",
      ]
    `);
  });

  it('refuses a second <style scoped> rather than dropping its CSS', async () => {
    let build = transform(`
      export const Foo = <template>
        <div class="first second">hi</div>
        <style scoped>
          .first { color: blue; }
        </style>
        <style scoped>
          .second { color: green; }
        </style>
      </template>;
    `);

    await expect(build).rejects.toThrow(
      /Only one <style scoped> is supported per template, but 2 were found/,
    );
  });
});
