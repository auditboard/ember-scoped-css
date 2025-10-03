import { scopedClass } from 'ember-scoped-css';

import HasAtClass from './has-at-class.gts';

import type { TOC } from '@ember/component/template-only';

export default <template>
  <HasAtClass @class={{scopedClass "text-color"}} />
</template> as TOC<{}>
