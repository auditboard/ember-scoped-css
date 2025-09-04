# no-unscoped-selectors

Disallows CSS selectors that cannot be properly scoped by ember-scoped-css's namespacing process.

This rule ensures that every CSS selector contains at least one class selector that can be transformed during the build process to provide proper component isolation.

## Options

### `true`

The following patterns are considered problems:

<!-- prettier-ignore -->
```css
/* No class selectors to scope */
div { }
```

<!-- prettier-ignore -->
```css
[data-test] { }
```

<!-- prettier-ignore -->
```css
:hover { }
```

<!-- prettier-ignore -->
```css
::before { }
```

<!-- prettier-ignore -->
```css
* { }
```

<!-- prettier-ignore -->
```css
/* Classes only inside :not() break component isolation */
:not(.hidden) { }
```

<!-- prettier-ignore -->
```css
/* Mixed selectors where some parts are unscopable */
.valid-class,
div { }
```

The following patterns are _not_ considered problems:

<!-- prettier-ignore -->
```css
/* Class selectors that can be namespaced */
.my-component { }
```

<!-- prettier-ignore -->
```css
.btn:hover { }
```

<!-- prettier-ignore -->
```css
.parent > .child { }
```

<!-- prettier-ignore -->
```css
/* Descendant selectors with scopable classes */
.component [data-test] { }
```

<!-- prettier-ignore -->
```css
div .my-class { }
```

<!-- prettier-ignore -->
```css
/* Classes inside scoping-safe functional pseudo-classes */
:has(.child) { }
```

<!-- prettier-ignore -->
```css
:is(.primary, .secondary) { }
```

<!-- prettier-ignore -->
```css
:where(.variant) { }
```

<!-- prettier-ignore -->
```css
/* Explicitly global selectors */
:global([data-test]) { }
```

<!-- prettier-ignore -->
```css
:global(body) { }
```
