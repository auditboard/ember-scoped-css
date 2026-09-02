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
  // Byte length equals code-unit length exactly when the prefix is ASCII, and
  // component sources usually are, so skip the copy and the decode.
  if (buffer.length === byteOffset) return byteOffset;

  const prefix = buffer.subarray(0, byteOffset);

  return prefix.every((byte) => byte < 0x80)
    ? byteOffset
    : prefix.toString('utf8').length;
}

/**
 * Normalise a content-tag range to string indices. v3 reports byte offsets
 * under `start`/`end`; v4 renamed those to `startByte`/`endByte`. Reading one
 * spelling blindly across the major bump yields `undefined`, which collapses
 * the parse window to nothing and lints every file clean rather than failing,
 * so the shape is checked rather than assumed.
 *
 * v4 also reports ready-made char offsets, but converting its byte offsets
 * gives the same answer, so there is no branch for them.
 *
 * @param {{ start?: number, end?: number, startByte?: number, endByte?: number }} range
 * @param {Buffer} buffer the source, as UTF-8 bytes
 * @returns {{ start: number, end: number }} indices into the source string
 */
export function toStringRange(range, buffer) {
  const startByte = range.start ?? range.startByte;
  const endByte = range.end ?? range.endByte;

  if (typeof startByte !== 'number' || typeof endByte !== 'number') {
    throw new Error(
      'stylelint-ember-scoped-css/syntax could not read a template range from ' +
        `content-tag (got ${JSON.stringify(Object.keys(range))}). This usually ` +
        'means an unsupported content-tag version; supported ranges are ^3 and ^4.',
    );
  }

  return {
    start: toStringIndex(buffer, startByte),
    end: toStringIndex(buffer, endByte),
  };
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
    return parsers.parseTemplate(contents);
  } catch (error) {
    if (error instanceof TypeError) throw error;

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
 * Mirrors `getLangAttribute` in the template plugin, including its
 * `value.chars || null`: an empty or valueless `lang` reads as absent.
 *
 * @param {{ attributes: Array<{ name: string, value?: { type: string, chars?: string } }> }} node
 * @returns {string | null}
 */
function getLang(node) {
  const attribute = node.attributes.find((each) => each.name === 'lang');

  if (!attribute) return null;
  if (attribute.value?.type !== 'TextNode') return null;

  return attribute.value.chars || null;
}

/**
 * Only scss and sass are preprocessed, and only those are unreadable by
 * postcss's default parser. Every other `lang` value -- including an empty one
 * -- is CSS the build scopes, so skipping on the attribute's mere presence
 * leaves genuinely scoped CSS unlinted.
 *
 * @param {{ attributes: Array<{ name: string, value?: { type: string, chars?: string } }> }} node
 * @returns {boolean}
 */
function isPreprocessed(node) {
  const lang = getLang(node);

  return lang === 'scss' || lang === 'sass';
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

  // content-tag reports offsets into a BOM-stripped source, so a leading BOM
  // has to be added back or the whole parse window shifts left and the file
  // silently lints clean.
  const bomLength = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const body = source.slice(bomLength);
  const buffer = Buffer.from(body, 'utf8');
  const blocks = [];

  for (const template of parseTemplates(body)) {
    const range = toStringRange(template.contentRange, buffer);
    const contentsStart = range.start + bomLength;
    const contentsEnd = range.end + bomLength;
    const ast = parseTemplateContents(source.slice(contentsStart, contentsEnd));

    if (!ast) continue;

    for (const node of ast.body) {
      if (node.type !== 'ElementNode' || node.tag !== 'style') continue;
      if (!isScoped(node) || isPreprocessed(node)) continue;

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
 * @param {import('postcss').Root} root
 * @param {number} lineOffset lines of .gts preceding the block
 * @param {number} columnOffset columns preceding the block on its opening line
 * @param {number} offsetShift characters of .gts preceding the block
 */
function reposition(root, lineOffset, columnOffset, offsetShift) {
  /** @param {import('postcss').Position | undefined} pos */
  const shift = (pos) => {
    if (!pos) return;
    // Only the opening line is indented by the tag; later lines start at column 1.
    if (pos.line === 1) pos.column += columnOffset;
    pos.line += lineOffset;
    if (typeof pos.offset === 'number') pos.offset += offsetShift;
  };

  shift(root.source?.start);
  shift(root.source?.end);
  root.walk((node) => {
    shift(node.source?.start);
    shift(node.source?.end);
  });
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
 * @param {string} source
 * @param {import('postcss').ProcessOptions} [opts]
 * @returns {import('postcss').Document}
 */
export function parse(source, opts) {
  const doc = postcss.document();

  // Built before the no-blocks branch below, so both paths hand stylelint the
  // same shape. It reads source.input.css to detect the file's line endings.
  doc.source = {
    input: new postcss.Input(source, opts),
    start: { line: 1, column: 1, offset: 0 },
  };

  const roots = [];

  let cursor = 0;

  for (const { start, end } of findStyleBlocks(source)) {
    const before = source.slice(0, start);
    const lineOffset = before.split('\n').length - 1;
    const columnOffset = start - (before.lastIndexOf('\n') + 1);

    let root;

    try {
      root = postcss.parse(source.slice(start, end), opts);
    } catch (error) {
      // Thrown before reposition could run, so the error still carries
      // block-relative coordinates and would point at the wrong .gts line.
      throw shiftSyntaxError(error, lineOffset, columnOffset, start);
    }

    reposition(root, lineOffset, columnOffset, start);

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
