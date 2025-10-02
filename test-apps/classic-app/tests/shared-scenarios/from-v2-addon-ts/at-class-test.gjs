
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import ComponentAtClass from 'v2-addon-ts/components/at-class-ts/component-at-class';

import { scopedClass } from 'ember-scoped-css/test-support';


module('[v2 Addon TS] Integration | Component | @class', function (hooks) {
  setupRenderingTest(hooks);

  test('strict mode', async function (assert) {
    console.log(ComponentAtClass);
    await render(<template>
      <ComponentAtClass />
    </template>
    );
    await this.pauseTest();

    assert
      .dom('p')
      .hasClass(
        scopedClass('text-color', 'v2-addon-ts/components/at-class-ts/component-at-class')
      );
    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 255)' });
  });

  test('loose mode', async function (assert) {
    await render(hbs`
      <AtClassTs::ComponentAtClass />
    `);

    assert
      .dom('p')
      .hasClass(
        scopedClass('text-color', 'v2-addon-ts/components/at-class-ts/component-at-class')
      );
    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 255)' });
  });
});
