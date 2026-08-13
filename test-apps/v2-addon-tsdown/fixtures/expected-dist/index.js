import './style.css';
import Component from "@glimmer/component";
import { precompileTemplate } from "@ember/template-compilation";
import { setComponentTemplate } from "@ember/component";
//#region src/components/themed-button.ts
var ThemedButton = class extends Component {
	get type() {
		return "button";
	}
	static {
		setComponentTemplate(precompileTemplate("<button type={{this.type}} class=\"button_e839586a1 e839586a1\" ...attributes>\n  {{yield}}\n</button>", { strictMode: true }), this);
	}
};
//#endregion
//#region src/components/banner.ts
var Banner = class extends Component {
	static {
		setComponentTemplate(precompileTemplate("<div class=\"banner_e75b0a467\" ...attributes>\n  {{yield}}\n</div>\n\n", { strictMode: true }), this);
	}
};
//#endregion
export { Banner, ThemedButton };

//# sourceMappingURL=index.js.map