import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import CallsAtHasClass from '#components/in-app/at-class-ts/calls-has-at-class';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] at-class-ts', function (hooks) {
  setupRenderingTest(hooks);

  test('calls component with @class', async function (assert) {
    await render(<template><CallsAtHasClass /></template>);

    assert
      .dom('p')
      .hasClass(
        scopedClass(
          'text-color',
          'vite-app/components/in-app/at-class-ts/calls-has-at-class'
        )
      );
    assert.dom('p').hasStyle({ color: 'rgb(51, 51, 119)' });
  });
});
