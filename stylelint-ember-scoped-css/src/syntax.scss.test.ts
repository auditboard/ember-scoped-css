import { describe, expect, it } from 'vitest';

import { lint } from './syntax.test-helpers.js';

describe('lang="scss"', () => {
  // postcss's own parser rejects this body, so a pass proves the dialect
  // parser ran.

  it('reads scss the default parser would report an error on', async () => {
    // postcss's own parser folds a `//` comment into the next selector, so only
    // the scss parser keeps this clean.
    const code = `<template>
  <style scoped lang="scss">
    // the brand colour
    $brand: #fff;
    .a { color: $brand; &:hover { color: red } }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 4, column: 13, rule: 'color-no-hex' }),
    ]);
  });

  it('matches lang case-insensitively', async () => {
    const code = `<template>
  <style scoped lang="SCSS">
    // brand
    $brand: #fff;
    .a { color: $brand; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 4, rule: 'color-no-hex' }),
    ]);
  });

  it('fixes a scss block and a plain block in the same file', async () => {
    const source = `<template>
  <style scoped lang="scss">
    // brand
    .a { color: #fff; }
  </style>
  <style scoped>
    .b { color: #fff; }
  </style>
</template>
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    // The `//` comment survives only if this block is written back out by the
    // scss stringifier rather than postcss's.
    expect(code).toBe(source.replaceAll('#fff;', '#ffffff;'));
  });
});
