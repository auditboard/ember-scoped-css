
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { module, test } from 'qunit';

import { setupRenderingTest } from 'ember-qunit';
import ComponentAtClass from 'v2-addon/components/at-class/component-at-class';

import { scopedClass } from 'ember-scoped-css/test-support';


module('[v2 Addon JS] Integration | Component | @class', function (hooks) {
  setupRenderingTest(hooks);

  test('strict mode', async function (assert) {
    await render(<template>
      <ComponentAtClass />
    </template>
    );

    assert
      .dom('p')
      .hasClass(
        scopedClass('text-color', 'v2-addon/components/at-class/component-at-class')
      );
    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 255)' });
  });

  test('loose mode', async function (assert) {
    await render(hbs`
      <AtClass::ComponentAtClass />
    `);

    assert
      .dom('p')
      .hasClass(
        scopedClass('text-color', 'v2-addon/components/at-class/component-at-class')
      );
    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 255)' });
  });
});
