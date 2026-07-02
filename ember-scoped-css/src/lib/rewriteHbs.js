import * as recast from 'ember-template-recast';

import { renameClass } from './renameClass.js';

/**
 * Whether an element carries an attribute that appears in a scoped attribute
 * selector. This includes component invocations: a component receives the
 * postfix class through its `...attributes` the same way it receives the
 * matched attribute, so `[type="text"]` scopes `<Foo type="text">` just as it
 * scopes `<input type="text">`.
 *
 * `attributes` comes from parsing the CSS, so it can only contain valid
 * attribute-selector names — `@args` and `...attributes` can never be in it
 * and need no special handling.
 *
 * Names in `attributes` are lowercased at discovery (CSS matches HTML
 * attribute names case-insensitively), so compare lowercased.
 */
function elementHasScopedAttribute(node, attributes) {
  return node.attributes.some((attr) =>
    attributes.has(attr.name.toLowerCase()),
  );
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
              recast.traverse(part, {
                StringLiteral(node) {
                  const renamedClass = renameClass(
                    node.value,
                    postfix,
                    classes,
                  );

                  node.value = renamedClass;
                },
              });
            }
          }
        }
      }
    },

    ElementNode(node) {
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
