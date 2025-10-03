import "./e4b9579df.css"
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var alert = setComponentTemplate(precompileTemplate("\n  <div class=\"e4b9579df\">\n    <h3 class=\"header_e4b9579df\">\n      {{@title}}\n    </h3>\n    <p class=\"message_e4b9579df {{@some}}\">\n      {{@message}}\n    </p>\n  </div>\n", {
  strictMode: true
}), templateOnly());

export { alert as default };
//# sourceMappingURL=alert.js.map
