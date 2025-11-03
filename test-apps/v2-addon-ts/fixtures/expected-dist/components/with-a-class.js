import "./with-a-class.css"
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import { g, i } from 'decorator-transforms/runtime-esm';

;

class WithAClass extends Component {
  static {
    g(this.prototype, "greeting", [tracked], function () {
      return 'hello there';
    });
  }
  #greeting = (i(this, "greeting"), void 0);
  static {
    setComponentTemplate(precompileTemplate("\n    <div class=\"greeting_efc49be66\">{{this.greeting}}</div>\n  ", {
      strictMode: true
    }), this);
  }
}

export { WithAClass as default };
//# sourceMappingURL=with-a-class.js.map
