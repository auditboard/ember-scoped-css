import { describe, expect, it } from 'vitest';

import rewriteHbs from './rewriteHbs.js';

const postfix = 'pfx';

/**
 * `a` and `b` are in the co-located CSS; `global-thing` deliberately is not, so
 * tests can distinguish "renamed" from "left alone for a global class".
 */
const classes = new Set(['a', 'b']);

function rewrite(hbs) {
  return rewriteHbs(hbs, classes, new Set(), postfix);
}

/**
 * Only the unquoted (bare `MustacheStatement`) class attribute value is new
 * here. The quoted (`ConcatStatement`) path already renames every string
 * literal it finds -- including the `if`/`scopedClass`-adjacent cases below --
 * so it isn't retested; see `legacy-conditional` in vite-app-with-compat for
 * existing end-to-end coverage of `if` + `scopedClass` together, unquoted.
 */
describe('unquoted class attribute values', () => {
  describe('if', () => {
    it('renames both branches', () => {
      expect(rewrite('<div class={{if x "a" "b"}}></div>')).to.equal(
        '<div class={{if x "a_pfx" "b_pfx"}}></div>',
      );
    });

    it('leaves a branch that is not in the CSS alone', () => {
      expect(rewrite('<div class={{if x "global-thing"}}></div>')).to.equal(
        '<div class={{if x "global-thing"}}></div>',
      );
    });

    it('leaves the condition alone, even when it is a helper call', () => {
      // checkAlphabet's own arguments are data, not class names -- only the
      // branches (params 1+) reach the class attribute.
      expect(
        rewrite('<div class={{if (checkAlphabet "a" "b") "a" "b"}}></div>'),
      ).to.equal(
        '<div class={{if (checkAlphabet "a" "b") "a_pfx" "b_pfx"}}></div>',
      );
    });

    it('skips if when it is a block param', () => {
      expect(
        rewrite(
          '{{#each xs as |if|}}<div class={{if y "a" "b"}}></div>{{/each}}',
        ),
      ).to.equal(
        '{{#each xs as |if|}}<div class={{if y "a" "b"}}></div>{{/each}}',
      );
    });
  });

  describe('scopedClass', () => {
    it('collapses to a quoted literal unconditionally, without a CSS lookup', () => {
      expect(
        rewrite('<div class={{scopedClass "global-thing"}}></div>'),
      ).to.equal('<div class="global-thing_pfx"></div>');
    });
  });

  it('only touches the class attribute', () => {
    expect(rewrite('<div data-x={{if x "a" "b"}}></div>')).to.equal(
      '<div data-x={{if x "a" "b"}}></div>',
    );
  });
});
