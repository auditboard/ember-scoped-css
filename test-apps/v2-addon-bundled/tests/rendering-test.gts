import { direct, virtual } from 'v2-addon-bundled';

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { scopedClass } from 'ember-scoped-css/test-support';

module('example', function (hooks) {
  setupRenderingTest(hooks);

  test('direct', async function (assert) {
    await render(<template><direct.Foo /></template>);

    assert.dom('p').hasStyle({ color: 'rgb(0, 244, 0)' });
    assert
      .dom('p')
      .hasClass(
        scopedClass('green', 'v2-addon-bundled/components/from-direct/example'),
      );
  });
  test('virtual', async function (assert) {
    await render(<template><virtual.Foo /></template>);

    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 244)' });
    assert
      .dom('p')
      .hasClass(
        scopedClass('blue', 'v2-addon-bundled/components/from-virtual/example'),
      );
  });
});
