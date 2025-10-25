import * as babel from '@babel/core';
import { stripIndent } from 'common-tags';
import { Preprocessor } from 'content-tag';
import jscodeshift from 'jscodeshift';
import { expect, it } from 'vitest';

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
    </div>
    <style>
        .foo {
            color: red;
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
                <style>/* src/components/example-component.css */
    @layer components {


                    .foo_e65d154a1 {
                        color: red;
                    }
                
    }
    </style>",
    ]
  `);
});

it('scoped inline (with stache) transforms correctly', async () => {
  let output = await transform(`
        const red = 'red';

        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                .foo {
                    color: {{red}};
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo_e65d154a1">
                    <h1>Hello, World!</h1>
                </div>
                <style>/* src/components/example-component.css */
    @layer components {


                    .foo_e65d154a1 {
                        color: {{red}};
                    }
                
    }
    </style>",
    ]
  `);
});

it('scoped inline with stache and units', async () => {
  let output = await transform(`
        const red = '12';

        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                .foo {
                    border: {{red}}px;
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo_e65d154a1">
                    <h1>Hello, World!</h1>
                </div>
                <style>/* src/components/example-component.css */
    @layer components {


                    .foo_e65d154a1 {
                        border: {{red}}px;
                    }
                
    }
    </style>",
    ]
  `);
});

it('scoped inline with complex stache', async () => {
  let output = await transform(`
        const red = '12';
        const defaultValue = '1rem';
        const concat = (...args) => args.join('');

        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                .foo {
                    border: calc(1dvw * {{if condition
                                             (concat red "px")
                                             defaultValue}}
                                 );
                }
            </style>
        </template>;
    `);

  expect(templateContentsOf(output)).toMatchInlineSnapshot(`
    [
      "<div class="foo_e65d154a1">
                    <h1>Hello, World!</h1>
                </div>
                <style>/* src/components/example-component.css */
    @layer components {


                    .foo_e65d154a1 {
                        border: calc(1dvw * {{if condition (concat red "px") defaultValue}}
                                     );
                    }
                
    }
    </style>",
    ]
  `);
});

it('scoped inline with complex stache (references retained)', async () => {
  let output = await transform(`
        const red = '12';
        const defaultValue = '1rem';
        const concat = (...args) => args.join('');

        export const Foo = <template>
            <div class="foo">
                <h1>Hello, World!</h1>
            </div>
            <style scoped inline>
                .foo {
                    border: calc(1dvw * {{if condition
                                             (concat red "px")
                                             defaultValue}}
                                 );
                }
            </style>
        </template>;
    `);

  expect(output).toMatchInlineSnapshot(`
    "import { precompileTemplate } from "@ember/template-compilation";
    import { setComponentTemplate } from "@ember/component";
    import templateOnly from "@ember/component/template-only";
    const red = '12';
    const defaultValue = '1rem';
    const concat = (...args) => args.join('');
    export const Foo = setComponentTemplate(precompileTemplate("\\n            <div class=\\"foo_e65d154a1\\">\\n                <h1>Hello, World!</h1>\\n            </div>\\n            <style>/* src/components/example-component.css */\\n@layer components {\\n\\n\\n                .foo_e65d154a1 {\\n                    border: calc(1dvw * {{if condition (concat red \\"px\\") defaultValue}}\\n                                 );\\n                }\\n            \\n}\\n</style>\\n        ", {
      strictMode: true
    }), templateOnly());"
  `);
});
