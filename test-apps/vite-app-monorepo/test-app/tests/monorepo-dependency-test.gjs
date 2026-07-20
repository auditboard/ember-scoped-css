import { render } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import { module, test } from 'qunit';

import PrefixCollisionCard from '#src/additional-other/prefix-collision-card.gjs';
import { scopedClass } from 'ember-scoped-css/test-support';
import UnrelatedCard from 'vite-app-monorepo-app-other/unrelated-card.gjs';
import WorkspaceCard from 'vite-app-monorepo-app/workspace-card.gjs';

module('monorepo dependency', function (hooks) {
  setupRenderingTest(hooks);

  test('scopes source from a sibling workspace', async function (assert) {
    await render(<template><WorkspaceCard /></template>);

    assert
      .dom('p')
      .hasClass(
        scopedClass('workspace-card', 'vite-app-monorepo-app/workspace-card')
      );
  });

  test('does not scope source outside an additional root', async function (assert) {
    await render(<template><UnrelatedCard /></template>);

    assert
      .dom('p')
      .doesNotHaveClass(
        scopedClass(
          'unrelated-card',
          'vite-app-monorepo-app-other/unrelated-card'
        )
      );
  });

  test('does not scope a same-workspace path that only shares a root prefix', async function (assert) {
    await render(<template><PrefixCollisionCard /></template>);

    assert
      .dom('p')
      .doesNotHaveClass(
        scopedClass(
          'prefix-collision-card',
          'vite-app-monorepo-test-app/additional-other/prefix-collision-card'
        )
      );
  });
});
