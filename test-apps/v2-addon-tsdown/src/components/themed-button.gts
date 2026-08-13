import Component from '@glimmer/component';

export interface ThemedButtonSignature {
  Element: HTMLButtonElement;
  Blocks: {
    default: [];
  };
}

export default class ThemedButton extends Component<ThemedButtonSignature> {
  get type(): string {
    return 'button';
  }

  <template>
    <button type={{this.type}} class="button" ...attributes>
      {{yield}}
    </button>
  </template>
}
