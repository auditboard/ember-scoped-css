# stylelint-ember-scoped-css

Stylelint plugin and config for [ember-scoped-css](https://github.com/soxhub/ember-scoped-css) projects.

## Why?

ember-scoped-css works by transforming class selectors like `.my-class` into `.my-class-abc123` to ensure component isolation. Selectors without scopable classes will:

1. **Apply globally** instead of being scoped to the component
2. **Break component isolation** by affecting elements outside the component
3. **Cause unexpected styling conflicts** across components

## Installation

```bash
npm install --save-dev stylelint-ember-scoped-css stylelint
```

## Usage

### As a config (recommended)

```json
{
  "overrides": [
    {
      "files": ["app/components/**/*.css", "app/templates/**/*.css"],
      "extends": ["stylelint-ember-scoped-css/config"]
    }
  ]
}
```

This adds ember-scoped-css specific rules to your existing stylelint config.

### As a plugin

```json
{
  "files": ["app/components/**/*.css", "app/templates/**/*.css"],
  "plugins": ["stylelint-ember-scoped-css"],
  "rules": {
    "ember-scoped-css/no-unscoped-selectors": true
  }
}
```

## List of rules

- [`no-unscoped-selectors`](./src/rules/no-unscoped-selectors/README.md)

## License

MIT
