import type { TOC } from '@ember/component/template-only';

export const Foo: TOC<{ Element: HTMLElement }> = <template>
  <h1 ...attributes>hi</h1>

  <style scoped>
    h1 {
      color: blue;
    }
  </style>
</template>;
