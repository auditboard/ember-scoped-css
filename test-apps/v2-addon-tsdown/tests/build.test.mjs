/**
 * Builds this addon with tsdown (the real CLI, the same way `pnpm build`
 * does) and asserts that ember-scoped-css did its job end-to-end:
 *
 *  - colocated CSS is rewritten (postfixed) and bundled into dist/style.css
 *  - inline `<style scoped>` CSS is extracted, rewritten, and bundled
 *  - the compiled templates reference the same postfixed classes
 *  - the css.inject strategy keeps the stylesheet loading implicit
 *    (dist/index.js imports './style.css')
 *  - declarations are emitted (the isolated-declarations pipeline works)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = (...paths) => join(projectRoot, 'dist', ...paths);
const read = (...paths) => readFileSync(dist(...paths), 'utf8');

beforeAll(() => {
  execFileSync('pnpm', ['build'], { cwd: projectRoot, stdio: 'inherit' });
});

/** The postfixed variant of `className` found in `css`, e.g. `button_abc123` */
function postfixedClass(css, className) {
  const match = css.match(new RegExp(`\\.(${className}_[a-z0-9]+)`));

  expect(match, `found a postfixed .${className} class`).toBeTruthy();

  return match[1];
}

describe('the tsdown build', () => {
  it('emits the entrypoint, its declarations, and a css bundle', () => {
    expect(existsSync(dist('index.js'))).toBe(true);
    expect(existsSync(dist('index.d.ts'))).toBe(true);
    expect(existsSync(dist('style.css'))).toBe(true);
  });

  it('keeps the stylesheet loading implicit via css.inject', () => {
    expect(read('index.js')).toContain(`import './style.css'`);
  });
});

describe('colocated CSS', () => {
  it('is rewritten and bundled', () => {
    const css = read('style.css');
    const button = postfixedClass(css, 'button');

    expect(css).toContain(`.${button} {`);
    // lightningcss (via @tsdown/css) normalizes rgb(1, 2, 3) to hex
    expect(css).toContain('color: #010203');
    // the naked tag selector is scoped with the postfix class
    expect(css).toMatch(/button\.[a-z0-9]+ {/);
    // the unscoped originals are gone
    expect(css).not.toMatch(/^\.button {/m);
  });

  it('the compiled template references the postfixed class', () => {
    const button = postfixedClass(read('style.css'), 'button');

    expect(read('index.js')).toContain(button);
  });
});

describe('inline <style scoped>', () => {
  it('is extracted, rewritten, and bundled', () => {
    const css = read('style.css');
    const banner = postfixedClass(css, 'banner');

    // lightningcss (via @tsdown/css) normalizes rgb(9, 8, 7) to hex
    expect(css).toContain('border: 1px solid #090807');
    expect(read('index.js')).toContain(banner);
  });

  it('the style tag is removed from the compiled template', () => {
    expect(read('index.js')).not.toContain('<style');
  });
});
