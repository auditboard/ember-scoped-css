import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import * as syntax from './syntax.js';
import { component, lint } from './syntax.test-helpers.js';

describe('positions', () => {
  it('reports a warning at the line and column it occupies in the .gts', async () => {
    const { results } = await lint(component, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 9, column: 16, rule: 'color-no-hex' }),
    ]);
  });
});

describe('fix offsets', () => {
  it('reports a fix range that indexes the whole .gts, not the block', async () => {
    const { results } = await stylelint.lint({
      code: component,
      codeFilename: 'demo.gts',
      customSyntax: syntax,
      computeEditInfo: true,
      config: { rules: { 'color-hex-length': 'long' } },
    });

    const { fix } = results[0]!.warnings[0]!;
    const [start, end] = fix!.range;
    const applied =
      component.slice(0, start) + fix!.text + component.slice(end);

    // What an editor's "fix this problem" action produces must match --fix.
    expect(applied).toBe(component.replace('#fff', '#ffffff'));
  });

  it('produces the corrected component when an editor applies the range', async () => {
    const { results } = await stylelint.lint({
      code: component,
      codeFilename: 'demo.gts',
      customSyntax: syntax,
      computeEditInfo: true,
      config: { rules: { 'color-hex-length': 'long' } },
    });

    const fix = results[0]?.warnings[0]?.fix;
    const [start, end] = fix?.range ?? [0, 0];
    const applied =
      component.slice(0, start) + (fix?.text ?? '') + component.slice(end);

    // An LSP "fix this problem" action must land on the hex and nowhere else.
    expect(applied).toBe(component.replace('#fff', '#ffffff'));
  });
});

describe('CSS syntax errors', () => {
  it('reports the error at the line it occupies in the .gts', async () => {
    const code = `<template>
  <div>x</div>

  <style scoped>
    @media (min-width: 1px) {
      .a { color: red; }
  </style>
</template>
`;

    const { results } = await lint(code, { 'color-no-hex': true });
    const [warning] = results[0]!.warnings;

    expect(warning).toEqual(
      expect.objectContaining({
        line: 5,
        text: expect.stringContaining('Unclosed'),
      }),
    );
  });
});

describe('byte order mark', () => {
  it('lints a component saved with a UTF-8 BOM', async () => {
    const body = `<template>
  <style scoped>
    .a { color: #fff; }
  </style>
</template>
`;

    const { results } = await lint(`\uFEFF${body}`, { 'color-no-hex': true });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 3, rule: 'color-no-hex' }),
    ]);
  });

  it('lints a BOM component whose template ends without trailing space', async () => {
    // The window ends on the `>` of </style>, so a window one short drops the
    // block with no error. The fixtures above end in whitespace and cannot
    // catch that.
    const code =
      '\uFEFF<template><style scoped>.a{color:#fff}</style></template>\n';

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 1, column: 34, rule: 'color-no-hex' }),
    ]);
  });

  it('drops the BOM under --fix', async () => {
    const body = `<template>
  <style scoped>
    .a { color: #fff; }
  </style>
</template>
`;

    const { code } = await lint(
      `\uFEFF${body}`,
      { 'color-hex-length': 'long' },
      true,
    );

    expect(code).toBe(body.replace('#fff', '#ffffff'));
  });
});

describe('block input', () => {
  it('gives a block an input that its own offsets index into', () => {
    const doc = syntax.parse(component);
    const root = doc.nodes[0];
    const rule = root?.first;
    const decl = rule?.type === 'rule' ? rule.first : undefined;

    const input = root?.source?.input.css ?? '';
    const start = decl?.source?.start?.offset ?? 0;
    const end = decl?.source?.end?.offset ?? 0;

    // postcss slices the input by these absolute offsets to find a `word`, so
    // a block-only input gives the wrong position.
    expect(input.slice(start, end)).toBe('color: #fff;');
  });
});

describe('document source', () => {
  it('sets source on a component with no style blocks', () => {
    const source = '<template>\n  <div>hi</div>\n</template>\n';

    const doc = syntax.parse(source);

    expect(doc.source?.input.css).toBe(source);
  });
});
