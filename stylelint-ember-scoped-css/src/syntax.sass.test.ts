import { describe, expect, it } from 'vitest';

import { lint } from './syntax.test-helpers.js';

describe('lang="sass"', () => {
  it('lints an indented <style scoped lang="sass"> block', async () => {
    const code = `<template>
  <style scoped lang="sass">
    $brand: #fff
    .a
      color: $brand
      background: #fff
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 3, column: 13, rule: 'color-no-hex' }),
      expect.objectContaining({ line: 6, column: 19, rule: 'color-no-hex' }),
    ]);
  });

  it('reads modern indented Sass constructs', async () => {
    const code = `<template>
  <style scoped lang="sass">
    // brand
    @mixin big
      font-size: 2em
    %ph
      color: red
    .a
      @include big
      @extend %ph
      &:hover
        color: #fff
    @media (min-width: 1px)
      .b
        color: #fff
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 12, rule: 'color-no-hex' }),
      expect.objectContaining({ line: 15, rule: 'color-no-hex' }),
    ]);
  });

  it('fixes a sass block and a plain block in the same file', async () => {
    const source = `<template>
  <style scoped lang="sass">
    .a
      color: #fff

      .b
        color: #fff
  </style>
  <style scoped>
    .b { color: #fff; }
  </style>
</template>
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(source.replaceAll('#fff', '#ffffff'));
  });
});

describe('indented sass edge cases', () => {
  it('round-trips blank lines with trailing whitespace and CRLF under --fix', async () => {
    const source =
      '<template>\r\n  <style scoped lang="sass">\r\n    .a\r\n      color: #fff\r\n      \r\n    .b\r\n      color: red\r\n  </style>\r\n</template>\r\n';

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(source.replace('#fff', '#ffffff'));
  });

  it('reads a block whose first line shares the tag line', async () => {
    const code = `<template>
  <style scoped lang="sass">.a
      color: #fff
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 3, column: 14, rule: 'color-no-hex' }),
    ]);
  });

  it('reports the =mixin and +include shorthand as a syntax error', async () => {
    const code = `<template>
  <style scoped lang="sass">
    =big
      font-size: 2em
    .a
      +big
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({
        line: 3,
        rule: 'CssSyntaxError',
        text: expect.stringContaining('@mixin'),
      }),
    ]);
  });

  it('reports a line indented less than the first line at its .gts line', async () => {
    const code = `<template>
  <style scoped lang="sass">
    .a
      color: red
  .b
      color: blue
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 5, rule: 'CssSyntaxError' }),
    ]);
  });

  it('reports a sugarss error at its .gts line and column', async () => {
    const code = `<template>
  <style scoped lang="sass">
    .a
      color: red
     .b
      color: blue
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 5, column: 6, rule: 'CssSyntaxError' }),
    ]);
  });
});
