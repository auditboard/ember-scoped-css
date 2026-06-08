import * as postcssProcessor from './postcss.js';

const processors = {
  postcss: postcssProcessor,
};

/**
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

  // `lang`-based routing (e.g. scss -> postcss) is added in a later task.
  // For now everything resolves to postcss.
  return processors.postcss;
}
