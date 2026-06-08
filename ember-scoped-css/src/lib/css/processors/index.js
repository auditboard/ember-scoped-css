import * as postcssProcessor from './postcss.js';

const processors = {
  postcss: postcssProcessor,
};

/**
 * @param {string|undefined} lang
 * @param {{ type?: 'postcss' | 'lightningcss' }} [options]
 */
export function resolveProcessor(lang, options = {}) {
  if (options.type) return processors[options.type];

  // Default during refactor is postcss; flipped to lightningcss in a later task.
  return processors.postcss;
}
