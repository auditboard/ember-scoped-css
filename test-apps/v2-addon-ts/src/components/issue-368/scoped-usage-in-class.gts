import Component from '@glimmer/component';

import { scopedClass } from 'ember-scoped-css';

export interface FieldSignature<T> {
  Element: HTMLInputElement;
  Args: {
    error: boolean;
  };
  Blocks: {
    default: [];
  };
}

export default class Field<T> extends Component<FieldSignature<T>> {
  <template>
    <style scoped>
      .field {
        background: blue;
      }

      .error {
        background: red;
      }
    </style>
    <h1 class={{if @error (scopedClass "error") (scopedClass "field")}}>
      Hello world
    </h1>
  </template>
}
