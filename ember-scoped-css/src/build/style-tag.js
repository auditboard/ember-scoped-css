/**
 * How a `<style>` element in a template is read: whether the build scopes it,
 * and whether its contents need a preprocessor before anything can treat them
 * as CSS.
 *
 * Thanks, CardStack and @ef4 for this code.
 */

const SCOPED_ATTRIBUTE_NAME = 'scoped';
const INLINE_ATTRIBUTE_NAME = 'inline';
const LANG_ATTRIBUTE_NAME = 'lang';

/**
 * @param {object} [node]
 * @returns {boolean | undefined}
 */
export function hasScopedAttribute(node) {
  if (!node) return;
  if (node.tag !== 'style') return;
  if (node.type !== 'ElementNode') return;

  return node.attributes.some(
    (attribute) => attribute.name === SCOPED_ATTRIBUTE_NAME,
  );
}

/**
 * @param {object} [node]
 * @returns {boolean | undefined}
 */
export function hasInlineAttributeWithoutLang(node) {
  if (!node) return;
  if (node.tag !== 'style') return;
  if (node.type !== 'ElementNode') return;

  if (getLangAttribute(node)) {
    return false;
  }

  return node.attributes.some(
    (attribute) => attribute.name === INLINE_ATTRIBUTE_NAME,
  );
}

/**
 * Returns the value of the `lang` attribute on a `<style>` node, or null if absent.
 *
 * @param {object} [node]
 * @returns {string | null}
 */
export function getLangAttribute(node) {
  if (!node) return null;
  if (node.tag !== 'style') return null;
  if (node.type !== 'ElementNode') return null;

  const attr = node.attributes.find(
    (attribute) => attribute.name === LANG_ATTRIBUTE_NAME,
  );

  if (!attr) return null;

  // The attribute value is a TextNode child of the AttrNode's value
  const value = attr.value;

  if (value?.type === 'TextNode') return value.chars || null;

  return null;
}

/**
 * The dialects Vite can preprocess into CSS. Named by `lang` on a `<style>`
 * block, and by extension on a colocated file, so both spellings are derived
 * from this one list.
 */
export const PREPROCESSED_LANGS = new Set([
  'scss',
  'sass',
  'less',
  'styl',
  'stylus',
]);

/** File extensions that Vite can preprocess via its CSS preprocessor pipeline */
export const PREPROCESSED_EXTENSIONS = new Set(
  [...PREPROCESSED_LANGS].map((lang) => `.${lang}`),
);

/**
 * Whether this block's contents are a preprocessor dialect rather than CSS.
 *
 * `lang` is not the same question as "did the build touch it": unplugin-inline
 * routes any `lang` through Vite, but `lang="css"` comes out the other side as
 * the CSS it already was. Anything reading the contents as CSS has to skip
 * only the dialects postcss cannot parse.
 *
 * @param {object} [node]
 * @returns {boolean}
 */
export function isPreprocessed(node) {
  const lang = getLangAttribute(node);

  return lang !== null && PREPROCESSED_LANGS.has(lang.toLowerCase());
}
