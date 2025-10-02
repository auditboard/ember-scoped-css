const key = 'styles.ember-scoped.css';

function parse(request) {
  let [left, qps] = request.split('?');
  let [relativePostfix] = left.split('___');
  let postfix = relativePostfix.slice(2);

  let search = new URLSearchParams(qps);

  return {
    from: postfix,
    css: search.get('css'),
  };
}

export function isScopedCSSRequest(request) {
  let [, stuff] = request.split('___');

  if (!stuff) return false;

  let [k] = stuff.split('?');

  return k === key;
}

export function decodeScopedCSSRequest(request) {
  let params = parse(request);

  return {
    postfix: params.from,
    css: decodeURIComponent(params.css),
  };
}

export function makeRequest(postfix, cssContent) {
  return `./${postfix}___${key}?css=${encodeURIComponent(cssContent)}`;
}
