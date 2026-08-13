import Component from '@glimmer/component';

export interface BannerSignature {
  Element: HTMLDivElement;
  Blocks: {
    default: [];
  };
}

export default class Banner extends Component<BannerSignature> {
  <template>
    <div class="banner" ...attributes>
      {{yield}}
    </div>

    <style scoped>
      .banner { border: 1px solid rgb(9, 8, 7); }
    </style>
  </template>
}
