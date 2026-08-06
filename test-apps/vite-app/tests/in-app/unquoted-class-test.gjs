import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import UnquotedClass from 'vite-app/components/in-app/unquoted-class';

import { scopedClass } from 'ember-scoped-css/test-support';

const modulePath = 'vite-app/components/in-app/unquoted-class';

module('[In App] unquoted class attribute', function (hooks) {
  setupRenderingTest(hooks);

  test('rewrites the literals of an unquoted class attribute', async function (assert) {
    await render(<template><UnquotedClass /></template>);

    assert
      .dom('[data-test-chosen]')
      .hasClass(scopedClass('chosen', modulePath));
    assert.dom('[data-test-chosen]').hasStyle({ color: 'rgb(10, 20, 30)' });

    assert
      .dom('[data-test-fallback]')
      .hasClass(scopedClass('other', modulePath));
    assert.dom('[data-test-fallback]').hasStyle({ color: 'rgb(40, 50, 60)' });
  });

  test('leaves a class that is not in the co-located CSS alone', async function (assert) {
    await render(<template><UnquotedClass /></template>);

    assert.dom('[data-test-global]').hasClass('not-in-css');
  });

  test('postfixes the classes of an imported concat', async function (assert) {
    // concat has to be imported in strict mode, so it is trusted by name.
    await render(<template><UnquotedClass /></template>);

    assert
      .dom('[data-test-concat]')
      .hasClass(scopedClass('chosen', modulePath));
    assert.dom('[data-test-concat]').hasClass(scopedClass('extra', modulePath));
    assert.dom('[data-test-concat]').hasStyle({
      color: 'rgb(10, 20, 30)',
      fontWeight: '700',
    });
  });

  test('leaves a comparand that happens to match a class alone', async function (assert) {
    // The comparand spells a real class name, so postfixing it would make the
    // comparison fail and select the other branch.
    await render(<template><UnquotedClass /></template>);

    assert
      .dom('[data-test-comparand]')
      .hasClass(scopedClass('chosen', modulePath));
    assert.dom('[data-test-comparand]').hasStyle({ color: 'rgb(10, 20, 30)' });
  });
});
