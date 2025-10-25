export const ScopedFoo = <template>
  <p class="hi">hi</p>
  <style scoped>
    .hi {
      color: rgb(0, 0, 200);
    }
  </style>
</template>;

export const ScopedInlineFoo = <template>
  <p class="hello">hi</p>
  <style scoped inline>
    .hello {
      color: rgb(0, 200, 0);
    }
  </style>
</template>;

const fromSomewhere = 'rgb(0, 200, 0)';

export const ScopedInlineInterpolated = <template>
  <p class="intern">hi</p>
  <style
    scoped
    inline
  >
    .intern {
      color: {{fromSomewhere}};
    }
  </style>
</template>;
