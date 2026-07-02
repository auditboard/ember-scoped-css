import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import AttrScoped from 'vite-app-with-compat/components/in-app/attr-scoped';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] attr-scoped', function (hooks) {
  setupRenderingTest(hooks);

  test('scopes a native element matched by an attribute selector', async function (assert) {
    await render(<template><AttrScoped /></template>);

    assert
      .dom('button')
      .hasClass(
        scopedClass('vite-app-with-compat/components/in-app/attr-scoped')
      );
    assert.dom('button').hasStyle({ color: 'rgb(10, 20, 30)' });
  });
});
