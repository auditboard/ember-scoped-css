import * as recast from 'ember-template-recast';

import { renameClass } from './renameClass.js';

/**
 * Whether an element may carry an attribute that appears in a scoped
 * attribute selector. This includes component invocations: a component
 * receives the postfix class through its `...attributes` the same way it
 * receives the matched attribute, so `[type="text"]` scopes
 * `<Foo type="text">` just as it scopes `<input type="text">`.
 *
 * An element that spreads `...attributes` can receive any attribute from its
 * caller at runtime, so it counts as long as the CSS scopes by attribute at
 * all — the preserved attribute selector still decides which rules actually
 * apply.
 *
 * `attributes` comes from parsing the CSS, so it can only contain valid
 * attribute-selector names — `@args` can never be in it and needs no special
 * handling.
 *
 * Names in `attributes` are lowercased at discovery (CSS matches HTML
 * attribute names case-insensitively), so compare lowercased.
 */
function elementHasScopedAttribute(node, attributes) {
  if (attributes.size === 0) return false;

  return node.attributes.some(
    (attr) =>
      attr.name === '...attributes' || attributes.has(attr.name.toLowerCase()),
  );
}

/**
 * Helpers whose result is assembled from their own params. `concat` joins all
 * of them; `if` and `unless` return one of their branches, so their condition
 * at index 0 is excluded -- it decides which branch wins rather than
 * contributing to the class string.
 *
 * Any other helper is opaque: it may return a class name, but what it does with
 * its arguments is unknown, so those arguments are left alone.
 * `{{scopedClass "..."}}` is the way to rename a literal such a helper receives.
 */
const CLASS_BUILDING_HELPERS = new Set(['concat', 'if', 'unless']);

/**
 * Of the above, the ones a strict-mode template gets for free. `concat` is not
 * among them: strict mode requires it to be imported, and which module it came
 * from is not visible from the template, so there it could be any function.
 */
const KEYWORDS = new Set(['if', 'unless']);

function endsAtClassBoundary(value) {
  return /\s$/.test(value);
}

function startsAtClassBoundary(value) {
  return /^\s/.test(value);
}

/**
 * Whether the literal at `index` is a whole class name rather than a fragment
 * that `concat` fuses onto a neighbour. In `{{concat "a" "-suffix"}}` the "a"
 * is a fragment: the result is one class, `a-suffix`, so postfixing "a" on its
 * own would bury the postfix in the middle of it.
 */
function isWholeClassName(params, index) {
  const param = params[index];
  // A param whose value is only known at runtime is bounded by its neighbours
  // alone, so it contributes no boundary of its own.
  const value = param.type === 'StringLiteral' ? param.value : '';
  const previous = params[index - 1];
  const next = params[index + 1];

  const boundedLeft =
    startsAtClassBoundary(value) ||
    index === 0 ||
    (previous.type === 'StringLiteral' && endsAtClassBoundary(previous.value));

  const boundedRight =
    endsAtClassBoundary(value) ||
    index === params.length - 1 ||
    (next.type === 'StringLiteral' && startsAtClassBoundary(next.value));

  return boundedLeft && boundedRight;
}

export function templatePlugin({
  classes,
  tags,
  attributes,
  postfix,
  strictMode = false,
}) {
  let stack = [];
  // scoped-class is a global we allow in hbs
  // scopedClass is importable, and we'll error if someone tries to rename it
  let scopedClassCandidates = ['scoped-class', 'scopedClass'];

  function isScopedClass(str) {
    if (!str) return false;

    return scopedClassCandidates.some((candidate) => candidate === str);
  }

  /**
   * Block params introduced by elements, e.g. `<Foo as |concat|>`. The `All`
   * visitor only runs for node types that have no visitor of their own, so
   * ElementNode never reaches `stack` and has to be tracked separately.
   */
  let elementScope = [];

  /**
   * Whether `name` refers to the helper it appears to. A block param wins over
   * both a helper and a keyword, so `{{#let x as |concat|}}` puts something
   * else entirely behind the name for the length of the block.
   */
  function isShadowed(name) {
    return (
      stack.some((ancestor) => ancestor.blockParams?.includes(name)) ||
      elementScope.some((element) => element.blockParams.includes(name))
    );
  }

  function isClassBuilding(name) {
    if (!CLASS_BUILDING_HELPERS.has(name)) return false;
    if (strictMode && !KEYWORDS.has(name)) return false;

    return !isShadowed(name);
  }

  /**
   * `concat` fuses its params into one string, so a literal is only a class
   * name of its own when a boundary separates it from its neighbours.
   *
   *   {{concat "a" " " "b"}}   -> two classes, rename each
   *   {{concat "a" "-suffix"}} -> one class, fold it and rename the whole thing
   *   {{concat "a" this.x}}    -> "a" fuses with an unknown value, so leave it
   */
  function renameConcatParams(node) {
    const params = node.params ?? [];
    const allLiterals = params.every((param) => param.type === 'StringLiteral');
    const fuses = params.some(
      (param, index) => !isWholeClassName(params, index),
    );

    if (fuses && allLiterals) {
      const folded = params.map((param) => param.value).join('');
      const renamed = renameClass(folded, postfix, classes);

      // Collapsing the params is only worth the churn if it renamed something.
      if (renamed !== folded) {
        node.params = [recast.builders.literal('StringLiteral', renamed)];
      }

      return;
    }

    for (const [index, param] of params.entries()) {
      if (!isWholeClassName(params, index)) continue;

      renameLiteralClasses(param);
    }
  }

  /**
   * Rename the string literals whose value reaches the class attribute.
   *
   *   {{if x "a" "b"}}                     -> both branches
   *   {{if x "a b"}}                       -> every class in the literal
   *   {{concat "a" " " "b"}}               -> every param
   *   {{concat "a" "-suffix"}}             -> folded to one class, then renamed
   *
   *   {{this.fooClass}}                    -> resolved at runtime, nothing to rename
   *   {{someHelper "a"}}                   -> opaque; use {{scopedClass "a"}}
   *   {{if (eq this.mode "a") "a" "b"}}    -> the branches, but not the comparand
   *   {{concat "a" this.x}}                -> "a" fuses with an unknown value
   */
  function renameLiteralClasses(node) {
    if (node.type === 'StringLiteral') {
      const renamedClass = renameClass(node.value, postfix, classes);

      node.value = renamedClass;

      return;
    }

    if (node.type !== 'MustacheStatement' && node.type !== 'SubExpression') {
      return;
    }

    const name = getValue(node.path);

    if (!isClassBuilding(name)) return;

    if (name === 'concat') {
      renameConcatParams(node);

      return;
    }

    for (let branch of (node.params ?? []).slice(1)) {
      renameLiteralClasses(branch);
    }
  }

  return {
    AttrNode(node) {
      if (node.name === 'class') {
        if (node.value.type === 'TextNode' && node.value.chars) {
          const renamedClass = renameClass(node.value.chars, postfix, classes);

          node.value.chars = renamedClass;
        } else if (node.value.type === 'ConcatStatement') {
          for (let part of node.value.parts) {
            if (part.type === 'TextNode' && part.chars) {
              const renamedClass = renameClass(part.chars, postfix, classes);

              part.chars = renamedClass;
            } else if (part.type === 'MustacheStatement') {
              renameLiteralClasses(part);
            }
          }
        } else if (node.value.type === 'MustacheStatement') {
          // Glimmer parses a quoted attribute value as a ConcatStatement and an
          // unquoted one as a bare MustacheStatement, so `class={{if x "a"}}`
          // lands here rather than in the branch above.
          renameLiteralClasses(node.value);
        }
      }
    },

    ElementNode: {
      enter(node) {
        // Only elements that introduce a name need tracking, which also keeps
        // the stack balanced when a visitor removes a node and skips its exit.
        if (node.blockParams?.length) elementScope.push(node);

        // An element is in scope if its tag matches a tag selector, or if it
        // carries an attribute named in a scoped attribute selector. We add the
        // postfix class at most once regardless of how many things matched.
        const shouldScope =
          tags.has(node.tag) || elementHasScopedAttribute(node, attributes);

        if (!shouldScope) return;

        // check if class attribute already exists
        const classAttr = node.attributes.find((attr) => attr.name === 'class');

        if (!classAttr) {
          // push class attribute
          node.attributes.push(
            recast.builders.attr('class', recast.builders.text(postfix)),
          );
        } else if (classAttr.value.type === 'TextNode') {
          classAttr.value.chars += ' ' + postfix;
        } else if (classAttr.value.type === 'ConcatStatement') {
          // class="foo {{bar}}"
          classAttr.value.parts.push(recast.builders.text(' ' + postfix));
        } else {
          // class={{this.foo}} — wrap in a concat so we can append the text part
          classAttr.value = recast.builders.concat([
            classAttr.value,
            recast.builders.text(' ' + postfix),
          ]);
          classAttr.quoteType = '"';
        }
      },
      exit(node) {
        if (elementScope.at(-1) === node) elementScope.pop();
      },
    },

    All: {
      enter(node) {
        stack.push(node);
      },
      exit() {
        stack.pop();
      },
    },

    MustacheStatement(node) {
      let cssClass;

      if (
        isScopedClass(getValue(node.path)) &&
        node.params?.length === 1 &&
        node.params[0].type === 'StringLiteral'
      ) {
        cssClass = node.params[0].value;
      }

      if (
        isScopedClass(getValue(node.path?.path)) &&
        node.path?.params?.length === 1 &&
        node.path?.params[0].type === 'StringLiteral'
      ) {
        cssClass = node.path.params[0].value;
      }

      if (cssClass) {
        const textNode = recast.builders.text(renameClass(cssClass, postfix));
        const parent = stack[stack.length - 1];

        if (parent?.type === 'AttrNode') {
          parent.quoteType = '"';
        }

        return textNode;
      }
    },

    SubExpression(node) {
      if (
        isScopedClass(getValue(node.path)) &&
        node.params?.length === 1 &&
        node.params[0].type === 'StringLiteral'
      ) {
        const cssClass = node.params[0].value;
        const textNode = recast.builders.literal(
          'StringLiteral',
          renameClass(cssClass, postfix),
        );

        return textNode;
      }
    },
  };
}

function getValue(path) {
  if (!path) return;

  if ('value' in path) {
    return path.value;
  }

  /**
   * Deprecated in ember 5.9+
   * (so we use the above for newer embers)
   */
  return path.original;
}

export default function rewriteHbs(
  hbs,
  classes,
  tags,
  postfix,
  attributes = new Set(),
  strictMode = false,
) {
  let ast = recast.parse(hbs);

  recast.traverse(
    ast,
    templatePlugin({ classes, tags, attributes, postfix, strictMode }),
  );

  let result = recast.print(ast);

  return result;
}
