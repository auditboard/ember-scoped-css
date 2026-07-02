import { visit } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] pod:top-level (hbs)', function (hooks) {
  setupApplicationTest(hooks);

  test('has a style on an element', async function (assert) {
    await visit('/top-level');

    assert
      .dom('span')
      .hasClass(
        scopedClass(
          'pod-template-class',
          'vite-app-with-compat-pods/pods/top-level'
        )
      );
    assert.dom('span').hasStyle({ fontWeight: '100', fontStyle: 'italic' });
  });

  test('scopes a native element matched by an attribute selector', async function (assert) {
    await visit('/top-level');

    assert
      .dom('button')
      .hasClass(scopedClass('vite-app-with-compat-pods/pods/top-level'));
    assert.dom('button').hasStyle({ color: 'rgb(10, 20, 30)' });
  });
});
