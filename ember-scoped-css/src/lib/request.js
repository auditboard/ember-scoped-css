const key = 'styles.ember-scoped.css';
const relativeKey = `./${key}`;

function parse(request) {
  let [, qps] = request.split('?');

  let search = new URLSearchParams(qps);

  return {
    from: search.get('from'),
    css: search.get('css'),
  };
}
export function isScopedCSSRequest(request) {
  return request.startsWith(relativeKey);
}

export function decodeScopedCSSRequest(request) {
  let params = parse(request);

  return {
    id: relativeKey,
    fromFile: decodeURIComponent(params.from),
    css: decodeURIComponent(params.css),
  };
}

export function makeRequest(fromFile, cssContent) {
  return `${relativeKey}?from=${encodeURIComponent(fromFile)}&css=${encodeURIComponent(cssContent)}`;
}
