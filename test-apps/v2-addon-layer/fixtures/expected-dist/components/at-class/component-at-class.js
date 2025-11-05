import "./component-at-class.css"
import HasAtClass from './has-at-class.js';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var componentAtClass = setComponentTemplate(precompileTemplate("\n  <HasAtClass @class=\"text-color_e8a5d064e\" />\n", {
  strictMode: true,
  scope: () => ({
    HasAtClass
  })
}), templateOnly());

export { componentAtClass as default };
//# sourceMappingURL=component-at-class.js.map
