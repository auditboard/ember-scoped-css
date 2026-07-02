import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import CallsChild from 'vite-app/components/in-app/attr-scoped/calls-child';
import AttrScopedElement from 'vite-app/components/in-app/attr-scoped/element';
import AttrScopedSplat from 'vite-app/components/in-app/attr-scoped/splat';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] attr-scoped', function (hooks) {
  setupRenderingTest(hooks);

  test('scopes a native element matched by an attribute selector', async function (assert) {
    await render(AttrScopedElement);

    assert
      .dom('button')
      .hasClass(scopedClass('vite-app/components/in-app/attr-scoped/element'));
    assert.dom('button').hasStyle({ color: 'rgb(10, 20, 30)' });
  });

  test('scopes a component invocation matched by an attribute selector', async function (assert) {
    // The generated scoping class reaches the child's root element through `...attributes`
    // the same way the `data-variant` attribute does, so the parent's
    // `[data-variant="primary"]` rule applies to it.
    await render(CallsChild);

    assert
      .dom('span')
      .hasClass(
        scopedClass('vite-app/components/in-app/attr-scoped/calls-child')
      );
    assert.dom('span').hasStyle({ color: 'rgb(40, 50, 60)' });
  });

  test('scopes an element that spreads ...attributes', async function (assert) {
    // `...attributes` can deliver any attribute at runtime, so the element
    // receives the generated class; the preserved `[disabled]` selector still
    // decides whether the rule applies.
    await render(<template><AttrScopedSplat disabled /></template>);

    assert
      .dom('button')
      .hasClass(scopedClass('vite-app/components/in-app/attr-scoped/splat'));
    assert.dom('button').hasStyle({ color: 'rgb(70, 80, 90)' });
  });
});
