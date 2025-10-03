const key = 'styles.ember-scoped.css';
const separator = '____';

function parse(request) {
  let [left, qps] = request.split('?');
  let [relativePostfix, cssId] = left.split(separator);
  let postfix = relativePostfix.slice(2);

  let search = new URLSearchParams(qps);

  return {
    from: postfix,
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
    css: decodeURIComponent(params.css),
    cssId: params.cssId,
  };
}

export function makeRequest(postfix, cssId, cssContent) {
  return `./${postfix}${separator}${cssId}${separator}${key}?css=${encodeURIComponent(cssContent)}`;
}
