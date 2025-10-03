import module from 'node:module';
import path from 'node:path';
import url from 'node:url';

import { describe, expect, it } from 'vitest';

const require = module.createRequire(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const monorepoRoot = path.join(__dirname, '../../../../');

export const paths = {
  v2Addon: path.join(monorepoRoot, 'test-apps/v2-addon'),
  viteApp: path.join(monorepoRoot, 'test-apps/vite-app'),
};

describe('paths', () => {
  it('exists', () => {
    let aRequirable = path.join(paths.viteApp, 'vite.config.mjs');
    // would error if not found
    let result = require.resolve(aRequirable);

    expect(result).to.equal(aRequirable);
  });
});
