const key = 'ember-scoped.css';

export function isScopedCSSRequest(request) {
  return request.includes(key);
}

export function decodeScopedCSSRequest(request) {
  let [left, qps] = request.split('?');

  left = left.slice(2).replace(`.${key}`, '');

  let [postfix, hash] = left.split('-');

  let search = new URLSearchParams(qps);

  return {
    hash,
    postfix,
    css: search.get('css'),
  };
}

/**
 * Makes request URL for embedding `<style>` as `<link>` into the `<head>`
 *
 * @param {string} hash the hash for the file being linked
 * @param {string} postfix the hash of the file that _includes_ the linked file
 * @param {string} cssContents the contents of the CSS file
 */
export function makeRequestForStyleElement(hash, postfix, cssContents) {
  return `./${postfix}-${hash}.${key}?css=${encodeURIComponent(cssContents)}`;
}
