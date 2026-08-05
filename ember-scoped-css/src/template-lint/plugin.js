import { generateRuleTests, Rule } from 'ember-template-lint';

/**
 * `scoped-class` is the legacy hbs global; `scopedClass` is the form consumers
 * import. Both compile through the same build-time rewrite, so both are subject
 * to the same restrictions.
 */
const HELPER_NAMES = new Set(['scoped-class', 'scopedClass']);

class ScopedClassHelperRule extends Rule {
  visitor() {
    const checkScopedClass = function (node) {
      const helperName = node.path.original;

      if (!HELPER_NAMES.has(helperName)) {
        return;
      }

      if (node.params.length === 1) {
        if (node.params[0].type !== 'StringLiteral') {
          this.log({
            message: `You cannot pass dynamic values to ${helperName} helper. {{${helperName} "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md`,
            node,
          });
        }
      } else {
        this.log({
          message: `One positional param is required to be passed to ${helperName} helper. {{${helperName} "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md`,
          node,
        });
      }
    };

    return {
      MustacheStatement: checkScopedClass,
      SubExpression: checkScopedClass,
    };
  }
}

const scopedClassHelperPlugin = {
  name: 'scoped-css-plugin',
  rules: {
    'scoped-class-helper': ScopedClassHelperRule,
  },
};

export default scopedClassHelperPlugin;

import assert from 'assert';

if (import.meta.vitest) {
  const { it, describe, beforeEach } = import.meta.vitest;

  generateRuleTests({
    name: 'scoped-class-helper',

    groupMethodBefore: beforeEach,
    groupingMethod: describe,
    testMethod: it,
    plugins: [scopedClassHelperPlugin],
    config: true,
    good: [
      '{{scoped-class "test"}}',
      '{{(scoped-class "test")}}',
      '{{scopedClass "test"}}',
      '{{(scopedClass "test")}}',
      '{{some-other-helper this.someClass}}',
    ],
    bad: [
      {
        template: '{{scoped-class}}',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'One positional param is required to be passed to scoped-class helper. {{scoped-class "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '{{scoped-class this.someClass}}',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'You cannot pass dynamic values to scoped-class helper. {{scoped-class "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '{{scopedClass}}',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'One positional param is required to be passed to scopedClass helper. {{scopedClass "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '{{scopedClass this.someClass}}',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'You cannot pass dynamic values to scopedClass helper. {{scopedClass "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '{{scopedClass "first" "second"}}',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'One positional param is required to be passed to scopedClass helper. {{scopedClass "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '<Foo @class={{scopedClass this.someClass}} />',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'You cannot pass dynamic values to scopedClass helper. {{scopedClass "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
      {
        template: '<Foo @class={{if x (scopedClass this.someClass)}} />',

        verifyResults(results) {
          assert.equal(results.length, 1);
          assert.equal(
            results[0].message,
            'You cannot pass dynamic values to scopedClass helper. {{scopedClass "some-class"}}. More info: https://github.com/soxhub/ember-scoped-css/blob/main/docs/lint-rules.md',
          );
        },
      },
    ],
  });
}
