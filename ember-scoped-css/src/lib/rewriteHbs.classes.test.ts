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

/** As `rewrite`, but with `div` also matched by a tag selector in the CSS. */
function rewriteWithScopedDiv(hbs) {
  return rewriteHbs(hbs, classes, new Set(['div']), postfix);
}

/**
 * The quoted (`ConcatStatement`) and unquoted (bare `MustacheStatement`)
 * class attribute values share the same literal-renaming dispatch, so most
 * cases are only exercised once, unquoted; see `legacy-conditional` in
 * vite-app-with-compat for end-to-end coverage of `if` + `scopedClass`
 * together, unquoted.
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

    it('skips if when an element introduces it, and resumes after that element', () => {
      expect(
        rewrite(
          '<Foo as |if|><div class={{if y "a"}}></div></Foo><div class={{if y "b"}}></div>',
        ),
      ).to.equal(
        '<Foo as |if|><div class={{if y "a"}}></div></Foo><div class={{if y "b_pfx"}}></div>',
      );
    });

    it('matches a branch against the CSS whole, not by prefix', () => {
      expect(rewrite('<div class={{if x "ab"}}></div>')).to.equal(
        '<div class={{if x "ab"}}></div>',
      );
    });

    it('still leaves the condition alone when the element is itself scoped', () => {
      // A scoped element gets the postfix appended to its class attribute,
      // which turns an unquoted value into a concat.
      expect(
        rewriteWithScopedDiv(
          '<div class={{if (eq this.m "a") "a" "b"}}></div>',
        ),
      ).to.equal(
        '<div class="{{if (eq this.m "a") "a_pfx" "b_pfx"}} pfx"></div>',
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

  it('leaves if alone outside an attribute', () => {
    expect(rewrite('<div>{{if x "a" "b"}}</div>')).to.equal(
      '<div>{{if x "a" "b"}}</div>',
    );
  });

  it('leaves a helper that is not if alone', () => {
    expect(rewrite('<div class={{someHelper "a" "b"}}></div>')).to.equal(
      '<div class={{someHelper "a" "b"}}></div>',
    );
  });
});

describe('quoted class attribute values', () => {
  it('leaves the condition of an if alone, even when it is a helper call', () => {
    // checkAlphabet's own arguments are data, not class names -- only the
    // branches (params 1+) reach the class attribute, same as unquoted.
    expect(
      rewrite(`<div class="{{if (checkAlphabet 'a' 'b') 'a' 'b'}}"></div>`),
    ).to.equal(
      `<div class="{{if (checkAlphabet 'a' 'b') 'a_pfx' 'b_pfx'}}"></div>`,
    );
  });
});
