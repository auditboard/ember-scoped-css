/**
 * Important docs:
 * - https://developer.mozilla.org/en-US/docs/Web/CSS/
 */
import postcss from 'postcss';
import scssSyntax from 'postcss-scss';
import parser from 'postcss-selector-parser';

import { hash, isInsideGlobal } from '../utils.js';

const SEP = '__';

function isRule(node) {
  return node.type === 'rule';
}

function isDeclaration(node) {
  return node.type === 'decl';
}

/**
 * NOTE: "keyframes" is a singular definition, in that it's a block containing keyframes
 *       using `@keyframes {}` with only one thing on the inside doesn't make sense.
 */
function rewriteReferenceable(node, postfix) {
  let originalName = node.params;
  let postfixedName = node.params + SEP + postfix;

  node.params = postfixedName;

  return {
    originalName,
    postfixedName,
  };
}

function rewriteSelector(sel, postfix) {
  const transform = (selectors) => {
    selectors.walk((selector) => {
      if (isInsideGlobal(selector)) return;

      // We never want to touch psuedo selectors since we and the user doesn't own them.
      if (selector.type === 'psuedo') return;

      // :nth-of-type has special syntax where the values passed to nth-of-type()
      // must either be exactly "odd", "even", or a simple formula
      //
      // https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-of-type
      if (isNthOfType(selector)) return;

      if (selector.type === 'class') {
        selector.value += '_' + postfix;
      } else if (selector.type === 'tag') {
        selector.replaceWith(
          parser.tag({ value: selector.value }),
          parser.className({ value: postfix }),
        );
      }
    });

    // remove :global
    selectors.walk((selector) => {
      if (selector.type === 'pseudo' && selector.value === ':global') {
        selector.replaceWith(...selector.nodes);
      }
    });
  };
  const transformed = parser(transform).processSync(sel);

  return transformed;
}

function isNthOfType(node) {
  if (!node) return false;

  return node.parent?.value === ':nth-of-type' || isNthOfType(node.parent);
}

function isInsideKeyframes(node) {
  const parent = node.parent;

  if (!parent) return false;
  if (parent.type === 'atrule' && parent.name === 'keyframes') return true;

  return isInsideKeyframes(parent);
}

/**
 * Rewrites the given CSS, scoping selectors and referenceables with the postfix.
 * Returns ONLY the scoped body. The file header and `@layer` wrapping are the
 * dispatcher's responsibility.
 *
 * @param {string} css plain CSS
 * @param {string} postfix
 * @param {{ postcss?: { plugins?: import('postcss').AcceptedPlugin[] } }} [options]
 * @return {string}
 */
export function rewrite(css, postfix, options = {}) {
  const userPlugins = options.postcss?.plugins ?? [];

  let ast;

  if (userPlugins.length) {
    const result = postcss(userPlugins).process(css, { from: undefined });

    // Force synchronous evaluation; throws if a plugin is async-only.
    result.sync();
    ast = result.root;
  } else {
    ast = postcss.parse(css);
  }

  /**
   * kind => originalName => postfixedName
   * @type {{ [kind: string]: { [originalName: string]: string }}}
   */
  const referenceables = {
    keyframes: {},
    'counter-style': {},
    'position-try': {},
    property: {},
  };

  const availableReferenceables = new Set(Object.keys(referenceables));

  function isReferenceable(node) {
    if (node.type !== 'atrule') return;

    return availableReferenceables.has(node.name);
  }

  function updateDirectReferences(node) {
    if (!node.value) return;

    for (let [, map] of Object.entries(referenceables)) {
      if (map[node.value]) {
        node.value = map[node.value];
      }
    }
  }

  function updateShorthandContents(node) {
    if (node.prop === 'animation') {
      let parts = node.value.split(' ');
      let match = parts.filter((x) => referenceables.keyframes[x]);

      if (match.length) {
        match.forEach((x) => {
          let replacement = referenceables.keyframes[x];

          if (!replacement) return;

          node.value = node.value.replace(x, replacement);
        });
      }
    }

    for (let [lookFor, replaceWith] of Object.entries(
      referenceables.property,
    )) {
      let lookForVar = `var(${lookFor})`;
      let replaceWithVar = `var(${replaceWith})`;

      node.value = node.value.replace(lookForVar, replaceWithVar);
    }
  }

  /**
   * We have to do two passes:
   * 1. postfix all the referenceable syntax
   * 2. postfix as normal, but also checking values of CSS properties
   *    that could match postfixed referenceables from step 1
   */

  // Step 1: find referenceables
  ast.walk((node) => {
    /**
     * @keyframes, @counter-style, etc
     */
    if (isReferenceable(node)) {
      let name = node.name;
      let { originalName, postfixedName } = rewriteReferenceable(node, postfix);

      referenceables[name][originalName] = postfixedName;

      return;
    }
  });

  // Step 2: postfix and update referenced referenceables
  ast.walk((node) => {
    if (isDeclaration(node)) {
      updateDirectReferences(node);
      updateShorthandContents(node);

      return;
    }

    if (isRule(node)) {
      /**
       * The inner-contents of a keyframe are percentages, rather than selectors
       */
      if (isInsideKeyframes(node)) return;

      node.selector = rewriteSelector(node.selector, postfix);

      return;
    }
  });

  return ast.toString().trimEnd();
}

/**
 * We use this function to check each class used in the template
 * to see if we need to leave it alone or transform it
 *
 * @param {string} css the CSS's contents
 * @param {{ lang?: string }} [options] optional language hint (e.g. 'scss', 'sass', 'less')
 * @return {{ classes: Set<string>, tags: Set<string>, css: string, id: string }}
 */
export function getContentInfo(css, { lang } = {}) {
  const classes = new Set();
  const tags = new Set();

  const parseOptions =
    lang === 'scss' || lang === 'sass' ? { syntax: scssSyntax } : {};

  const ast = postcss.parse(css, parseOptions);

  const isScss = lang === 'scss' || lang === 'sass';

  ast.walk((node) => {
    if (node.type === 'rule') {
      const selector = isScss ? resolveNestedSassSelector(node) : node.selector;

      getClassesAndTags(selector, classes, tags);
    }
  });

  let id = hash(css);

  return { classes, tags, css, id };
}

/**
 * Resolves a nested SCSS selector by substituting `&` with the fully-resolved
 * parent selector, recursively. This converts e.g. `&--modifier` (child of
 * `.block`) into `.block--modifier`, and handles arbitrary nesting depth so
 * that `&--modifier` inside `&--modifier` inside `.block` yields
 * `.block--modifier--modifier`.
 *
 * @param {import('postcss').Rule} node
 * @return {string}
 */
function resolveNestedSassSelector(node) {
  const { selector } = node;

  if (!selector.includes('&')) {
    return selector;
  }

  const parent = node.parent;

  if (!parent || parent.type !== 'rule') {
    // No parent rule — `&` has nothing to substitute, return as-is
    return selector;
  }

  // Recursively resolve the parent first, then substitute into this selector
  const resolvedParent = resolveNestedSassSelector(parent);

  return selector.replace(/&/g, resolvedParent);
}

function getClassesAndTags(sel, classes, tags) {
  const transform = (sls) => {
    sls.walk((selector) => {
      if (selector.type === 'class' && !isInsideGlobal(selector)) {
        classes.add(selector.value);
      } else if (selector.type === 'tag' && !isInsideGlobal(selector)) {
        tags.add(selector.value);
      }
    });
  };

  parser(transform).processSync(sel);
}
