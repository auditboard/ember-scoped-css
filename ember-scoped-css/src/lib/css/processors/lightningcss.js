import { transform } from 'lightningcss';

import { hash } from '../utils.js';

const ENCODER = new TextEncoder();

const SEP = '__';

function rename(name, postfix) {
  return name + SEP + postfix;
}

/**
 * Convert the raw token stream inside `:global(...)` back into selector
 * components. Only the forms used in this codebase are handled:
 *   `.foo` (delim '.' + ident)  -> class
 *   `p`    (bare ident)         -> type/tag
 *   whitespace                  -> descendant combinator
 */
function unwrapGlobalArguments(args) {
  const out = [];

  for (let i = 0; i < args.length; i++) {
    const tok = args[i]?.value;

    if (!tok) continue;

    if (tok.type === 'delim' && tok.value === '.') {
      const next = args[i + 1]?.value;

      if (next && next.type === 'ident') {
        out.push({ type: 'class', name: next.value });
        i++;
      }
    } else if (tok.type === 'ident') {
      out.push({ type: 'type', name: tok.value });
    } else if (tok.type === 'white-space') {
      out.push({ type: 'combinator', value: 'descendant' });
    }
  }

  return out;
}

function scopeSelector(selector, postfix) {
  const out = [];

  for (const component of selector) {
    if (component.type === 'class') {
      out.push({ type: 'class', name: rename(component.name, postfix) });
    } else if (component.type === 'type') {
      out.push(component);
      out.push({ type: 'class', name: postfix });
    } else if (
      component.type === 'pseudo-class' &&
      component.kind === 'custom-function' &&
      component.name === 'global'
    ) {
      out.push(...unwrapGlobalArguments(component.arguments));
    } else {
      out.push(component);
    }
  }

  return out;
}

/**
 * @param {string} css plain CSS
 * @param {string} postfix
 * @returns {string} scoped CSS body
 */
export function rewrite(css, postfix) {
  const result = transform({
    filename: 'styles.css',
    code: ENCODER.encode(css),
    minify: false,
    visitor: {
      Selector(selector) {
        return scopeSelector(selector, postfix);
      },
    },
  });

  return result.code.toString().trimEnd();
}

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
