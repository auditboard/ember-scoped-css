import Component from '@glimmer/component';

export default class Hello extends Component {
  name = 'world';

  <template>
    <div>
      <h3 class="header">
        {{@title}}
      </h3>
      <p class="message">
        name:
        {{this.name}}<br />
        {{@message}}
      </p>
    </div>
  </template>
}
