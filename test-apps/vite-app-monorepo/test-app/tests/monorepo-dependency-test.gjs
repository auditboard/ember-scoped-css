import { render } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import { module, test } from 'qunit';

import { scopedClass } from 'ember-scoped-css/test-support';
import WorkspaceCard from 'vite-app-monorepo-app/workspace-card';

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
});
