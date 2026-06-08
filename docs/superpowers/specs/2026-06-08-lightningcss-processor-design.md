# Pluggable CSS Processors with lightningcss as Default

**Date:** 2026-06-08
**Issue:** [#320 — Migrate to lightningcss?](https://github.com/auditboard/ember-scoped-css/issues/320)
**Status:** Approved design, pending implementation plan

## Summary

Introduce a pluggable CSS processor layer for ember-scoped-css's scoping
transform. lightningcss becomes the default engine; the existing postcss-based
engine is kept as a configurable, opt-in processor. Both processors implement
the same logical transform behind a shared interface, and a thin resolver
selects the right one per file based on language (overridable via a global
`type` option).

This is non-breaking by default: the default "vanilla CSS" path is not, and
will not become, user-configurable beyond passing options through; SCSS keeps
working out of the box because SCSS files auto-route to the postcss processor
(the only one that can parse raw SCSS at Babel time).

## Motivation

lightningcss (Rust) is substantially faster than postcss and has first-class
sourcemap and modern-CSS support. The issue lands on the architecture: "implement
the same transform for each processor, keyed off `type`," with lightningcss as the
default and postcss exposed as a configurable opt-in (e.g. for postcss plugins).

## Constraints

- **lightningcss cannot parse raw SCSS.** SCSS uses `$variables`, mixins,
  `@include`, and functions that are not valid CSS. lightningcss will fail or
  drop them.
- Two distinct call sites consume postcss today, with different inputs:
  1. **`rewriteCss`** (the scoping transform) — always runs on *plain CSS*.
     In the colocated Vite flow, SCSS/LESS is preprocessed by Vite's
     `preprocessCSS` *before* `rewriteCss` runs. So this path can always use
     lightningcss safely.
  2. **`getCSSContentInfo` / `getCSSInfo`** (class & tag extraction at Babel
     time, in `template-plugin.js`) — parses *raw source*, which may be SCSS.
     It extracts class names and resolves `&` nesting to know which classes a
     template uses. This path needs an SCSS-capable parser (postcss-scss) for
     SCSS files.
- The existing `rewrite.test.ts` (605 lines) and the SCSS-extraction tests in
  `utils.js` define the correctness contract and must continue to pass for the
  postcss path.

## Architecture

### Approaches considered

- **A (chosen): Two independent processor modules behind a shared interface,
  plus a thin resolver.** The current postcss code moves nearly as-is into
  `processors/postcss.js`; a new `processors/lightningcss.js` reimplements the
  same transform via lightningcss visitors. A resolver picks the processor by
  `lang`, overridable by a global `type` option.
- **B (rejected): One shared traversal with a pluggable parse/print layer.**
  postcss (a JS object AST) and lightningcss (Rust-backed visitor callbacks)
  have fundamentally different traversal models; there is no meaningful shared
  traversal to factor out. Forcing one abstraction would add complexity, not
  remove it.
- **C (rejected): Keep postcss as the only scoping engine, use lightningcss
  only as a minifier.** Does not satisfy "lightningcss as the default scoping
  engine."

### Module layout

```
src/lib/css/
  processors/
    index.js          // resolveProcessor(lang, options) -> processor; registry
    postcss.js        // { getContentInfo, rewrite } — current logic, moved here
    lightningcss.js   // { getContentInfo, rewrite } — new
  rewrite.js          // thin dispatcher -> resolveProcessor(...).rewrite(...)
  utils.js            // thin dispatcher for getCSSContentInfo/getCSSInfo;
                      // keeps processor-agnostic helpers (hash, isInsideGlobal)
```

### Processor interface

Each processor module exports two functions with a shared contract:

```js
// getContentInfo(css, { lang }) ->
//   { classes: Set<string>, tags: Set<string>, css: string, id: string }
//
// rewrite(css, { postfix, fileName, layerName, options }) -> string
```

- `getContentInfo` extracts the class and tag names referenced by the source,
  plus a content hash `id`.
- `rewrite` produces the scoped CSS string, including the `/* fileName */`
  header and optional `@layer` wrapper. The header/layer wrapping is applied by
  the dispatcher (processor-agnostic), so both processors emit only the scoped
  body.

`rewrite.js` and `utils.js` retain their existing exported signatures as the
internal surface, but dispatch to the resolved processor. Call sites in
`unplugin-colocated.js`, `unplugin-inline.js`, and `template-plugin.js` change
minimally — primarily threading the plugin options object through so the
resolver can read `type` and per-processor options.

### Routing & config API

Plugin options gain (following Vite's `[tool]Options` convention):

```js
scopedCss({
  type: undefined,            // optional global override: 'lightningcss' | 'postcss'
  lightningcss: { /* targets, drafts, etc. passed through to lightningcss */ },
  postcss: { plugins: [ /* user plugins */ ] },
})
```

Per-file resolution:

1. If `type` is set globally, use that processor for all files.
2. Otherwise auto-route by file language:
   - `.scss` / `.sass` / `.less` → **postcss** (can parse raw SCSS at Babel time)
   - everything else → **lightningcss** (default)

This keeps SCSS working with zero configuration.

### lightningcss transform mapping

The postcss transform maps onto lightningcss visitors, run with `minify: false`
to minimize incidental rewriting:

| Transform | postcss today | lightningcss visitor |
| --- | --- | --- |
| `.foo` → `.foo_postfix` | selector-parser walk | `Selector` visitor |
| `div` → `div.postfix` | selector-parser replaceWith | `Selector` visitor (append class component) |
| `:global(...)` unwrap | selector-parser walk | `Selector` visitor (detect/unwrap `:global` pseudo) |
| `@keyframes` / `@counter-style` / `@position-try` name postfix | atrule `params` rewrite | `Rule` + `CustomIdent` visitors |
| `@property --name` + `var()` refs | decl value replace | `DashedIdent` visitor |
| `animation` shorthand name refs | decl value split/replace | typed declaration visitor |
| skip `:nth-of-type`, pseudos, keyframe-% selectors | guard conditions | guard conditions in visitor |

**Primary risk:** `:global` handling and exact selector-component manipulation
in lightningcss differ from postcss, and some edge cases may need iteration.
The ported test suite is the gate that proves parity.

### Dependencies

- Add `lightningcss` as a regular `dependency` (native binary with
  platform-specific optional deps; the same engine Vite uses).
- Keep `postcss`, `postcss-scss`, `postcss-selector-parser` as regular
  dependencies — SCSS auto-routing needs postcss available by default.

## Testing strategy

TDD against the existing parity suites:

- The **postcss** path must keep passing the current `rewrite.test.ts` snapshots
  and the `utils.js` SCSS-extraction tests **unchanged**.
- The **lightningcss** path gets its own snapshots. Because lightningcss
  normalizes and reprints CSS, its output will not byte-match the postcss
  snapshots; the bar is *semantic equivalence* — same scoped class names, same
  tag→class rewrites, same referenceable (keyframes/property/counter-style)
  names and references rewritten.
- Parameterize or duplicate the suite per processor so both engines are
  exercised against the same input cases.
- The lightningcss processor is built test-first against these ported cases.

## Out of scope

- New preprocessors beyond what exists today (SASS/LESS stay delegated to
  Vite's `preprocessCSS`).
- Making the default vanilla-CSS lightningcss behavior configurable beyond
  passing through `lightningcss` options.
- Per-glob / per-extension processor mapping (YAGNI for now; the global `type`
  override plus lang auto-routing covers known needs).
