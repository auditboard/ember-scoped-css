import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { hashFromAbsolutePath } from './hash-from-absolute-path.js';
import { forcePosix } from './utils.js';
import { paths } from './utils.paths.test.js';

describe('hashFromAbsolutePath', () => {
  describe(`the module: "embroider-app/templates/application"`, () => {
    it('works with direct path', () => {
      let filePath = path.join(paths.viteApp, 'src/components/third');
      let postfix = hashFromAbsolutePath(forcePosix(filePath));

      expect(postfix).to.equal('e4b5bd4dc');
    });
  });
});
