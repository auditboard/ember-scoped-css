/**
 * End-to-end sourcemap correctness for ember-scoped-css, run against the *real*
 * v2-addon rollup pipeline (see `./build.mjs`).
 *
 * What this project established:
 *
 *  - Components WITHOUT a colocated `.css` (plain `.gjs` / `.gts`) already get
 *    correct sourcemaps. Those tests pass and act as regression guards.
 *
 *  - The moment a component imports a colocated `.css`, `@embroider/addon-dev`'s
 *    `keep-assets` plugin transforms the asset without emitting a sourcemap.
 *    Rollup warns (`SOURCEMAP_BROKEN`) and the breakage poisons BOTH:
 *      * the component's JS chunk map (collapses to empty), and
 *      * the emitted `.css` (no usable map at all).
 *
 * The failing tests below pin that bug. They should go green once the CSS that
 * `ember-scoped-css` produces carries a sourcemap through the bundler.
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
  it('produces no "broken sourcemap" warnings', () => {
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

describe('colocated CSS component — the bug', () => {
  it('the JS chunk keeps a non-empty map referencing the original .gjs', () => {
    const chunk = chunkNamed('colocated');

    expect(chunk?.map).toBeTruthy();
    // Currently empty: importing the colocated .css poisons the chunk map.
    expect(chunk.map.mappings.length).toBeGreaterThan(0);
    expect(chunk.map.sources.some((s) => s?.endsWith('colocated.gjs'))).toBe(
      true,
    );
  });

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

describe('inline <style scoped> component — the bug', () => {
  it('the JS chunk keeps a non-empty map referencing the original .gjs', () => {
    const chunk = chunkNamed('inline');

    expect(chunk?.map).toBeTruthy();
    // Same failure mode as colocated: the virtual inline CSS import poisons it.
    expect(chunk.map.mappings.length).toBeGreaterThan(0);
    expect(chunk.map.sources.some((s) => s?.endsWith('inline.gjs'))).toBe(true);
  });

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
