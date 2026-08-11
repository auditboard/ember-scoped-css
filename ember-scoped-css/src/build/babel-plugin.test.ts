import path from 'node:path';

import * as babel from '@babel/core';
import { describe, expect, it } from 'vitest';

import { hash } from '../lib/path/hash-from-module-path.js';
import { paths } from '../lib/path/utils.paths.test.js';
import { scopedCSS } from './babel-plugin.js';

const modulePath = 'vite-app/components/scoped-class-helper';
const postfix = hash(modulePath);
const filename = path.join(
  paths.viteApp,
  'src/components/scoped-class-helper.js',
);

async function transform(code: string) {
  const result = await babel.transformAsync(code, {
    plugins: [[scopedCSS({}), {}]],
    filename,
    cwd: paths.viteApp,
    root: paths.viteApp,
    babelrc: false,
    configFile: false,
  });

  return result?.code;
}

/** The value the `scopedClass(...)` call is replaced with. */
async function scopedClassOf(argument: string) {
  const code = await transform(
    [
      `import { scopedClass } from 'ember-scoped-css';`,
      `export const result = scopedClass(${argument});`,
    ].join('\n'),
  );

  const match = code?.match(/export const result = "(.*)";/);

  return match?.[1];
}

describe('scopedClass()', () => {
  it('postfixes a single class', async () => {
    expect(await scopedClassOf(`'bar-complete'`)).to.equal(
      `bar-complete_${postfix}`,
    );
  });

  it('postfixes every class of a multi-class argument', async () => {
    expect(await scopedClassOf(`'column column-hidden'`)).to.equal(
      `column_${postfix} column-hidden_${postfix}`,
    );
  });

  it('postfixes every class regardless of how they are spaced', async () => {
    // Leading and trailing whitespace survives; whitespace between classes
    // collapses to a single space.
    expect(await scopedClassOf(`'  column   column-hidden  '`)).to.equal(
      `  column_${postfix} column-hidden_${postfix}  `,
    );
  });

  it('agrees with the test-support helper, which the app asserts against', async () => {
    const { scopedClass } = await import('../runtime/test-support.js');

    expect(await scopedClassOf(`'column column-hidden'`)).to.equal(
      scopedClass('column column-hidden', modulePath),
    );
  });

  it('does not postfix a class twice', async () => {
    expect(await scopedClassOf(`'bar-complete_${postfix}'`)).to.equal(
      `bar-complete_${postfix}`,
    );
  });

  it('removes the import', async () => {
    const code = await transform(
      [
        `import { scopedClass } from 'ember-scoped-css';`,
        `export const result = scopedClass('bar-complete');`,
      ].join('\n'),
    );

    expect(code).to.not.include('ember-scoped-css');
  });

  describe('rejects arguments it cannot resolve at build time', () => {
    it('throws on a dynamic argument', async () => {
      await expect(
        transform(
          [
            `import { scopedClass } from 'ember-scoped-css';`,
            `export const result = scopedClass(someVariable);`,
          ].join('\n'),
        ),
      ).rejects.toThrow(/only accepts a single, non-dynamic, string literal/);
    });

    it('throws on more than one argument', async () => {
      await expect(
        transform(
          [
            `import { scopedClass } from 'ember-scoped-css';`,
            `export const result = scopedClass('column', 'column-hidden');`,
          ].join('\n'),
        ),
      ).rejects.toThrow(/only accepts a single, non-dynamic, string literal/);
    });
  });
});
