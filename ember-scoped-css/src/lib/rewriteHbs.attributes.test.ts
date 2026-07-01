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

  describe('non-attribute bindings are ignored', () => {
    it('does not match named args', () => {
      expect(scopeByAttribute('<Foo @type="text" />', ['type'])).to.equal(
        '<Foo @type="text" />',
      );
    });

    it('does not match ...attributes', () => {
      expect(scopeByAttribute('<div ...attributes></div>', ['type'])).to.equal(
        '<div ...attributes></div>',
      );
    });
  });
});
