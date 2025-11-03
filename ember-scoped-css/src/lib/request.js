import path from 'node:path';

const KEY = 'ember-scoped.css';

export function isStyleElementCSSRequest(request) {
  return request.includes(KEY);
}

export function decodeStyleElementCSSRequest(request) {
  let [left, qps] = request.split('?');

  left = left.slice(2).replace(`.${KEY}`, '');

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
  return `./${postfix}-${hash}.${KEY}?css=${encodeURIComponent(cssContents)}`;
}

export function isSeparateCSSFileRequest(request) {
  return request.includes('.css?scoped=');
}

export function decodeSeparateCSSFileRequest(request) {
  const [fileName, qs] = request.split('?');
  const search = new URLSearchParams(qs);

  return {
    fileName,
    postfix: search.get('scoped'),
  };
}

/**
 * Makes request URL for embedding separate CSS File as `<link>` into the `<head>`
 *
 * @param {string} postfix the hash of the file that _includes_ the linked file
 * @param {string} filePath path to the separate CSS File
 */
export function makeRequestForSeparateCSSFile(postfix, filePath) {
  return `./${path.basename(filePath)}?scoped=${postfix}`;
}
