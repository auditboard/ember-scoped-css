import { scopedClass } from 'ember-scoped-css';

import HasAtClass from './has-at-class.gts';

import type { TOC } from '@ember/component/template-only';

export default <template>
  {{! template-lint-disable require-presentational-children }}
  <li class="item">
    <div class="button">
      <div class="layout">
        <div class="status">
          <div class="circle" />
          <HasAtClass @class={{scopedClass "svg-completed"}} />
          <HasAtClass @class={{scopedClass "svg-skipped "}} />
        </div>
      </div>
    </div>
  </li>
</template> as TOC<{}>
