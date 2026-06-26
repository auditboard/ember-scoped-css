import { describe, expect, it } from 'vitest';

import rewriteHbs from './rewriteHbs.js';

const postfix = 'pfx';

/** Mark elements that carry one of `attributeNames`. */
function mark(hbs, attributeNames) {
  return rewriteHbs(
    hbs,
    new Set(),
    new Set(),
    postfix,
    new Set(attributeNames),
  );
}

describe('attribute marking', () => {
  it('marks a native element that has a scoped attribute', () => {
    expect(mark('<input type="text">', ['type'])).to.equal(
      '<input type="text" class="pfx">',
    );
  });

  it('appends to an existing class attribute', () => {
    expect(mark('<input type="text" class="foo">', ['type'])).to.equal(
      '<input type="text" class="foo pfx">',
    );
  });

  it('does not mark elements without the scoped attribute', () => {
    expect(mark('<a href="/x">link</a>', ['type'])).to.equal(
      '<a href="/x">link</a>',
    );
  });

  it('adds the marker only once when tag and attribute both match', () => {
    const out = rewriteHbs(
      '<input type="text">',
      new Set(),
      new Set(['input']),
      postfix,
      new Set(['type']),
    );

    expect(out).to.equal('<input type="text" class="pfx">');
  });

  describe('component invocations are never marked', () => {
    it('skips capitalized components', () => {
      expect(mark('<Foo type="text" />', ['type'])).to.equal(
        '<Foo type="text" />',
      );
    });

    it('skips path-based components', () => {
      expect(mark('<foo.bar type="text" />', ['type'])).to.equal(
        '<foo.bar type="text" />',
      );
    });
  });

  describe('non-attribute bindings are ignored', () => {
    it('does not match named args', () => {
      expect(mark('<Foo @type="text" />', ['type'])).to.equal(
        '<Foo @type="text" />',
      );
    });

    it('does not match ...attributes', () => {
      expect(mark('<div ...attributes></div>', ['...attributes'])).to.equal(
        '<div ...attributes></div>',
      );
    });
  });
});
