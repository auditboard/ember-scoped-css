import EmberApp from '@ember/application';
import EmberRouter from '@ember/routing/router';
import { setApplication } from '@ember/test-helpers';
import * as QUnit from 'qunit';
import { setup } from 'qunit-dom';
import { setupEmberOnerrorValidation, start as qunitStart } from 'ember-qunit';

import Resolver from 'ember-resolver';

class Router extends EmberRouter {
  location = 'none';
  rootURL = '/';
}

class TestApp extends EmberApp {
  modulePrefix = 'test-app';
  Resolver = Resolver.withModules({
    'test-app/router': { default: Router },
    // add any custom services here
  });
}

Router.map(function () {});

export function start() {
  setApplication(
    TestApp.create({
      autoboot: false,
      rootElement: '#ember-testing',
    }),
  );
  setup(QUnit.assert);
  setupEmberOnerrorValidation();
  qunitStart();
}
