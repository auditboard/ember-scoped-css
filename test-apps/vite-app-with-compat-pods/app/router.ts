import EmberRouter from '@ember/routing/router';
import config from 'vite-app-with-compat-pods/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('top-level');
  this.route('another');
});
