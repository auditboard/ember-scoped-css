import stylelint from 'stylelint';

import * as syntax from './syntax.js';

export const component = `import Component from '@glimmer/component';

export default class Demo extends Component {
  <template>
    <div class="wrapper">hi</div>

    <style scoped>
      .wrapper {
        color: #fff;
      }
    </style>
  </template>
}
`;

export async function lint(
  code: string,
  rules: stylelint.Config['rules'],
  fix = false,
) {
  return stylelint.lint({
    code,
    codeFilename: 'demo.gts',
    customSyntax: syntax,
    config: { rules },
    fix,
  });
}
