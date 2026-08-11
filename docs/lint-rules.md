## scoped-class-helper

This rule checks if the helper has one positional param of type StringLiteral. It
applies to both spellings: the imported `scopedClass` and the legacy hbs global
`scoped-class`. The following examples show the correct use of the helper:

```hbs
<SomeComponent @class={{scoped-class 'first-class second-class'}} />
```

```gjs
import { scopedClass } from 'ember-scoped-css';

<template>
  <SomeComponent @class={{scopedClass 'first-class second-class'}} />
</template>
```

### Examples

This rule forbids the following:

1. Wrong number of positional params

```hbs
<SomeComponent @class={{scoped-class}} />
<SomeComponent @class={{scoped-class 'first-class' 'second-param'}} />
```

```gjs
import { scopedClass } from 'ember-scoped-css';

<template>
  <SomeComponent @class={{scopedClass 'first-class' 'second-param'}} />
</template>
```

2. Dynamic properties

```hbs
<SomeComponent @class={{scoped-class this.myClass}} />
```

```gjs
import { scopedClass } from 'ember-scoped-css';

<template>
  <SomeComponent @class={{scopedClass this.myClass}} />
</template>
```
