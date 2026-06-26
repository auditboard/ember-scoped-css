# CSS Isolation

The main function of the `ember-scoped-css` addon is to provide scoped CSS that only applies to a particular component. When designing the addon we considered multiple different approaches and compared the approaches used in Svelt, Vue, and existing Ember addons like ember-css-modules. This document will give an overview of the different approaches and some justification why we ended up using the approach we settled on.

## Svelte approach

Svelte adds an extra generated class to every class and tag used in css file. It's important to note that it doesn't touch the original class and just adds a new one that CSS can target.

Here is an example starting with the input files:

```html
<!-- components/first.hbs -->
<p class="my-class">...</p>
<div>...</div>
```

```css
/* components/first.css */
.my-class {
  ...;
}

div {
  ...;
}
```

Output:

```html
<!-- components/first.hbs -->
<p class="my-class generated-first">...</p>
<div class="generated-first">...</div>
```

```css
/* components/first.css */
.my-class.generated-first {
  ...;
}
div.generated-first {
  ...;
}
```

## Vue approach

Vue adds an extra generated data-attribute to every class and tag used in the css file.

Input:

```html
<!-- components/first.hbs -->
<p class="my-class">...</p>
<div>...</div>
```

```css
/* components/first.css */
.my-class {
  ...;
}
div {
  ...;
}
```

Output:

```html
<!-- components/first.hbs -->
<p class="my-class" data-generated-first>...</p>
<div data-generated-first>...</div>
```

```css
/* components/first.css */
.my-class[data-generated-first] {
  ...;
}
div[data-generated-first] {
  ...;
}
```

## ember-scoped-css approach

ember-scoped-css replaces classes with a new class that has a generated suffix that is specific to that file.

Input: 

```html
<!-- components/first.hbs -->
<p class="my-class">...</p>
<div>...</div>
```

```css
/* components/first.css */
.my-class {
  ...;
}
div {
  ...;
}
```

Output

```html
<!-- components/first.hbs -->
<p class="my-class_generated-first">...</p>
<div class="generated-first">...</div>
```

```css
/* components/first.css */
.my-class_generated-first {
  ...;
}
div.generated-first {
  ...;
}
```

## Why ember-scoped-css chose renaming classes

By renaming classes we ensure a better issolation of CSS between components and from global styles that could be included by thrid parties.

If class names aren't renamed it is possible to have a global class (that is outside the scope of our CSS processor) with the same name as that used in a scoped component. In this case, the global style could unintentionally alter the component, especially if you're in an environment where you have little control over the order that CSS is included in the bundle - thus affecting specificity. 

In both a Svelte and Vue app, everyone needs to be aware of class names used in global styles and across all other components and it is a good practice to avoid known global class names when writing your scoped component. However, achieving this could prove to be extremely challenging in larger projects. 

For example, If someone chose the same class name in multiple components and also used that class name in global styles then in a Svelte or Vue app styles would leak both from the global styles into the component styles but also from one component to other components that use the same name in their local CSS file

---
The following example shows a simplified case where global styles are potentially leaking into component styles. It's a bit harder to show an example of cross-component leaking but this simple example is illustrative that you can't depend on extra classes or data-attributes for true issolation

```css
/* app.css */

.header {
  ...;
}
```

```css
/* some-component.css */

.header {
  /* The developer intends for this style to be scoped to only the `some-component.hbs` file */
  ...;
} 
```

```html
<!-- some-component.hbs -->
<header class="header">
  A Lovely header
</header>
```

```css
/* other-component.css */
:global(.header) {
  ...;
}
```

---

Resulting output

```css
/* app.css */
.header {
  ...;
}
```

```css
/* some-component.css */

/* svelte */
.header.generated {
  /* svelte selector can be overwriten in any other component and from global styles */
  ...;
} 

/* vue */
.header[data-generated] {
  /* vue selector can be overwriten in any other component and from global styles */
  ...;
} 

/* ember-scoped-css */
.header_data-generated {
  /* ember-scoped-css selector can't be unintentionally overwritten in other components and in global styles */
  ...;
} 
```

```css
/* other-component.css */
.header {
  ...;
}
```

As you can see a developer could use the header class in `some-component` thinking that it is scoped and styles don't leak in or out but in svelte and vue `other-component` will leak styles to `some-compoent` unintentionally. Also global styles leak to some components unintentionally. This is not the case in `ember-scoped-css`

## Global Styles

All three approaches can use `:global()` pseudo-class. Selector inside it will not be scoped.

In Svelte the following

```css
.some-class {
  ...;
}
:global(.other-class) {
  /* class inside :global will not be scoped */
  ...;
}
```

will become

```css
.some-class.generated {
  ...;
}
.other-class {
  ...;
}
```

## Attribute selectors

Attribute selectors (`[disabled]`, `[type="text"]`, `[data-state="open"]`, …) are
scoped the same way bare element selectors are: the original selector is kept as
the discriminator and a marker class is added, while every matching native
element in the template gets that same marker class.

```css
[type='text'] {
  ...;
}
```

becomes

```css
[type='text'].generated {
  ...;
}
```

and `<input type="text">` becomes `<input type="text" class="generated">`.

When an attribute selector targets `class` and the value is a real class name
(`[class="foo"]` or `[class~="foo"]`), the value is renamed to match the scoped
class instead of adding a marker, because `.foo` is itself renamed to
`.foo_generated`:

```css
[class~='foo'] {
  ...;
} /* -> [class~="foo_generated"] */
```

Only **native** elements are marked. Component invocations (`<Foo>`,
`<foo.bar>`) are skipped so the scope marker is never forwarded into another
component's scope. Named arguments (`@type`) and `...attributes` are not treated
as attributes.

## Known limitations

These limitations stem from the marker-class model and apply to bare element
selectors as well as attribute selectors.

### Standalone negation leaks

The marker class is a _positive_ signal ("this element belongs to my
component"). A negation (`:not(...)`) inverts its contents, so when the marker
is added inside the `:not()` it no longer acts as a scope anchor. A selector
that is _only_ a negation has nothing left to anchor the scope, so it matches
the whole document:

```css
:not([disabled]) {
} /* -> :not([disabled].generated) — leaks globally */
:not(div) {
} /* -> :not(div.generated)        — same leak, pre-existing for tags */
```

As long as the negation has a positive anchor in the same compound, scoping is
correct:

```css
button:not([disabled]) {
} /* -> button.generated:not([disabled].generated) — scoped */
```

The `ember-scoped-css/no-unscoped-selectors` stylelint rule flags standalone
negations, which surfaces this case before it ships.

### Class-targeting attribute operators

`[class$="foo"]` matches by string-suffix. If the matched class is also renamed
through its own `.foo` selector, its suffix becomes `_generated` and the
selector no longer matches. This cannot be detected statically, so it is left
as a documented edge case.

`[class|="foo"]` cannot be expressed precisely after class renaming. It emits a
build-time warning and is scoped with a marker class only (matching on the
preserved value), which may not behave exactly as written.
