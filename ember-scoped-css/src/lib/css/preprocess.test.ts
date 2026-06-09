import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { compileToCss } from './preprocess.js';

describe('compileToCss', () => {
  it('compiles scss (variables, & nesting, child nesting) to plain css', () => {
    const scss = `
      $color: rgb(200, 0, 100);

      .parent {
        color: $color;

        &--modifier { outline: none; }
        .child { color: blue; }
      }
    `;

    const css = compileToCss(scss, 'scss');

    expect(css).toContain('.parent--modifier');
    expect(css).toContain('.parent .child');
    expect(css).not.toContain('$color');
  });

  it('compiles indented sass syntax', () => {
    const source = [
      '$color: green',
      '.block',
      '  color: $color',
      '  &--modifier',
      '    color: red',
    ].join('\n');

    const css = compileToCss(source, 'sass');

    expect(css).toContain('.block--modifier');
  });

  it('resolves relative @use from the component file directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scoped-css-preprocess-'));

    writeFileSync(join(dir, '_mixins.scss'), '@mixin red { color: red; }');

    const scss = `@use './mixins' as m;\n.card { @include m.red; }`;
    const css = compileToCss(scss, 'scss', join(dir, 'component.gjs'));

    expect(css).toContain('.card');
    expect(css).toContain('color: red');
  });

  it('throws a clear error for unsupported languages', () => {
    expect(() => compileToCss('.a { width: 1px; }', 'less')).toThrow(
      /lang="less".*not supported/,
    );
  });
});
