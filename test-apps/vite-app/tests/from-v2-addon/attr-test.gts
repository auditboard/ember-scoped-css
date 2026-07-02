import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';
import Attr from 'v2-addon/components/attr';

module('from v2-addon | attribute selector', function (hooks) {
  setupRenderingTest(hooks);

  test('scopes a native element matched by an attribute selector', async function (assert) {
    await render(Attr);

    assert.dom('button').hasClass(scopedClass('v2-addon/components/attr'));
    assert.dom('button').hasStyle({ color: 'rgb(10, 20, 30)' });
  });
});
