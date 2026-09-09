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

The syntax finds each `<template>` with `content-tag-utils`, parses it with
`@glimmer/syntax`, and walks the AST. Only real `<style>` elements count. A
`<style>` inside a JS string is left alone.

`content-tag-utils` requires `content-tag >= 4.2.0`. A project pinned to
`content-tag@3` will resolve a second copy.

The `scoped` and `lang` attributes are read with the same helpers the
`ember-scoped-css` build uses, so the linted blocks are the scoped blocks, with
one exception below.

`lang` selects the parser. Matching is case-insensitive, and every parser is a
dependency of this package:

| `lang`              | parser         |
| ------------------- | -------------- |
| absent, `""`, `css` | postcss        |
| `scss`              | `postcss-scss` |
| `less`              | `postcss-less` |
| `styl`, `stylus`    | `postcss-styl` |

A `lang` not in the table is parsed as plain CSS. The build does the same.

Four kinds of block are skipped:

- `<style>` without `scoped`. That is global CSS, and `no-unscoped-selectors`
  must not fire on it.
- `<style scoped lang="sass">`. No available parser reads indented Sass
  correctly. `postcss-styl` reports errors on valid Sass, and `postcss-sass`
  drops rules from the AST. `lang="scss"` is not affected.
- Blocks that contain a `{{mustache}}`. `<style scoped inline>` supports
  interpolation, and postcss cannot parse a mustache.
- Blocks in a component whose template does not parse. Glint or the template
  compiler already reports that error.

Only a `<style scoped>` at the root of a `<template>` is extracted. The build
rejects a nested one.

### Known limitations

- `stylelint-disable` comments must sit inside the `<style>` block. A
  file-level `/* stylelint-disable */` at the top of a `.gts` has no effect.
  `stylelint-disable-next-line` inside the block works.
- A CSS syntax error in one block stops linting for the whole file. The
  reported position points at the right line in the `.gts`.
- `--fix` drops a leading UTF-8 byte order mark. Every parser in the chain
  strips it, and putting it back is not worth the offset bookkeeping.

## List of rules

- [`no-unscoped-selectors`](./src/rules/no-unscoped-selectors/README.md)
- [`no-unscopable-class-attribute-selectors`](./src/rules/no-unscopable-class-attribute-selectors/README.md)

## License

MIT
