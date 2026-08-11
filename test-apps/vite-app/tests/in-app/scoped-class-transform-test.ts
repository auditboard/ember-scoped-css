import { module, test } from 'qunit';

import {
  transformed,
  transformedMultiple,
} from 'vite-app/components/scoped-class.gts';
import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] scopedClass() build utility', function () {
  test('has a style on an element', function (assert) {
    assert.notStrictEqual(transformed, 'foo');
    assert.strictEqual(
      transformed,
      scopedClass('foo', 'vite-app/components/scoped-class')
    );
  });

  test('postfixes every class of a multi-class argument', function (assert) {
    assert.notStrictEqual(transformedMultiple, 'foo bar');
    assert.strictEqual(
      transformedMultiple,
      scopedClass('foo bar', 'vite-app/components/scoped-class')
    );
  });
});
