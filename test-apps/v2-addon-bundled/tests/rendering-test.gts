import { direct, virtual } from 'v2-addon-bundled';

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';

module('example', function (hooks) {
  setupRenderingTest(hooks);

  test('direct', async function (assert) {
    await render(<template><direct.foo /></template>);

    assert.dom('p').hasStyle({ color: 'rgb(0, 244, 0)' });
  });
  test('virtual', async function (assert) {
    await render(<template><virtual.foo /></template>);

    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 244)' });
  });
});
