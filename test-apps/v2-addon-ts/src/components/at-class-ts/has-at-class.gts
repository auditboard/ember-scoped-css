import type { TOC } from '@ember/component/template-only';

const X = <template>
  <p class={{@class}} ...attributes>some text</p>
</template> as TOC<{
 Args: { class: string }, Element: HTMLParagraphElement }>;

export default X;
