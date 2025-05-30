import Application from '@ember/application';
import Resolver from 'ember-resolver';

import { registry } from './registry.js';

export default class App extends Application {
  modulePrefix = 'vite-app-with-compat';
  Resolver = Resolver.withModules(registry);
}
