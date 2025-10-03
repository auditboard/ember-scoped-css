import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixFilename } from './template-transform-paths.js';
import { paths } from './utils.paths.test.js';

describe('fixFilename()', () => {
  it(`works with /src/`, () => {
    let file = path.join(
      paths.viteApp,
      'src',
      'components/in-app/calls-has-at-class.gts',
    );
    let corrected = fixFilename(file);

    expect(corrected).to.equal(
      path.join(paths.viteApp, 'src/components/in-app/calls-has-at-class.gts'),
    );
  });

  it('works with the real path', () => {
    let file = path.join(paths.viteApp, 'app', 'components/template-only.hbs');
    let corrected = fixFilename(file);

    expect(corrected).to.equal(
      path.join(paths.viteApp, 'app/components/template-only.hbs'),
    );
  });

  it('is not confused with "app" in the component path', () => {
    let file = path.join(
      paths.viteApp,
      'app',
      'components/app/page/template-only.hbs',
    );
    let corrected = fixFilename(file);

    expect(corrected).to.equal(
      path.join(paths.viteApp, 'app/components/app/page/template-only.hbs'),
    );
  });

  it('works with classic paths (w/ module name)', () => {
    let file = path.join(
      paths.viteApp,
      'classic-app',
      'components/template-only.hbs',
    );
    let corrected = fixFilename(file);

    expect(corrected).to.equal(
      path.join(paths.viteApp, 'app/components/template-only.hbs'),
    );
  });

  it('is not confused with "app" in the component path (w/ module name)', () => {
    let file = path.join(
      paths.viteApp,
      'classic-app',
      'components/app/page/template-only.hbs',
    );
    let corrected = fixFilename(file);

    expect(corrected).to.equal(
      path.join(paths.viteApp, 'app/components/app/page/template-only.hbs'),
    );
  });
});
