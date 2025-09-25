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

| You Have | ember-scoped-css | ember-scoped-css-compat |
| -------- | ----------- | ---------------------- |
| ember-template-imports@v4 or babel-plugin-ember-template-compilation@2.2.5+ | 0.19.0 | 10.0.0 |
| ember-template-imports@v3 or babel-plugin-ember-template-compilation@2.2.1 or rollup-plugin-glimmer-template-tag | <= 0.18.0 | <= 9.0.0 |
| classic components | <= 0.18.0 | <= 8.0.0 |
| ember < 4 | <= 0.18.0 | <= 8.0.0 |

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

## Installation for a non-embroider ember app

```bash
npm install --save-dev ember-scoped-css ember-scoped-css-compat
```

### Configuration

In your `ember-cli-build.js`, you can configure the behavior of scoped-css transformations within the app via 
```js 

const app = new EmberApp(defaults, { 
  /* ... */ 
  'ember-scoped-css': {
    layerName: 'app-styles', // default: 'components', set to false to disable the layer
    additionalRoots: ['routes/'], // default: [], set this to use scoped-css in pods-using apps
    passthrough: ['some-other-file.css'], // default: [] this is only used in a non-embroider app to pass files through the build pipeline
    passthroughDestination: 'assets' // default: undefined this alters where the passthrough files are placed in the output tree
  }
});
```

Note that supporting `pods` is _opt in_, because all apps can have their pods root directory configured differently.

## Installation for an embroider app

```bash 
npm install --save-dev ember-scoped-css ember-scoped-css-compat
```

Setup webpack:
```js 
// ember-cli-build.js
module.exports = async function (defaults) {  
  const app = new EmberApp(defaults, { /* ... */ });

  const { Webpack } = require('@embroider/webpack');

  return require('@embroider/compat').compatBuild(app, Webpack, {
    /* ... */
    packagerOptions: {
      webpackConfig: {
        module: {
          rules: [
            // css loaders for your app CSS
            {
              test: /\.css$/,
              use: [
                {
                  loader: require.resolve(
                    'ember-scoped-css/build/app-css-loader'
                  ),
                  options: {
                    layerName: 'the-layer-name', // optional
                  }
                },
              ],
            },
          ],
        },
      },
    },
  });
}
```

## Installation for a V2 Addon

```
npm install --save-dev ember-scoped-css
```

1. If you want to use `.gjs/gts` components, [`@embroider/addon-dev`](https://github.com/embroider-build/embroider/tree/main/packages/addon-dev) provides a plugin for you, `addon.gjs()`.

<details><summary>An older approach</summary>

There is a deprecated plugin (superseded by `@embroider/addon-dev`) that uses ember-template-imports -- to use this follow the instructions from [rollup-plugin-glimmer-template-tag](https://github.com/NullVoxPopuli/rollup-plugin-glimmer-template-tag) addon.

This plugin is not recommended, and is archived.

</details>

2. Add the following to your `rollup.config.mjs`:

```diff
+ import { scopedCssUnplugin } from 'ember-scoped-css/build';

// if you want to have some global styles in your addon then
// put them in the styles folder and change the path to the styles folder
// if there are no global styles then you can remove addon.keepAssets
- addon.keepAssets(['**/*.css']),
+ addon.keepAssets(['**/styles/*.css']),

// add the following to the rollup config
+ scopedCssUnplugin.rollup(),
```

Note that if you're using [`rollup-plugin-ts`](https://github.com/wessberg/rollup-plugin-ts), `scopedCssUnpulugin.rollup()` must come before `typescript(/*...*/)` 

### Configuration

In the rollup config, you may pass options:

```js 
scopedCssUnplugin.rollup({ 
  layerName: 'utilities', // default: 'components', set to false to disable the layer
});
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

```js
import { scopedClass } from 'ember-scoped-css/test-support';

test('MyComponent has hello-class', async function (assert) {
  assert.expect(1);

  await render(hbs`
    <MyComponent />
  `);

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
