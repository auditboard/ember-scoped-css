import "./e1bb7ee70.css"
import Component from '@glimmer/component';
import { service } from '@ember/service';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';
import { g, i } from 'decorator-transforms/runtime-esm';

;

const A = setComponentTemplate(precompileTemplate("<div ...attributes>A</div>", {
  strictMode: true
}), templateOnly());
const B = setComponentTemplate(precompileTemplate("<div ...attributes>B</div>", {
  strictMode: true
}), templateOnly());
class StrictClass extends Component {
  static {
    g(this.prototype, "router", [service]);
  }
  #router = (i(this, "router"), void 0);
  get dynamicComponent() {
    return Math.random() < 0.5 ? A : B;
  }
  static {
    setComponentTemplate(precompileTemplate("\n    <this.dynamicComponent class=\"hello-there_e1bb7ee70\" />\n    {{yield}}\n\t", {
      strictMode: true
    }), this);
  }
}

export { StrictClass };
//# sourceMappingURL=strict-class.js.map
