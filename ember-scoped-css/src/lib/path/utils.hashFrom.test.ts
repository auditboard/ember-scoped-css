import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { hashFrom } from './utils.js';
import { paths } from './utils.paths.test.js';

describe('hashFrom()', () => {
  let component = {
    css: path.join(paths.embroiderApp, 'components/forth.css'),
    ext: path.join(paths.embroiderApp, 'components/forth.gjs'),
    withoutExt: path.join(paths.embroiderApp, 'components/forth'),
    module: 'embroider-app/components/forth',
  };
  let route = {
    css: path.join(paths.embroiderApp, 'templates/application.css'),
    ext: path.join(paths.embroiderApp, 'templates/application.hbs'),
    withoutExt: path.join(paths.embroiderApp, 'templates/application'),
    module: 'embroider-app/templates/application',
  };

  describe('component', () => {
    it('with an extension: absolute and module paths give the same value', () => {
      expect(hashFrom(component.ext)).to.equal(hashFrom(component.module));
    });

    it('without an extension: absolute and module paths give the same value', () => {
      expect(hashFrom(component.withoutExt)).to.equal(
        hashFrom(component.module),
      );
    });

    it('also matches a css extension', () => {
      expect(hashFrom(component.withoutExt)).to.equal(hashFrom(component.css));
    });
  });

  describe('route template', () => {
    it('with an extension: absolute and module paths give the same value', () => {
      expect(hashFrom(route.ext)).to.equal(hashFrom(route.module));
    });

    it('without an extension: absolute and module paths give the same value', () => {
      expect(hashFrom(route.withoutExt)).to.equal(hashFrom(route.module));
    });

    it('also matches a css extension', () => {
      expect(hashFrom(route.withoutExt)).to.equal(hashFrom(route.css));
    });
  });
});
