import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { rewriteCss } from './rewrite.js';

/** Rewrite a single rule and return just the scoped selector. */
function scopeSelector(css) {
  const rewritten = rewriteCss(css, 'postfix', 'foo.css');

  let selector = '';

  postcss.parse(rewritten).walkRules((rule) => {
    selector ||= rule.selector;
  });

  return selector;
}

describe('attribute selectors', () => {
  it('scopes a bare attribute selector with the postfix class', () => {
    expect(scopeSelector('[disabled] { color: red; }')).to.equal(
      '[disabled].postfix',
    );
  });

  it('scopes an attribute selector with a value', () => {
    expect(scopeSelector('[type="text"] { color: red; }')).to.equal(
      '[type="text"].postfix',
    );
  });

  it('preserves the case-insensitive flag', () => {
    expect(scopeSelector('[href^="http" i] { color: red; }')).to.equal(
      '[href^="http" i].postfix',
    );
  });

  it('adds the postfix class once for a tag + attribute compound', () => {
    expect(scopeSelector('input[type="text"] { color: red; }')).to.equal(
      'input.postfix[type="text"]',
    );
  });

  it('adds the postfix class once for multiple attributes in a compound', () => {
    expect(
      scopeSelector('[data-state="open"][role="dialog"] { color: red; }'),
    ).to.equal('[data-state="open"].postfix[role="dialog"]');
  });

  it('scopes each compound of a descendant selector', () => {
    expect(scopeSelector('[data-x] [data-y] { color: red; }')).to.equal(
      '[data-x].postfix [data-y].postfix',
    );
  });

  it('does not scope attribute selectors inside :global', () => {
    expect(scopeSelector(':global([data-x]) { color: red; }')).to.equal(
      '[data-x]',
    );
  });

  describe('class-targeting operators', () => {
    it('rewrites the value for ~= (renamed value, no postfix class)', () => {
      expect(scopeSelector('[class~="foo"] { color: red; }')).to.equal(
        '[class~="foo_postfix"]',
      );
    });

    it('rewrites every token for = (renamed value, no postfix class)', () => {
      expect(scopeSelector('[class="foo bar"] { color: red; }')).to.equal(
        '[class="foo_postfix bar_postfix"]',
      );
    });

    it('keeps the value and adds the postfix class for ^=', () => {
      expect(scopeSelector('[class^="foo"] { color: red; }')).to.equal(
        '[class^="foo"].postfix',
      );
    });

    it('keeps the value and adds the postfix class for *=', () => {
      expect(scopeSelector('[class*="foo"] { color: red; }')).to.equal(
        '[class*="foo"].postfix',
      );
    });

    it('keeps the value and adds the postfix class for $=', () => {
      expect(scopeSelector('[class$="foo"] { color: red; }')).to.equal(
        '[class$="foo"].postfix',
      );
    });

    it('falls back to the postfix class for |= (no runtime warning)', () => {
      expect(scopeSelector('[class|="foo"] { color: red; }')).to.equal(
        '[class|="foo"].postfix',
      );
    });
  });

  describe('functional pseudo-classes', () => {
    it('scopes via the outer compound for button:not([disabled])', () => {
      expect(scopeSelector('button:not([disabled]) { color: red; }')).to.equal(
        'button.postfix:not([disabled].postfix)',
      );
    });

    it('rewrites a standalone :not (documented leak — no outer anchor)', () => {
      expect(scopeSelector(':not([disabled]) { color: red; }')).to.equal(
        ':not([disabled].postfix)',
      );
    });

    it('scopes attributes inside :is()', () => {
      expect(scopeSelector(':is([type="text"]) { color: red; }')).to.equal(
        ':is([type="text"].postfix)',
      );
    });
  });
});
