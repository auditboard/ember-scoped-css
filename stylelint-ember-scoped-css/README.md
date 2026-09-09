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

Stylelint reads only `.css` files by default, so CSS in an inline
`<style scoped>` block is never linted. This package ships a PostCSS custom
syntax that exposes those blocks to stylelint.

Add an override for your `.gts` and `.gjs` files. `.css` files keep the
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

Then widen the glob in your `lint:css` script:

```json
"lint:css": "stylelint 'app/**/*.{css,gts,gjs}'"
```

Warnings report the line and column in the `.gts` file. `--fix` rewrites only
the CSS and leaves the rest of the file byte-for-byte.

The syntax is opt-in. Nothing changes until you add `customSyntax` and widen
the glob. A codebase that has never linted its inline styles will get the whole
backlog at once, so adopt it one package at a time.

### What gets linted

Every `<style scoped>` at the root of a `<template>`. A `<style>` inside a JS
string is left alone. The build already rejects a `<style scoped>` nested
deeper than the template root.

`lang` picks the dialect, case-insensitively. Any other value, or no `lang`, is
plain CSS, which is what the build does too. Each dialect needs its parser
installed, the same way Vite needs the preprocessor:

```sh
# lang="scss"
npm add -D postcss-scss
# lang="sass"
npm add -D sugarss
# lang="less"
npm add -D postcss-less
# lang="styl" or lang="stylus"
npm add -D postcss-styl
```

A block whose parser is missing is reported at its `<style>` tag with the
package to install.

Skipped:

- `<style>` without `scoped`. That is global CSS, and `no-unscoped-selectors`
  must not fire on it.
- Blocks that contain a `{{mustache}}`. Interpolated CSS cannot be parsed.
- Blocks in a component whose template does not parse. Glint or the template
  compiler already reports that error.

### Known limitations

- `stylelint-disable` comments must sit inside the `<style>` block. A
  file-level `/* stylelint-disable */` at the top of a `.gts` has no effect.
  `stylelint-disable-next-line` inside the block works.
- A CSS syntax error in one block stops linting for the whole file, the same
  as in a `.css` file. The error is reported at its line in the `.gts`.
- `--fix` drops a leading UTF-8 byte order mark.
- In indented Sass, the `=mixin` and `+include` shorthand is reported as a
  syntax error. Use `@mixin` and `@include`. Nested properties such as `font:`
  with indented children are read as a rule, so selector rules may report them.

## List of rules

- [`no-unscoped-selectors`](./src/rules/no-unscoped-selectors/README.md)
- [`no-unscopable-class-attribute-selectors`](./src/rules/no-unscopable-class-attribute-selectors/README.md)

## License

MIT
