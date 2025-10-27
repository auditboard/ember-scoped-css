import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isRelevantFile } from './utils.js';
import { paths } from './utils.paths.test.js';

describe('isRelevantFile()', () => {
  describe('the file is relevant', () => {
    it('for in-project files', () => {
      let file = path.posix.join(paths.viteApp, 'app/components/forth.gjs');
      let result = isRelevantFile(file, { cwd: paths.viteApp });

      expect(result).toBeTruthy();
    });

    it('for /templates/', () => {
      let file = path.posix.join(
        paths.viteApp,
        'app/templates/application.hbs',
      );
      let result = isRelevantFile(file, { cwd: paths.viteApp });

      expect(result).toBeTruthy();
    });
  });

  describe('the file is not relevant', () => {
    it('for outside-of-project files', () => {
      let file = path.posix.join(paths.v2Addon, 'dist/components/footer.js');
      let result = isRelevantFile(file, { cwd: paths.viteApp });

      expect(result).toBeFalsy();
    });

    it('for files in node_modules', () => {
      let file = path.posix.join(
        paths.viteApp,
        'node_modules/ember-resources/dist/index.js',
      );
      let result = isRelevantFile(file, { cwd: paths.viteApp });

      expect(result).toBeFalsy();
    });

    it('for files in tests/', () => {
      let file = path.posix.join(paths.viteApp, 'tests/foo.js');
      let result = isRelevantFile(file, { cwd: paths.viteApp });

      expect(result).toBeFalsy();
    });
  });
});
