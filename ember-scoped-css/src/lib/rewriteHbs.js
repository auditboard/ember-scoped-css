import recast from 'ember-template-recast';

import { renameClass } from './renameClass.js';

export function templatePlugin({ classes, tags, postfix }) {
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
      if (tags.has(node.tag)) {
        // check if class attribute already exists
        const classAttr = node.attributes.find((attr) => attr.name === 'class');

        if (classAttr) {
          classAttr.value.chars += ' ' + postfix;
        } else {
          // push class attribute
          node.attributes.push(
            recast.builders.attr('class', recast.builders.text(postfix)),
          );
        }
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

export default function rewriteHbs(hbs, classes, tags, postfix) {
  let ast = recast.parse(hbs);

  recast.traverse(ast, templatePlugin({ classes, tags, postfix }));

  let result = recast.print(ast);

  return result;
}
