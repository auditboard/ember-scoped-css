import { describe, expect, it } from 'vitest';

import rewriteHbs from './rewriteHbs.js';

const postfix = 'pfx';

/**
 * `a` and `b` are in the co-located CSS; `global-thing` deliberately is not, so
 * every test can distinguish "renamed" from "left alone for a global class".
 */
const classes = new Set(['a', 'b']);

function rewrite(hbs) {
  return rewriteHbs(hbs, classes, new Set(), postfix);
}

describe('class attribute values', () => {
  describe('quoted (ConcatStatement)', () => {
    it('renames literals in a mustache', () => {
      expect(rewrite(`<div class="{{if x 'a' 'b'}}"></div>`)).to.equal(
        `<div class="{{if x 'a_pfx' 'b_pfx'}}"></div>`,
      );
    });

    it('renames both the text part and the mustache literals', () => {
      expect(rewrite(`<div class="a {{if x 'b'}}"></div>`)).to.equal(
        `<div class="a_pfx {{if x 'b_pfx'}}"></div>`,
      );
    });
  });

  describe('unquoted (MustacheStatement)', () => {
    it('renames literals in a mustache', () => {
      expect(rewrite('<div class={{if x "a" "b"}}></div>')).to.equal(
        '<div class={{if x "a_pfx" "b_pfx"}}></div>',
      );
    });

    it('leaves a class that is not in the CSS alone', () => {
      expect(rewrite('<div class={{if x "global-thing"}}></div>')).to.equal(
        '<div class={{if x "global-thing"}}></div>',
      );
    });

    it('renames only the literals that are in the CSS', () => {
      expect(rewrite('<div class={{if x "a" "global-thing"}}></div>')).to.equal(
        '<div class={{if x "a_pfx" "global-thing"}}></div>',
      );
    });

    it('reaches literals in any helper, not just if', () => {
      expect(rewrite('<div class={{concat "a" " " "b"}}></div>')).to.equal(
        '<div class={{concat "a_pfx" " " "b_pfx"}}></div>',
      );
    });

    it('reaches literals nested in a class-building subexpression', () => {
      expect(
        rewrite('<div class={{if x (concat "a" "-suffix") "b"}}></div>'),
      ).to.equal(
        '<div class={{if x (concat "a_pfx" "-suffix") "b_pfx"}}></div>',
      );
    });

    it('renames the branches of unless', () => {
      expect(rewrite('<div class={{unless x "a" "b"}}></div>')).to.equal(
        '<div class={{unless x "a_pfx" "b_pfx"}}></div>',
      );
    });

    it('renames the single branch of a two-param if', () => {
      expect(rewrite('<div class={{if x "a"}}></div>')).to.equal(
        '<div class={{if x "a_pfx"}}></div>',
      );
    });

    it('renames every class in a multi-class literal', () => {
      expect(rewrite('<div class={{if x "a b" "b"}}></div>')).to.equal(
        '<div class={{if x "a_pfx b_pfx" "b_pfx"}}></div>',
      );
    });

    it('leaves a path expression alone', () => {
      // A path resolves at runtime, so there is no literal to rename.
      expect(rewrite('<div class={{this.fooClass}}></div>')).to.equal(
        '<div class={{this.fooClass}}></div>',
      );
    });

    it('renames on a component invocation', () => {
      expect(rewrite('<Foo class={{if x "a" "b"}} />')).to.equal(
        '<Foo class={{if x "a_pfx" "b_pfx"}} />',
      );
    });

    it('does not rename an already-postfixed class', () => {
      expect(rewrite('<div class={{if x "a_pfx"}}></div>')).to.equal(
        '<div class={{if x "a_pfx"}}></div>',
      );
    });

    it('only touches the class attribute', () => {
      expect(rewrite('<div data-x={{if x "a" "b"}}></div>')).to.equal(
        '<div data-x={{if x "a" "b"}}></div>',
      );
    });
  });

  describe('literals that are not class names', () => {
    it('leaves the arguments of a helper in the condition alone', () => {
      expect(
        rewrite('<div class={{if (checkAlphabet "a" "b") "a" "b"}}></div>'),
      ).to.equal(
        '<div class={{if (checkAlphabet "a" "b") "a_pfx" "b_pfx"}}></div>',
      );
    });

    it('leaves the arguments of a condition alone in a quoted value too', () => {
      expect(
        rewrite(`<div class="{{if (checkAlphabet 'a' 'b') 'a' 'b'}}"></div>`),
      ).to.equal(
        `<div class="{{if (checkAlphabet 'a' 'b') 'a_pfx' 'b_pfx'}}"></div>`,
      );
    });

    it('leaves a comparand alone', () => {
      // Postfixing it would stop the comparison ever matching this.mode.
      expect(
        rewrite('<div class={{if (eq this.mode "a") "a" "b"}}></div>'),
      ).to.equal('<div class={{if (eq this.mode "a") "a_pfx" "b_pfx"}}></div>');
    });

    it('leaves a comparand alone inside a class-building helper', () => {
      expect(
        rewrite(
          '<div class={{concat "a" (if (eq this.x "b") "-on" "-off")}}></div>',
        ),
      ).to.equal(
        '<div class={{concat "a_pfx" (if (eq this.x "b") "-on" "-off")}}></div>',
      );
    });

    it('leaves the arguments of an opaque helper alone', () => {
      // The helper may well return a class name, but what it does with its
      // arguments is unknown. {{scopedClass "a"}} renames a literal here.
      expect(rewrite('<div class={{someHelper "a"}}></div>')).to.equal(
        '<div class={{someHelper "a"}}></div>',
      );
    });
  });

  describe('the scopedClass helper still collapses to a text node', () => {
    it('renames unconditionally, without a CSS lookup', () => {
      expect(
        rewrite('<div class={{scopedClass "global-thing"}}></div>'),
      ).to.equal('<div class="global-thing_pfx"></div>');
    });

    it('does not double-postfix a class that is in the CSS', () => {
      expect(rewrite('<div class={{scopedClass "a"}}></div>')).to.equal(
        '<div class="a_pfx"></div>',
      );
    });

    it('does not double-postfix the legacy hbs global either', () => {
      expect(rewrite('<div class={{scoped-class "a"}}></div>')).to.equal(
        '<div class="a_pfx"></div>',
      );
    });
  });

  describe('an element that is also scoped by its tag', () => {
    function rewriteScopedDiv(hbs) {
      return rewriteHbs(hbs, classes, new Set(['div']), postfix);
    }

    it('renames literals and appends the postfix class', () => {
      expect(rewriteScopedDiv('<div class={{if x "a" "b"}}></div>')).to.equal(
        '<div class="{{if x "a_pfx" "b_pfx"}} pfx"></div>',
      );
    });

    it('appends the postfix class to a path expression', () => {
      expect(rewriteScopedDiv('<div class={{this.fooClass}}></div>')).to.equal(
        '<div class="{{this.fooClass}} pfx"></div>',
      );
    });
  });
});
