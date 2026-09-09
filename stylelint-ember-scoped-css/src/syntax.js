import { preprocess as parseTemplate } from '@glimmer/syntax';

import { Transformer } from 'content-tag-utils';
import {
  getLangAttribute,
  hasScopedAttribute,
} from 'ember-scoped-css/__private_do_not_use_are_you_serious__/style-tag';
import postcss from 'postcss';
import less from 'postcss-less';
import scss from 'postcss-scss';
import styl from 'postcss-styl';

const CSS_SYNTAX = { parse: postcss.parse, stringify: postcss.stringify };

/**
 * Every parser here round-trips its dialect byte-exact, and parse and
 * stringify both resolve through syntaxForLang, so `--fix` writes a block back
 * with the syntax that read it.
 *
 * `sass` is absent because no parser reads indented Sass correctly.
 * postcss-styl reads `$brand: #fff` as a selector, since Stylus assigns with
 * `=`, and throws a TypeError on `=mixin`. postcss-sass returns an empty AST
 * for `=mixin` and `+include` and drops the rule from `@extend %placeholder`,
 * so a block using either lints clean and `--fix` writes back less than it
 * read.
 */
const SYNTAXES = new Map([
  ['scss', scss],
  ['less', less],
  ['styl', styl],
  ['stylus', styl],
]);

/**
 * @param {string | null} lang lowercased `lang`, or null for plain CSS
 * @returns {{ parse: Function, stringify: Function }}
 */
function syntaxForLang(lang) {
  if (lang === null) return CSS_SYNTAX;

  return SYNTAXES.get(lang) ?? CSS_SYNTAX;
}

/**
 * A .gts that does not parse has no styles. Glint already reports that error,
 * so it is not a CSS problem and must not abort the stylelint run.
 *
 * @param {string} source
 * @returns {Array<{ start: number, end: number }>} each template's contents,
 *   as indices into `source`
 */
function findTemplates(source) {
  let transformer;

  try {
    transformer = new Transformer(source);
  } catch (error) {
    // A TypeError is our bug or a parser API change, not bad source.
    if (error instanceof TypeError) throw error;

    return [];
  }

  /** @type {Array<{ start: number, end: number }>} */
  const templates = [];

  transformer.each((_contents, { start, end }) => {
    templates.push({ start, end });
  });

  return templates;
}

/**
 * @param {string} contents the body of a single `<template>`
 * @returns {import('@glimmer/syntax').ASTv1.Template | null}
 */
function parseTemplateContents(contents) {
  try {
    return parseTemplate(contents);
  } catch (error) {
    if (error instanceof TypeError) throw error;

    return null;
  }
}

/**
 * @param {string} source contents of a .gts/.gjs file
 * @returns {Array<{ start: number, end: number, lang: string | null }>}
 */
function findStyleBlocks(source) {
  const blocks = [];

  for (const { start: contentsStart, end: contentsEnd } of findTemplates(
    source,
  )) {
    const ast = parseTemplateContents(source.slice(contentsStart, contentsEnd));

    if (!ast) continue;

    for (const node of ast.body) {
      // The build decides what counts as scoped, so its helper decides here too.
      if (!hasScopedAttribute(node)) continue;

      const lang = getLangAttribute(node)?.toLowerCase() ?? null;

      // No parser reads indented Sass correctly. See SYNTAXES.
      if (lang === 'sass') continue;

      // `<style scoped inline>` allows mustaches, which postcss cannot parse.
      // Linting only the text around one reports a syntax error on valid source.
      const [text, ...rest] = node.children;

      if (!text || rest.length > 0 || text.type !== 'TextNode') continue;

      // Offsets, not `chars`, so `--fix` writes back the exact bytes it read.
      blocks.push({
        start: contentsStart + text.loc.getStart().offset,
        end: contentsStart + text.loc.getEnd().offset,
        lang,
      });
    }
  }

  return blocks;
}

/**
 * stylelint builds an editor fix range from `node.source.start.offset`, so a
 * block-relative offset makes an LSP fix write into unrelated source.
 *
 * `input` must be the whole .gts. postcss finds a `word` warning position by
 * slicing `input.css` between the node's offsets, and a block-only input has
 * nothing at .gts offsets, so the position falls back to the node start.
 *
 * @param {import('postcss').Root} root
 * @param {number} lineOffset lines of .gts preceding the block
 * @param {number} columnOffset columns preceding the block on its opening line
 * @param {number} offsetShift characters of .gts preceding the block
 * @param {import('postcss').Input} input the whole .gts
 */
function reposition(root, lineOffset, columnOffset, offsetShift, input) {
  /** @param {import('postcss').Position | undefined} pos */
  const shift = (pos) => {
    if (!pos) return;
    // The tag indents only the opening line.
    if (pos.line === 1) pos.column += columnOffset;
    pos.line += lineOffset;
    if (typeof pos.offset === 'number') pos.offset += offsetShift;
  };

  /** @param {import('postcss').NodeSource | undefined} source */
  const retarget = (source) => {
    if (!source) return;
    shift(source.start);
    shift(source.end);
    source.input = input;
  };

  retarget(root.source);
  root.walk((node) => retarget(node.source));
}

/**
 * A CssSyntaxError from a block has block-relative coordinates, which point at
 * the wrong .gts line.
 *
 * @param {unknown} error
 * @param {number} lineOffset
 * @param {number} columnOffset
 * @param {number} offsetShift
 * @returns {unknown} the same error, repositioned
 */
function shiftSyntaxError(error, lineOffset, columnOffset, offsetShift) {
  if (!(error instanceof Error) || error.name !== 'CssSyntaxError')
    return error;

  const shifted =
    /** @type {Error & { line?: number, column?: number, offset?: number, endLine?: number, endColumn?: number }} */ (
      error
    );

  if (typeof shifted.column === 'number' && shifted.line === 1) {
    shifted.column += columnOffset;
  }

  if (typeof shifted.endColumn === 'number' && shifted.endLine === 1) {
    shifted.endColumn += columnOffset;
  }

  if (typeof shifted.line === 'number') shifted.line += lineOffset;
  if (typeof shifted.endLine === 'number') shifted.endLine += lineOffset;
  if (typeof shifted.offset === 'number') shifted.offset += offsetShift;

  return shifted;
}

/**
 * @param {string} source
 * @param {import('postcss').ProcessOptions} [opts]
 * @returns {import('postcss').Document}
 */
export function parse(source, opts) {
  // content-tag-utils and postcss both strip a leading BOM before parsing, so
  // the offsets they report only line up with a source that has none.
  source = source.replace(/^\uFEFF+/, '');

  const doc = postcss.document();

  // Set before the no-blocks return so both paths give stylelint the same
  // shape. It reads source.input.css for the file's line endings.
  doc.source = {
    input: new postcss.Input(source, opts),
    start: { line: 1, column: 1, offset: 0 },
  };

  const roots = [];

  let cursor = 0;

  for (const { start, end, lang } of findStyleBlocks(source)) {
    const before = source.slice(0, start);
    const lineOffset = before.split('\n').length - 1;
    const columnOffset = start - (before.lastIndexOf('\n') + 1);

    let root;

    try {
      root = syntaxForLang(lang).parse(source.slice(start, end), opts);
    } catch (error) {
      // Thrown before reposition ran, so the coordinates are still block-relative.
      throw shiftSyntaxError(error, lineOffset, columnOffset, start);
    }

    reposition(root, lineOffset, columnOffset, start, doc.source.input);

    // The .gts around each block is kept verbatim so --fix cannot corrupt it.
    root.raws.codeBefore = source.slice(cursor, start);
    root.raws.scopedCssLang = lang;
    root.parent = doc;
    roots.push(root);
    cursor = end;
  }

  if (roots.length === 0) {
    doc.raws.codeBefore = source;

    return doc;
  }

  roots.at(-1).raws.codeAfter = source.slice(cursor);
  doc.nodes = roots;

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
    syntaxForLang(root.raws.scopedCssLang ?? null).stringify(root, builder);
    if (root.raws.codeAfter) builder(root.raws.codeAfter);
  });
}
