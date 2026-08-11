import { render, settled } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { tracked } from '@glimmer/tracking';

import Legacy from 'vite-app-with-compat/components/in-app/legacy-if-literal';

import { scopedClass } from 'ember-scoped-css/test-support';

function cell<T>(value: T) {
  return new (class {
    @tracked current = value;
  })();
}

module('[In App] legacy-if-literal (hbs)', function (hooks) {
  setupRenderingTest(hooks);

  test('postfixes a bare literal branch of an unquoted if', async function (assert) {
    const truthiness = cell(true);
    await render(
      <template><Legacy @isTrue={{truthiness.current}} /></template>
    );

    assert
      .dom('div')
      .hasClass(
        scopedClass(
          'on',
          'vite-app-with-compat/components/in-app/legacy-if-literal'
        )
      );
    assert.dom('div').hasStyle({ color: 'rgb(10, 20, 30)' });

    truthiness.current = false;
    await settled();

    assert
      .dom('div')
      .hasClass(
        scopedClass(
          'off',
          'vite-app-with-compat/components/in-app/legacy-if-literal'
        )
      );
    assert.dom('div').hasStyle({ color: 'rgb(40, 50, 60)' });
  });
});
