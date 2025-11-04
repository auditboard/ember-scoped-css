import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import Basic from 'vite-app/components/in-app/basic';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] basic', function (hooks) {
  setupRenderingTest(hooks);

  test('has a style on an element', async function (assert) {
    await render(<template><Basic /></template>);

    assert
      .dom('div')
      .hasClass(scopedClass('has-a-style', 'vite-app/components/in-app/basic'));
    assert.dom('div').hasStyle({ color: 'rgb(0, 100, 50)', fontWeight: '700' });
  });
});
