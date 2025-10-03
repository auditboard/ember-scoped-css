# ember-scoped-css

`ember-scoped-css` is a modern addon that allows you to isolate your CSS in a modular way with co-located scoped CSS. This is a build-time-only addon and therefore is fully supported if your app is built with Embroider.

With `ember-scoped-css` you can write your component styles in a co-located `.css` file next to your `.hbs` or `.gjs/.gts` files. Every selector you write in your styles is automatically scoped to the component. So you can develop your component with styles isolated from the rest of the application and you don't have to worry about CSS selectors collisions or issues with the CSS cascade.

If you want to read more specifics on how this addon achieves isolation with CSS you can read more in the [detailed CSS isolation documentation](docs/css-isolation.md)

As selectors are scoped/renamed during the build process. So there is no performance hit when running the app.

The philosophy of `ember-scoped-css` is to stick as close to CSS and HTML as possible and not introduce new syntax or concepts unless it is absolutely necessary. 

You may also find the docs on [CSS `@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) interesting.
This build tool emits CSS in a `@layer`.

## Compatibility

- Vite
- V2 addons
- non-embroider apps 
- embroider apps

| You Have | ember-scoped-css | ember-scoped-css-compat | docs |
| -------- | ----------- | ---------------------- | --- |
| vite | >= 1.0.0 | 🚫 | [main][docs-main]
| gjs / gts library (no hbs) | >= 1.0.0 | 🚫 | [main][docs-main]
| webpack | <= 0.24.3 | <= 10.0.0 | [0.24.3][docs-2] 
| hbs | <= 0.24.3 | <= 10.0.0 | [0.24.3][docs-2]
| ember-template-imports@v4 or babel-plugin-ember-template-compilation@2.2.5+ | 0.19.0 | 10.0.0 | [0.19][docs-3] - [0.24][docs-2]
| ember-template-imports@v3 or babel-plugin-ember-template-compilation@2.2.1 or rollup-plugin-glimmer-template-tag | <= 0.18.0 | <= 9.0.0 | [0.18][docs-4]
| classic components | <= 0.18.0 | <= 8.0.0 | [0.18][docs-4]
| ember < 4 | <= 0.18.0 | <= 8.0.0 | [0.18][docs-4]

[docs-main]: https://github.com/auditboard/ember-scoped-css/
[docs-2]: https://github.com/auditboard/ember-scoped-css/tree/v0.24.3-ember-scoped-css
[docs-3]: https://github.com/auditboard/ember-scoped-css/tree/v0.19.1-ember-scoped-css
[docs-4]: https://github.com/auditboard/ember-scoped-css/tree/ember-scoped-css%400.18.0

## Installation for a Vite app

```bash
npm install --save-dev ember-scoped-css
```

### Configuration

In your `vite.config.js`, import and add the `scopedCSS` plugin:
```js
import { defineConfig } from 'vite';
import { scopedCSS } from 'ember-scoped-css/vite';

export default defineConfig({
  // ...
  plugins: [
    scopedCSS(),
    // ...
  ],
});
```

and then in your `babel.config.mjs`, add a template-transform:
```js
import * as scopedCSS from "ember-scoped-css/build";

module.exports = {
  plugins: [
    // ...
    [scopedCSS.babelPlugin, {}],
    [
      'babel-plugin-ember-template-compilation',
      {
        // ...
        transforms: [scopedCSS.templatePlugin({})],
      },
    ],
    // ...
  ],
  // ...
};

```

If you have a rollup config:
```js
import * as scopedCss from 'ember-scoped-css/build';

// ...
plugins: [
    scopedCss.rollupPlugin(),
]
```


## Installation for an embroider app

```bash 
npm install --save-dev ember-scoped-css ember-scoped-css-compat
```

### Configuration

All forms of `scopedCss` take an options hash except for the rollup and vite plugins.

Configuration in the two locations in the babel config should match, for example:


```js
plugins: [
  [scopedCSS.babelPlugin, { layerName: 'my-library' }],

  [
    'babel-plugin-ember-template-compilation',
    {
      targetFormat: 'hbs',
      transforms: [scopedCSS.templatePlugin({ layerName: 'my-libarry' })],
    },
  ],
],
```

## Usage

With `ember-scoped-css` you define styles in `.css` files that are colocated with your components

```hbs
{{! src/components/my-component.hbs }}
<div data-test-my-component class='hello-class header'><b>Hello</b>, world!</div>
```

```css
/* src/components/my-component.css */
.hello-class {
  color: red;
}

/* the :global() pseudo-class is used to define a global class. It mean that header class wont be scoped to that component */
.hello-class:global(.header) {
  font-size: 20px;
}

b {
  color: blue;
}
```

NOTE: that if you're using pods, css co-located with templates/routes/etc will need to be named `styles.css`



### Passing classes as arguments to a component

There is a `scoped-class` helper that you can use to pass a class name as an argument to a component. The helper takes a class name and returns a scoped class name. `scoped-class` helper is replaced at build time so there is no performance hit when running the app.

```hbs
{{! src/components/my-component.hbs }}
<OtherComponent @internalClass={{scoped-class 'hello-class'}} />
<OtherComponent @internalClass={{(scoped-class 'hello-class')}} />
<OtherComponent
  @internalClass={{concat (scoped-class 'hello-class') ' other-class'}}
/>
```

In gjs/gts/`<template>`, the above would look like:
```gjs
import { scopedClass } from 'ember-scoped-css';

<template>
  <OtherComponent @internalClass={{scopedClass 'hello-class'}} />
  <OtherComponent @internalClass={{(scopedClass 'hello-class')}} />
  <OtherComponent
    @internalClass={{concat (scopedClass 'hello-class') ' other-class'}}
  />
</template>
```

## Testing

As classes are renamed during the build process you can't directly verify if classes are present in your tests. To solve this problem you can use the `scopedClass` function from the `ember-scoped-css/test-support` module. The function takes the class names and path to the CSS file where are the classes defined and returns the scoped class names.

The path to the CSS file is always relative to the V2 addon root no matter where the test is located.

```gjs
import { scopedClass } from 'ember-scoped-css/test-support';

test('MyComponent has hello-class', async function (assert) {
  assert.expect(1);

  await render(<template>
    <MyComponent />
  </template>);

  const rewrittenClass = scopedClass(
    'hello-class',
    '<module-name>/components/my-component'
  );

  assert.dom('[data-test-my-component]').hasClass(rewrittenClass);
});
```

## Linting

`ember-scoped-css` exports a ember-template-lint plugin with one rule `scoped-class-helper`. This lint rule is intended to help you prevent improper use of the `scoped-class` helper which might not be immediately obvious during regular development. You can read more information in the [lint rules documentation](docs/lint-rules.md)

### Steps for adding the rule to the project

1. Add `ember-scoped-css` plugin to `.template-lintrc.js`

```diff
'use strict';

module.exports = {
	plugins: [
+    'ember-scoped-css/src/template-lint/plugin'
  ],

```

2. Add `scoped-class-helper` rule to `.template-lintrc.js`

```diff
'use strict';

module.exports = {
	plugins: [
    'ember-scoped-css/src/template-lint/plugin'
  ],
  rules: {
+    'scoped-class-helper': 'error',
  }

```

## License

This project is licensed under the [MIT License](LICENSE.md).
