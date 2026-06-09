import { transform } from 'lightningcss';

import { md5 } from '../path/md5.js';

/**
 * @param {string} css
 * @return {string} hashed down version of the CSS for disambiguating
 */
function hash(css) {
  return `css-${md5(css)}`;
}

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
      out.push({ type: 'class', name: `${component.name}_${postfix}` });
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
 * @param {{ lightningcss?: object }} [options]
 * @returns {string} scoped CSS body
 */
export function rewrite(css, postfix, options = {}) {
  const code = ENCODER.encode(css);

  const userLightningcss = options.lightningcss ?? {};

  const defs = {
    keyframes: new Set(),
    counterStyle: new Set(),
    property: new Set(),
    positionTry: new Set(),
  };

  // Referenceable at-rules are the only reason we need two passes (a reference
  // can appear before its definition in document order). When none are present
  // — the common case for component CSS — skip the collection pass entirely and
  // scope selectors in a single transform. This is a cheap substring check: a
  // false positive (e.g. the text in a comment) only costs an unnecessary pass,
  // never correctness.
  const hasReferenceables =
    css.includes('@keyframes') ||
    css.includes('@counter-style') ||
    css.includes('@property') ||
    css.includes('@position-try');

  // Pass 1: collect referenceable definition names.
  if (hasReferenceables) {
    transform({
      filename: 'styles.css',
      code,
      minify: false,
      visitor: {
        Rule: {
          keyframes(rule) {
            defs.keyframes.add(rule.value.name.value);

            return undefined;
          },
          'counter-style'(rule) {
            defs.counterStyle.add(rule.value.name);

            return undefined;
          },
          property(rule) {
            defs.property.add(rule.value.name);

            return undefined;
          },
          unknown(rule) {
            // `@position-try` is not a typed rule in lightningcss; it surfaces as
            // an `unknown` at-rule whose prelude holds the dashed-ident name.
            // The keyed handler receives the unwrapped value (rule.name/prelude).
            if (rule.name === 'position-try') {
              for (const tok of rule.prelude) {
                if (tok.type === 'dashed-ident') {
                  defs.positionTry.add(tok.value);
                }
              }
            }

            return undefined;
          },
        },
      },
    });
  }

  // Pass 2: apply scoping + reference rewrites.
  const result = transform({
    minify: false,
    ...userLightningcss,
    // The following keys are required for our scoping to work and must not be
    // overridable by user-supplied lightningcss options.
    filename: 'styles.css',
    code,
    visitor: {
      Selector(selector) {
        return scopeSelector(selector, postfix);
      },
      Rule: {
        keyframes(rule) {
          rule.value.name = {
            type: 'ident',
            value: rename(rule.value.name.value, postfix),
          };

          return rule;
        },
        'counter-style'(rule) {
          rule.value.name = rename(rule.value.name, postfix);

          return rule;
        },
      },
      Declaration(decl) {
        return scopeDeclaration(decl, defs, postfix);
      },
      DashedIdent(ident) {
        // Covers both the `@position-try` definition name (in the unknown
        // at-rule prelude) and `position-try-fallbacks` references.
        if (defs.property.has(ident) || defs.positionTry.has(ident)) {
          return rename(ident, postfix);
        }

        return undefined;
      },
    },
  });

  return result.code.toString().trimEnd();
}

function scopeDeclaration(decl, defs, postfix) {
  // animation shorthand: value is an array of animation entries.
  if (decl.property === 'animation' && Array.isArray(decl.value)) {
    let changed = false;

    for (const anim of decl.value) {
      if (anim.name?.type === 'ident' && defs.keyframes.has(anim.name.value)) {
        anim.name = { type: 'ident', value: rename(anim.name.value, postfix) };
        changed = true;
      }
    }

    return changed ? decl : undefined;
  }

  // animation-name: value is an array of name entries (idents or `none`).
  if (decl.property === 'animation-name' && Array.isArray(decl.value)) {
    let changed = false;

    decl.value = decl.value.map((name) => {
      if (name?.type === 'ident' && defs.keyframes.has(name.value)) {
        changed = true;

        return { type: 'ident', value: rename(name.value, postfix) };
      }

      return name;
    });

    return changed ? decl : undefined;
  }

  if (decl.property === 'list-style' && decl.value?.listStyleType) {
    const lst = decl.value.listStyleType;

    if (
      lst.type === 'counter-style' &&
      lst.value?.type === 'name' &&
      defs.counterStyle.has(lst.value.value)
    ) {
      lst.value.value = rename(lst.value.value, postfix);

      return decl;
    }

    return undefined;
  }

  if (decl.property === 'list-style-type') {
    const lst = decl.value;

    if (
      lst?.type === 'counter-style' &&
      lst.value?.type === 'name' &&
      defs.counterStyle.has(lst.value.value)
    ) {
      lst.value.value = rename(lst.value.value, postfix);

      return decl;
    }

    return undefined;
  }

  return undefined;
}

/**
 * @param {string} css plain CSS
 * @returns {{ classes: Set<string>, tags: Set<string>, css: string, id: string }}
 */
export function getContentInfo(css) {
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
