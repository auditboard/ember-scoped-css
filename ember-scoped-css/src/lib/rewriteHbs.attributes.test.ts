import { describe, expect, it } from 'vitest';

import rewriteHbs from './rewriteHbs.js';

const postfix = 'pfx';

/** Add the postfix class to elements that carry one of `attributeNames`. */
function scopeByAttribute(hbs, attributeNames) {
  return rewriteHbs(
    hbs,
    new Set(),
    new Set(),
    postfix,
    new Set(attributeNames),
  );
}

describe('attribute scoping', () => {
  it('adds the postfix class to an element that has a scoped attribute', () => {
    expect(scopeByAttribute('<input type="text">', ['type'])).to.equal(
      '<input type="text" class="pfx">',
    );
  });

  it('appends to an existing class attribute', () => {
    expect(
      scopeByAttribute('<input type="text" class="foo">', ['type']),
    ).to.equal('<input type="text" class="foo pfx">');
  });

  it('matches attribute names case-insensitively, like CSS does', () => {
    expect(scopeByAttribute('<input TYPE="text">', ['type'])).to.equal(
      '<input TYPE="text" class="pfx">',
    );
  });

  it('does not scope elements without the scoped attribute', () => {
    expect(scopeByAttribute('<a href="/x">link</a>', ['type'])).to.equal(
      '<a href="/x">link</a>',
    );
  });

  it('adds the postfix class only once when tag and attribute both match', () => {
    const out = rewriteHbs(
      '<input type="text">',
      new Set(),
      new Set(['input']),
      postfix,
      new Set(['type']),
    );

    expect(out).to.equal('<input type="text" class="pfx">');
  });

  describe('component invocations are scoped too', () => {
    // The postfix class reaches the component's root element through
    // `...attributes`, the same way the matched attribute does.
    it('scopes capitalized components', () => {
      expect(scopeByAttribute('<Foo type="text" />', ['type'])).to.equal(
        '<Foo type="text" class="pfx" />',
      );
    });

    it('scopes path-based components', () => {
      expect(scopeByAttribute('<foo.bar type="text" />', ['type'])).to.equal(
        '<foo.bar type="text" class="pfx" />',
      );
    });
  });

  describe('dynamic class values still receive the postfix class', () => {
    it('appends to a mustache class by wrapping it in a concat', () => {
      expect(
        scopeByAttribute('<input type="text" class={{this.cls}}>', ['type']),
      ).to.equal('<input type="text" class="{{this.cls}} pfx">');
    });

    it('appends to a concat class', () => {
      expect(
        scopeByAttribute('<input type="text" class="foo {{bar}}">', ['type']),
      ).to.equal('<input type="text" class="foo {{bar}} pfx">');
    });

    it('appends to a mustache class for tag-scoped elements', () => {
      const out = rewriteHbs(
        '<div class={{this.cls}}></div>',
        new Set(),
        new Set(['div']),
        postfix,
        new Set(),
      );

      expect(out).to.equal('<div class="{{this.cls}} pfx"></div>');
    });
  });

  describe('...attributes may deliver any scoped attribute at runtime', () => {
    it('scopes elements that spread ...attributes', () => {
      expect(scopeByAttribute('<div ...attributes></div>', ['type'])).to.equal(
        '<div ...attributes class="pfx"></div>',
      );
    });

    it('does not scope ...attributes when the CSS has no attribute selectors', () => {
      expect(scopeByAttribute('<div ...attributes></div>', [])).to.equal(
        '<div ...attributes></div>',
      );
    });
  });

  describe('non-attribute bindings are ignored', () => {
    it('does not match named args', () => {
      expect(scopeByAttribute('<Foo @type="text" />', ['type'])).to.equal(
        '<Foo @type="text" />',
      );
    });
  });
});
