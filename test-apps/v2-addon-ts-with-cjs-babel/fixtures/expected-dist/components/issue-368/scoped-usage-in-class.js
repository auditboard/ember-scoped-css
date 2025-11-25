import "./scoped-usage-in-class-css-afd67848cb3760288f86391a08dac515.css"
import Component from '@glimmer/component';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';

;

class Field extends Component {
  static {
    setComponentTemplate(precompileTemplate("\n    \n    <h1 class={{if @error \"error_e337bece8\" \"field_e337bece8\"}}>\n      Hello world\n    </h1>\n  ", {
      strictMode: true
    }), this);
  }
}

export { Field as default };
//# sourceMappingURL=scoped-usage-in-class.js.map
