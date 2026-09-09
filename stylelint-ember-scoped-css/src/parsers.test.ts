import { describe, expect, it } from 'vitest';

import { loadPackage, loadParser, parserPackage } from './parsers.js';

describe('parserPackage', () => {
  it.each([
    ['scss', 'postcss-scss'],
    ['sass', 'sugarss'],
    ['less', 'postcss-less'],
    ['styl', 'postcss-styl'],
    ['stylus', 'postcss-styl'],
  ])('maps lang=%s to %s', (lang, pkg) => {
    expect(parserPackage(lang)).toBe(pkg);
  });

  it('names no package for plain CSS or an unknown lang', () => {
    expect(parserPackage('css')).toBeNull();
    expect(parserPackage('postcss')).toBeNull();
  });
});

describe('loadPackage', () => {
  it('returns null for a package that is not installed', () => {
    expect(loadPackage('stylelint-ember-scoped-css-not-installed')).toBeNull();
  });

  it('returns the export of an installed package', () => {
    expect(loadPackage('postcss-scss')).toMatchObject({
      parse: expect.any(Function),
      stringify: expect.any(Function),
    });
  });
});

describe('loadParser', () => {
  it.each(['scss', 'sass', 'less', 'styl', 'stylus'])(
    'returns a parse/stringify pair for lang=%s',
    (lang) => {
      expect(loadParser(lang)).toMatchObject({
        parse: expect.any(Function),
        stringify: expect.any(Function),
      });
    },
  );

  it('returns the same instance on every call', () => {
    expect(loadParser('sass')).toBe(loadParser('sass'));
  });
});
