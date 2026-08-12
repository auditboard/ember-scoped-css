import { describe, expect, it } from 'vitest';

import rewriteHbs from './rewriteHbs.js';

const postfix = 'pfx';

const classes = new Set(['a', 'b']);

function rewrite(hbs) {
  return rewriteHbs(hbs, classes, new Set(), postfix);
}

describe('scopedClass in a class attribute', () => {
  it('collapses to a quoted literal unconditionally, without a CSS lookup', () => {
    expect(
      rewrite('<div class={{scopedClass "global-thing"}}></div>'),
    ).to.equal('<div class="global-thing_pfx"></div>');
  });
});
