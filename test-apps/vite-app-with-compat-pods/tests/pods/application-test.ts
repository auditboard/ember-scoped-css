import { visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] pod:application (hbs)', function (hooks) {
  setupApplicationTest(hooks);

  test('has a style on an element', async function (assert) {
    await visit('/');

    assert
      .dom('p')
      .hasClass(
        scopedClass(
          'template-class',
          'vite-app-with-compat-pods/pods/application'
        )
      );
    assert.dom('p').hasStyle({ textDecoration: 'underline rgb(0, 0, 0)' });
  });
});
