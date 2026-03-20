export const ScopedScss = <template>
  <p class="scss-hi">hello from scss</p>
  <style
    scoped
    lang="scss"
  >
    .scss-hi {
      $color: rgb(200, 0, 100);

      color: $color;

      &:focus {
        outline: none;
      }
    }
  </style>
</template>;

export const ScopedScssMixins = <template>
  <div class="card">
    <span class="card-title">title</span>
    <span class="card-body">body</span>
  </div>
  <style
    scoped
    lang="scss"
  >
    @mixin flex-center($gap: 0px) {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $gap;
    }

    @mixin font-style($size, $weight) {
      font-size: $size;
      font-weight: $weight;
    }

    $border-radius: 4px;
    $padding: 8px;

    .card {
      @include flex-center(4px);
      padding: $padding;
      border-radius: $border-radius;
      background-color: rgb(240, 240, 255);

      .card-title {
        @include font-style(18px, 700);
        color: rgb(10, 20, 200);
      }

      .card-body {
        @include font-style(14px, 400);
        color: rgb(50, 50, 50);
      }
    }
  </style>
</template>;

export const ScopedScssAtUse = <template>
  <button type="button" class="btn-primary">click me</button>
  <span class="sr-label">accessible label</span>
  <style
    scoped
    lang="scss"
  >
    @use './mixins' as m;

    .btn-primary {
      @include m.button-base(rgb(0, 112, 240), rgb(255, 255, 255));
    }

    .sr-label {
      @include m.visually-hidden;
    }
  </style>
</template>;
