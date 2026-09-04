# stylelint-ember-scoped-css

Stylelint plugin and config for [ember-scoped-css](https://github.com/soxhub/ember-scoped-css) projects.

## Why?

ember-scoped-css works by transforming class selectors like `.my-class` into `.my-class-abc123` to ensure component isolation. Selectors without scopable classes will:

1. **Apply globally** instead of being scoped to the component
2. **Break component isolation** by affecting elements outside the component
3. **Cause unexpected styling conflicts** across components

## Installation

```bash
npm install --save-dev stylelint-ember-scoped-css stylelint
```

## Usage

### As a config (recommended)

```json
{
  "overrides": [
    {
      "files": ["app/components/**/*.css", "app/templates/**/*.css"],
      "extends": ["stylelint-ember-scoped-css/config"]
    }
  ]
}
```

This adds ember-scoped-css specific rules to your existing stylelint config.

### As a plugin

```json
{
  "files": ["app/components/**/*.css", "app/templates/**/*.css"],
  "plugins": ["stylelint-ember-scoped-css"],
  "rules": {
    "ember-scoped-css/no-unscoped-selectors": true,
    "ember-scoped-css/no-unscopable-class-attribute-selectors": true
  }
}
```

## Linting inline `<style scoped>` blocks

By default stylelint only sees `.css` files, so a component that keeps all of
its CSS in an inline `<style scoped>` block is silently unlinted. This package
ships a PostCSS syntax that exposes those blocks to stylelint.

Point it at your `.gts`/`.gjs` files with an override, so `.css` files keep the
default syntax:

```json
{
  "overrides": [
    {
      "files": ["app/components/**/*.css", "app/templates/**/*.css"],
      "extends": ["stylelint-ember-scoped-css/config"]
    },
    {
      "files": ["app/components/**/*.{gts,gjs}"],
      "extends": ["stylelint-ember-scoped-css/config"],
      "customSyntax": "stylelint-ember-scoped-css/syntax"
    }
  ]
}
```

Then widen the glob your `lint:css` script passes to stylelint:

```json
"lint:css": "stylelint 'app/**/*.{css,gts,gjs}'"
```

Warnings report the line and column the CSS occupies in the `.gts` itself, and
`--fix` rewrites only the CSS, leaving the surrounding component source
byte-for-byte.

This is opt-in on purpose. It is not part of the shipped config, and nothing
changes for an existing setup until you both add `customSyntax` and widen your
glob to include `.gts`/`.gjs`. On a large codebase that has never linted its
inline styles, turning it on will surface a backlog all at once, so adopt it
per package behind its own cleanup ticket.

### What gets linted

The syntax parses the component with `content-tag` and the template with
`@glimmer/syntax`, then walks the resulting AST, so it only ever picks up real
style blocks. A `<style>` written inside a plain JS string is left alone.

Which blocks count as scoped CSS is not decided here: the `scoped` and `lang`
attributes are read with `ember-scoped-css`'s own helpers, so the blocks this
lints are the blocks the build scopes, minus the one exception below.

A `lang` naming a preprocessor dialect is read by that dialect's parser rather
than skipped, so inline SCSS, Less and Stylus are linted like any other block:

| `lang`             | parser         |
| ------------------ | -------------- |
| absent, `""`, `css` | postcss        |
| `scss`             | `postcss-scss` |
| `less`             | `postcss-less` |
| `styl`, `stylus`   | `postcss-styl` |

Matching is case-insensitive, and each parser is a dependency of this package,
so there is nothing extra to install. A `lang` this table does not list is
parsed as plain CSS, which is what the build does with it too.

Four kinds of block are skipped:

- **`<style>` without `scoped`.** That is intentionally global CSS, so
  `no-unscoped-selectors` must not fire on it. Global inline styles stay
  unlinted.
- **`<style scoped lang="sass">`.** Indented Sass parses only under
  `postcss-sass`, which drops trailing newlines when it writes a block back
  out, so linting it would mean `--fix` silently changing a byte outside the
  warning it is fixing. `lang="scss"` is unaffected; this is only the
  indented dialect.
- **Blocks containing a `{{mustache}}`.** `<style scoped inline>` supports
  interpolation, which is not CSS postcss can parse. Linting part of such a
  block would report a syntax error on valid source.
- **Blocks in a component whose template does not parse.** The real error comes
  from glint or the template compiler; reporting it again as a CSS problem, or
  letting it abort the whole stylelint run, would not help.

Note that only a `<style scoped>` at the root of a `<template>` is extracted,
matching the build, which already rejects a nested one.

### Known limitations

- **`stylelint-disable` comments must sit inside the `<style>` block.** The
  component source around a block belongs to no stylesheet, so a file-level
  `/* stylelint-disable */` at the top of a `.gts` has no effect.
  `stylelint-disable-next-line` inside the block works normally.
- **A CSS syntax error in one block stops the others from being linted.** One
  document is parsed per file, so the first unparseable block fails the file.
  The reported position does point at the right line in the `.gts`.

## List of rules

- [`no-unscoped-selectors`](./src/rules/no-unscoped-selectors/README.md)
- [`no-unscopable-class-attribute-selectors`](./src/rules/no-unscopable-class-attribute-selectors/README.md)

## License

MIT
