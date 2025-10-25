import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import {
  ScopedFoo,
  ScopedInlineFoo,
  ScopedInlineInterpolated,
} from 'vite-app/components/in-app/scoped';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] scoped', function (hooks) {
  setupRenderingTest(hooks);

  test('has a style on an element', async function (assert) {
    await render(ScopedFoo);

    assert
      .dom('p')
      .hasClass(scopedClass('hi', 'vite-app/components/in-app/scoped'));
    assert.dom('p').hasStyle({ color: 'rgb(0, 0, 200)' });
  });

  test('inline has a style on an element', async function (assert) {
    await render(ScopedInlineFoo);

    assert
      .dom('p')
      .hasClass(scopedClass('hello', 'vite-app/components/in-app/scoped'));
    assert.dom('p').hasStyle({ color: 'rgb(0, 200, 0)' });
  });

  test('inline allows interpolation', async function (assert) {
    await render(ScopedInlineInterpolated);

    assert
      .dom('p')
      .hasClass(scopedClass('intern', 'vite-app/components/in-app/scoped'));
    assert.dom('p').hasStyle({ color: 'rgb(0, 200, 0)' });
  });
});
