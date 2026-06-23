/**
 * End-to-end sourcemap correctness tests.
 *
 * These run a *real* Vite build through the public `ember-scoped-css/vite`
 * plugin (the same entrypoint apps consume) and assert that the scoped CSS
 * we emit carries a correct sourcemap back to the original authored CSS.
 *
 * The strategy is deliberately broad ("does the whole plugin produce correct
 * sourcemaps?") rather than unit-level. When something is wrong, narrow down
 * from here into `rewriteCss` / the unplugin `load` hooks.
 *
 * NOTE: As of writing, the plugin emits scoped CSS but *no* CSS sourcemap, so
 * the correctness assertions below are expected to fail until sourcemap
 * support is implemented. The JS control test documents that the harness
 * itself is sound (Vite does emit JS maps).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  type EncodedSourceMap,
  originalPositionFor,
  TraceMap,
} from '@jridgewell/trace-mapping';
import { build, type Rollup } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { request } from '../lib/request.js';
import { scopedCSS } from './public-exports/vite.js';

type OutputItem = Rollup.OutputChunk | Rollup.OutputAsset;

const tempDirs: string[] = [];

/**
 * Write `files` into a fresh temp dir and run a production Vite build through
 * the scoped-css plugin with sourcemaps enabled and minification disabled
 * (so generated positions are stable and easy to locate).
 *
 * Returns the flattened rollup output (chunks + assets), held in memory.
 */
async function buildProject(
  files: Record<string, string>,
  entry: string,
): Promise<OutputItem[]> {
  const root = mkdtempSync(path.join(tmpdir(), 'scoped-css-sourcemaps-'));

  tempDirs.push(root);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = path.join(root, relativePath);

    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }

  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [scopedCSS()],
    build: {
      write: false,
      sourcemap: true,
      minify: false,
      cssMinify: false,
      reportCompressedSize: false,
      outDir: path.join(root, 'dist'),
      rollupOptions: {
        input: path.join(root, entry),
      },
    },
  });

  const outputs = Array.isArray(result)
    ? result.flatMap((bundle) => bundle.output)
    : 'output' in result
      ? result.output
      : [];

  return outputs as OutputItem[];
}

function assetsOf(outputs: OutputItem[]): Rollup.OutputAsset[] {
  return outputs.filter((o): o is Rollup.OutputAsset => o.type === 'asset');
}

function findCssAsset(outputs: OutputItem[]): Rollup.OutputAsset {
  const css = assetsOf(outputs).find((a) => a.fileName.endsWith('.css'));

  if (!css) {
    throw new Error(
      `No emitted .css asset found. Emitted: ${outputs.map((o) => o.fileName).join(', ')}`,
    );
  }

  return css;
}

function sourceText(asset: Rollup.OutputAsset): string {
  return typeof asset.source === 'string'
    ? asset.source
    : Buffer.from(asset.source).toString('utf8');
}

/**
 * Locate the sourcemap that belongs to a CSS asset, regardless of how it is
 * delivered: an inline `data:` URI in a `sourceMappingURL` comment, an
 * external `.css.map` referenced by comment, or a sibling `<name>.css.map`
 * asset. Returns the parsed map, or `null` if no sourcemap is present.
 */
function extractCssSourcemap(
  outputs: OutputItem[],
  cssAsset: Rollup.OutputAsset,
): EncodedSourceMap | null {
  const css = sourceText(cssAsset);

  const urlMatch = css.match(/\/\*#\s*sourceMappingURL=([^\s*]+)\s*\*\//);

  if (urlMatch) {
    const url = urlMatch[1];

    const inlineBase64 = url.match(
      /^data:application\/json;(?:charset=[^;,]+;)?base64,(.+)$/,
    );

    if (inlineBase64) {
      return JSON.parse(
        Buffer.from(inlineBase64[1], 'base64').toString('utf8'),
      );
    }

    const inlinePlain = url.match(
      /^data:application\/json;?(?:charset=[^,]+)?,(.+)$/,
    );

    if (inlinePlain) {
      return JSON.parse(decodeURIComponent(inlinePlain[1]));
    }

    // External reference: resolve relative to the CSS asset's directory.
    const referenced = path.posix.join(
      path.posix.dirname(cssAsset.fileName),
      url,
    );
    const mapAsset = assetsOf(outputs).find(
      (a) => a.fileName === referenced || a.fileName === url,
    );

    if (mapAsset) {
      return JSON.parse(sourceText(mapAsset));
    }
  }

  // Last resort: a sibling map asset with no inline comment.
  const sibling = assetsOf(outputs).find(
    (a) => a.fileName === `${cssAsset.fileName}.map`,
  );

  if (sibling) {
    return JSON.parse(sourceText(sibling));
  }

  return null;
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

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('colocated scoped CSS', () => {
  const POSTFIX = 'abc123';

  /**
   * styles.css authored layout (1-based lines):
   *   1: .header {
   *   2:   color: red;
   *   3: }
   *   4:
   *   5: .message {
   *   6:   font-size: 1em;
   *   7: }
   */
  const ORIGINAL_CSS = [
    '.header {',
    '  color: red;',
    '}',
    '',
    '.message {',
    '  font-size: 1em;',
    '}',
    '',
  ].join('\n');

  let outputs: OutputItem[];
  let cssAsset: Rollup.OutputAsset;

  beforeAll(async () => {
    outputs = await buildProject(
      {
        'styles.css': ORIGINAL_CSS,
        'entry.js': [
          `import "./styles.css?scoped=${POSTFIX}&cssHash=deadbeef";`,
          `console.log("app");`,
          '',
        ].join('\n'),
      },
      'entry.js',
    );
    cssAsset = findCssAsset(outputs);
  });

  it('emits the scoped CSS (sanity check on the harness)', () => {
    const css = sourceText(cssAsset);

    expect(css).toContain(`.header_${POSTFIX}`);
    expect(css).toContain(`.message_${POSTFIX}`);
  });

  it('emits a sourcemap for the scoped CSS', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(
      map,
      'expected a sourcemap (inline data URI or .css.map asset) for the scoped CSS, found none',
    ).not.toBeNull();
  });

  it('maps the rewritten `.header` selector back to its original line', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(map).not.toBeNull();

    const tracer = new TraceMap(map!);
    const generated = generatedPositionOf(
      sourceText(cssAsset),
      `.header_${POSTFIX}`,
    );
    const original = originalPositionFor(tracer, generated);

    expect(original.source).toBeTruthy();
    expect(path.basename(original.source!)).toBe('styles.css');
    expect(original.line).toBe(1);
    expect(original.column).toBe(0);
  });

  it('maps the rewritten `.message` selector back to its (different) original line', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(map).not.toBeNull();

    const tracer = new TraceMap(map!);
    const generated = generatedPositionOf(
      sourceText(cssAsset),
      `.message_${POSTFIX}`,
    );
    const original = originalPositionFor(tracer, generated);

    expect(path.basename(original.source!)).toBe('styles.css');
    // `.message` is on line 5 of the original file: this guards against a
    // degenerate identity map that happens to satisfy the `.header` case.
    expect(original.line).toBe(5);
    expect(original.column).toBe(0);
  });

  it('includes the original CSS in the sourcemap sources', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(map).not.toBeNull();
    expect(map!.sources.some((s) => s?.endsWith('styles.css'))).toBe(true);
  });
});

describe('inline <style scoped> CSS', () => {
  const POSTFIX = 'def456';

  /**
   * Inline CSS authored layout (1-based lines):
   *   1: .banner {
   *   2:   color: blue;
   *   3: }
   */
  const INLINE_CSS = ['.banner {', '  color: blue;', '}', ''].join('\n');

  let outputs: OutputItem[];
  let cssAsset: Rollup.OutputAsset;

  beforeAll(async () => {
    // This is exactly the virtual request the template plugin injects for an
    // inline `<style scoped>` block.
    const inlineRequest = request.inline.create(
      'inlinehash',
      POSTFIX,
      INLINE_CSS,
    );

    outputs = await buildProject(
      {
        'entry.js': [
          `import ${JSON.stringify(inlineRequest)};`,
          `console.log("app");`,
          '',
        ].join('\n'),
      },
      'entry.js',
    );
    cssAsset = findCssAsset(outputs);
  });

  it('emits the scoped inline CSS (sanity check on the harness)', () => {
    expect(sourceText(cssAsset)).toContain(`.banner_${POSTFIX}`);
  });

  it('emits a sourcemap for the scoped inline CSS', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(
      map,
      'expected a sourcemap for the inline scoped CSS, found none',
    ).not.toBeNull();
  });

  it('maps the rewritten `.banner` selector back to the inline source', () => {
    const map = extractCssSourcemap(outputs, cssAsset);

    expect(map).not.toBeNull();

    const tracer = new TraceMap(map!);
    const generated = generatedPositionOf(
      sourceText(cssAsset),
      `.banner_${POSTFIX}`,
    );
    const original = originalPositionFor(tracer, generated);

    expect(original.source).toBeTruthy();
    expect(original.line).toBe(1);
    expect(original.column).toBe(0);
  });
});

describe('control: JS sourcemaps (should already work)', () => {
  it('emits a valid JS chunk sourcemap', async () => {
    const outputs = await buildProject(
      {
        'entry.js': [
          'export function greet(name) {',
          '  console.log("hello", name);',
          '}',
          'greet("world");',
          '',
        ].join('\n'),
      },
      'entry.js',
    );

    const chunk = outputs.find(
      (o): o is Rollup.OutputChunk => o.type === 'chunk',
    );

    expect(chunk, 'expected a JS chunk').toBeTruthy();
    expect(
      chunk!.map,
      'expected the JS chunk to carry a sourcemap',
    ).toBeTruthy();
    expect(chunk!.map!.sources.some((s) => s?.endsWith('entry.js'))).toBe(true);
  });
});
