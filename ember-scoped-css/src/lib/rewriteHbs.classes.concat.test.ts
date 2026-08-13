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
 * from every case here regardless of whether anything ends up renamed. A
 * `concat` nested inside that one's own params joins in the same way, since
 * concatenation doesn't care how its inputs were grouped. Only a `concat`
 * nested inside an `if`/`unless` branch keeps its call, because a branch has
 * to stay one value; see the last test.
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

  it("joins a nested concat's params in directly, folding fused literals", () => {
    // concat(concat("a", " ", "b"), " b") joins to the same string as
    // concat("a", " ", "b", " b") -- the inner call's own params flatten
    // into the outer one rather than surviving as a nested call.
    expect(
      rewrite('<div class={{concat (concat "a" " " "b") " b"}}></div>'),
    ).to.equal('<div class="a_pfx b_pfx b_pfx"></div>');
  });

  it("gives a class-building call among a nested concat's params its own mustache", () => {
    expect(
      rewrite('<div class={{concat (concat "a " (if x "a" "b")) " c"}}></div>'),
    ).to.equal('<div class="a_pfx {{if x "a_pfx" "b_pfx"}} c"></div>');
  });

  it("gives an opaque helper among a nested concat's params its own mustache too", () => {
    expect(
      rewrite(
        '<div class={{concat (concat "a " (someHelper "z") " b") " c"}}></div>',
      ),
    ).to.equal('<div class="a_pfx {{someHelper "z"}} b_pfx c"></div>');
  });

  it('keeps a concat nested inside an if branch, renaming its whole-class-name params', () => {
    // The branch's result has to stay one value for if to choose between, so
    // the concat inside it survives as a call -- and gets the boundary-aware
    // rename a concat that must stay one value needs, not the splice above.
    expect(
      rewrite('<div class={{if x (concat "a" " " "b") "c"}}></div>'),
    ).to.equal('<div class={{if x (concat "a_pfx" " " "b_pfx") "c"}}></div>');
  });
});

/**
 * A `concat` nested inside an `if`/`unless` branch survives as a call (the
 * branch has to stay one value), so a param fused onto a nested `if`/`unless`
 * -- "a" and (if x "-on" "-off") share no boundary -- is never a whole class
 * name on its own; the boundary-aware rename above has nothing to postfix.
 * But every class the branch could actually produce is still known ahead of
 * time, so enumerating them lets the fused run collapse into an `if`/`unless`
 * over the renamed classes instead, with nothing left for `concat` to join.
 */
describe('a concat nested in an if/unless branch, fused onto a nested condition', () => {
  const classesWithVariants = new Set(['a', 'b', 'a-on', 'a-off']);
  const rewriteWithVariants = (hbs) =>
    rewriteHbs(hbs, classesWithVariants, new Set(), postfix);

  it('distributes over a nested if, replacing the concat with an if over the renamed classes', () => {
    expect(
      rewriteWithVariants(
        '<div class={{if outer (concat "a" (if x "-on" "-off")) "c"}}></div>',
      ),
    ).to.equal(
      '<div class={{if outer (if x "a-on_pfx" "a-off_pfx") "c"}}></div>',
    );
  });

  it('distributes over a nested unless, inverting the branches it reaches through', () => {
    // unless resolves to its second param when falsy and its third when
    // truthy -- the opposite of if -- so the if built in its place has to
    // reach each renamed class through the opposite branch.
    expect(
      rewriteWithVariants(
        '<div class={{if outer (concat "a" (unless x "-on" "-off")) "c"}}></div>',
      ),
    ).to.equal(
      '<div class={{if outer (if x "a-off_pfx" "a-on_pfx") "c"}}></div>',
    );
  });

  it('leaves the concat as a call when a fused param is a genuine runtime value', () => {
    // this.suffix has no statically-known value to enumerate, so the classes
    // the concat could produce aren't knowable ahead of time.
    expect(
      rewriteWithVariants(
        '<div class={{if outer (concat "a" this.suffix) "c"}}></div>',
      ),
    ).to.equal('<div class={{if outer (concat "a" this.suffix) "c"}}></div>');
  });

  it('leaves the concat as a call when a fused param is an opaque helper call', () => {
    expect(
      rewriteWithVariants(
        '<div class={{if outer (concat "a" (someHelper "z")) "c"}}></div>',
      ),
    ).to.equal(
      '<div class={{if outer (concat "a" (someHelper "z")) "c"}}></div>',
    );
  });

  it('distributes over two independent conditions', () => {
    const classesWithBothVariants = new Set(['a-on', 'a-off', 'b-on', 'b-off']);

    expect(
      rewriteHbs(
        '<div class={{if outer (concat (if p "a" "b") (if q "-on" "-off")) "c"}}></div>',
        classesWithBothVariants,
        new Set(),
        postfix,
      ),
    ).to.equal(
      '<div class={{if outer (if p (if q "a-on_pfx" "a-off_pfx") (if q "b-on_pfx" "b-off_pfx")) "c"}}></div>',
    );
  });

  it('leaves the concat as a call once a third independent condition would be needed', () => {
    // Every independent condition doubles the leaves a full enumeration has
    // to cover; the budget caps how many may combine so a long run of fused
    // conditions doesn't blow up the rewrite.
    expect(
      rewriteWithVariants(
        '<div class={{if outer (concat (if p "a" "b") "-" (if q "x" "y") "-" (if r "1" "2")) "c"}}></div>',
      ),
    ).to.equal(
      '<div class={{if outer (concat (if p "a" "b") "-" (if q "x" "y") "-" (if r "1" "2")) "c"}}></div>',
    );
  });

  it('leaves the concat as a call when none of the classes it could produce need renaming', () => {
    expect(
      rewrite(
        '<div class={{if outer (concat "z" (if x "-on" "-off")) "c"}}></div>',
      ),
    ).to.equal(
      '<div class={{if outer (concat "z" (if x "-on" "-off")) "c"}}></div>',
    );
  });

  it('skips a shadowed concat, leaving it and its nested if alone', () => {
    expect(
      rewriteWithVariants(
        '{{#let x as |concat|}}<div class={{if outer (concat "a" (if x "-on" "-off")) "c"}}></div>{{/let}}',
      ),
    ).to.equal(
      '{{#let x as |concat|}}<div class={{if outer (concat "a" (if x "-on" "-off")) "c"}}></div>{{/let}}',
    );
  });
});
