import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { appPath } from './utils.js';
import { paths } from './utils.paths.test.js';

describe('appPath()', () => {
  it('handles extraneous /app/', () => {
    let file = path.join(paths.viteApp, 'app', 'templates/application');
    let result = appPath(file);

    expect(result).to.equal(path.join('vite-app/templates/application'));
  });

  it('handles psuedo module', () => {
    let file = path.join(paths.viteApp, 'templates/application');
    let result = appPath(file);

    expect(result).to.equal(path.join('vite-app/templates/application'));
  });
});
