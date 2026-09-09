import postcss from 'postcss';

/**
 * sugarss reads indented Sass, but it requires the first line at column 1, and
 * every inline block sits inside its template's indentation. The indent shared
 * by every line is removed before parsing, positions are moved back onto the
 * original text, and stringify puts the indent back on every line with content.
 *
 * sugarss is an optional peer, so it arrives as an argument rather than an import.
 */

/** sugarss reads `=name` as a selector and `+name` as part of the next line. */
const LEGACY_SHORTHAND = /^[ \t]*[=+][A-Za-z_-]/m;

/**
 * @param {string} text
 * @returns {{ indent: string, dedented: string, dedentedLines: boolean[] }}
 * @throws {number} the 1-based line indented less than the first line
 */
function dedent(text) {
  const lines = text.split('\n');
  const first = lines.find((line) => line.trim() !== '');
  const indent = first ? /^[ \t]*/.exec(first)[0] : '';
  const dedentedLines = [];

  const stripped = lines.map((line, i) => {
    if (indent === '' || line.trim() === '') {
      dedentedLines.push(false);

      return line;
    }

    if (!line.startsWith(indent)) throw i + 1;

    dedentedLines.push(true);

    return line.slice(indent.length);
  });

  return { indent, dedented: stripped.join('\n'), dedentedLines };
}

/**
 * @param {string} text
 * @param {number} offset
 * @returns {number} 1-based
 */
function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/**
 * @param {{ line?: number, column?: number, offset?: number } | undefined} pos
 * @param {number} indentLength
 * @param {boolean[]} dedentedLines
 */
function restore(pos, indentLength, dedentedLines) {
  if (!pos || typeof pos.line !== 'number') return;

  if (dedentedLines[pos.line - 1] && typeof pos.column === 'number') {
    pos.column += indentLength;
  }

  if (typeof pos.offset === 'number') {
    const removed = dedentedLines.slice(0, pos.line).filter(Boolean).length;

    pos.offset += indentLength * removed;
  }
}

/**
 * @param {typeof import('sugarss')} sugarss
 * @returns {{ parse: Function, stringify: Function }}
 */
export default function createSassSyntax(sugarss) {
  /**
   * @param {string} text
   * @param {import('postcss').ProcessOptions} [opts]
   * @returns {import('postcss').Root}
   */
  function parse(text, opts) {
    const input = new postcss.Input(text, opts);
    const legacy = LEGACY_SHORTHAND.exec(text);

    if (legacy) {
      throw input.error(
        'The =mixin and +include shorthand is not supported. Use @mixin and @include',
        lineAt(text, legacy.index),
        1,
      );
    }

    let stripped;

    try {
      stripped = dedent(text);
    } catch (badLine) {
      throw input.error(
        'Line is indented less than the first line of the block',
        badLine,
        1,
      );
    }

    const { indent, dedented, dedentedLines } = stripped;

    let root;

    try {
      root = sugarss.parse(dedented, opts);
    } catch (error) {
      if (error instanceof Error && error.name === 'CssSyntaxError') {
        restore(error, indent.length, dedentedLines);

        const end = { line: error.endLine, column: error.endColumn };

        restore(end, indent.length, dedentedLines);
        Object.assign(error, { endLine: end.line, endColumn: end.column });
      }

      throw error;
    }

    // The root starts before the first indent, so only its end moves.
    restore(root.source?.end, indent.length, dedentedLines);
    root.walk((node) => {
      restore(node.source?.start, indent.length, dedentedLines);
      restore(node.source?.end, indent.length, dedentedLines);
    });
    root.raws.scopedCssIndent = indent;

    return root;
  }

  /**
   * @param {import('postcss').Root} root
   * @param {import('postcss').Builder} builder
   */
  function stringify(root, builder) {
    const indent = root.raws.scopedCssIndent ?? '';
    let out = '';

    // sugarss indents each line by the node's depth, counted through every
    // parent, so a root attached to a document comes out one step too deep.
    const { parent } = root;

    root.parent = undefined;

    try {
      sugarss.stringify(root, (part) => {
        out += part;
      });
    } finally {
      root.parent = parent;
    }

    builder(
      out
        .split('\n')
        .map((line) => (line.trim() === '' ? line : indent + line))
        .join('\n'),
    );
  }

  return { parse, stringify };
}
