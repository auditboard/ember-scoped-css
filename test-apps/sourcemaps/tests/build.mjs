/**
 * Runs the *real* v2-addon rollup pipeline programmatically against this
 * project's `src/`, capturing the in-memory output and any rollup warnings.
 *
 * This deliberately uses the same plugin set a consuming addon ships:
 *   - `ember-scoped-css/rollup` (CSS request handling)
 *   - `@rollup/plugin-babel` driving this project's `babel.config.mjs`
 *     (which runs `ember-scoped-css/babel` + the template transform)
 *   - `@embroider/addon-dev`'s `addon.gjs()` + `addon.keepAssets()`
 *
 * `addon.keepAssets()` is the plugin rollup flags as breaking the sourcemap
 * chain, so including it is the whole point — it's what makes this faithful.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Addon } from '@embroider/addon-dev/rollup';
import { babel } from '@rollup/plugin-babel';
import { scopedCSS } from 'ember-scoped-css/rollup';
import { rollup } from 'rollup';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const src = (relative) => path.join(root, 'src', relative);

/** Runtime modules we don't need rollup to resolve for a sourcemap check. */
const isExternal = (id) =>
  id.startsWith('@ember/') ||
  id.startsWith('@glimmer/') ||
  id.startsWith('@embroider/') ||
  id.includes('decorator-transforms') ||
  id.includes('@babel/runtime');

/**
 * @returns {Promise<{ output: import('rollup').OutputChunk[] | import('rollup').OutputAsset[], warnings: import('rollup').RollupLog[] }>}
 */
export async function buildAddon() {
  const addon = new Addon({ srcDir: 'src', destDir: 'dist' });

  /** @type {import('rollup').RollupLog[]} */
  const warnings = [];

  const bundle = await rollup({
    input: {
      'components/colocated': src('components/colocated.gjs'),
      'components/typed': src('components/typed.gts'),
      'components/scoped': src('components/scoped.gjs'),
    },
    external: isExternal,
    onwarn(warning) {
      warnings.push(warning);
    },
    plugins: [
      scopedCSS(),
      babel({
        babelHelpers: 'bundled',
        extensions: ['.js', '.ts', '.gjs', '.gts'],
      }),
      addon.gjs(),
      addon.keepAssets(['**/*.css']),
    ],
  });

  try {
    const { output } = await bundle.generate({
      ...addon.output(),
      sourcemap: true,
    });

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
