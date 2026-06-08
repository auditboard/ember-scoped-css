import { resolveProcessor } from './processors/index.js';

/**
 * @param {string} css plain CSS
 * @param {string} postfix
 * @param {string} fileName
 * @param {string} [layerName]
 * @param {object} [options] processor options ({ type, lightningcss, postcss })
 */
export function rewriteCss(css, postfix, fileName, layerName, options = {}) {
  const processor = resolveProcessor(undefined, options);
  const body = processor.rewrite(css, postfix, options);

  return (
    [
      `/* ${fileName} */`,
      layerName ? `@layer ${layerName} {` : '',
      body.trimEnd(),
      layerName ? `}` : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n'
  );
}
