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

describe('unless in a class attribute', () => {
  it('renames both branches', () => {
    expect(rewrite('<div class={{unless x "a" "b"}}></div>')).to.equal(
      '<div class={{unless x "a_pfx" "b_pfx"}}></div>',
    );
  });

  it('leaves a branch that is not in the CSS alone', () => {
    expect(rewrite('<div class={{unless x "global-thing"}}></div>')).to.equal(
      '<div class={{unless x "global-thing"}}></div>',
    );
  });

  it('leaves the condition alone, even when it is a helper call', () => {
    expect(
      rewrite('<div class={{unless (checkAlphabet "a" "b") "a" "b"}}></div>'),
    ).to.equal(
      '<div class={{unless (checkAlphabet "a" "b") "a_pfx" "b_pfx"}}></div>',
    );
  });

  it('skips unless when it is an element block param', () => {
    expect(
      rewrite('<Foo as |unless|><div class={{unless y "a" "b"}}></div></Foo>'),
    ).to.equal('<Foo as |unless|><div class={{unless y "a" "b"}}></div></Foo>');
  });

  it('is shadowed independently of if', () => {
    // if and unless share one set of class-building helper names, and the
    // shadow check keys on the name rather than the set.
    expect(
      rewrite(
        '{{#let q as |if|}}<div class={{if a "a" "b"}}></div><div class={{unless a "a" "b"}}></div>{{/let}}',
      ),
    ).to.equal(
      '{{#let q as |if|}}<div class={{if a "a" "b"}}></div><div class={{unless a "a_pfx" "b_pfx"}}></div>{{/let}}',
    );
  });

  it('reaches whole-class-name params of a concat branch, same as if', () => {
    expect(
      rewrite('<div class={{unless x (concat "a" " " "b") "c"}}></div>'),
    ).to.equal(
      '<div class={{unless x (concat "a_pfx" " " "b_pfx") "c"}}></div>',
    );
  });
});
