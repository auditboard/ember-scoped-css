import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { findWorkspacePath, forceUnixPath } from './utils.js';
import { paths } from './utils.paths.test.js';

let viteApp = forceUnixPath(paths.viteApp);
let v2Addon = forceUnixPath(paths.v2Addon);

describe('findWorkspacePath()', () => {
  it('from a component', () => {
    let file = path.join(paths.viteApp, 'app/components/forth.gjs');
    let result = findWorkspacePath(file, { cwd: paths.viteApp });

    expect(result).toBe(viteApp);
  });

  it('from a component with app in the name', () => {
    let file = path.join(paths.viteApp, 'app/components/page/app.gjs');
    let result = findWorkspacePath(file, { cwd: paths.viteApp });

    expect(result).toBe(viteApp);
  });

  it('from a component with app in the path', () => {
    let file = path.join(paths.viteApp, 'app/components/app/page/forth.gjs');
    let result = findWorkspacePath(file, { cwd: paths.viteApp });

    expect(result).toBe(viteApp);
  });

  it('from an unrelated path', () => {
    let file = path.join(paths.viteApp, 'app/components/app/page/forth.gjs');
    let result = findWorkspacePath(file, { cwd: paths.v2Addon });

    expect(result).toBe(viteApp);
  });

  it('from an unrelated CWD', () => {
    let file = path.join(paths.v2Addon, 'app/components/app/page/forth.gjs');
    let result = findWorkspacePath(file, { cwd: paths.viteApp });

    expect(result).toBe(v2Addon);
  });

  it('from outside the CWD entirely', () => {
    expect(() => {
      let file = path.join('/tmp/app/components/app/page/forth.gjs');

      findWorkspacePath(file, { cwd: paths.viteApp });
    }).toThrowError(/Could not determine project/);
  });
});
