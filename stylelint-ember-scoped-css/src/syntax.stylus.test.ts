import { describe, expect, it } from 'vitest';

import { lint } from './syntax.test-helpers.js';

describe('lang="styl" and lang="stylus"', () => {
  // postcss's own parser rejects this body, so a pass proves the dialect
  // parser ran.

  it('lints an indented <style scoped lang="stylus"> block', async () => {
    const code = `<template>
  <style scoped lang="stylus">
    .a
      color: #fff
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 4, column: 14, rule: 'color-no-hex' }),
    ]);
  });

  it('reads lang="styl" with the same parser as lang="stylus"', async () => {
    const code = `<template>
  <style scoped lang="styl">
    .a
      color: #fff
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 4, rule: 'color-no-hex' }),
    ]);
  });
});
