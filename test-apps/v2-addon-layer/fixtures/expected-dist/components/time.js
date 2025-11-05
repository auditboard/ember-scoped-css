import "./time.css"
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var time = setComponentTemplate(precompileTemplate("\n  <h1 class=\"edbaa90ce\">Time</h1>\n", {
  strictMode: true
}), templateOnly());

export { time as default };
//# sourceMappingURL=time.js.map
