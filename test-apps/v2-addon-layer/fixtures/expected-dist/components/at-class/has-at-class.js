
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

var HasAtClass = setComponentTemplate(precompileTemplate("\n  <p class={{@class}} ...attributes>some text</p>\n", {
  strictMode: true
}), templateOnly());

export { HasAtClass as default };
//# sourceMappingURL=has-at-class.js.map
