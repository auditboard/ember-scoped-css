import { concat } from "@ember/helper";
import { precompileTemplate } from "@ember/template-compilation";
import { setComponentTemplate } from "@ember/component";
import templateOnly from "@ember/component/template-only";

import './card-aEcGhfWu.css';
//#region src/components/footer.gjs
var footer_default = setComponentTemplate(precompileTemplate("\n  <div class=\"alert_e89b8fbcc e89b8fbcc\" data-test3={{concat \"test\" \"   my-class_e89b8fbcc my-other-class_e89b8fbcc  \"}} data-test2=\"  my-class_e89b8fbcc \" data-test=\"my-class_e89b8fbcc\">\n    <div class=\"e89b8fbcc\">\n      {{@title}}\n    </div>\n    <p class=\"e89b8fbcc\">\n      {{@message}}\n    </p>\n  </div>\n", {
	strictMode: true,
	scope: () => ({ concat })
}), templateOnly());

//#endregion
//#region src/components/header.gjs
var header_default = setComponentTemplate(precompileTemplate("\n  <div class=\"alert\">\n    <div>\n      {{@title}}\n    </div>\n    <p>\n      {{@message}}\n    </p>\n  </div>\n", { strictMode: true }), templateOnly());

//#endregion
//#region src/card.gjs
var card_default = setComponentTemplate(precompileTemplate("\n  <Header />\n  <Footer />\n", {
	strictMode: true,
	scope: () => ({
		Header: header_default,
		Footer: footer_default
	})
}), templateOnly());

//#endregion
export { header_default as n, footer_default as r, card_default as t };
//# sourceMappingURL=card-JHSCjVpW.mjs.map