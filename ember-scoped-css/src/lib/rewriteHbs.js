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
 * param can be a class name in its own right. The condition at index 0 of
 * `if` and `unless` is excluded -- it decides which branch wins rather than
 * contributing to the class string, so postfixing it (e.g. a comparand:
 * `{{if (eq this.mode "a") "a" "b"}}`) would stop the comparison ever
 * matching. `concat` has no such condition, but fuses its params together --
 * see isWholeClassName.
 *
 * Any other helper is opaque: it may return a class name, but what it does
 * with its arguments is unknown, so those arguments are left alone.
 * `{{scopedClass "..."}}` is the way to rename a literal such a helper
 * receives.
 *
 * Matching is by name, so a block param that shadows one of these is checked
 * for -- see isShadowed.
 */
const CLASS_BUILDING_HELPERS = new Set(['if', 'unless', 'concat']);

function endsAtClassBoundary(value) {
  return /\s$/.test(value);
}

function startsAtClassBoundary(value) {
  return /^\s/.test(value);
}

/**
 * Whether the param at `index` sits in a whole-class-name position rather
 * than fused onto a neighbour -- true whether that param is itself a literal
 * or a class-building call, since a call is renamed by looking inside it
 * (see renameConcatParams), not by postfixing its result. Postfixing a
 * fused fragment would bury the postfix in the middle of the class the
 * fragments build. A neighbour whose value is only known at runtime bounds
 * nothing of its own, since it could begin or end with anything.
 *
 *   {{concat "a" " " "b"}}   -> "a" and "b", the space separates them
 *   {{concat "a" "-suffix"}} -> neither, the result is the one class a-suffix
 *   {{concat "a" this.x}}    -> not "a", it fuses with an unknown value
 *   {{concat "a " this.x}}   -> "a ", its own trailing space ends it
 */
function isWholeClassName(params, index) {
  // Only a StringLiteral has a value of its own to test for a boundary; a
  // call or a path contributes no boundary and is bounded by its neighbours
  // alone.
  const param = params[index];
  const value = param.type === 'StringLiteral' ? param.value : '';
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

/**
 * A collapsed `concat`/`if`/`unless` run becomes a StringLiteral or a
 * SubExpression (`(if ...)`), which are the right shape for a helper param
 * but not for an attribute value -- there they need to be a TextNode or
 * MustacheStatement instead.
 *
 *   "a-suffix"     -> the TextNode a-suffix
 *   (if C "a" "b") -> {{if C "a" "b"}}
 */
function toAttributeValue(node) {
  if (node.type === 'StringLiteral') return recast.builders.text(node.value);

  if (node.type === 'SubExpression') {
    return recast.builders.mustache(node.path, node.params, node.hash);
  }

  return node;
}

/**
 * How many independent `if`/`unless` conditions may be combined when
 * expanding a concat run into a decision tree. Each one roughly doubles the
 * leaves, so this bounds the blowup rather than the leaf count directly.
 */
const MAX_CONDITION_DEPTH = 2;

const EMPTY_VALUE = { kind: 'literal', value: '' };

/**
 * Concatenate two statically-known values. Two literals just join; a literal
 * against a choice distributes into both of the choice's branches, and two
 * choices nest, doubling the leaves.
 *
 *   "a" + "b"                          -> "ab"
 *   "a" + (C ? "x" : "y")              -> C ? "ax" : "ay"
 *   (C ? "x" : "y") + (D ? "1" : "2")  -> C ? (D ? "x1" : "x2") : (D ? "y1" : "y2")
 */
function concatValueExprs(left, right) {
  if (left.kind === 'literal' && right.kind === 'literal') {
    return { kind: 'literal', value: left.value + right.value };
  }

  if (left.kind === 'choice') {
    return {
      kind: 'choice',
      condition: left.condition,
      whenTrue: concatValueExprs(left.whenTrue, right),
      whenFalse: concatValueExprs(left.whenFalse, right),
    };
  }

  return {
    kind: 'choice',
    condition: right.condition,
    whenTrue: concatValueExprs(left, right.whenTrue),
    whenFalse: concatValueExprs(left, right.whenFalse),
  };
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

  /**
   * The statically-known values a class-building expression can produce,
   * shaped as the decision tree of the `if`/`unless` conditions involved.
   * `null` means the value isn't pinned down at build time -- either it's a
   * genuine runtime value, or pinning it down would need more conditions
   * than `budget` allows.
   *
   *   "a"                 -> { kind: 'literal', value: 'a' }
   *   (if C "a" "b")       -> { kind: 'choice', condition: C, whenTrue: ..., whenFalse: ... }
   *   (if C "a")           -> the same, with whenFalse the empty string
   *   this.x               -> null, an arbitrary runtime value
   *   (someHelper "a")     -> null, its contract is opaque
   *
   * `budget.remaining` is shared across one whole enumeration attempt (it is
   * not reset per branch), since sibling conditions multiply leaves exactly
   * as nested ones do.
   */
  function toValueExpr(node, budget) {
    if (node.type === 'StringLiteral') {
      return { kind: 'literal', value: node.value };
    }

    if (node.type !== 'MustacheStatement' && node.type !== 'SubExpression') {
      return null;
    }

    const name = getValue(node.path);

    if (!isClassBuilding(name)) return null;

    if (name === 'concat') {
      let combined = EMPTY_VALUE;

      for (const param of node.params ?? []) {
        const next = toValueExpr(param, budget);

        if (!next) return null;

        combined = concatValueExprs(combined, next);
      }

      return combined;
    }

    if (budget.remaining <= 0) return null;

    budget.remaining -= 1;

    const [condition, thenBranch, elseBranch] = node.params ?? [];
    const thenExpr = thenBranch ? toValueExpr(thenBranch, budget) : EMPTY_VALUE;
    const elseExpr = elseBranch ? toValueExpr(elseBranch, budget) : EMPTY_VALUE;

    if (!thenExpr || !elseExpr) return null;

    return name === 'unless'
      ? { kind: 'choice', condition, whenTrue: elseExpr, whenFalse: thenExpr }
      : { kind: 'choice', condition, whenTrue: thenExpr, whenFalse: elseExpr };
  }

  /**
   * Rename every leaf of a value tree in one pass, reporting alongside it
   * whether any leaf's value actually changed -- the tree is rebuilt either
   * way, so this is the only point that can tell without walking it twice.
   */
  function renameValueExpr(expr) {
    if (expr.kind === 'literal') {
      const value = renameClass(expr.value, postfix, classes);

      return {
        expr: { kind: 'literal', value },
        changed: value !== expr.value,
      };
    }

    const whenTrue = renameValueExpr(expr.whenTrue);
    const whenFalse = renameValueExpr(expr.whenFalse);

    return {
      expr: {
        kind: 'choice',
        condition: expr.condition,
        whenTrue: whenTrue.expr,
        whenFalse: whenFalse.expr,
      },
      changed: whenTrue.changed || whenFalse.changed,
    };
  }

  /**
   * Turn a value tree into the AST it describes -- a literal for a plain
   * leaf, or nested `if`s reproducing the conditions. A condition reused
   * across sibling branches (two independent `if`s in one concat) appears
   * more than once in the output, exactly as it would if written by hand.
   */
  function buildValueExprNode(expr) {
    if (expr.kind === 'literal') {
      return recast.builders.literal('StringLiteral', expr.value);
    }

    return recast.builders.sexpr(recast.builders.path('if'), [
      expr.condition,
      buildValueExprNode(expr.whenTrue),
      buildValueExprNode(expr.whenFalse),
    ]);
  }

  /**
   * `concat` fuses its params into one string, so a literal is only a class
   * name of its own when a boundary separates it from its neighbours (see
   * isWholeClassName). When every param's value is statically known and they
   * all fuse, the call produces one of a fixed set of class names, so
   * `concat` has nothing left to join -- the caller replaces the whole call
   * with the literal (no conditions involved) or the `if` expression (one
   * per condition) that reaches each renamed leaf.
   *
   *   {{concat "a" " " "b"}}               -> two classes, rename each, concat stays
   *   {{concat "a" "-suffix"}}             -> one class; the call is replaced by it
   *   {{concat "a" (if C "-on" "-off")}}   -> replaced by {{if C "a-on_pfx" "a-off_pfx"}}
   *   {{concat "a" this.x}}                -> "a" fuses with an unknown value, so leave it
   *
   * Returns the replacement when the call collapses; otherwise renames
   * whole-class-name params in place and returns nothing.
   */
  function renameConcatParams(node) {
    const params = node.params ?? [];
    const fuses = params.some(
      (param, index) => !isWholeClassName(params, index),
    );

    if (fuses) {
      const expr = toValueExpr(node, { remaining: MAX_CONDITION_DEPTH });
      const renamed = expr && renameValueExpr(expr);

      // Collapsing is only worth the churn if it renamed something -- and
      // only possible at all if every leaf's value was statically known.
      if (renamed?.changed) {
        return buildValueExprNode(renamed.expr);
      }

      return;
    }

    for (const [index, param] of params.entries()) {
      if (!isWholeClassName(params, index)) continue;

      params[index] = renameLiteralClasses(param);
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
   * `concat(concat(x, y), z)` joins to the same string as `concat(x, y, z)`
   * -- string concatenation doesn't care how its inputs were grouped -- so a
   * `concat` param that is itself an unshadowed `concat` call contributes
   * its own params in its place rather than surviving as a nested call.
   */
  function flattenConcatParams(params) {
    return params.flatMap((param) =>
      param.type === 'SubExpression' &&
      getValue(param.path) === 'concat' &&
      isClassBuilding('concat')
        ? flattenConcatParams(param.params ?? [])
        : [param],
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
   *   {{concat (concat "a" " " "b") "c"}}  -> {{concat "a" " " "b"}}'s own
   *                                          params joined in directly, not
   *                                          wrapped as a surviving call
   */
  function concatParts(node) {
    const parts = [];
    let pendingText = '';

    for (const param of flattenConcatParams(node.params ?? [])) {
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
   * Rename the string literals whose value reaches the class attribute, and
   * return the node that should stand in this one's place. That's the same
   * node for everything but a `concat` call that collapses to a single
   * literal or `if` expression -- see renameConcatParams.
   *
   *   {{if x "a" "b"}}                       -> both branches
   *   {{if (checkAlphabet "a" "b") "a" "b"}}  -> the branches, not the condition
   *   {{if x (concat "a" " " "b") "c"}}       -> concat's own whole-class-name params too
   *   {{if x (someHelper "a") "b"}}           -> someHelper is opaque, left alone
   *   {{concat "a" " " "b"}}                  -> every param that's a whole class name
   *   {{concat "a" "-suffix"}}                -> replaced by the renamed literal
   *   {{this.fooClass}}                       -> resolved at runtime, nothing to rename
   *
   * The shadowing checked at each depth is the one in effect at the element
   * carrying the attribute: only a block or an element can introduce a block
   * param, and neither can appear inside a subexpression, so no name can be
   * rebound part-way down a class attribute's value.
   */
  function renameLiteralClasses(node) {
    if (node.type === 'StringLiteral') {
      node.value = renameClass(node.value, postfix, classes);

      return node;
    }

    const name = getValue(node.path);

    if (!isClassBuilding(name)) return node;

    if (name === 'concat') {
      return renameConcatParams(node) ?? node;
    }

    for (let index = 1; index < (node.params?.length ?? 0); index++) {
      node.params[index] = renameLiteralClasses(node.params[index]);
    }

    return node;
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
          for (const [index, part] of node.value.parts.entries()) {
            if (part.type === 'TextNode' && part.chars) {
              const renamedClass = renameClass(part.chars, postfix, classes);

              part.chars = renamedClass;
            } else if (part.type === 'MustacheStatement') {
              node.value.parts[index] = toAttributeValue(
                renameLiteralClasses(part),
              );
            }
          }
        } else if (node.value.type === 'MustacheStatement') {
          // Glimmer parses a quoted attribute value as a ConcatStatement and
          // an unquoted one as a bare MustacheStatement, so `class={{if x
          // "a" "b"}}` lands here rather than in the branch above.
          const replaced = renameLiteralClasses(node.value);

          if (replaced.type === 'StringLiteral') node.quoteType = '"';

          node.value = toAttributeValue(replaced);
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
