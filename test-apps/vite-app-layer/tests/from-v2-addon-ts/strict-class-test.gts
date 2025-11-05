import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import { scopedClass } from 'ember-scoped-css/test-support';
import { StrictClass } from 'v2-addon-ts/components/strict-class';

module('from v2-addon-ts | <StrictClass>', function (hooks) {
  setupRenderingTest(hooks);

  test('it has scoped class', async function (assert) {
    await render(
      <template>
        <StrictClass>
          hi
        </StrictClass>
      </template>
    );

    assert.dom('div').hasClass('hello-there_e1bb7ee70');
    assert.dom('div').hasStyle({ color: 'rgb(1, 2, 3)' });
    assert
      .dom('div')
      .hasClass(
        scopedClass('hello-there', 'v2-addon-ts/components/strict-class')
      );
  });
});
