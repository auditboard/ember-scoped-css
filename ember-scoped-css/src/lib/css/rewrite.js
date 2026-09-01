/**
 * Important docs:
 * - https://developer.mozilla.org/en-US/docs/Web/CSS/
 */
import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { renameClass } from '../renameClass.js';
import { isInsideGlobal, isRenamedClassAttribute } from './utils.js';

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

/**
 * Walk left and right from `node` within its compound selector (bounded by
 * combinators) to see if the postfix class has already been added. Used to add
 * the postfix class at most once per compound, e.g. `input[type="text"]`
 * becomes `input.postfix[type="text"]`, not `input.postfix[type="text"].postfix`.
 */
function compoundHasPostfixClass(node, postfix) {
  const siblings = node.parent.nodes;
  const index = siblings.indexOf(node);

  for (let i = index; i >= 0; i--) {
    if (siblings[i].type === 'combinator') break;
    if (siblings[i].type === 'class' && siblings[i].value === postfix)
      return true;
  }

  for (let i = index + 1; i < siblings.length; i++) {
    if (siblings[i].type === 'combinator') break;
    if (siblings[i].type === 'class' && siblings[i].value === postfix)
      return true;
  }

  return false;
}

function addPostfixClass(node, postfix) {
  if (compoundHasPostfixClass(node, postfix)) return;

  node.parent.insertAfter(node, parser.className({ value: postfix }));
}

function rewriteSelector(sel, postfix) {
  const transform = (selectors) => {
    // Nodes that need the postfix class added next to them. We collect them
    // during the walk and insert the classes afterwards so the freshly-inserted
    // classes are never themselves re-visited by the walk.
    const needsPostfixClass = [];

    selectors.walk((selector) => {
      if (isInsideGlobal(selector)) return;

      if (isInAnPlusB(selector)) return;

      if (selector.type === 'class') {
        selector.value += '_' + postfix;
      } else if (selector.type === 'tag') {
        needsPostfixClass.push(selector);
      } else if (selector.type === 'attribute') {
        if (isRenamedClassAttribute(selector)) {
          // The renamed token (e.g. `foo_postfix`) is already unique per
          // file, so no postfix class is needed.
          selector.value = renameClass(selector.value, postfix);
          if (!selector.quoteMark) selector.quoteMark = '"';
        } else {
          // `[class|="foo"]` and `[class$="foo"]` cannot be reliably scoped
          // with the postfix class (the postfix class defeats them). That is
          // surfaced to authors by the
          // `ember-scoped-css/no-unscopable-class-attribute-selectors`
          // stylelint rule rather than a runtime warning.
          needsPostfixClass.push(selector);
        }
      }
    });

    for (const node of needsPostfixClass) {
      addPostfixClass(node, postfix);
    }

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

/**
 * Pseudo-classes whose argument starts with an An+B value ("odd", "even", or a
 * formula such as `2n + 1`).
 *
 * https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors#tree-structural_pseudo-classes
 */
const AN_PLUS_B_PSEUDOS = new Set([
  ':nth-child',
  ':nth-last-child',
  ':nth-of-type',
  ':nth-last-of-type',
  ':nth-col',
  ':nth-last-col',
]);

/**
 * An An+B value is not a selector, but postcss-selector-parser has no dedicated
 * node for it and parses it as ordinary tag/combinator nodes (`2n + 1` becomes
 * tag `2n`, combinator `+`, tag `1`). Scoping those emits invalid CSS like
 * `:nth-child(2.postfix)`, which invalidates the whole selector list.
 *
 * `:nth-child()` and `:nth-last-child()` also accept a trailing
 * `of <selector-list>`. That part *is* a selector, so it is scoped as usual --
 * only the An+B value ahead of the `of` keyword is off limits.
 *
 * @param {import('postcss-selector-parser').Node} node
 * @returns {boolean}
 */
function isInAnPlusB(node) {
  let argument = node;

  while (argument.parent) {
    const parent = argument.parent;

    if (
      parent.type === 'pseudo' &&
      AN_PLUS_B_PSEUDOS.has(parent.value.toLowerCase())
    ) {
      return !isInOfSelectorList(node, argument, parent);
    }

    argument = parent;
  }

  return false;
}

/**
 * Whether `node` belongs to the `of <selector-list>` part of a positional
 * pseudo-class rather than to its An+B value.
 *
 * The `of` keyword lives in the pseudo-class's first argument, and a comma in
 * the selector list starts another argument -- `:nth-child(2 of .b, .c)` parses
 * as the two arguments `2 of .b` and `.c` -- so everything after the first
 * argument is part of the list.
 *
 * @param {import('postcss-selector-parser').Node} node
 * @param {import('postcss-selector-parser').Container} argument the argument `node` sits in
 * @param {import('postcss-selector-parser').Pseudo} pseudo
 * @returns {boolean}
 */
function isInOfSelectorList(node, argument, pseudo) {
  const [first] = pseudo.nodes;

  if (!first) return false;

  const ofIndex = first.nodes.findIndex(
    (sibling) => sibling.type === 'tag' && sibling.value.toLowerCase() === 'of',
  );

  if (ofIndex === -1) return false;
  if (argument !== first) return true;
  // The argument container itself sits ahead of everything in it.
  if (node === argument) return false;

  // `node` may be nested (e.g. `.b` in `:nth-child(2 of .b:hover)`), so compare
  // against whichever ancestor is a direct child of the argument.
  let top = node;

  while (top.parent !== argument) top = top.parent;

  return first.nodes.indexOf(top) > ofIndex;
}

function isInsideKeyframes(node) {
  const parent = node.parent;

  if (!parent) return false;
  if (parent.type === 'atrule' && parent.name === 'keyframes') return true;

  return isInsideKeyframes(parent);
}

export function rewriteCss(css, postfix, fileName, layerName) {
  const ast = postcss.parse(css);
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

  function updateDeclarationName(node) {
    let replacement = referenceables.property[node.prop];

    if (replacement) {
      node.prop = replacement;
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
      updateDeclarationName(node);
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

  const rewrittenCss = ast.toString();

  return (
    [
      `/* ${fileName} */`,
      layerName ? `@layer ${layerName} {` : '',
      rewrittenCss.trimEnd(),
      layerName ? `}` : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n'
  );
}
