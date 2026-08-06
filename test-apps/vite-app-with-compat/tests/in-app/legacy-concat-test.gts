import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import Legacy from 'vite-app-with-compat/components/in-app/legacy-concat';

import { scopedClass } from 'ember-scoped-css/test-support';

const modulePath = 'vite-app-with-compat/components/in-app/legacy-concat';

module('[In App] legacy-concat (hbs)', function (hooks) {
  setupRenderingTest(hooks);

  test('postfixes the class concat builds out of fragments', async function (assert) {
    // Postfixing "fused" on its own would emit fused_HASH-part, which matches
    // no selector the CSS rewrite produces.
    await render(<template><Legacy /></template>);

    assert
      .dom('[data-test-fused]')
      .hasClass(scopedClass('fused-part', modulePath));
    assert.dom('[data-test-fused]').hasStyle({ color: 'rgb(11, 22, 33)' });
  });

  test('postfixes each class when a boundary separates them', async function (assert) {
    await render(<template><Legacy /></template>);

    assert.dom('[data-test-separate]').hasClass(scopedClass('one', modulePath));
    assert.dom('[data-test-separate]').hasClass(scopedClass('two', modulePath));
    assert.dom('[data-test-separate]').hasStyle({
      color: 'rgb(44, 55, 66)',
      fontWeight: '700',
    });
  });
});
