// Add any types here that you need for local development only.
// These will *not* be published as part of your addon, so be careful that your published code does not rely on them!
import 'ember-source/types';
import 'ember-source/types/preview';
import '@glint/environment-ember-loose';

import type HasAtClass from '../src/components/at-class-ts/has-at-class.ts';
import type ScopedCss from 'ember-scoped-css/template-registry';

declare module '@glint/environment-ember-loose/registry' {
  // Remove this once entries have been added! 👇
   
  export default interface Registry extends ScopedCss {
    // Add any registry entries from other addons here that your addon itself uses (in non-strict mode templates)
    // See https://typed-ember.gitbook.io/glint/using-glint/ember/using-addons
    'AtClass::HasAtClass': typeof HasAtClass;
  }
}
