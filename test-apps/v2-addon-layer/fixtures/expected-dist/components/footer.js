import "./footer.css"
import { concat } from '@ember/helper';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var footer = setComponentTemplate(precompileTemplate("\n  <div class=\"alert_ea7505261 ea7505261\" data-test3={{concat \"test\" \"   my-class_ea7505261 my-other-class_ea7505261  \"}} data-test2=\"  my-class_ea7505261 \" data-test=\"my-class_ea7505261\">\n    <div class=\"ea7505261\">\n      {{@title}}\n    </div>\n    <p class=\"ea7505261\">\n      {{@message}}\n    </p>\n  </div>\n", {
  strictMode: true,
  scope: () => ({
    concat
  })
}), templateOnly());

export { footer as default };
//# sourceMappingURL=footer.js.map
