import { createRequire } from 'node:module';

import postcss from 'postcss';

const nodeRequire = createRequire(import.meta.url);

/**
 * `content-tag` and `@glimmer/syntax` are optional peer dependencies, so that a
 * consumer using only the rules does not pay for a parser it never runs. They
 * are required rather than imported so a consumer who opts in without
 * installing them gets a message naming both, instead of a bare
 * ERR_MODULE_NOT_FOUND naming whichever resolved first.
 *
 * @param {(id: string) => unknown} [requireFn] seam for testing the failure
 * @returns {{ Preprocessor: new () => { parse: (source: string) => Array<{ contentRange: { start: number, end: number } }> }, parseTemplate: (contents: string) => import('@glimmer/syntax').ASTv1.Template }}
 */
export function loadParsers(requireFn = nodeRequire) {
  try {
    return {
      Preprocessor: requireFn('content-tag').Preprocessor,
      parseTemplate: requireFn('@glimmer/syntax').preprocess,
    };
  } catch (error) {
    throw new Error(
      "stylelint-ember-scoped-css/syntax needs 'content-tag' and " +
        "'@glimmer/syntax'. They are optional peer dependencies, so install " +
        'them alongside it: npm i -D content-tag @glimmer/syntax',
      { cause: error },
    );
  }
}

/** @type {ReturnType<typeof loadParsers> | undefined} */
let parsers;

/** @type {{ parse: (source: string) => Array<{ contentRange: { start: number, end: number } }> } | undefined} */
let preprocessor;

/**
 * content-tag reports UTF-8 byte offsets, but we slice JS strings, which are
 * indexed by code unit. Converting is only a no-op for pure-ASCII files.
 *
 * @param {Buffer} buffer the source, as UTF-8 bytes
 * @param {number} byteOffset
 * @returns {number} the equivalent index into the source string
 */
function toStringIndex(buffer, byteOffset) {
  return buffer.subarray(0, byteOffset).toString('utf8').length;
}

/**
 * A .gts that does not parse has no styles we can trust. Its real error comes
 * from glint or the template compiler, so we neither report it as a CSS
 * problem nor let it abort the whole stylelint run.
 *
 * @param {string} source
 * @returns {Array<{ contentRange: { start: number, end: number } }>}
 */
function parseTemplates(source) {
  try {
    return preprocessor.parse(source);
  } catch {
    return [];
  }
}

/**
 * @param {string} contents the body of a single `<template>`
 * @returns {import('@glimmer/syntax').ASTv1.Template | null}
 */
function parseTemplateContents(contents) {
  try {
    return parsers.parseTemplate(contents);
  } catch {
    return null;
  }
}

/**
 * Mirrors `hasScopedAttribute` in ember-scoped-css's template plugin: a bare
 * `<style>` is deliberately global CSS, so linting it as scoped CSS would be
 * wrong.
 *
 * @param {{ attributes: Array<{ name: string }> }} node
 * @returns {boolean}
 */
function isScoped(node) {
  return node.attributes.some((attribute) => attribute.name === 'scoped');
}

/**
 * A `lang` attribute means the block is scss/sass that Vite preprocesses at
 * build time. postcss's default parser cannot read it, so we leave it alone.
 *
 * @param {{ attributes: Array<{ name: string }> }} node
 * @returns {boolean}
 */
function isPreprocessed(node) {
  return node.attributes.some((attribute) => attribute.name === 'lang');
}

/**
 * The CSS text of every root-level plain `<style scoped>` element in the file,
 * as absolute offsets into `source`.
 *
 * @param {string} source contents of a .gts/.gjs file
 * @returns {Array<{ start: number, end: number }>}
 */
function findStyleBlocks(source) {
  parsers ??= loadParsers();
  preprocessor ??= new parsers.Preprocessor();

  const buffer = Buffer.from(source, 'utf8');
  const blocks = [];

  for (const template of parseTemplates(source)) {
    const contentsStart = toStringIndex(buffer, template.contentRange.start);
    const contentsEnd = toStringIndex(buffer, template.contentRange.end);
    const ast = parseTemplateContents(source.slice(contentsStart, contentsEnd));

    if (!ast) continue;

    for (const node of ast.body) {
      if (node.type !== 'ElementNode' || node.tag !== 'style') continue;
      if (!isScoped(node) || isPreprocessed(node)) continue;

      // Slicing by offset rather than reading `chars` keeps the CSS byte-exact,
      // so a `--fix` that touches one block cannot rewrite another.
      const [text] = node.children;

      if (!text) continue;

      blocks.push({
        start: contentsStart + text.loc.getStart().offset,
        end: contentsStart + text.loc.getEnd().offset,
      });
    }
  }

  return blocks;
}

/**
 * Move a parsed block from positions relative to the block onto positions
 * relative to the file, so warnings point at real .gts lines.
 *
 * @param {import('postcss').Root} root
 * @param {number} lineOffset lines of .gts preceding the block
 * @param {number} columnOffset columns preceding the block on its opening line
 */
function reposition(root, lineOffset, columnOffset) {
  /** @param {import('postcss').Position | undefined} pos */
  const shift = (pos) => {
    if (!pos) return;
    // Only the opening line is indented by the tag; later lines start at column 1.
    if (pos.line === 1) pos.column += columnOffset;
    pos.line += lineOffset;
  };

  shift(root.source?.start);
  shift(root.source?.end);
  root.walk((node) => {
    shift(node.source?.start);
    shift(node.source?.end);
  });
}

/**
 * @param {string} source
 * @param {import('postcss').ProcessOptions} [opts]
 * @returns {import('postcss').Document}
 */
export function parse(source, opts) {
  const doc = postcss.document();
  const roots = [];

  let cursor = 0;

  for (const { start, end } of findStyleBlocks(source)) {
    const root = postcss.parse(source.slice(start, end), opts);
    const before = source.slice(0, start);

    reposition(
      root,
      before.split('\n').length - 1,
      start - (before.lastIndexOf('\n') + 1),
    );

    // The .gts around each block rides along verbatim so --fix cannot corrupt it.
    root.raws.codeBefore = source.slice(cursor, start);
    root.parent = doc;
    roots.push(root);
    cursor = end;
  }

  if (roots.length === 0) {
    // A component with no styles is not an error, just an empty document.
    doc.raws.codeBefore = source;

    return doc;
  }

  roots.at(-1).raws.codeAfter = source.slice(cursor);
  doc.nodes = roots;
  doc.source = {
    input: new postcss.Input(source, opts),
    start: { line: 1, column: 1, offset: 0 },
  };

  return doc;
}

/**
 * @param {import('postcss').AnyNode} node
 * @param {import('postcss').Builder} builder
 */
export function stringify(node, builder) {
  if (node.type !== 'document') {
    postcss.stringify(node, builder);

    return;
  }

  if (node.nodes.length === 0) {
    if (node.raws.codeBefore) builder(node.raws.codeBefore);

    return;
  }

  node.each((root) => {
    if (root.raws.codeBefore) builder(root.raws.codeBefore);
    postcss.stringify(root, builder);
    if (root.raws.codeAfter) builder(root.raws.codeAfter);
  });
}
