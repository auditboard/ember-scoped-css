import "./e9a64d6f1.css"
import { concat } from '@ember/helper';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var footer = setComponentTemplate(precompileTemplate("\n  <div class=\"alert_e9a64d6f1 e9a64d6f1\" data-test3={{concat \"test\" \"   my-class_e9a64d6f1 my-other-class_e9a64d6f1  \"}} data-test2=\"  my-class_e9a64d6f1 \" data-test=\"my-class_e9a64d6f1\">\n    <div class=\"e9a64d6f1\">\n      {{@title}}\n    </div>\n    <p class=\"e9a64d6f1\">\n      {{@message}}\n    </p>\n  </div>\n", {
  strictMode: true,
  scope: () => ({
    concat
  })
}), templateOnly());

export { footer as default };
//# sourceMappingURL=footer.js.map
