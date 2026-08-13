import Component from "@glimmer/component";
//#region src/components/themed-button.d.ts
interface ThemedButtonSignature {
  Element: HTMLButtonElement;
  Blocks: {
    default: [];
  };
}
declare class ThemedButton extends Component<ThemedButtonSignature> {
  get type(): string;
}
//#endregion
//#region src/components/banner.d.ts
interface BannerSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [];
  };
}
declare class Banner extends Component<BannerSignature> {}
//#endregion
export { Banner, type BannerSignature, ThemedButton, type ThemedButtonSignature };
//# sourceMappingURL=index.d.ts.map