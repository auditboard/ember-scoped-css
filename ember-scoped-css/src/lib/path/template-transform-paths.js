import path from 'node:path';

import { findWorkspacePath } from './utils.js';

/**
 * template plugins do not hand us the correct file path.
 * additionally, we may not be able to rely on this data in the future,
 * so this functions acts as a means of normalizing _whatever_ we're given
 * in the future.
 *
 * @param {string} filename
 * @returns {string} the absolute path to the file
 */
export function fixFilename(filename) {
  let fileName = filename;
  let workspace = findWorkspacePath(fileName);

  /**
   * ember-source 5.8:
   * - the filename looks like an absolute path, but swapped out the 'app' part of the path
   *   with the module name, so the file paths never exist on disk
   *
   * - in vite apps:
   *   the 'app' part _may_ be `src`, so we also need to ensure that `src` is excluded as well
   */
  let hasAppDir = fileName.includes(path.join(workspace, 'app'));
  let hasSrcDir = fileName.includes(path.join(workspace, 'src'));

  if (
    !(hasAppDir || hasSrcDir) &&
    !fileName.includes('/node_modules/.embroider/')
  ) {
    let maybeModule = fileName.replace(workspace, '');
    let [maybeScope, ...rest] = maybeModule.split('/').filter(Boolean);
    let parts = rest;

    if (maybeScope.startsWith('@')) {
      let [, ...rester] = rest;

      parts = rester;
    }

    let relative = path.join(...parts);

    /**
     * We don't actually know if this file is an app.
     * it could be an addon (v1 or v2)
     *
     * So here we log to see if we have unhandled situations.
     */
    let candidatePath = path.join(workspace, 'app', relative);

    return candidatePath;
  }

  // TODO: why are we passed files to other projects?
  if (!fileName.includes(workspace)) {
    return fileName;
  }

  // Fallback to what the plugin system gives us.
  // This may be wrong, and if wrong, reveals
  // unhandled scenarios with the file names in the plugin infra
  return fileName;
}
