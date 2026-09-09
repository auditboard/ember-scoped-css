import stylelint from 'stylelint';
import { describe, expect, it, vi } from 'vitest';

import * as syntax from './syntax.js';

vi.mock('./parsers.js', async (importOriginal) => {
  const parsers = await importOriginal<typeof import('./parsers.js')>();

  return {
    ...parsers,
    loadParser: (lang: string) =>
      lang === 'less' ? null : parsers.loadParser(lang),
  };
});

async function lint(code: string) {
  return stylelint.lint({
    code,
    codeFilename: 'demo.gts',
    customSyntax: syntax,
    config: { rules: { 'color-no-hex': true } },
  });
}

describe('a dialect whose parser is not installed', () => {
  it('reports the package to install at the <style> tag', async () => {
    const code = `<template>
  <div>x</div>
  <style scoped lang="less">
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code);

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({
        line: 3,
        rule: 'CssSyntaxError',
        text: expect.stringContaining('npm add -D postcss-less'),
      }),
    ]);
  });

  it('still lints the other dialects', async () => {
    const code = `<template>
  <style scoped lang="scss">
    // brand
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(code);

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 4, rule: 'color-no-hex' }),
    ]);
  });
});
