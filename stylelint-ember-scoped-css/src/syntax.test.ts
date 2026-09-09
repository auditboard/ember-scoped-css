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

  it('does not fail the file when lang="sass" uses indented syntax no parser round-trips', async () => {
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
  <style scoped lang="sass">
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
    // The window ends on the `>` of </style>, so a window one short of the BOM
    // drops the block with no error. The fixtures above end in whitespace and
    // cannot catch that.
    const code =
      '\uFEFF<template><style scoped>.a{color:#fff}</style></template>\n';

    const { results } = await lint(code, { 'color-no-hex': true });

    expect(results[0]?.parseErrors).toEqual([]);
    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({ line: 1, column: 35, rule: 'color-no-hex' }),
    ]);
  });

  it('round-trips a BOM component under --fix', async () => {
    const source = `\uFEFF<template>
  <style scoped>
    .a { color: #fff; }
  </style>
</template>
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(source.replace('#fff', '#ffffff'));
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

describe('lang attributes naming a preprocessor dialect', () => {
  // postcss's own parser rejects each body below, so a pass proves the dialect
  // parser ran.
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

  it('skips lang="sass", the one dialect no parser round-trips byte-exact', () => {
    // postcss-sass drops trailing newlines on stringify, so --fix would rewrite
    // a byte outside the warning.
    const source = `<template>
  <style scoped lang="sass">
    .a
      color: #fff
  </style>
</template>
`;

    const doc = syntax.parse(source);

    expect(doc.nodes).toEqual([]);
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
