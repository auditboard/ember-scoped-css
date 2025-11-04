import "./inline-css-d542ca65446c00a9a005e6e4fe7e0bbc.css"
import "./inline-css-a429dce1a164746b7f8ad15dc067290e.css"
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';

;

;

var inline = setComponentTemplate(precompileTemplate("\n  <h1 class=\"e1fcda1af\">Time</h1>\n\n  \n  <style>\n    @layer firstLayer {\n      h1 { color: rgb(0, 200, 0); }\n    }\n  </style>\n", {
  strictMode: true
}), templateOnly());
const SecondScoped = setComponentTemplate(precompileTemplate("\n  <h6 class=\"e1fcda1af\">Second Scoped</h6>\n\n  \n", {
  strictMode: true
}), templateOnly());
const ActuallyInline = setComponentTemplate(precompileTemplate("\n  <h6 class=\"e1fcda1af\">Actually Inline</h6>\n\n  <style scoped inline>/* src/components/inline.css */\n\n    h6.e1fcda1af { color: rgb(200, 0, 0); }\n</style>\n", {
  strictMode: true
}), templateOnly());

export { ActuallyInline, SecondScoped, inline as default };
//# sourceMappingURL=inline.js.map
