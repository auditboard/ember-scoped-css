import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Languages we can compile to CSS at Babel-time. Compilation must be
 * synchronous (Babel visitors cannot await), which rules out less/stylus.
 */
const SASS_LANGS = new Set(['scss', 'sass']);

let cachedSass;

function loadSass() {
  if (!cachedSass) {
    try {
      // Resolve sass from the app, not from ember-scoped-css. Mirrors how the
      // unplugins resolve vite from the app root.
      const require = createRequire(path.join(process.cwd(), 'package.json'));

      cachedSass = require('sass');
    } catch {
      throw new Error(
        `[ember-scoped-css] <style scoped lang="scss|sass"> requires the 'sass' package to be installed in your app.`,
      );
    }
  }

  return cachedSass;
}

/**
 * Synchronously compile an inline `<style scoped lang="...">` body to plain
 * CSS so classes/tags can be extracted at Babel-time.
 *
 * @param {string} source raw preprocessor source
 * @param {string} lang value of the `lang` attribute (e.g. 'scss')
 * @param {string} [fromFile] absolute path of the component file containing
 *   the style tag; relative `@use`/`@import` resolve from its directory
 *   (matching how Vite's load-time compile resolves them)
 * @returns {string} plain CSS
 */
export function compileToCss(source, lang, fromFile) {
  if (!SASS_LANGS.has(lang)) {
    throw new Error(
      `[ember-scoped-css] <style scoped lang="${lang}"> is not supported. ` +
        `Only scss/sass can be compiled at build time (requires the 'sass' package); ` +
        `for other languages, precompile to CSS.`,
    );
  }

  const sass = loadSass();

  const loadPaths = fromFile
    ? [path.dirname(fromFile), process.cwd()]
    : [process.cwd()];

  const result = sass.compileString(source, {
    loadPaths,
    ...(lang === 'sass' ? { syntax: 'indented' } : {}),
  });

  return result.css;
}
