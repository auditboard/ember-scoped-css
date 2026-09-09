import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import sharedConfig from './config.js';
import * as syntax from './syntax.js';

describe('with the ember-scoped-css rules', () => {
  it('applies the shipped config to an inline <style scoped> block', async () => {
    const code = `import Component from '@glimmer/component';

export default class MetricStat extends Component {
  <template>
    <div class="stat">{{@value}}</div>

    <style scoped>
      .stat {
        color: red;
      }

      [class$='stat'] {
        font-weight: bold;
      }
    </style>
  </template>
}
`;

    const { results } = await stylelint.lint({
      code,
      codeFilename: 'demo.gts',
      customSyntax: syntax,
      config: sharedConfig,
    });

    expect(results[0]?.warnings).toEqual([
      expect.objectContaining({
        line: 12,
        column: 7,
        rule: 'ember-scoped-css/no-unscopable-class-attribute-selectors',
      }),
    ]);
  });
});
