import { tracked } from '@glimmer/tracking';
import { render, settled } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

module('[In App] DynamicAttribute', function (hooks) {
  setupRenderingTest(hooks);

  test('it has scoped class', async function (assert) {
    class State {
      @tracked ya = true;
    }

    const state = new State();

    this.setProperties({ state });
    await render(hbs`<DynamicAttribute @foo={{this.state.ya}}/>`);

    assert.dom('div').hasClass('is-foo_e3cf3bd44');
    assert.dom('div').hasStyle({ color: 'rgb(0, 0, 255)' });

    state.ya = false;
    await settled();

    assert.dom('div').hasClass('is-not-foo_e3cf3bd44');
    assert.dom('div').hasStyle({ color: 'rgb(255, 0, 0)' });
  });
});
