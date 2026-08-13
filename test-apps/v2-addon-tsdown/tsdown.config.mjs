import { fileURLToPath } from 'node:url';

import { ember } from '@nullvoxpopuli/ember-rolldown';
import { defineConfig } from 'tsdown';

import { scopedCSS } from 'ember-scoped-css/rollup';

const babelConfig = fileURLToPath(
  new URL('./babel.publish.config.mjs', import.meta.url),
);

export default defineConfig({
  // The public entrypoint; the components bundle into it.
  entry: ['./src/index.ts'],
  // The publish tsconfig, not tsconfig.json: isolatedDeclarations (which
  // ember() requires) should constrain only what gets declarations emitted
  // for it.
  tsconfig: './tsconfig.publish.json',
  logLevel: 'warn',
  // Keep the css imports in the JS output so consuming apps load the
  // stylesheet implicitly by importing a component, like addon-dev's
  // keepAssets output — no explicit styles.css import needed.
  css: { inject: true },
  plugins: [
    // ember() must come first: its content-tag transform rewrites `<template>`
    // in .gts to plain JS before anything else parses the module. The
    // component CSS imports are bundled by tsdown via @tsdown/css into a
    // single dist/style.css, re-imported from the modules via css.inject.
    ember({ babel: { configFile: babelConfig } }),
    scopedCSS(),
  ],
});
