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
 * Helpers whose result is assembled from their own params, so a literal
 * param can be a class name in its own right. `if`'s condition at index 0 is
 * excluded -- it decides which branch wins rather than contributing to the
 * class string, so postfixing it (e.g. a comparand: `{{if (eq this.mode
 * "a") "a" "b"}}`) would stop the comparison ever matching. `concat` has no
 * such condition, but fuses its params together -- see isWholeClassName.
 *
 * Any other helper is opaque: it may return a class name, but what it does
 * with its arguments is unknown, so those arguments are left alone.
 * `{{scopedClass "..."}}` is the way to rename a literal such a helper
 * receives.
 *
 * Matching is by name, so a block param that shadows one of these is checked
 * for -- see isShadowed.
 */
const CLASS_BUILDING_HELPERS = new Set(['if', 'concat']);

function endsAtClassBoundary(value) {
  return /\s$/.test(value);
}

function startsAtClassBoundary(value) {
  return /^\s/.test(value);
}

/**
 * Whether the literal at `index` is a whole class name rather than a fragment
 * that `concat` fuses onto a neighbour. Postfixing a fragment would bury the
 * postfix in the middle of the class the fragments build. A neighbour whose
 * value is only known at runtime bounds nothing, since it could begin or end
 * with anything.
 *
 *   {{concat "a" " " "b"}}   -> "a" and "b", the space separates them
 *   {{concat "a" "-suffix"}} -> neither, the result is the one class a-suffix
 *   {{concat "a" this.x}}    -> not "a", it fuses with an unknown value
 *   {{concat "a " this.x}}   -> "a ", its own trailing space ends it
 */
function isWholeClassName(params, index) {
  const { value } = params[index];
  const previous = params[index - 1];
  const next = params[index + 1];

  const boundedLeft =
    index === 0 ||
    startsAtClassBoundary(value) ||
    (previous.type === 'StringLiteral' && endsAtClassBoundary(previous.value));

  const boundedRight =
    index === params.length - 1 ||
    endsAtClassBoundary(value) ||
    (next.type === 'StringLiteral' && startsAtClassBoundary(next.value));

  return boundedLeft && boundedRight;
}

export function templatePlugin({ classes, tags, attributes, postfix }) {
  let stack = [];
  // scoped-class is a global we allow in hbs
  // scopedClass is importable, and we'll error if someone tries to rename it
  let scopedClassCandidates = ['scoped-class', 'scopedClass'];

  function isScopedClass(str) {
    if (!str) return false;

    return scopedClassCandidates.some((candidate) => candidate === str);
  }

  /**
   * Stack of ElementNode ancestors that introduce a block param, e.g.
   * `<Foo as |if|>` -- pushed in ElementNode's own `enter` and popped in its
   * own `exit` below. A `{{#each xs as |if|}}` block has no dedicated
   * visitor, so it reaches `stack` through the generic `All` visitor
   * instead; ElementNode has its own visitor, so `All` never runs for it,
   * and this tracks it separately.
   */
  let elementScope = [];

  /**
   * Whether `name` refers to the helper it appears to. A block param wins
   * over both a helper and a keyword, so `{{#each xs as |if|}}` puts
   * something else entirely behind the name for the length of the block.
   */
  function isShadowed(name) {
    return (
      stack.some((ancestor) => ancestor.blockParams?.includes(name)) ||
      elementScope.some((element) => element.blockParams.includes(name))
    );
  }

  function isClassBuilding(name) {
    return CLASS_BUILDING_HELPERS.has(name) && !isShadowed(name);
  }

  function renameConcatParams(node) {
    const params = node.params ?? [];

    for (const [index, param] of params.entries()) {
      if (param.type !== 'StringLiteral') continue;
      if (!isWholeClassName(params, index)) continue;

      param.value = renameClass(param.value, postfix, classes);
    }
  }

  /**
   * Whether `node` is a `concat` call sitting in the class attribute's value
   * itself, where the attribute joins the call's result into its own string.
   * A `concat` nested any deeper -- an `if` branch, another `concat`'s
   * params -- has to stay one value, so it keeps its call.
   */
  function isAttributeLevelConcat(node) {
    return (
      node.type === 'MustacheStatement' &&
      getValue(node.path) === 'concat' &&
      isClassBuilding('concat')
    );
  }

  /**
   * `concat`'s own job -- joining its params into one string -- is exactly
   * what an attribute value already does natively: adjacent literal params
   * join into one `TextNode`, and each other param becomes its own part. So
   * a `concat` the attribute would join anyway can be spliced into the parts
   * it's equivalent to, leaving the existing per-part handling (below) to
   * treat it as it would a hand-written attribute string.
   *
   *   {{concat x y z}}                     -> {{x}}{{y}}{{z}}
   *   {{concat (if x y z) " " (if a b c)}} -> {{if x y z}} {{if a b c}}
   *   {{concat "a" "-suffix"}}             -> the single TextNode a-suffix
   */
  function concatParts(node) {
    const parts = [];
    let pendingText = '';

    for (const param of node.params ?? []) {
      if (param.type === 'StringLiteral') {
        pendingText += param.value;

        continue;
      }

      if (pendingText) {
        parts.push(recast.builders.text(pendingText));
        pendingText = '';
      }

      parts.push(
        param.type === 'SubExpression'
          ? recast.builders.mustache(param.path, param.params, param.hash)
          : recast.builders.mustache(param),
      );
    }

    // A ConcatStatement needs at least one part, and joining no params -- or
    // only empty ones -- still gives the empty string to carry.
    if (pendingText || parts.length === 0) {
      parts.push(recast.builders.text(pendingText));
    }

    return parts;
  }

  /**
   * Rename the string literals whose value reaches the class attribute.
   *
   *   {{if x "a" "b"}}                       -> both branches
   *   {{if (checkAlphabet "a" "b") "a" "b"}}  -> the branches, not the condition
   *   {{if x (concat "a" " " "b") "c"}}       -> concat's own whole-class-name params too
   *   {{if x (someHelper "a") "b"}}           -> someHelper is opaque, left alone
   *   {{concat "a" " " "b"}}                  -> every param that's a whole class name
   *   {{this.fooClass}}                       -> resolved at runtime, nothing to rename
   *
   * The shadowing checked at each depth is the one in effect at the element
   * carrying the attribute: only a block or an element can introduce a block
   * param, and neither can appear inside a subexpression, so no name can be
   * rebound part-way down a class attribute's value.
   */
  function renameLiteralClasses(node) {
    const name = getValue(node.path);

    if (!isClassBuilding(name)) return;

    if (name === 'concat') {
      renameConcatParams(node);

      return;
    }

    for (let param of node.params.slice(1)) {
      if (param.type === 'StringLiteral') {
        param.value = renameClass(param.value, postfix, classes);
      } else {
        renameLiteralClasses(param);
      }
    }
  }

  return {
    AttrNode(node) {
      if (node.name === 'class') {
        if (isAttributeLevelConcat(node.value)) {
          node.value = recast.builders.concat(concatParts(node.value));
          node.quoteType = '"';
        } else if (node.value.type === 'ConcatStatement') {
          // Quoting always produces a ConcatStatement, even for a value
          // that's nothing but a single concat call (`class="{{concat
          // ...}}"`), so the concat to splice away can be any one of the
          // parts rather than the whole value.
          node.value.parts = node.value.parts.flatMap((part) =>
            isAttributeLevelConcat(part) ? concatParts(part) : part,
          );
        }

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
          // Glimmer parses a quoted attribute value as a ConcatStatement and
          // an unquoted one as a bare MustacheStatement, so `class={{if x
          // "a" "b"}}` lands here rather than in the branch above.
          renameLiteralClasses(node.value);
        }
      }
    },

    ElementNode: {
      enter(node) {
        // Only elements that introduce a name need tracking, which also
        // keeps the stack balanced when a visitor removes a node and skips
        // its exit.
        if (node.blockParams?.length) elementScope.push(node);
      },

      // Appending runs on the way out so that AttrNode has already seen the
      // class attribute in its authored shape. Wrapping `class={{if ...}}` in
      // a concat first would hand AttrNode a ConcatStatement, whose every
      // string literal is a class name by assumption -- including an `if`
      // condition's, which must not be renamed.
      exit(node) {
        if (elementScope.at(-1) === node) elementScope.pop();

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
) {
  let ast = recast.parse(hbs);

  recast.traverse(ast, templatePlugin({ classes, tags, attributes, postfix }));

  let result = recast.print(ast);

  return result;
}
