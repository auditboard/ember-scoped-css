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
 * Cross-cutting behavior of the class-attribute dispatch that isn't specific
 * to any one helper; see rewriteHbs.if.test.ts, rewriteHbs.scopedClass.test.ts,
 * and rewriteHbs.classes.concat.test.ts for per-helper coverage.
 */
describe('class attribute dispatch', () => {
  it('only touches the class attribute', () => {
    expect(rewrite('<div data-x={{if x "a" "b"}}></div>')).to.equal(
      '<div data-x={{if x "a" "b"}}></div>',
    );
  });
});
