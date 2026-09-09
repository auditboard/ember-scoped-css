import { createRequire } from 'node:module';

import createSassSyntax from './sass.js';

const require = createRequire(import.meta.url);

/**
 * The consumer installs the parser for each dialect it writes, the way Vite
 * has it install the preprocessor, so a project with no Stylus never pays for
 * the Stylus compiler that postcss-styl depends on.
 *
 * Every parser here round-trips its dialect byte-exact, which `--fix` relies
 * on to write a block back with the syntax that read it.
 *
 * Indented Sass goes through sass.js rather than sugarss directly, because
 * sugarss requires the first line at column 1 and every inline block is
 * indented by its template. postcss-sass was rejected: it drops `=mixin`,
 * `+include`, and the rule after an `@extend` from the AST, so a block using
 * them lints clean and `--fix` writes back less than it read.
 */
const PARSERS = new Map([
  ['scss', { pkg: 'postcss-scss', wrap: (mod) => mod }],
  ['sass', { pkg: 'sugarss', wrap: createSassSyntax }],
  ['less', { pkg: 'postcss-less', wrap: (mod) => mod }],
  ['styl', { pkg: 'postcss-styl', wrap: (mod) => mod }],
  ['stylus', { pkg: 'postcss-styl', wrap: (mod) => mod }],
]);

const loaded = new Map();

/**
 * @param {string} lang lowercased `lang`
 * @returns {string | null} the package that parses it, or null for plain CSS
 */
export function parserPackage(lang) {
  return PARSERS.get(lang)?.pkg ?? null;
}

/**
 * @param {string} pkg
 * @returns {unknown | null} the package's export, or null when it is not installed
 */
export function loadPackage(pkg) {
  try {
    require.resolve(pkg);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;

    throw error;
  }

  return require(pkg);
}

/**
 * @param {string} lang a `lang` that parserPackage knows
 * @returns {{ parse: Function, stringify: Function } | null} null when the
 *   consumer has not installed the parser
 */
export function loadParser(lang) {
  const { pkg, wrap } = PARSERS.get(lang);

  if (!loaded.has(pkg)) {
    const mod = loadPackage(pkg);

    loaded.set(pkg, mod === null ? null : wrap(mod));
  }

  return loaded.get(pkg);
}
