import { describe, expect, it } from 'vitest';

import { getContentInfo } from './lightningcss.js';

describe('lightningcss getContentInfo', () => {
  it('extracts classes and tags, skipping :global contents', () => {
    const css = '.baz :global(.foo) .bar div :global(p) { color: red; }';
    const { classes, tags } = getContentInfo(css);

    expect([...classes].sort()).toEqual(['bar', 'baz']);
    expect([...tags]).toEqual(['div']);
  });
});
