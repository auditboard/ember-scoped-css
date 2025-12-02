import { visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] pod:top-level (hbs)', function (hooks) {
  setupApplicationTest(hooks);

  test('has a style on an element', async function (assert) {
    await visit('/another');

    assert
      .dom('span')
      .hasClass(
        scopedClass(
          'pod-template-class',
          'vite-app-with-compat-pods/pods/another'
        )
      );
    assert.dom('span').hasStyle({ fontWeight: '100', fontStyle: 'italic' });
  });
});
