# lightningcss-only: remove the postcss processor entirely

**Date:** 2026-06-09
**Branch:** `lightningcss-processor` (stacks on the engine-swap work)
**Supersedes:** the dual-processor architecture in `2026-06-08-lightningcss-processor-design.md`. The engine swap itself (lightningcss scoping behavior, coverage, normalization trade-off) is unchanged; this spec removes the postcss path that design kept as an opt-in.

## Decision

postcss is not supported at all. lightningcss is the only CSS scoping engine. There is no `type` option, no processor dispatch, and no postcss dependency.

The released `<style scoped lang="scss|sass">` feature survives: at Babel-time, the raw source is compiled with the app's own `sass` (synchronous `compileString`), and class/tag extraction runs on the compiled CSS via lightningcss. `lang="less"` / `lang="styl"` / `lang="stylus"` are dropped and produce a clear build error.

## Why

- The multi-persona debate on the dual-processor approach surfaced its costs: permanent behavioral divergence between engines (e.g. the `@property` rename), double test surface, and an ambiguous long-term support story for the postcss opt-in. The maintainer's call: one engine, no options.
- postcss's only irreplaceable role was parsing raw scss/sass at Babel-time to extract class names for template rewriting (`getCSSContentInfo`). Everything else lightningcss already covers, byte-identical scoped class names verified across all fixture apps.
- The README already documents lang extraction as "compile to plain CSS, then extract from the compiled CSS." The implementation never did that (it lexed raw scss with `postcss-scss` and a hand-rolled `&`-substitution heuristic). This design makes the implementation match the documented behavior, and makes extraction strictly more accurate.

## Current state (what postcss does today on this branch)

1. **Opt-in rewrite engine** - `resolveProcessor` routes `type: 'postcss'`, or any non-css `lang`, to `processors/postcss.js`. Runs user `options.postcss.plugins`.
2. **Raw-dialect extraction** - `getCSSContentInfo(css, lang)` parses uncompiled scss/sass with `postcss-scss` to extract class/tag names at Babel-time (sync context), resolving `&` nesting manually. The actual scss compilation happens later, at Vite load-time, via `preprocessCSS` - after which lightningcss rewrites plain CSS.
3. Babel-time file-based extraction (`getCSSInfo` via `cssPathFor`) only ever resolves `.css` paths; colocated `.scss` never reaches the raw-dialect parser. The sync compile is needed in exactly one place: inline `<style scoped lang>` tags.

## Design

### 1. File structure (flatten - approach A)

- Delete `src/lib/css/processors/postcss.js` and `processors/postcss.test.ts`.
- Delete `src/lib/css/processors/index.js` (`resolveProcessor`) and `processors/index.test.ts`. With one engine there is nothing to resolve.
- Move `src/lib/css/processors/lightningcss.js` to `src/lib/css/lightningcss.js`; move `processors/lightningcss.test.ts` alongside it. The `processors/` directory is gone.
- New `src/lib/css/preprocess.js` owning the sync sass compile.
- `src/lib/css/rewrite.js` imports `rewrite` from `./lightningcss.js` directly. Options JSDoc shrinks to `{ lightningcss }`. It keeps owning the `/* file */` header and `@layer` wrap.
- `src/lib/css/utils.js#getCSSContentInfo(css, lang, options)`: if `lang` is present and not `'css'`, compile via `preprocess.js` first, then run lightningcss `getContentInfo` on the result. Drop the `{ lang }` argument to `getContentInfo` - it always receives plain CSS now.
- Remove `isInsideGlobal` from `utils.js` - only the postcss processor used it.

### 2. preprocess.js - sync sass compile

```
compileToCss(css, lang) -> css
```

- `lang === 'scss'` -> `sass.compileString(css, { loadPaths: [process.cwd()] }).css`
- `lang === 'sass'` -> same plus `syntax: 'indented'`
- any other lang -> throw: `[ember-scoped-css] <style scoped lang="X"> is not supported. Only scss/sass are supported (requires the 'sass' package); for other languages, precompile to CSS.`
- `sass` is resolved from the app root via `createRequire(path.join(process.cwd(), 'package.json'))` - synchronous, Babel-time safe, and mirrors how the unplugins resolve `vite` from `config.root`. It is NOT a dependency of ember-scoped-css. If resolution fails, throw: lang="scss" requires the `sass` package to be installed.
- Rationale for no new hard dependency: any working Vite setup using `lang=` already has `sass` installed, because Vite's load-time `preprocessCSS` requires it. Non-Vite builds with `lang=` already threw at load time before this change.
- Relative `@use`/`@import` inside inline style tags resolve from the component file's directory, then CWD (`compileToCss` receives the component's absolute path from the template plugin and uses `loadPaths: [dirname(componentFile), cwd]`). This matches Vite's load-time resolution, which places the virtual stylesheet next to the component. (Implementation note: the original `loadPaths: [cwd]`-only choice broke vite-app's `@use './mixins'`; component-relative resolution is required.)
- Compile errors propagate (sass's errors carry line/column context; Babel adds file context).

### 3. Options surface

- `options.type` - removed, no compat shim. It only ever existed on this unreleased branch; no npm release has it.
- `options.postcss` - removed, no compat shim, same reason (user postcss plugins were added on this branch only).
- `options.lightningcss` - stays, the only processor option: passthrough to lightningcss `transform` (`targets`, `drafts`, ...). This is the knob for controlling output conservativeness/normalization.
- JSDoc updates at every site that mentions `{ type, lightningcss, postcss }` (`rewrite.js`, `utils.js`, `template-plugin.js`, unplugins as applicable).

### 4. Dependencies (ember-scoped-css/package.json)

- Remove from `dependencies`: `postcss`, `postcss-scss`, `postcss-selector-parser`.
- Add `sass` to `devDependencies` only (unit tests for preprocess.js / scss extraction need it).
- No peer dependency declaration for `sass` - runtime resolution with a clear error, consistent with how `vite` is treated.

### 5. Behavior changes vs released 2.2.x

Everything already accepted with the engine swap (normalization: color canonicalization, `0px` -> `0`, redundant-declaration dedup; `@media` range syntax; `@property` value-declaration rename), plus, new in this spec:

- `lang="less"` / `lang="styl"` / `lang="stylus"` inline tags: build error at Babel-time. Previously extraction half-worked by accident (plain postcss lexing raw less) and classic non-Vite builds already threw at load time.
- scss/sass extraction becomes compile-accurate: classes generated by `@if`/`@each`/mixins are now extracted correctly; `&--modifier` BEM nesting still resolves (via real compilation instead of the `&`-substitution heuristic); placeholder selectors (`%foo`) are compiled away and no longer extracted as if real.
- New requirement: `sass` must be resolvable from the app root at Babel-time when `lang="scss|sass"` is used (already true in practice for working setups).
- New edge: `@use`/`@import` inside an inline `<style scoped lang>` tag must resolve at Babel-time (from the component's directory, then cwd), or the build errors.

### 6. Tests and gates

- Delete `processors/postcss.test.ts` and `processors/index.test.ts`.
- Move `processors/lightningcss.test.ts` to `src/lib/css/lightningcss.test.ts` (imports updated).
- `rewrite.test.ts` (617 lines, currently pinned to `type: 'postcss'` by commit `31d8e81` "pin rewrite snapshots to postcss"): remove the pinning wrapper, regenerate snapshots against lightningcss. Expected diff: normalization only - scoped names must remain identical. Review the snapshot diff with that lens.
- `utils.js` inline-vitest scss/sass tests stay; BEM class-set expectations should hold under real sass compilation. Snapshots updated if formatting shifts.
- New `preprocess.js` tests: scss compile, sass indented compile, unsupported-lang error message, missing-sass error path.
- Fixtures (`test-apps/*/fixtures/expected-dist`): NO regeneration expected - removing postcss does not change lightningcss output, and baselines were already regenerated for lightningcss in commit `2529746`.
- Gates before done: `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:fixture`, `pnpm test:ember`.

### 7. Release

This stacks onto the already-breaking engine swap: the next release is a major. Migration notes to carry into the changelog/PR:

- postcss is fully removed; lightningcss is the only engine. `lightningcss.targets` controls how conservative the emitted CSS is.
- The engine normalizes output (colors, zero units, redundant-declaration dedup). The dedup case deserves an explicit example in the migration notes: a longhand fallback before a shorthand override (e.g. `margin-top: 0px;` before `margin: 0 auto;`) is removed when provably redundant per spec.
- `lang=` is scss/sass-only and requires `sass` in the app.

## Out of scope

- Auto-deriving lightningcss `targets` from browserslist (rejected earlier to avoid new dependencies; unchanged).
- Branch history cleanup. Removal commits go on top of the current branch; squash at PR time if desired.
- Any support for less/stylus extraction via other means.
