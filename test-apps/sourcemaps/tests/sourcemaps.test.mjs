/**
 * End-to-end sourcemap correctness for ember-scoped-css, run against the *real*
 * v2-addon rollup pipeline (see `./build.mjs`).
 *
 * Two layers are at play:
 *
 *  1. ember-scoped-css's own CSS output. FIXED: the scoped CSS we emit
 *     (colocated and inline `<style scoped>`) now carries an inline sourcemap
 *     that traces back to the authored source.
 *
 *  2. `@embroider/addon-dev`'s `keep-assets` plugin, which the addon uses to
 *     emit `.css` files. It drops sourcemaps in BOTH its `transform` hook
 *     (replaces the CSS module with a marker, no map) and its `renderChunk`
 *     hook (prepends import statements to the chunk, no map). That poisons the
 *     JS chunk map for any component importing a kept asset and makes rollup
 *     warn `SOURCEMAP_BROKEN`. This is upstream and NOT fixable from here.
 *
 * Tests marked `it.fails` pin that upstream limitation: they're expected to
 * fail today and will start passing once keep-assets preserves sourcemaps — at
 * which point vitest flips them red, prompting us to drop the `.fails`.
 */
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { beforeAll, describe, expect, it } from 'vitest';

import { assets, buildAddon, chunks, generatedPositionOf } from './build.mjs';

/** @type {Awaited<ReturnType<typeof buildAddon>>} */
let result;

beforeAll(async () => {
  result = await buildAddon();
});

const chunkNamed = (name) =>
  chunks(result.output).find((c) => c.fileName === `components/${name}.js`);

/** Find the sourcemap belonging to a CSS asset (inline comment or sibling). */
function cssSourcemap(cssAsset) {
  const css =
    typeof cssAsset.source === 'string'
      ? cssAsset.source
      : Buffer.from(cssAsset.source).toString('utf8');

  const match = css.match(/\/\*#\s*sourceMappingURL=([^\s*]+)\s*\*\//);

  if (match) {
    const url = match[1];
    const base64 = url.match(/^data:application\/json;(?:[^,]*;)?base64,(.+)$/);

    if (base64) {
      return JSON.parse(Buffer.from(base64[1], 'base64').toString('utf8'));
    }

    const sibling = assets(result.output).find((a) =>
      a.fileName.endsWith(url.split('/').pop()),
    );

    if (sibling) return JSON.parse(sibling.source);
  }

  // sibling `<name>.css.map`
  const sibling = assets(result.output).find(
    (a) => a.fileName === `${cssAsset.fileName}.map`,
  );

  if (sibling) return JSON.parse(sibling.source);

  return null;
}

describe('the build itself', () => {
  // Upstream: keep-assets' transform + renderChunk hooks don't emit maps.
  it.fails('produces no "broken sourcemap" warnings', () => {
    const broken = result.warnings.filter((w) => w.code === 'SOURCEMAP_BROKEN');

    expect(
      broken.map((w) => w.message),
      'rollup flagged one or more sourcemaps as broken',
    ).toEqual([]);
  });
});

describe('plain .gjs / .gts (no colocated CSS) — regression guards', () => {
  it('a .gjs gets a non-empty map referencing the original source', () => {
    const chunk = chunkNamed('scoped');

    expect(chunk?.map).toBeTruthy();
    expect(chunk.map.mappings.length).toBeGreaterThan(0);
    expect(chunk.map.sources.some((s) => s?.endsWith('scoped.gjs'))).toBe(true);
  });

  it('a .gts maps a top-level identifier back to its exact original position', () => {
    const chunk = chunkNamed('typed');

    expect(chunk?.map).toBeTruthy();
    expect(chunk.map.sources.some((s) => s?.endsWith('typed.gts'))).toBe(true);

    const tracer = new TraceMap(chunk.map);
    const generated = generatedPositionOf(chunk.code, 'greeting');
    const original = originalPositionFor(tracer, generated);

    // `const greeting` is line 1, column 6 of typed.gts.
    expect(original.source?.endsWith('typed.gts')).toBe(true);
    expect(original.line).toBe(1);
    expect(original.column).toBe(6);
  });
});

describe('colocated CSS component', () => {
  // Upstream (keep-assets): importing the kept .css asset poisons the chunk map.
  it.fails(
    'the JS chunk keeps a non-empty map referencing the original .gjs',
    () => {
      const chunk = chunkNamed('colocated');

      expect(chunk?.map).toBeTruthy();
      expect(chunk.map.mappings.length).toBeGreaterThan(0);
      expect(chunk.map.sources.some((s) => s?.endsWith('colocated.gjs'))).toBe(
        true,
      );
    },
  );

  it('the emitted scoped CSS carries a sourcemap', () => {
    const cssAsset = assets(result.output).find((a) =>
      a.fileName.endsWith('colocated.css'),
    );

    expect(
      cssAsset,
      'expected a colocated .css asset to be emitted',
    ).toBeTruthy();

    const map = cssSourcemap(cssAsset);

    expect(map, 'the scoped CSS has no usable sourcemap').not.toBeNull();
    expect(map.mappings.length).toBeGreaterThan(0);
    expect(map.sources.some((s) => s?.endsWith('colocated.css'))).toBe(true);
  });

  it('the scoped CSS map traces a rewritten selector back to the source', () => {
    const cssAsset = assets(result.output).find((a) =>
      a.fileName.endsWith('colocated.css'),
    );
    const map = cssSourcemap(cssAsset);

    expect(map).not.toBeNull();

    const css =
      typeof cssAsset.source === 'string'
        ? cssAsset.source
        : Buffer.from(cssAsset.source).toString('utf8');
    const renamed = css.match(/\.title_[a-z0-9]+/)[0];
    const tracer = new TraceMap(map);
    const original = originalPositionFor(
      tracer,
      generatedPositionOf(css, renamed),
    );

    // `.title` is on line 1 of colocated.css.
    expect(original.source?.endsWith('colocated.css')).toBe(true);
    expect(original.line).toBe(1);
  });
});

describe('inline <style scoped> component', () => {
  // Upstream (keep-assets): same failure mode as colocated.
  it.fails(
    'the JS chunk keeps a non-empty map referencing the original .gjs',
    () => {
      const chunk = chunkNamed('inline');

      expect(chunk?.map).toBeTruthy();
      expect(chunk.map.mappings.length).toBeGreaterThan(0);
      expect(chunk.map.sources.some((s) => s?.endsWith('inline.gjs'))).toBe(
        true,
      );
    },
  );

  it('the extracted inline CSS carries a sourcemap', () => {
    const cssAsset = assets(result.output).find((a) =>
      a.fileName.includes('inline-css'),
    );

    expect(cssAsset, 'expected an inline CSS asset to be emitted').toBeTruthy();

    const map = cssSourcemap(cssAsset);

    expect(map, 'the inline scoped CSS has no usable sourcemap').not.toBeNull();
    expect(map.mappings.length).toBeGreaterThan(0);
  });
});
