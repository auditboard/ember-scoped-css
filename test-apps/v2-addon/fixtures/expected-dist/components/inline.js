import "./e1fcda1af.css"
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

var inline = setComponentTemplate(precompileTemplate("\n  <h1 class=\"e1fcda1af\">Time</h1>\n\n  \n  <style>\n    @layer firstLayer {\n      h1 { color: rgb(0, 200, 0); }\n    }\n  </style>\n", {
  strictMode: true
}), templateOnly());

export { inline as default };
//# sourceMappingURL=inline.js.map
