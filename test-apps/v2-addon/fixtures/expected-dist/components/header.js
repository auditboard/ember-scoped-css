
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

var header = setComponentTemplate(precompileTemplate("\n  <div class=\"alert\">\n    <div>\n      {{@title}}\n    </div>\n    <p>\n      {{@message}}\n    </p>\n  </div>\n", {
  strictMode: true
}), templateOnly());

export { header as default };
//# sourceMappingURL=header.js.map
