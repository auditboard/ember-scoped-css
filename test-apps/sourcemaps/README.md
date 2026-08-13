# sourcemaps

A dedicated test project that verifies **sourcemap correctness** for
`ember-scoped-css` end-to-end, by running the *real* v2-addon rollup pipeline
(`@embroider/addon-dev` `addon.gjs()` + `addon.keepAssets()`,
`@rollup/plugin-babel` driving `ember-scoped-css/babel`, and
`ember-scoped-css/rollup`).

It lives in its own package so the test harness can use the full embroider
toolchain without adding those deps to `ember-scoped-css` itself, and so it
exercises exactly what a consuming addon ships.

## Why a real build instead of a hand-rolled pipeline?

A hand-rolled `content-tag → babel` pipeline produces *correct* maps and hides
the bug. The real pipeline reproduces it: as soon as a component imports a
colocated `.css`, `keep-assets` transforms the asset without a sourcemap,
rollup emits `SOURCEMAP_BROKEN`, and the breakage poisons both the JS chunk map
and the emitted CSS map. Plain `.gjs` / `.gts` (no colocated CSS) are fine.

## Run

```sh
pnpm test
```

Fixtures live in `src/components`; the build harness and assertions are in
`tests/`.
