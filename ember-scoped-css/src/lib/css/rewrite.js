import { rewrite } from './lightningcss.js';

/**
 * @param {string} css plain CSS
 * @param {string} postfix
 * @param {string} fileName
 * @param {string} [layerName]
 * @param {object} [options] processor options ({ lightningcss })
 */
export function rewriteCss(css, postfix, fileName, layerName, options = {}) {
  const body = rewrite(css, postfix, options);

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
