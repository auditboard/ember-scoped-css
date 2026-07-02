# no-unscopable-class-attribute-selectors

Disallows `[class|="..."]` and `[class$="..."]` attribute selectors, which cannot be reliably scoped by ember-scoped-css.

ember-scoped-css renames classes by appending a per-file suffix (`.foo` becomes `.foo_generated`), and scopes other selectors by appending a generated class to matching elements.

- The `|=` operator matches a value that is either exactly equal to the given string or begins with it followed by a hyphen, which no longer holds once the class has been renamed. Unlike `=` and `~=` (whose values are rewritten to the renamed class), a `|=` value cannot be rewritten precisely, so the selector is scoped with the generated class only and may not match as written.
- The `$=` operator matches the end of the `class` attribute's value, but the generated class is appended to the end of that value, so the selector can never match once it is scoped.

## Options

### `true`

The following are examples of patterns that are considered acceptable:

```css
/* Class selectors are scoped by renaming */
.my-component {
}
```

```css
/* Other class attribute operators are scoped */
[class~="foo"] {
}
[class^="foo"] {
}
```

```css
/* `|=` against a non-class attribute is fine */
[lang|="en"] {
}
```

```css
/* Explicitly global selectors are not scoped */
:global([class|="foo"]) {
}
```

The following are examples of patterns that are considered problems:

```css
/* `|=` against `class` cannot be reliably scoped */
[class|="foo"] {
}

/* `$=` against `class` can never match once scoped */
[class$="foo"] {
}
```

## How to Fix Violations

Use a class selector, which is scoped by renaming:

```css
/* ❌ Error */
[class|="foo"] {
}

/* ✅ Fixed */
.foo {
}
```

If the rule is intentionally global, wrap it in `:global()`:

```css
/* ✅ Applies globally, not scoped */
:global([class|="foo"]) {
}
```
