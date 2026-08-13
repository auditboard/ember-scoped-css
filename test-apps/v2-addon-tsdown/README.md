# v2-addon-tsdown

A v2 addon built with [tsdown](https://tsdown.dev) and
[`@nullvoxpopuli/ember-rolldown`](https://github.com/NullVoxPopuli/ember-rolldown)
instead of `@embroider/addon-dev` + rollup + `@rollup/plugin-babel`.

This mirrors the strategy auditboard-frontend uses for its libraries:

- `ember()` (content-tag + babel via `babel.publish.config.mjs`) runs first,
  then `scopedCSS()` from `ember-scoped-css/rollup`
- component CSS is bundled by tsdown via `@tsdown/css` into a single
  `dist/style.css`, re-imported from the modules via `css: { inject: true }` —
  so consuming apps load the stylesheet implicitly by importing a component
- declarations are emitted through the isolated-declarations pipeline, so
  `tsconfig.publish.json` sets `isolatedDeclarations: true` for `src/`

## Run

```sh
pnpm test
```

The tests build with the real tsdown CLI, assert the scoped-css output shape
in `dist/` (vitest), and then compare `dist/` byte-for-byte against the
committed snapshot in `fixtures/expected-dist` (`compare-fixture`).

When an intentional output change breaks the fixture comparison, re-snapshot:

```sh
pnpm build && rm -rf fixtures/expected-dist && cp -R dist fixtures/expected-dist
```
