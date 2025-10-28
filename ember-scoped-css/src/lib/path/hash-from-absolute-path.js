import { hash } from './hash-from-module-path.js';
import { appPath, forcePosix } from './utils.js';

export { hash } from './hash-from-module-path.js';

export function hashFromAbsolutePath(absolutePath) {
  /**
   * The whole of `appPath` ultimately transforms the `absolutePath`
   * into the exact string that folks will pass to `relativePath`
   * at runtime.
   */
  const modulePath = appPath(absolutePath);
  const forced = forcePosix(modulePath);
  console.log('forced', forced);
  const postfix = hash(forced);

  return postfix;
}
