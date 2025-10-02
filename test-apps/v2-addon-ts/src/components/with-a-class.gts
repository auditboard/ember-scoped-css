import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class WithAClass extends Component {
  @tracked greeting = 'hello there';

  <template>
    <div class="greeting">{{this.greeting}}</div>
  </template>
}
