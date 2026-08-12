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
 * A `concat` sitting in the class attribute's value itself -- the whole
 * unquoted value, a quoted value, or one part of a value the attribute
 * already has (e.g. once a scoped element's postfix class is appended) --
 * is spliced into the native parts it's equivalent to, so the call is gone
 * from every case here regardless of whether anything ends up renamed. Only
 * a `concat` nested deeper than that (another `concat`'s own params, or an
 * `if`/`unless` branch) keeps its call; see the last two tests.
 */
describe('concat in a class attribute', () => {
  it('renames a lone param that is the whole class', () => {
    expect(rewrite('<div class={{concat "a"}}></div>')).to.equal(
      '<div class="a_pfx"></div>',
    );
  });

  it('renames every param that is a whole class name', () => {
    expect(rewrite('<div class={{concat "a" " " "b"}}></div>')).to.equal(
      '<div class="a_pfx b_pfx"></div>',
    );
  });

  it('leaves a param that is not in the CSS alone', () => {
    expect(
      rewrite('<div class={{concat "a" " " "global-thing"}}></div>'),
    ).to.equal('<div class="a_pfx global-thing"></div>');
  });

  it('folds fused literal params into one class and renames it', () => {
    // Renaming just "a" would emit a_pfx-suffix, which matches no selector
    // the CSS rewrite produces -- concat's own job of joining "a" and
    // "-suffix" into "a-suffix" makes this the same case as any other
    // TextNode class value.
    const rewriteWithSuffixClass = (hbs) =>
      rewriteHbs(hbs, new Set(['a', 'b', 'a-suffix']), new Set(), postfix);

    expect(
      rewriteWithSuffixClass('<div class={{concat "a" "-suffix"}}></div>'),
    ).to.equal('<div class="a-suffix_pfx"></div>');
  });

  it('renames a literal fused with a runtime value the same as a hand-written attribute would', () => {
    // Once concat is spliced away, "a" and this.suffix are just adjacent
    // parts of a native attribute value -- the same shape `class="a{{this.suffix}}"`
    // already has -- so "a" is renamed on its own, with no cross-part fusion
    // detection. A boundary of its own still bounds it either way.
    expect(rewrite('<div class={{concat "a" this.suffix}}></div>')).to.equal(
      '<div class="a_pfx{{this.suffix}}"></div>',
    );
    expect(rewrite('<div class={{concat "a " this.suffix}}></div>')).to.equal(
      '<div class="a_pfx {{this.suffix}}"></div>',
    );
  });

  it('gives an arbitrary helper call among its params its own mustache', () => {
    expect(
      rewrite('<div class={{concat "a " (someHelper "x") " b"}}></div>'),
    ).to.equal('<div class="a_pfx {{someHelper "x"}} b_pfx"></div>');
  });

  it('replaces the call with the native parts it is equivalent to', () => {
    expect(rewrite('<div class={{concat x y z}}></div>')).to.equal(
      '<div class="{{x}}{{y}}{{z}}"></div>',
    );
  });

  it('gives a nested class-building helper its own mustache too', () => {
    expect(
      rewrite('<div class={{concat (if x y z) " " (if a b c)}}></div>'),
    ).to.equal('<div class="{{if x y z}} {{if a b c}}"></div>');
  });

  it('splices into the value a scoped element has already been given', () => {
    // A scoped tag gets its postfix class appended to the class attribute,
    // which the concat now arrives as one part of rather than as the whole
    // of it.
    const rewriteScopingDiv = (hbs) =>
      rewriteHbs(hbs, classes, new Set(['div']), postfix);

    expect(
      rewriteScopingDiv('<div class={{concat "a" " " "b"}}></div>'),
    ).to.equal('<div class="a_pfx b_pfx pfx"></div>');
  });

  it('joins no params at all into an empty value', () => {
    expect(rewrite('<div class={{concat ""}}></div>')).to.equal(
      '<div class=""></div>',
    );
  });

  it('renames the same params in a quoted attribute value', () => {
    expect(rewrite(`<div class="{{concat 'a' ' ' 'b'}}"></div>`)).to.equal(
      `<div class="a_pfx b_pfx"></div>`,
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

  it('keeps a concat nested below the attribute value, renaming its whole-class-name params', () => {
    // The inner call's result has to stay one value for the outer call to
    // join, so it survives as a call -- and gets the boundary-aware rename
    // a concat that must stay one value needs, not the splice above.
    expect(
      rewrite('<div class={{concat (concat "a" " " "b") " b"}}></div>'),
    ).to.equal('<div class="{{concat "a_pfx" " " "b_pfx"}} b_pfx"></div>');
  });

  it("recurses into a class-building call among a nested concat's own params", () => {
    // "a " is a literal param of the surviving inner concat, boundary-aware
    // renamed as usual. (if x "a" "b") sits in a whole-class-name position of
    // that same concat, so it's looked inside rather than skipped.
    expect(
      rewrite('<div class={{concat (concat "a " (if x "a" "b")) " c"}}></div>'),
    ).to.equal(
      '<div class="{{concat "a_pfx " (if x "a_pfx" "b_pfx")}} c"></div>',
    );
  });

  it("leaves an opaque helper among a nested concat's params alone, even in a whole-class-name position", () => {
    expect(
      rewrite(
        '<div class={{concat (concat "a " (someHelper "z") " b") " c"}}></div>',
      ),
    ).to.equal(
      '<div class="{{concat "a_pfx " (someHelper "z") " b_pfx"}} c"></div>',
    );
  });
});
