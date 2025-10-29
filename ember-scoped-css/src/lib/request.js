const key = 'styles.ember-scoped.css';
const separator = '____';

import { hash } from './path/hash-from-absolute-path.js';

function parse(request) {
  let [left, qps] = request.split('?');
  let [relativePostfix, cssId] = left.split(separator);
  let key = relativePostfix.slice(2);

  let search = new URLSearchParams(qps);

  return {
    from: key,
    css: search.get('css'),
    cssId,
  };
}

export function isScopedCSSRequest(request) {
  let [, , stuff] = request.split(separator);

  if (!stuff) return false;

  let [k] = stuff.split('?');

  return k === key;
}

export function decodeScopedCSSRequest(request) {
  let params = parse(request);

  return {
    postfix: params.from,
    css: params.css,
    cssId: params.cssId,
  };
}

export function makeRequest(postfix, cssId, cssContent) {
  return `./${postfix}${hash(cssContent)}${separator}${cssId}${separator}${key}?css=${encodeURIComponent(cssContent)}`;
}
