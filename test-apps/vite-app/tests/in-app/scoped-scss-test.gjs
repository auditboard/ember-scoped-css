import { render } from '@ember/test-helpers';
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';

import {
  ScopedScss,
  ScopedScssMixins,
  ScopedScssAtUse,
} from 'vite-app/components/in-app/scoped-scss';

import { scopedClass } from 'ember-scoped-css/test-support';

module('[In App] scoped scss', function (hooks) {
  setupRenderingTest(hooks);

  test('scss styles are applied and class is scoped', async function (assert) {
    await render(ScopedScss);

    assert
      .dom('p')
      .hasClass(
        scopedClass('scss-hi', 'vite-app/components/in-app/scoped-scss')
      );
    assert.dom('p').hasStyle({ color: 'rgb(200, 0, 100)' });
  });

  test('mixins, variables, and nesting are compiled and scoped correctly', async function (assert) {
    await render(ScopedScssMixins);

    const scope = 'vite-app/components/in-app/scoped-scss';

    const cardClass = scopedClass('card', scope);
    const titleClass = scopedClass('card-title', scope);
    const bodyClass = scopedClass('card-body', scope);

    assert.dom(`.${cardClass}`).exists();
    assert
      .dom(`.${cardClass}`)
      .hasStyle({ display: 'flex', backgroundColor: 'rgb(240, 240, 255)' });

    assert.dom(`.${titleClass}`).exists();
    assert.dom(`.${titleClass}`).hasStyle({
      fontSize: '18px',
      fontWeight: '700',
      color: 'rgb(10, 20, 200)',
    });

    assert.dom(`.${bodyClass}`).exists();
    assert.dom(`.${bodyClass}`).hasStyle({
      fontSize: '14px',
      fontWeight: '400',
      color: 'rgb(50, 50, 50)',
    });
  });

  test('@use from an external partial applies mixins and scopes classes', async function (assert) {
    await render(ScopedScssAtUse);

    const scope = 'vite-app/components/in-app/scoped-scss';

    const btnClass = scopedClass('btn-primary', scope);
    const srClass = scopedClass('sr-label', scope);

    assert.dom(`.${btnClass}`).exists();
    assert.dom(`.${btnClass}`).hasStyle({
      display: 'inline-flex',
      backgroundColor: 'rgb(0, 112, 240)',
      color: 'rgb(255, 255, 255)',
    });

    // visually-hidden mixin: element is in the DOM but not visible
    assert.dom(`.${srClass}`).exists();
    assert.dom(`.${srClass}`).hasStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
    });
  });
});
