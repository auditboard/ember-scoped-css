import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { expect, test } from 'vitest';

import buildDisplaySelector from './buildDisplaySelector.js';

function assertDisplay(cssText: string, expected: string) {
  const root = postcss.parse(cssText);
  let target: any = null;

  root.walkRules((r) => {
    target = r; // pick the deepest/last rule
  });
  if (!target) throw new Error('No rule found');

  const ast = selectorParser().astSync(target.selector);
  const selectorNode = ast.nodes[0]!.toString().trim();

  const actual = buildDisplaySelector(target, selectorNode);

  expect(actual).toBe(expected);
}

test('wraps with single at-rule', () => {
  assertDisplay(
    '@media (min-width: 768px) { [attr] {} }',
    '@media (min-width: 768px) { [attr] }',
  );
});

test('builds wrapper-only chain', () => {
  assertDisplay('[a] { [b] {} }', '[a] { [b] }');
});

test('wrapper chain plus at-rule chain', () => {
  assertDisplay(
    '@media (width <= 400px) { [a] { [b] {} } }',
    '@media (width <= 400px) { [a] { [b] } }',
  );
});

test('falls back to resolved selector without wrappers or at-rules', () => {
  assertDisplay(':not(.class) {}', ':not(.class)');
});

test('deep wrapper-only chain', () => {
  assertDisplay('[a] { [b] { [c] {} } }', '[a] { [b] { [c] } }');
});

test('wrapper chain goes to the top even if ancestors have decls', () => {
  assertDisplay('[a] { color: red; [b] { [c] {} } }', '[a] { [b] { [c] } }');
});

test('multiple nested at-rules wrap from outermost to innermost', () => {
  assertDisplay(
    '@supports (display: grid) { @media (min-width: 900px) { [a] { [b] {} } } }',
    '@supports (display: grid) { @media (min-width: 900px) { [a] { [b] } } }',
  );
});
