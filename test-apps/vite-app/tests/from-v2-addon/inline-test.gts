import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';
import Inline from 'v2-addon/components/inline';

module('from v2-addon | <Inline>', function (hooks) {
  setupRenderingTest(hooks);

  test('it has scoped class', async function (assert) {
    await render(Inline);

    assert.dom('h1').hasClass('e1fcda1af');
    assert.dom('h1').hasStyle({ color: 'rgb(0, 0, 200)' });
    assert.dom('h1').hasClass(scopedClass('v2-addon/components/inline'));
  });
});
