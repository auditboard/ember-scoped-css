/**
 * End-to-end sourcemap correctness tests for `.gjs` / `.gts` components.
 *
 * These mirror the real consumer pipeline as closely as we can in-package:
 *
 *   1. `content-tag` preprocesses the `<template>` tag into JS (emitting a map)
 *   2. Babel runs the public `ember-scoped-css/babel` plugin + template
 *      transform via `babel-plugin-ember-template-compilation` (emitting a map)
 *   3. the bundler (Vite/Rollup) composes the maps across those transforms
 *
 * We then assert the final bundled sourcemap traces back to the original
 * `.gjs` / `.gts` source. This is the same "is the whole plugin producing
 * correct sourcemaps?" strategy used for CSS in `sourcemaps.e2e.test.ts`;
 * narrow down from here into the babel plugin / `rewriteHbs` if something is
 * wrong.
 *
 * Note on fidelity: template *interior* positions (e.g. a rewritten class deep
 * inside the markup) are necessarily coarse, because the template compiles to
 * an opaque `precompileTemplate("...")` string literal. The fine-grained
 * assertions below therefore target real JS positions (a top-level identifier),
 * while the template assertions only require the mapping to land in the right
 * source file.
 *
 * Fixtures are written *inside* this package, under a `components/` directory,
 * because the plugin only treats a file as relevant when it resolves to the
 * same workspace as `process.cwd()` and lives under a known root.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import * as babel from '@babel/core';
import {
  type EncodedSourceMap,
  originalPositionFor,
  TraceMap,
} from '@jridgewell/trace-mapping';
import { Preprocessor } from 'content-tag';
import { build, type Rollup, transformWithEsbuild } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scopedCSS } from './public-exports/babel.js';

const preprocessor = new Preprocessor();

const cleanId = (id: string) => id.split('?')[0];
const isGlimmer = (id: string) => /\.g[jt]s$/.test(cleanId(id));
const isGts = (id: string) => /\.gts$/.test(cleanId(id));

/** Ember/Glimmer runtime imports the bundle does not need resolved for this test. */
const emberExternals = (id: string) =>
  id.startsWith('@ember/') ||
  id.startsWith('@glimmer/') ||
  id.startsWith('@embroider/');

/**
 * Stands in for `@embroider/vite`'s `ember()` / `addon.gjs()`: turns the
 * `<template>` tag into JS and hands back content-tag's sourcemap.
 */
const contentTagPlugin = {
  name: 'test:content-tag',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!isGlimmer(id)) return null;

    const out = preprocessor.process(code, { filename: cleanId(id) });

    return {
      code: out.code,
      map: typeof out.map === 'string' ? JSON.parse(out.map) : out.map,
    };
  },
};

/** Strips TypeScript from `.gts` output (what esbuild does for the app). */
const typescriptPlugin = {
  name: 'test:ts',
  async transform(code: string, id: string) {
    if (!isGts(id)) return null;

    return transformWithEsbuild(code, cleanId(id), {
      loader: 'ts',
      sourcemap: true,
    });
  },
};

/** Runs the actual `ember-scoped-css/babel` plugin + template transform. */
const scopedCssBabelPlugin = {
  name: 'test:babel',
  async transform(code: string, id: string) {
    if (!isGlimmer(id)) return null;

    const result = await babel.transformAsync(code, {
      filename: cleanId(id),
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      plugins: [
        scopedCSS(),
        [
          'babel-plugin-ember-template-compilation',
          { targetFormat: 'hbs', transforms: [scopedCSS.template({})] },
        ],
      ],
    });

    return { code: result!.code, map: result!.map };
  },
};

interface BuiltGlimmer {
  code: string;
  map: EncodedSourceMap;
  /** basename of the authored source file, e.g. `comp.gjs` */
  sourceName: string;
}

let fixturesBase: string;

/**
 * Write a `.gjs`/`.gts` fixture and run a real Vite build through the
 * content-tag → babel pipeline. Returns the emitted JS chunk's code + map.
 */
async function buildGlimmer(
  ext: 'gjs' | 'gts',
  source: string,
): Promise<BuiltGlimmer> {
  const dir = mkdtempSync(path.join(fixturesBase, 'c-'));
  const componentsDir = path.join(dir, 'components');

  mkdirSync(componentsDir, { recursive: true });

  const sourceName = `comp.${ext}`;
  const file = path.join(componentsDir, sourceName);

  writeFileSync(file, source);

  const result = await build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    plugins: [contentTagPlugin, typescriptPlugin, scopedCssBabelPlugin],
    build: {
      write: false,
      sourcemap: true,
      minify: false,
      reportCompressedSize: false,
      outDir: path.join(dir, 'dist'),
      rollupOptions: {
        input: file,
        external: emberExternals,
      },
    },
  });

  const outputs = Array.isArray(result)
    ? result.flatMap((bundle) => bundle.output)
    : 'output' in result
      ? result.output
      : [];

  const chunk = (outputs as (Rollup.OutputChunk | Rollup.OutputAsset)[]).find(
    (o): o is Rollup.OutputChunk => o.type === 'chunk',
  );

  if (!chunk) {
    throw new Error('No JS chunk was emitted from the Glimmer build');
  }

  if (!chunk.map) {
    throw new Error('The emitted JS chunk has no sourcemap');
  }

  return {
    code: chunk.code,
    map: chunk.map as unknown as EncodedSourceMap,
    sourceName,
  };
}

/** 1-based line, 0-based column of the first occurrence of `token`. */
function generatedPositionOf(
  text: string,
  token: string,
): { line: number; column: number } {
  const index = text.indexOf(token);

  if (index === -1) {
    throw new Error(`Token ${JSON.stringify(token)} not found in:\n${text}`);
  }

  const before = text.slice(0, index);
  const lines = before.split('\n');

  return {
    line: lines.length,
    column: lines[lines.length - 1].length,
  };
}

beforeAll(() => {
  fixturesBase = mkdtempSync(
    path.join(process.cwd(), '.tmp-sourcemaps-glimmer-'),
  );
});

afterAll(() => {
  if (fixturesBase) {
    rmSync(fixturesBase, { recursive: true, force: true });
  }
});

describe('.gjs sourcemaps', () => {
  const SOURCE = [
    `import { concat } from '@ember/helper';`,
    ``,
    `<template>`,
    `  <div class='alert' data-test={{scoped-class 'my-class'}}>`,
    `    {{@title}}`,
    `  </div>`,
    `</template>`,
    ``,
  ].join('\n');

  let built: BuiltGlimmer;

  beforeAll(async () => {
    built = await buildGlimmer('gjs', SOURCE);
  });

  it('rewrites the scoped-class usage (sanity check on the harness)', () => {
    expect(built.code).toMatch(/my-class_[a-z0-9]+/);
  });

  it('emits a non-empty sourcemap that references the original .gjs', () => {
    // The real addon `dist` ships `{ sources: [], mappings: "" }` for .gjs —
    // this guards against that empty-map regression.
    expect(built.map.mappings.length).toBeGreaterThan(0);
    expect(built.map.sources.some((s) => s?.endsWith('comp.gjs'))).toBe(true);
  });

  it('includes the original .gjs contents in the sourcemap', () => {
    expect(
      built.map.sourcesContent?.some((c) => c?.includes('<template>')),
    ).toBe(true);
  });

  it('maps the rewritten class back into the original .gjs file', () => {
    const tracer = new TraceMap(built.map);
    const renamed = built.code.match(/my-class_[a-z0-9]+/)![0];
    const generated = generatedPositionOf(built.code, renamed);
    const original = originalPositionFor(tracer, generated);

    // Template interiors map coarsely, so only require the right file + a real
    // line; precise in-template fidelity is owned by the template compiler.
    expect(original.source).toBeTruthy();
    expect(path.basename(original.source!)).toBe('comp.gjs');
    expect(original.line).toBeGreaterThanOrEqual(1);
  });
});

describe('.gts sourcemaps', () => {
  const SOURCE = [
    `const greeting: string = 'hi';`,
    ``,
    `<template>`,
    `  <div data-test={{scoped-class 'my-class'}}>{{greeting}}</div>`,
    `</template>`,
    ``,
  ].join('\n');

  let built: BuiltGlimmer;

  beforeAll(async () => {
    built = await buildGlimmer('gts', SOURCE);
  });

  it('rewrites the scoped-class usage (sanity check on the harness)', () => {
    expect(built.code).toMatch(/my-class_[a-z0-9]+/);
  });

  it('emits a non-empty sourcemap that references the original .gts', () => {
    expect(built.map.mappings.length).toBeGreaterThan(0);
    expect(built.map.sources.some((s) => s?.endsWith('comp.gts'))).toBe(true);
  });

  it('maps a top-level identifier back to its exact original position', () => {
    // `const greeting` is on line 1, column 6 of the authored .gts. This is a
    // real JS position (outside the template), so it must map precisely.
    const tracer = new TraceMap(built.map);
    const generated = generatedPositionOf(built.code, 'greeting');
    const original = originalPositionFor(tracer, generated);

    expect(path.basename(original.source!)).toBe('comp.gts');
    expect(original.line).toBe(1);
    expect(original.column).toBe(6);
  });

  it('maps the rewritten class back into the original .gts file', () => {
    const tracer = new TraceMap(built.map);
    const renamed = built.code.match(/my-class_[a-z0-9]+/)![0];
    const generated = generatedPositionOf(built.code, renamed);
    const original = originalPositionFor(tracer, generated);

    expect(original.source).toBeTruthy();
    expect(path.basename(original.source!)).toBe('comp.gts');
    expect(original.line).toBeGreaterThanOrEqual(1);
  });
});
