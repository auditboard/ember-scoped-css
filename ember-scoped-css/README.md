# ember-scoped-css

Scope your component styles and never worry about a collision ever again.

```gjs
const greeting = "hello world";

<template>
  <div>{{greeting}}</div>

  <style scoped>
    div {
      color: blue;
    }
  </style>
</template>
```

becomes the equivelent of;

```gjs
import './abcd1234.css'; // containing your CSS, but with selectors scoped
const greeting = "hello world";

<template>
  <div class="abcd1234">{{greeting}}</div>
</template>
```

This is a build-time-only addon, so there is no need to worry about runtime performance.

You can also write your styles as a co-located `.css` file, right next to your `.gjs`/`.gts` files.
Every selector you write in your styles is automatically scoped to the component.
So you can develop your component with styles isolated from the rest of the application and you don't have to worry about CSS selectors collisions or issues with the CSS cascade.

_See [Usage](#usage) for details_.

If you want to read more specifics on how this addon achieves isolation with CSS you can read more in the [detailed CSS isolation documentation](docs/css-isolation.md)

As selectors are scoped/renamed during the build process. So there is no performance hit when running the app.

The philosophy of `ember-scoped-css` is to stick as close to CSS and HTML as possible and not introduce new syntax or concepts unless it is absolutely necessary.

You may also find the docs on [CSS `@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) interesting.
This build tool can emit CSS in a `@layer`.

## Compatibility

- Vite
- V2 addons with `@embroider/addon-dev` @ v8+ (or similar)
- For [hbs, broccoli, or webpack-based builds, view this version of the docs](https://github.com/auditboard/ember-scoped-css/tree/hbs-classic-and-webpack-support)
  - For [bugfixes for the pre-ember-scoped-css-1.0 code, PR here](https://github.com/auditboard/ember-scoped-css/tree/hbs-classic-and-webpack-support)

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

## Installation

```bash
npm install --save-dev ember-scoped-css
```

### Configuration

Configuration happens in multiple locations to take over the need portion of your build steps.

- `vite.config.*`
- `rollup.config.*`
- `babel.config.*`
- `tsdown.config.*`

#### Vite

In your `vite.config.*`, import and add the `scopedCSS` plugin:

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

<details><summary>notes for vite projects</summary>

  If you're `import.meta.glob`ing large chunks of your codebase, you'll want to make sure that your globs exclude CSS files

  For example:

  ❌ Don't do this
  
  ```js
  ...import.meta.glob('./templates/**/*', { eager: true })
  ```

  ✅ Do this

  ```js
  ...import.meta.glob('./templates/**/*.{gjs,gts}', { eager: true }),
  ```

  or better yet, for small projects:

  ```js
  ...import.meta.glob('./templates/{top,level,folders}/{sub,folders}.{gjs,gts}', { eager: true }),
  ```

  This way you don't import CSS yourself, which would make CSS go through Vite's default CSS processing.
  We need the scoped-css plugins to process the CSS instead of Vite's default behaviors.

</details>

##### Configuration Options

- `layerName: string` - Wrap your CSS in a `@layer` with this given name

#### Rollup

If you have a rollup config:

```js
import { scopedCSS } from 'ember-scoped-css/rollup';

// ...
plugins: [
    scopedCSS(),
]
```

##### Configuration Options

- `layerName: string` - Wrap your CSS in a `@layer` with this given name

#### Rolldown / TSdown

If you have a rolldown/tsdown config:

```js
import { scopedCSS } from 'ember-scoped-css/rolldown';

// ...
plugins: [
    scopedCSS(),
]
```

##### Configuration Options

- `layerName: string` - Wrap your CSS in a `@layer` with this given name

#### Babel

In your `babel.config.*`, add the plugins:

```js
import { scopedCSS } from 'ember-scoped-css/babel';

export default {
  plugins: [
    // ...
    scopedCSS(),
    [
      'babel-plugin-ember-template-compilation',
      {
        // ...
        transforms: [scopedCSS.template({})],
      },
    ],
    // ...
  ],
  // ...
};
```

There are two plugins, but you made only need one:

- `scopedCSS()` - handles removing the import for scopedCSS (which you'd use in GJS and GTS for intellisense, and TypeScript)
- `scopedCSS.template()` - transforms your template

##### Configuration Options (`scopedCSS.template()`)

- `layerName: string` - Wrap your CSS in a `@layer` with this given name
- `additionalRoots: string[]` - When you want to procss more folders. For example you want to support pods structure

### TypeScript

If you use TypeScript, or rely on information from TypeScript, you'll want to add the special attributes to the `<style>` element's attributes list.
These attributes don't exist in normal HTML, which is why they'd error without this change:

Requires

- @glint/ember-tsc 1.0.5 or higher
- @glint/template 1.7.0 or higher
- @glint/tsserver-plugin 2.0.5 or higher

In `types/index.d.ts` (or similar for apps) or `unpublished-development-types/index.d.ts` (for libraries), we'll declaration merge merge the known attributes for the `<style>` tag:

```ts
import '@glint/template';

declare global {
  interface HTMLStyleElementAttributes {
    scoped: '';
    inline: '';
  }
}
```

### template-lint

If you use [ember-template-lint](https://github.com/ember-template-lint/ember-template-lint) for linting the `<template>...</template>` regions of your components, you'll need to allow the `<style>` attribute to be used. The easiest way is to disable the [`no-forbidden-elements`](https://github.com/ember-template-lint/ember-template-lint/blob/main/docs/rule/no-forbidden-elements.md) rule:

```js
// the template-lintrc
{ // ...
  overrides: [
    {
      files: ['**/*'],
      rules: {
        'no-forbidden-elements': false,
        // or
        'no-forbidden-elements': ['meta', 'html', 'script']
      },
    },
  ],
}
```

## Usage

With `ember-scoped-css` you define styles in an inline `<style scoped>` block or `.css` files that are colocated with your components

```gjs
// ...

<template>
  <div data-test-my-component class='hello-class header'>
    <b>Hello</b>, world!
  </div>

  <style scoped>
    .hello-class {
      color: red;
    }

    /* the :global() pseudo-class is used to define a global class. 
       It mean that header class wont be scoped to that component */
    .hello-class:global(.header) {
      font-size: 20px;
    }

    b {
      color: blue;
    }
  </style>
</template>
```

Note that `<style>` (without `scoped`) will continue to work as it does today and be "global styles"

<details><summary>inline / conditional CSS</summary>

  Like the example above, we can specify the `scoped` attribute on the `<style>` tag, but if we add the `inline` attribute as well, the `<style>` tag will not be extracted to a CSS file during your app's build -- it will be left inline.

  This can be useful for conditionally applied styles.

> [!IMPORTANT]
> While using `inline` enables conditional styles, if multiple of the same component are rendered on a page, the CSS from both `<style scoped inline>` elements will be applied to both renderings of that component.

```gjs
// ...

<template>
  <div data-test-my-component class='hello-class header'>
    <b>Hello</b>, world!
  </div>

  <style scoped inline>
    .hello-class {
      color: red;
    }

    /* the :global() pseudo-class is used to define a global class. 
       It mean that header class wont be scoped to that component */
    .hello-class:global(.header) {
      font-size: 20px;
    }

    b {
      color: blue;
    }
  </style>
</template>
```

</details>

<details><summary>separate CSS file</summary>

```hbs
<div data-test-my-component class='hello-class header'><b>Hello</b>, world!</div>
```

```css
/* src/components/my-component.css */
.hello-class {
  color: red;
}

/* the :global() pseudo-class is used to define a global class. It mean that header class wont be scoped to that component */
:global(.header) {
  font-size: 20px;
}

b {
  color: blue;
}
```

NOTE: that if you're using pods, css co-located with templates/routes/etc will need to be named `styles.css`

</details>

<details><summary>Difference with @scope</summary>

  The [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope) at-rule will scope all CSS defined within a `<style>` tag to the parent element.

```html
<div>
  <style>
    @scope {
      p { color: red; }
    }
  </style>

  <p>this is red</p>
</div>

<p>not red</p>
```

In this example, it is effectively the same as:

```html
<!-- style scoped must be at the root of the template-area -->
<style scoped>
    p.inner { color: red; }
</style>

<div>
  <p class="inner">this is red</p>
</div>

<p>not red</p>
```

But the nice thing is that you don't need to use classes with `@scope`.

A _potential_ downside to `@scope` is that it operates deeply -- where as `<style scoped>` will only apply its styles to the immediate component -- meaning that nested elements / components don't accidentally get surprise styles.

For example:

```gjs
const Inner = <template>
  <p>
    inner (also red)
  </p>
</template>;

const Outer = <template>
  <div>
    <style>
      @scope {
        p { color: red; }
      }
    </style>

    <p>this is red</p>

    <Inner />
  </div>
</template>
```

Where as with `<style scoped>`

```gjs
const Inner = <template>
  <p>
    inner (not red)
  </p>
</template>;

const Outer = <template>
  <style scoped>
    p { color: red; }
  </style>

  <div>
    <p>this is red</p>

    <Inner />
  </div>
</template>
```

</details>

### Passing classes as arguments to a component

There is a `scopedClass` helper that you can use to pass a class name as an argument to a component. The helper takes a class name and returns a scoped class name. `scopedClass` helper is replaced at build time so there is no performance hit when running the app.

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

`ember-scoped-css` exports a ember-template-lint plugin with one rule `scoped-class-helper`. This lint rule is intended to help you prevent improper use of the `scopedClass` helper which might not be immediately obvious during regular development. You can read more information in the [lint rules documentation](docs/lint-rules.md)

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
+    'no-forbidden-elements': ['meta', 'html', 'script'], // style removed
  }
```

## License

This project is licensed under the [MIT License](LICENSE.md).
