import { describe, expect, it } from 'vitest';

import { lint } from './syntax.test-helpers.js';

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
    // content-tag reports byte offsets, so enough non-ASCII before the template
    // would slice the <style> tag out of the window.
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

describe('lang attributes the build treats as plain CSS', () => {
  it.each([
    ['an empty lang value', '<style scoped lang="">'],
    ['a bare lang attribute', '<style scoped lang>'],
    ['lang="css"', '<style scoped lang="css">'],
  ])('lints a block with %s', async (_name, tag) => {
    // getLangAttribute returns `value.chars || null`, and `lang="css"` names
    // no preprocessor, so the build parses all of these as plain CSS.
    const code = `<template>
  ${tag}
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 3, rule: 'color-no-hex' }),
    ]);
  });
});

describe('interpolated blocks', () => {
  const interpolated = `<template>
  <style scoped inline>
    .a { color: {{this.color}}; }
    .b { color: #fff; }
  </style>
</template>
`;

  it('does not report a CSS error for a block containing a mustache', async () => {
    // <style scoped inline> supports interpolation, so this source is valid.
    const { results } = await lint(interpolated, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([]);
  });

  it('leaves an interpolated block untouched under --fix', async () => {
    const { code } = await lint(
      interpolated,
      { 'color-hex-length': 'long' },
      true,
    );

    expect(code).toBe(interpolated);
  });

  it('still lints a plain block alongside an interpolated one', async () => {
    const code = `<template>
  <style scoped inline>
    .a { color: {{this.color}}; }
  </style>
  <style scoped>
    .b { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 6, rule: 'color-no-hex' }),
    ]);
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
