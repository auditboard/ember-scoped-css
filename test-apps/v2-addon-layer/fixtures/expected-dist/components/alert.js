import "./alert.css"
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var alert = setComponentTemplate(precompileTemplate("\n  <div class=\"ef8c4f8c3\">\n    <h3 class=\"header_ef8c4f8c3\">\n      {{@title}}\n    </h3>\n    <p class=\"message_ef8c4f8c3 {{@some}}\">\n      {{@message}}\n    </p>\n  </div>\n", {
  strictMode: true
}), templateOnly());

export { alert as default };
//# sourceMappingURL=alert.js.map
