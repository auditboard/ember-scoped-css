/**
 * Runs the *real* v2-addon rollup pipeline programmatically against this
 * project's `src/`, capturing the in-memory output and any rollup warnings.
 *
 * This is the same plugin set (and ordering) a consuming addon ships, so the
 * addon API does the work for us:
 *   - `addon.publicEntrypoints()` discovers entry modules from `src/` — there is
 *     no hand-written `input`.
 *   - `addon.dependencies()` decides externals (deps + ember virtual packages) —
 *     there is no hand-written `external`.
 *   - `addon.gjs()` / `addon.hbs()` handle `<template>` and `.hbs`.
 *   - `addon.keepAssets()` keeps `.css` imports as emitted assets. This is the
 *     plugin rollup flags as breaking the sourcemap chain, so including it is
 *     the whole point.
 */
import { Addon } from '@embroider/addon-dev/rollup';
import { babel } from '@rollup/plugin-babel';
import { scopedCSS } from 'ember-scoped-css/rollup';
import { rollup } from 'rollup';

/**
 * @returns {Promise<{ output: (import('rollup').OutputChunk | import('rollup').OutputAsset)[], warnings: import('rollup').RollupLog[] }>}
 */
export async function buildAddon() {
  const addon = new Addon({ srcDir: 'src', destDir: 'dist' });

  /** @type {import('rollup').RollupLog[]} */
  const warnings = [];

  const bundle = await rollup({
    onwarn(warning) {
      warnings.push(warning);
    },
    plugins: [
      scopedCSS(),
      addon.publicEntrypoints(['components/**/*.js']),
      addon.dependencies(),
      babel({
        babelHelpers: 'bundled',
        extensions: ['.js', '.ts', '.gjs', '.gts'],
      }),
      addon.hbs(),
      addon.gjs(),
      addon.keepAssets(['**/*.css']),
    ],
  });

  try {
    const { output } = await bundle.generate(addon.output());

    return { output, warnings };
  } finally {
    await bundle.close();
  }
}

/** First occurrence of `token` as a { line (1-based), column (0-based) }. */
export function generatedPositionOf(text, token) {
  const index = text.indexOf(token);

  if (index === -1) {
    throw new Error(`Token ${JSON.stringify(token)} not found in:\n${text}`);
  }

  const before = text.slice(0, index);
  const lines = before.split('\n');

  return { line: lines.length, column: lines[lines.length - 1].length };
}

export function chunks(output) {
  return output.filter((o) => o.type === 'chunk');
}

export function assets(output) {
  return output.filter((o) => o.type === 'asset');
}
