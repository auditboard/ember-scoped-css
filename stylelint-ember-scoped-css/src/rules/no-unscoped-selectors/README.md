# no-unscoped-selectors

Disallows CSS selectors that cannot be properly scoped by ember-scoped-css's namespacing process.

This rule ensures that every CSS selector contains at least one class or tag selector that can be scoped during the build process to provide proper component isolation.

## Options

### `true`

The following are examples of patterns that are considered acceptable:

```css
/* Class selectors can be namespaced */
.my-component {
}
```

```css
/* Tag selectors can be scoped */
div {
}
```

```css
/* Combinations of scoped and unscoped selectors */
.btn [data-test] {
}
.btn:hover {
}
div[data-test] {
}
```

```css
/* Explicitly global selectors */
:global([data-test]) {
}
```

```css
/* Root selectors for global styles */
:root {
}
```

The following are examples of patterns that are considered problems:

```css
/* Attribute selectors cannot be scoped */
[data-test] {
}
```

```css
/* Element selectors cannot be scoped */
#container {
}
```

```css
/* Universal selectors cannot be scoped */
* {
}
```

## How to Fix Violations

When this rule reports an error, you have several options:

1. **Add a class selector** (most common):

```css
/* ❌ Error */
[data-test] {
}

/* ✅ Fixed */
.my-component [data-test] {
}
```

2. **Add a tag selector**:

```css
/* ❌ Error */
[data-test] {
}

/* ✅ Fixed */
div[data-test] {
}
```

3. **Use :global() for intentionally global styles**:

```css
/* ❌ Error */
[data-test] {
}

/* ✅ Fixed - applies globally */
:global([data-test]) {
}
```

4. **Use :root for root-level styles**:

```css
/* ✅ Root styles are allowed */
:root {
}
```
