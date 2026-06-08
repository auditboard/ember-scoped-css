import * as lightningcssProcessor from './lightningcss.js';
import * as postcssProcessor from './postcss.js';

const processors = {
  postcss: postcssProcessor,
  lightningcss: lightningcssProcessor,
};

/**
 * Pick a CSS processor.
 * - Explicit `options.type` always wins.
 * - Any non-plain-css language (scss/sass/less/...) routes to postcss, since
 *   lightningcss cannot parse raw preprocessor dialects.
 * - Default is lightningcss.
 *
 * @param {string|undefined} lang
 * @param {{ type?: 'postcss' | 'lightningcss' }} [options]
 */
export function resolveProcessor(lang, options = {}) {
  if (options.type) {
    const processor = processors[options.type];

    if (!processor) {
      throw new Error(
        `[ember-scoped-css] Unknown CSS processor type: "${options.type}". ` +
          `Valid types: ${Object.keys(processors).join(', ')}.`,
      );
    }

    return processor;
  }

  if (lang && lang !== 'css') {
    return processors.postcss;
  }

  return processors.lightningcss;
}
