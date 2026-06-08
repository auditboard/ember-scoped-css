import { describe, expect, it } from 'vitest';

import { resolveProcessor } from './index.js';
import * as lightning from './lightningcss.js';
import * as postcss from './postcss.js';

describe('resolveProcessor', () => {
  it('defaults to lightningcss for plain css', () => {
    expect(resolveProcessor(undefined)).toBe(lightning);
    expect(resolveProcessor('css')).toBe(lightning);
  });

  it('routes preprocessor langs to postcss', () => {
    expect(resolveProcessor('scss')).toBe(postcss);
    expect(resolveProcessor('sass')).toBe(postcss);
    expect(resolveProcessor('less')).toBe(postcss);
  });

  it('honors an explicit type override', () => {
    expect(resolveProcessor('scss', { type: 'lightningcss' })).toBe(lightning);
    expect(resolveProcessor(undefined, { type: 'postcss' })).toBe(postcss);
  });

  it('throws on an unknown type', () => {
    expect(() => resolveProcessor(undefined, { type: 'nope' })).toThrow(/Unknown CSS processor/);
  });
});
