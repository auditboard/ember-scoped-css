import { preprocess as parseTemplate } from '@glimmer/syntax';

import { Preprocessor } from 'content-tag';
import { coordinatesOf } from 'content-tag-utils';
import {
  getLangAttribute,
  hasScopedAttribute,
} from 'ember-scoped-css/__private_do_not_use_are_you_serious__/style-tag';
import postcss from 'postcss';
import less from 'postcss-less';
import scss from 'postcss-scss';
import styl from 'postcss-styl';

const preprocessor = new Preprocessor();

/** Plain CSS. `lang` absent, empty, or naming no preprocessor lands here. */
const CSS_SYNTAX = { parse: postcss.parse, stringify: postcss.stringify };

/**
 * The parser each `lang` needs. Every one of these round-trips its dialect
 * byte-exact, which is the property `--fix` depends on: a block is written
 * back out by the same syntax that read it, so fixing one hex value cannot
 * move a byte anywhere else in the block.
 *
 * `sass` is missing on purpose: indented Sass has no parser that reads it
 * correctly, and both candidates were tried.
 *
 * postcss-styl is close, being indentation-based, but Stylus assigns with `=`
 * where Sass uses `:`, so it reads `$brand: #fff` as a selector rather than a
 * declaration and the file comes back with two `Cannot parse selector` errors
 * on ordinary Sass. It also throws a raw TypeError on `=mixin`, which surfaces
 * to the user as `Cannot read properties of undefined (reading 'op')`.
 *
 * postcss-sass reads the syntax but loses source: `=mixin`/`+include` returns
 * an empty AST, and `@extend %placeholder` silently drops a rule. A block
 * using either would lint clean forever, and `--fix` would write back less
 * than it read.
 *
 * Skipping is the only option that neither invents errors on valid source nor
 * quietly discards it. See findStyleBlocks.
 */
const SYNTAXES = new Map([
  ['scss', scss],
  ['less', less],
  ['styl', styl],
  ['stylus', styl],
]);

/**
 * Resolving by the stored `lang` rather than by a stored function keeps parse
 * and stringify reading one table, so a block cannot be written back out by a
 * different syntax than read it.
 *
 * @param {string | null} lang lowercased `lang`, or null for plain CSS
 * @returns {{ parse: Function, stringify: Function }}
 */
function syntaxForLang(lang) {
  if (lang === null) return CSS_SYNTAX;

  return SYNTAXES.get(lang) ?? CSS_SYNTAX;
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
  } catch (error) {
    // A TypeError here is our bug or a parser API change, not bad user source.
    // Swallowing it would turn the whole feature into a silent no-op.
    if (error instanceof TypeError) throw error;

    return [];
  }
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
 * The CSS text of every root-level `<style scoped>` element in the file, as
 * absolute offsets into `source`, each tagged with the `lang` that decides
 * which parser reads it.
 *
 * @param {string} source contents of a .gts/.gjs file
 * @returns {Array<{ start: number, end: number, lang: string | null }>}
 */
function findStyleBlocks(source) {
  // content-tag reports offsets into a BOM-stripped source, and coordinatesOf
  // indexes whatever string it is handed, so both are given the stripped body
  // and the BOM is added back afterwards. Handing either the raw source instead
  // shifts the whole parse window left by the BOM's three UTF-8 bytes and the
  // file silently lints clean.
  const bomLength = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const body = source.slice(bomLength);
  const blocks = [];

  for (const template of parseTemplates(body)) {
    // Byte offsets to string indices, which is what we slice by.
    const range = coordinatesOf(body, template);
    const contentsStart = range.start + bomLength;
    const contentsEnd = range.end + bomLength;
    const ast = parseTemplateContents(source.slice(contentsStart, contentsEnd));

    if (!ast) continue;

    for (const node of ast.body) {
      // Whether the build scopes this block is ember-scoped-css's question to
      // answer, so it answers it.
      if (!hasScopedAttribute(node)) continue;

      const lang = getLangAttribute(node)?.toLowerCase() ?? null;

      // The one dialect with no parser that reads it correctly. Linting it
      // would mean either inventing syntax errors on valid Sass or silently
      // dropping rules from it. See SYNTAXES.
      if (lang === 'sass') continue;

      // `<style scoped inline>` supports interpolation, and a mustache is not
      // CSS postcss can parse. Taking only children[0] would silently truncate
      // the block and report a bogus syntax error on valid source, so a block
      // is only linted when its entire content is one text node.
      const [text, ...rest] = node.children;

      if (!text || rest.length > 0 || text.type !== 'TextNode') continue;

      // Slicing by offset rather than reading `chars` keeps the CSS byte-exact,
      // so a `--fix` that touches one block cannot rewrite another.
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
 * Move a parsed block from positions relative to the block onto positions
 * relative to the file, so warnings point at real .gts lines.
 *
 * `offset` matters as much as line/column: stylelint builds a fix range from
 * `node.source.start.offset` for `computeEditInfo`, and an editor applies that
 * range against the whole file. Leaving it block-relative makes an LSP "fix
 * this problem" action write into unrelated source.
 *
 * The block's `input` moves with its positions. postcss answers a `word`-based
 * warning position by slicing `source.input.css` between the node's offsets,
 * so an input holding only the block would be indexed by .gts offsets that run
 * past its end: the slice comes back empty, the word is not found in it, and
 * the position silently falls back to the start of the whole node.
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
    // Only the opening line is indented by the tag; later lines start at column 1.
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
 * A CssSyntaxError from a block carries coordinates relative to that block.
 * Left alone it points at whatever happens to sit at that line in the .gts,
 * which is the first thing a user sees when adopting this.
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
 * The input every block is positioned against.
 *
 * `css` has to be the exact string the block offsets index, BOM included.
 * postcss strips a leading BOM into `hasBOM` and its stringifier re-emits one
 * for any root whose input carries the flag, which would write a BOM into the
 * middle of the file once per block. The BOM is put back into `css` so offsets
 * line up, and the flag cleared because the first block's `codeBefore` already
 * carries the real one.
 *
 * @param {string} source
 * @param {import('postcss').ProcessOptions} [opts]
 * @returns {import('postcss').Input}
 */
function blockInput(source, opts) {
  const input = new postcss.Input(source, opts);

  if (input.hasBOM) {
    input.css = source;
    input.hasBOM = false;
  }

  return input;
}

/**
 * @param {string} source
 * @param {import('postcss').ProcessOptions} [opts]
 * @returns {import('postcss').Document}
 */
export function parse(source, opts) {
  const doc = postcss.document();

  // Built before the no-blocks branch below, so both paths hand stylelint the
  // same shape. It reads source.input.css to detect the file's line endings.
  doc.source = {
    input: blockInput(source, opts),
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
      // Thrown before reposition could run, so the error still carries
      // block-relative coordinates and would point at the wrong .gts line.
      throw shiftSyntaxError(error, lineOffset, columnOffset, start);
    }

    reposition(root, lineOffset, columnOffset, start, doc.source.input);

    // The .gts around each block rides along verbatim so --fix cannot corrupt it.
    root.raws.codeBefore = source.slice(cursor, start);
    root.raws.scopedCssLang = lang;
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
