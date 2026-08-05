## scoped-class-helper

This rule checks if the helper has one positional param of type StringLiteral. It
applies to both spellings: the imported `scopedClass` and the legacy hbs global
`scoped-class`. The following examples show the correct use of the helper:

```hbs
<SomeComponent @class={{scopedClass 'first-class second-class'}} />
<SomeComponent @class={{scoped-class 'first-class second-class'}} />
```

### Examples

This rule forbids the following:

1. Wrong number of positional params

```hbs
<SomeComponent @class={{scopedClass}} />
<SomeComponent @class={{scopedClass 'first-class' 'second-param'}} />
<SomeComponent @class={{scoped-class}} />
<SomeComponent @class={{scoped-class 'first-class' 'second-param'}} />
```

2. Dynamic properties

```hbs
<SomeComponent @class={{scopedClass this.myClass}} />
<SomeComponent @class={{scoped-class this.myClass}} />
```
