import {scopedClass} from 'ember-scoped-css';

import HasAtClass from './has-at-class.gjs';

export default <template>
  <HasAtClass @class={{scopedClass "text-color"}} />
</template>
