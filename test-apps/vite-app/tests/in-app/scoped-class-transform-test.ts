import { module, test } from 'qunit';

import { transformed } from 'vite-app/components/scoped-class.gts';

module('[In App] scopedClass() build utility', function () {
  test('has a style on an element', function (assert) {
    assert.notStrictEqual(transformed, 'foo');
  });
});
