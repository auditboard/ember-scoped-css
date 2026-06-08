import { transform } from 'lightningcss';

import { hash } from '../utils.js';

const ENCODER = new TextEncoder();

/**
 * @param {string} css plain CSS
 * @param {{ lang?: string }} [_opts]
 * @returns {{ classes: Set<string>, tags: Set<string>, css: string, id: string }}
 */
export function getContentInfo(css, _opts = {}) {
  const classes = new Set();
  const tags = new Set();

  transform({
    filename: 'styles.css',
    code: ENCODER.encode(css),
    minify: false,
    visitor: {
      Selector(selector) {
        for (const component of selector) {
          if (component.type === 'class') classes.add(component.name);
          else if (component.type === 'type') tags.add(component.name);
        }

        return undefined;
      },
    },
  });

  return { classes, tags, css, id: hash(css) };
}
