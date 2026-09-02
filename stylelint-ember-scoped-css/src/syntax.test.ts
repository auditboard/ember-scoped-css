import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import sharedConfig from './config.js';
import * as syntax from './syntax.js';

const component = `import Component from '@glimmer/component';

export default class Demo extends Component {
  <template>
    <div class="wrapper">hi</div>

    <style scoped>
      .wrapper {
        color: #fff;
      }
    </style>
  </template>
}
`;

async function lint(
  code: string,
  rules: stylelint.Config['rules'],
  fix = false,
) {
  return stylelint.lint({
    code,
    codeFilename: 'demo.gts',
    customSyntax: syntax,
    config: { rules },
    fix,
  });
}

describe('positions', () => {
  it('reports a warning at the line and column it occupies in the .gts', async () => {
    const { results } = await lint(component, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 9, column: 16, rule: 'color-no-hex' }),
    ]);
  });
});

describe('which blocks are exposed', () => {
  it('offsets the column when the CSS starts on the same line as the tag', async () => {
    const code = `<template>
  <style scoped>.a { color: #fff; }</style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 2, column: 29 }),
    ]);
  });

  it('ignores a <style> without the scoped attribute, which is global CSS', async () => {
    const code = `<template>
  <style>
    .global { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([]);
  });
});

describe('preprocessed blocks', () => {
  it('does not lint a <style scoped lang="scss"> block', async () => {
    const code = `<template>
  <style scoped lang="scss">
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([]);
  });

  it('does not fail the file when lang="sass" uses indented syntax postcss cannot parse', async () => {
    const code = `<template>
  <style scoped lang="sass">
    .a
      color: red
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([]);
  });
});

describe('malformed input', () => {
  it('does not abort the lint run when a template cannot be parsed', async () => {
    const code = `<template>
  <div>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([]);
  });

  it('still lints the other templates in a file with one bad template', async () => {
    const code = `export const Broken = <template><div></template>;

export const Fine = <template>
  <style scoped>
    .a { color: #fff; }
  </style>
</template>;
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 5, rule: 'color-no-hex' }),
    ]);
  });
});

describe('what counts as a style block', () => {
  it('ignores a style block written in a plain JS string outside any template', async () => {
    const code = `const SNIPPET = '<style scoped>.leaked { color: #fff }</style>';

export default class Demo {
  <template>
    {{SNIPPET}}
  </template>
}
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([]);
  });

  it('lints a block in every template in the file', async () => {
    const code = `export const One = <template>
  <style scoped>
    .a { color: #aaa; }
  </style>
</template>;

export const Two = <template>
  <style scoped>
    .b { color: #bbb; }
  </style>
</template>;
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings.map((w) => w.line)).toEqual([3, 9]);
  });

  it('keeps positions correct when multi-byte characters precede the template', async () => {
    // content-tag reports byte offsets. Enough non-ASCII ahead of the template
    // and the byte/char gap slices the <style> tag out of the window entirely.
    const code = `const GREETING = 'こんにちは、世界！ようこそ';

<template>
  <div>{{GREETING}}</div>
  <style scoped>
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 6, column: 17 }),
    ]);
  });
});

describe('--fix', () => {
  it('rewrites the CSS and leaves the surrounding component byte-for-byte', async () => {
    const { code } = await lint(
      component,
      { 'color-hex-length': 'long' },
      true,
    );

    expect(code).toBe(component.replace('#fff', '#ffffff'));
  });

  it('returns a component with no style blocks unchanged', async () => {
    const source = `import Component from '@glimmer/component';

export default class Demo extends Component {
  <template>
    <div class="wrapper">hi</div>
  </template>
}
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(source);
  });

  it('preserves a skipped lang block while fixing a plain block in the same file', async () => {
    const source = `<template>
  <style scoped lang="scss">
    .a
      color: #fff
  </style>
  <style scoped>
    .b { color: #fff; }
  </style>
</template>
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(
      source.replace('.b { color: #fff; }', '.b { color: #ffffff; }'),
    );
  });

  it('preserves the source between two fixed blocks', async () => {
    const source = `export const One = <template>
  <style scoped>
    .a { color: #aaa; }
  </style>
</template>;

export const Two = <template>
  <style scoped>
    .b { color: #bbb; }
  </style>
</template>;
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(
      source.replace('#aaa', '#aaaaaa').replace('#bbb', '#bbbbbb'),
    );
  });
});

describe('with the ember-scoped-css rules', () => {
  it('applies the shipped config to an inline <style scoped> block', async () => {
    const code = `import Component from '@glimmer/component';

export default class MetricStat extends Component {
  <template>
    <div class="stat">{{@value}}</div>

    <style scoped>
      .stat {
        color: red;
      }

      [class$='stat'] {
        font-weight: bold;
      }
    </style>
  </template>
}
`;

    const { results } = await stylelint.lint({
      code,
      codeFilename: 'demo.gts',
      customSyntax: syntax,
      config: sharedConfig,
    });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({
        line: 12,
        column: 7,
        rule: 'ember-scoped-css/no-unscopable-class-attribute-selectors',
      }),
    ]);
  });
});
