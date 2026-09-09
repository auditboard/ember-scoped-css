import { describe, expect, it } from 'vitest';

import { component, lint } from './syntax.test-helpers.js';

describe('--fix', () => {
  it('rewrites the CSS and leaves the surrounding component byte-for-byte', async () => {
    const { code } = await lint(
      component,
      { 'color-hex-length': 'long' },
      true,
    );

    expect(code).toBe(component.replace('#fff', '#ffffff'));
  });

  it('returns a component with no style blocks unchanged', async () => {
    const source = `import Component from '@glimmer/component';

export default class Demo extends Component {
  <template>
    <div class="wrapper">hi</div>
  </template>
}
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(source);
  });

  it('preserves the source between two fixed blocks', async () => {
    const source = `export const One = <template>
  <style scoped>
    .a { color: #aaa; }
  </style>
</template>;

export const Two = <template>
  <style scoped>
    .b { color: #bbb; }
  </style>
</template>;
`;

    const { code } = await lint(source, { 'color-hex-length': 'long' }, true);

    expect(code).toBe(
      source.replace('#aaa', '#aaaaaa').replace('#bbb', '#bbbbbb'),
    );
  });
});
