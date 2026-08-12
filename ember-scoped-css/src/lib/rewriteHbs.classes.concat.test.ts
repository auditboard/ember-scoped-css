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

describe('concat in a class attribute', () => {
  it('renames a lone param that is the whole class', () => {
    expect(rewrite('<div class={{concat "a"}}></div>')).to.equal(
      '<div class={{concat "a_pfx"}}></div>',
    );
  });

  it('renames every param that is a whole class name', () => {
    expect(rewrite('<div class={{concat "a" " " "b"}}></div>')).to.equal(
      '<div class={{concat "a_pfx" " " "b_pfx"}}></div>',
    );
  });

  it('leaves a param that is not in the CSS alone', () => {
    expect(
      rewrite('<div class={{concat "a" " " "global-thing"}}></div>'),
    ).to.equal('<div class={{concat "a_pfx" " " "global-thing"}}></div>');
  });

  it('leaves a param that fuses with a literal neighbour alone', () => {
    // Renaming "a" here would emit a_pfx-suffix, which matches no selector
    // the CSS rewrite produces.
    expect(rewrite('<div class={{concat "a" "-suffix"}}></div>')).to.equal(
      '<div class={{concat "a" "-suffix"}}></div>',
    );
  });

  it('leaves a param that fuses with a runtime value alone', () => {
    // this.suffix could be anything, so "a" only survives as a class of its
    // own if it ends at a boundary of its own.
    expect(rewrite('<div class={{concat "a" this.suffix}}></div>')).to.equal(
      '<div class={{concat "a" this.suffix}}></div>',
    );
    expect(rewrite('<div class={{concat "a " this.suffix}}></div>')).to.equal(
      '<div class={{concat "a_pfx " this.suffix}}></div>',
    );
  });

  it('leaves an arbitrary helper call among its params alone', () => {
    expect(
      rewrite('<div class={{concat "a " (someHelper "x") " b"}}></div>'),
    ).to.equal(
      '<div class={{concat "a_pfx " (someHelper "x") " b_pfx"}}></div>',
    );
  });

  it('skips concat when it is a block param', () => {
    expect(
      rewrite(
        '{{#let x as |concat|}}<div class={{concat "a" " " "b"}}></div>{{/let}}',
      ),
    ).to.equal(
      '{{#let x as |concat|}}<div class={{concat "a" " " "b"}}></div>{{/let}}',
    );
  });

  it('renames the same params in a quoted attribute value', () => {
    expect(rewrite(`<div class="{{concat 'a' ' ' 'b'}}"></div>`)).to.equal(
      `<div class="{{concat 'a_pfx' ' ' 'b_pfx'}}"></div>`,
    );
  });
});
