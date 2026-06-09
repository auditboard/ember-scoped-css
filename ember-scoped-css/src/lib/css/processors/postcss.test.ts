import { describe, expect, it } from 'vitest';

import { rewrite } from './postcss.js';

import type { Root } from 'postcss';

describe('postcss processor — user plugins', () => {
  it('runs a user postcss plugin before scoping', () => {
    // Use the `Once` hook so the plugin makes a single pass over the root.
    // (A `Rule` visitor that appends unconditionally would loop forever, since
    // PostCSS re-visits a rule after it is mutated.)
    const addColor = () => ({
      postcssPlugin: 'add-color',
      Once(root: Root) {
        root.walkRules((rule) => {
          rule.append({ prop: 'color', value: 'red' });
        });
      },
    });

    addColor.postcss = true;

    const out = rewrite('.foo {}', 'postfix', {
      postcss: { plugins: [addColor()] },
    });

    expect(out).toContain('.foo_postfix');
    expect(out).toContain('color: red');
  });

  it('works without any options (no plugins)', () => {
    const out = rewrite('.foo { color: blue; }', 'postfix');

    expect(out).toContain('.foo_postfix');
    expect(out).toContain('color: blue');
  });
});
