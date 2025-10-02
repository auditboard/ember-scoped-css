import { render, settled } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import SubExpression from 'classic-app/components/subexpression';
import { cell } from 'ember-resources';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] subexpression', function (hooks) {
  setupRenderingTest(hooks);

  test('it has scoped class', async function (assert) {
    const cond = cell(false);

    await render(<template>
      <SubExpression @condition={{cond.current}} />
    </template>
    );

    assert.dom('div').hasClass('global-probably');

    cond.current = true;
    await settled();


    assert
      .dom('div')
      .hasClass(
        scopedClass('a-local-class', 'classic-app/components/subexpression')
      );
    assert.dom('div').hasStyle({ color: 'rgb(0, 0, 255)' });
  });
});
