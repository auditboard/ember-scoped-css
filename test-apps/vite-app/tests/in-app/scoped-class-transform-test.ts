import { module, test } from 'qunit';

import { transformed } from 'vite-app/components/scoped-class.gts';
import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] scopedClass() build utility', function () {
  test('has a style on an element', function (assert) {
    assert.notStrictEqual(transformed, 'foo');
    assert.strictEqual(
      transformed,
      scopedClass('foo', 'vite-app/components/scoped-class')
    );
  });
});
