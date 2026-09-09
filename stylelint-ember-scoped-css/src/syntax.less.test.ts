import { describe, expect, it } from 'vitest';

import { lint } from './syntax.test-helpers.js';

describe('lang="less"', () => {
  it('lints a <style scoped lang="less"> block', async () => {
    const code = `<template>
  <style scoped lang="less">
    .a { color: #fff; .mixin(); }
    .mixin() { padding: 0; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 3, column: 17, rule: 'color-no-hex' }),
    ]);
  });
});
