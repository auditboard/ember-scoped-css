/**
 * Important docs:
 * - https://developer.mozilla.org/en-US/docs/Web/CSS/
 */
import postcss from 'postcss';
import parser from 'postcss-selector-parser';

import { renameClass } from '../renameClass.js';
import { isInsideGlobal } from './utils.js';

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
 * Class-targeting attribute selectors whose value is a real class name
 * (`[class="foo"]`, `[class~="foo"]`) are scoped by renaming the value the same
 * way `.foo` is renamed to `.foo_postfix`. The renamed token is unique, so the
 * postfix class is not needed (mirrors the class-renaming strategy).
 *
 * Every other attribute selector keeps its discriminator and is scoped by
 * adding the postfix class (mirrors the tag strategy: `div` -> `div.postfix`).
 */
function isRenamedClassAttribute(node) {
  return (
    node.attribute === 'class' &&
    (node.operator === '=' || node.operator === '~=') &&
    Boolean(node.value)
  );
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
        needsPostfixClass.push(selector);
      } else if (selector.type === 'attribute') {
        if (isRenamedClassAttribute(selector)) {
          // Bucket A: rewrite the value to track the renamed class. The
          // renamed token (e.g. `foo_postfix`) is already unique per file, so
          // no postfix class is needed.
          selector.value = renameClass(selector.value, postfix);
          if (!selector.quoteMark) selector.quoteMark = '"';
        } else {
          // Bucket B: keep the discriminator, scope with the postfix class.
          //
          // `[class|="foo"]` cannot be fully scoped via renaming and only
          // matches by the preserved value, so it falls back to the postfix
          // class like any other Bucket B selector. That imprecision is
          // surfaced to authors by the
          // `ember-scoped-css/no-unscopable-class-attribute-selector`
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
