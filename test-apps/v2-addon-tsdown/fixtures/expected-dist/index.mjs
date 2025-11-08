import { precompileTemplate } from "@ember/template-compilation";
import { setComponentTemplate } from "@ember/component";
import templateOnly from "@ember/component/template-only";
import { concat } from "@ember/helper";

import './index.css';
//#region src/components/alert.gjs
var alert_default = setComponentTemplate(precompileTemplate("\n  <div class=\"ef9808f67\">\n    <h3 class=\"header_ef9808f67\">\n      {{@title}}\n    </h3>\n    <p class=\"message_ef9808f67 {{@some}}\">\n      {{@message}}\n    </p>\n  </div>\n", { strictMode: true }), templateOnly());

//#endregion
//#region src/components/footer.gjs
var footer_default = setComponentTemplate(precompileTemplate("\n  <div class=\"alert_e89b8fbcc e89b8fbcc\" data-test3={{concat \"test\" \"   my-class_e89b8fbcc my-other-class_e89b8fbcc  \"}} data-test2=\"  my-class_e89b8fbcc \" data-test=\"my-class_e89b8fbcc\">\n    <div class=\"e89b8fbcc\">\n      {{@title}}\n    </div>\n    <p class=\"e89b8fbcc\">\n      {{@message}}\n    </p>\n  </div>\n", {
	strictMode: true,
	scope: () => ({ concat })
}), templateOnly());

//#endregion
//#region src/components/header.gjs
var header_default = setComponentTemplate(precompileTemplate("\n  <div class=\"alert\">\n    <div>\n      {{@title}}\n    </div>\n    <p>\n      {{@message}}\n    </p>\n  </div>\n", { strictMode: true }), templateOnly());

//#endregion
//#region src/components/inline.gts
var inline_default = setComponentTemplate(precompileTemplate("\n  <h1 class=\"eb86dbfce\">Time</h1>\n\n  \n  <style>\n    @layer firstLayer {\n      h1 { color: rgb(0, 200, 0); }\n    }\n  </style>\n", { strictMode: true }), templateOnly());
const SecondScoped = setComponentTemplate(precompileTemplate("\n  <h6 class=\"eb86dbfce\">Second Scoped</h6>\n\n  \n", { strictMode: true }), templateOnly());
const ActuallyInline = setComponentTemplate(precompileTemplate("\n  <h6 class=\"eb86dbfce\">Actually Inline</h6>\n\n  <style scoped inline>/* src/components/inline.css */\n\n    h6.eb86dbfce { color: rgb(200, 0, 0); }\n</style>\n", { strictMode: true }), templateOnly());

//#endregion
//#region src/components/time.gts
var time_default = setComponentTemplate(precompileTemplate("\n  <h1 class=\"e227860bf\">Time</h1>\n", { strictMode: true }), templateOnly());

//#endregion
export { ActuallyInline, alert_default as Alert, footer_default as Footer, header_default as Header, inline_default as Inline, SecondScoped, time_default as Time };
//# sourceMappingURL=index.mjs.map