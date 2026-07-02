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

Attribute selectors like `[disabled]`, `[type="text"]`, and `[data-state="open"]` are scoped the same way bare tag selectors are. The original selector is kept and the generated class is added to it, and every matching element in the template gets that same class.

Input:

```html
<!-- components/first.hbs -->
<input type="text" />
```

```css
/* components/first.css */
[type='text'] {
  ...;
}
```

Output:

```html
<!-- components/first.hbs -->
<input type="text" class="generated-first" />
```

```css
/* components/first.css */
[type='text'].generated-first {
  ...;
}
```

When an attribute selector targets the `class` attribute and the value is a real class name (`[class="foo"]` or `[class~="foo"]`) the value is renamed instead of adding the generated class, because `.foo` is itself renamed to `.foo_generated-first`.

```css
/* components/first.css */
[class~='foo'] {
  ...;
}
```

becomes

```css
/* components/first.css */
[class~='foo_generated-first'] {
  ...;
}
```

Component invocations are scoped too. A component receives the generated class through its `...attributes` the same way it receives the matched attribute, so `[type='text']` scopes `<Foo type="text" />` just as it scopes `<input type="text" />`. Named arguments such as `@type` are not HTML attributes, and `...attributes` carries an unknown set of attributes, so neither is matched.

Two things to be aware of with this forwarding.

First, elements are matched by attribute **name**, not value. Given this CSS:

```css
/* components/first.css */
[data-variant='primary'] {
  ...;
}
```

both of these invocations receive the generated class:

```html
<!-- components/first.hbs -->
<Foo data-variant="primary" />
<Foo data-variant="secondary" />
```

```html
<!-- output -->
<Foo data-variant="primary" class="generated-first" />
<Foo data-variant="secondary" class="generated-first" />
```

This is harmless for the rule itself — the preserved `[data-variant='primary']` still decides which elements are styled — but it feeds into the second point.

Second, the generated class is shared by every selector in the file that is scoped with it. Once it reaches the child's root element through `...attributes`, that element matches **all** of the file's generated-class rules — including bare tag rules — not just the attribute rule that caused it to be forwarded:

```css
/* components/first.css */
[data-variant='primary'] {
  color: blue;
}
button {
  color: red;
}
```

```html
<!-- components/first.hbs -->
<Child data-variant="primary" />
```

```html
<!-- components/child.hbs -->
<button ...attributes>...</button>
```

renders as

```html
<button data-variant="primary" class="generated-first">...</button>
```

which matches both `[data-variant='primary'].generated-first` **and** `button.generated-first` — the parent's plain `button` rule now styles the child's root element, which a plain `<button>` inside the child never would be.

## Known limitations

These limitations come from the generated-class approach and apply to bare tag selectors as well as attribute selectors.

### Standalone negation leaks

The generated class is a positive signal that an element belongs to a component. A negation like `:not(...)` inverts its contents, so when the generated class is added inside the `:not()` it no longer anchors the scope. A selector that is only a negation has nothing left to anchor it and ends up matching the whole document.

```css
/* components/first.css */
:not([disabled]) {
  ...;
}
:not(div) {
  ...;
}
```

becomes

```css
/* components/first.css */
:not([disabled].generated-first) {
  ...;
}
:not(div.generated-first) {
  ...;
}
```

Both rules now match every element that isn't a disabled (or `div`) element in the current component, including elements in other components and the rest of the page. As long as the negation has a positive anchor in the same compound the scope is preserved, so `button:not([disabled])` becomes `button.generated-first:not([disabled].generated-first)` and stays scoped. The `ember-scoped-css/no-unscoped-selectors` stylelint rule flags standalone negations so this is caught before it ships.

### Attributes that only appear at runtime

Scoping looks at the attributes written literally in the template. An attribute that arrives some other way — through `...attributes` from a caller, or set by a modifier — is not visible at build time, so the element does not receive the generated class and the rule matches nothing:

```css
/* components/first.css */
[disabled] {
  ...;
}
```

```html
<!-- components/first.hbs -->
<button ...attributes>...</button>
<!-- `disabled` arrives from the caller; the button is never scoped -->
```

If you are upgrading: attribute selectors used to be left untouched, so a rule like this leaked into other components but *appeared* to work on elements like the one above. Now that attribute selectors are scoped, the same rule applies to nothing. Add the attribute (or a class) to the element in the component's own template, or use `:global(...)` if the rule is intentionally global.

### Class attribute operators

`[class$="foo"]` matches the end of the class string, but the generated class is appended to the end of the class attribute of every element the file scopes, so the selector can never match once it is scoped. `[class|="foo"]` can't be expressed precisely once classes are renamed, so it is scoped with the generated class only and may not behave exactly as written. The `ember-scoped-css/no-unscopable-class-attribute-selectors` stylelint rule flags both so they are caught before they ship.

`[class="foo"]` is renamed to `[class="foo_generated-first"]`, which is an *exact* match of the whole attribute value. If the same element is also scoped by a tag or attribute selector in the file it additionally receives the generated class, the value becomes `"foo_generated-first generated-first"`, and the exact match no longer holds. Prefer `[class~="foo"]` (token match), which is unaffected.
