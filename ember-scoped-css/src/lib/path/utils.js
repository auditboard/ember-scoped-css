import assert from 'node:assert';
import fsSync, { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { hashFromAbsolutePath } from './hash-from-absolute-path.js';
import { hashFromModulePath } from './hash-from-module-path.js';

export { hashFromAbsolutePath } from './hash-from-absolute-path.js';
export { hashFromModulePath } from './hash-from-module-path.js';

const COMPONENT_EXTENSIONS = ['.gts', '.gjs', '.ts', '.js', '.hbs'];

// CJS / ESM?
let here = import.meta.url;
let ourRequire = globalThis.require
  ? globalThis.require
  : here && createRequire(here);

if (!ourRequire) {
  ourRequire = require;
}

const EMBROIDER_DIR = 'node_modules/.embroider';
const EMBROIDER_3_REWRITTEN_APP_PATH = `${EMBROIDER_DIR}/rewritten-app`;
const EMBROIDER_3_REWRITTEN_APP_ASSETS = `${EMBROIDER_3_REWRITTEN_APP_PATH}/assets`;
const EMBROIDER_3_REWRITTEN_PACKAGES = `${EMBROIDER_DIR}/rewritten-packages`;
const IRRELEVANT_PATHS = ['node_modules/.pnpm', '__vite-'];
const UNSUPPORTED_DIRECTORIES = new Set(['tests']);

const CWD = process.cwd();

/**
 * Regardless of what the filePath format is,
 * this will try to return the correct postfix.
 *
 * @param {string} filePath
 * @returns
 */
export function hashFrom(filePath) {
  if (filePath.startsWith('/')) {
    return hashFromAbsolutePath(filePath);
  }

  return hashFromModulePath(filePath);
}

/**
 *
 */
export function cssHasAssociatedComponent(cssPath) {
  return cssHasStandardFile(cssPath) || cssHasPodsFile(cssPath);
}

function cssHasStandardFile(id) {
  /**
   * Normally we don't need to check a JS path here, but when using
   * embroider@3, we have a "rewritten app", which has all our source
   * preprocessed a bit before scoped-css transformations.
   *
   * (In Vite, we operate more directly with the source)
   */
  for (let ext of COMPONENT_EXTENSIONS) {
    let candidatePath = id.replace(/\.css$/, ext);

    if (existsSync(candidatePath)) {
      return true;
    }
  }

  return false;
}

function cssHasPodsFile(id) {
  if (!id.endsWith('styles.css')) {
    return;
  }

  /**
   * Normally we don't need to check a JS path here, but when using
   * embroider@3, we have a "rewritten app", which has all our source
   * preprocessed a bit before scoped-css transformations.
   *
   * (In Vite, we operate more directly with the source)
   */
  for (let ext of COMPONENT_EXTENSIONS) {
    let candidatePath = id.replace(/styles\.css$/, `template${ext}`);

    if (existsSync(candidatePath)) {
      return true;
    }
  }

  return false;
}

/**
 * Based on ember's component location conventions,
 * this function will provide a path for where we
 * expect the CSS to live.
 *
 * For co-located structure:
 *   - components/my-component.hbs
 *   - components/my-component.css
 *
 * For nested co-located structure
 *   - components/my-component/foo.hbs
 *   - components/my-component/foo.css
 *
 * For Pods routes structure
 *   - routes/my-route/template.{hbs,js}
 *   - routes/my-route/styles.css
 *
 * Deliberately not supported:
 *   - components w/ pods -- this is deprecated in 5.10
 *
 * @param {string} fileName - the hbs, js, gjs, gts or whatever co-located path.
 * @returns {string} - expected css path
 */
export function cssPathFor(fileName) {
  let withoutExt = withoutExtension(fileName);
  let cssPath = withoutExt + '.css';

  if (isPod(fileName)) {
    cssPath = fileName
      .replace(/template\.js$/, 'styles.css')
      .replace(/template\.hbs/, 'styles.css');
  }

  return cssPath;
}

/**
 * Note that components in the "pods" convention will
 * never be supported.
 *
 * @param {string} filePath
 */
export function isPodTemplate(filePath) {
  if (filePath.includes('/components/')) {
    return false;
  }

  return filePath.endsWith('template.js') || filePath.endsWith('template.hbs');
}

/**
 * Note that components in the "pods" convention will
 * never be supported.
 *
 * Checks if a file ends with
 * - template.js
 * - template.hbs
 * - styles.css
 *
 * @param {string} filePath
 */
export function isPod(filePath) {
  if (filePath.includes('/components/')) {
    return false;
  }

  if (isPodTemplate(filePath)) {
    return true;
  }

  return filePath.endsWith('styles.css');
}

/**
 *
 * @param {string} filePath
 * @returns the same path, but without the extension
 */
export function withoutExtension(filePath) {
  let parsed = path.parse(filePath);

  return path.join(parsed.dir, parsed.name);
}

/**
 * Examples for fileName
 * - absolute on-disk path
 * - in webpack
 *   - URL-absolute path, starting with /
 *
 * @param {string} fileName
 * @param {{ additionalRoots?: string[]; cwd: string }} options
 * @returns
 */
export function isRelevantFile(fileName, { additionalRoots, cwd }) {
  // Fake file handled by testem server when it runs
  if (fileName.startsWith('/testem')) return false;
  // Private Virtual Modules
  if (fileName.startsWith('\0')) return false;
  // These are not valid userland names (or are from libraries)
  if (fileName.match(/^[a-zA-Z]/)) return false;
  // External to us
  if (fileName.startsWith('/@embroider')) return false;
  if (IRRELEVANT_PATHS.some((i) => fileName.includes(i))) return false;

  if (fileName.includes('/node_modules/')) {
    // if a file is not the embroider cache directory
    // and is in node_modules, skip it.
    if (!fileName.includes(EMBROIDER_DIR)) {
      return false;
    }

    // rewritten packages should have already been processed at their own
    // publish time
    if (fileName.includes(EMBROIDER_3_REWRITTEN_PACKAGES)) {
      return false;
    }

    // These are already the bundled files.
    if (fileName.includes(EMBROIDER_3_REWRITTEN_APP_ASSETS)) {
      // not supported, never will be
      if (fileName.endsWith(`${EMBROIDER_3_REWRITTEN_APP_ASSETS}/tests.js`)) {
        return false;
      }

      // Ideally, we never get here -- indicates we're not filtering effectively in babel
      // NOTE: if we get here, we're trying to operate on a file too late.
      //       we need ScopedCSS to operate as close to original source as possible -- not output files.
      return false;
    }
  }

  let workspace = findWorkspacePath(fileName);

  assert(cwd, `cwd was not passed to isRelevantFile`);

  let ourWorkspace = findWorkspacePath(cwd);

  if (workspace !== ourWorkspace) {
    return false;
  }

  let local = fileName.replace(workspace, '');
  let [, ...parts] = local.split('/').filter(Boolean);

  if (UNSUPPORTED_DIRECTORIES.has(parts[0])) {
    return false;
  }

  /**
   * Mostly pods support.
   * folks need to opt in to pods (routes), because every pods app can be configured differently
   */
  let roots = ['/components/', '/templates/', ...(additionalRoots || [])];

  if (!roots.some((root) => fileName.includes(root))) {
    return;
  }

  return true;
}

export function packageScopedPathToModulePath(packageScopedPath) {
  /**
   * *By convention*, `src` is omitted from component paths.
   * We can reflect the same behavior by replacing src/
   * with an empty string.
   *
   * CSS isn't emitted as a co-located module, but
   * to keep conventions consistent across languages,
   * we can pretend it is.
   *
   * Any customization beyond removing `src` and `app` is potentially confusing.
   * If we need further customizations, we'll want to match on `exports` in the
   * corresponding package.json
   */
  let packageRelative = packageScopedPath.replace(/^\/src\//, '/');

  let parsed = path.parse(packageRelative);

  if (isPod(packageRelative)) {
    /**
     * For pods, we chop off the whole file, and use the dir name as the "modulePath"
     */
    return parsed.dir;
  }

  /**
   * If an extension is passed, remove it.
   * When using packagers, folks are used to not having to specify extensions for files.
   * Since we don't even emit css files co-located to each module,
   * this helps us not convey a lie that a file may exist in at runtime.
   *
   * For example `<module-name>/components/button`.
   * It doesn't matter what the extension is, because you can only have one css file
   * for the button module anyway.
   */
  let localPackagerStylePath = path.join(parsed.dir, parsed.name);

  return localPackagerStylePath;
}

/**
 * returns the app-module path of the source file
 *
 * This assumes normal ember app conventions
 *
 * which is `<package.json#name>/path-to-file`
 */
export function appPath(sourcePath) {
  let workspacePath = findWorkspacePath(sourcePath);
  let name = moduleName(sourcePath);

  /**
   *  Under embroider builds, the spec-compliant version of the app
   * has all the files under a folder which represents the package name,
   * rather than "app".
   */
  let packageRelative = sourcePath.replace(workspacePath, '');

  /**
   * But we also don't want 'app' -- which is present in the v1 addon pipeline
   */
  packageRelative = packageRelative.replace(`/app/`, `/`);

  /**
   * also also, we know that the re-written app structure in embroider@v3
   * is extraneous, and we can collapse it
   */
  packageRelative = packageRelative.replace(
    `${EMBROIDER_3_REWRITTEN_APP_PATH}/`,
    '/',
  );

  // Any of the above relpacements could accidentally give us an extra / (depending on our build environment)
  packageRelative = packageRelative.replace('//', '/');

  let localPackagerStylePath = packageScopedPathToModulePath(packageRelative);

  return `${name}${localPackagerStylePath}`;
}

/**
 * To avoid hitting the filesysetm, we'll store all found
 * project paths bere, so we can, in memory,
 * get the folder where a package.json exists, rather than
 * hit the file system every time.
 */
const SEEN = new Set();

function getSeen(sourcePath) {
  if (SEEN.has(sourcePath)) return sourcePath;

  let parts = sourcePath.split('/');

  for (let i = parts.length - 1; i > 1; i--) {
    let toCheck = parts.slice(0, i).join('/');

    let seen = SEEN.has(toCheck);

    if (seen) {
      return toCheck;
    }
  }
}

export function findWorkspacePath(sourcePath, options) {
  let cwd = options?.cwd ?? CWD;

  if (sourcePath.includes(EMBROIDER_3_REWRITTEN_APP_PATH)) {
    sourcePath = sourcePath.split(EMBROIDER_3_REWRITTEN_APP_PATH)[0];
  }

  if (sourcePath.endsWith('/')) {
    sourcePath = sourcePath.replace(/\/$/, '');
  }

  let seen = getSeen(sourcePath);

  if (seen) {
    return seen;
  }

  let candidatePath = path.join(sourcePath, 'package.json');

  const isWorkspace = fsSync.existsSync(candidatePath);

  if (isWorkspace) {
    return sourcePath;
  }

  const packageJsonPath = findPackageJsonUp(sourcePath, { cwd });

  if (!packageJsonPath) {
    throw new Error(`Could not determine project for ${sourcePath}`);
  }

  const workspacePath = path.dirname(packageJsonPath);

  SEEN.add(workspacePath);

  return workspacePath;
}

function findPackageJsonUp(startPath, options) {
  let cwd = options?.cwd ?? CWD;
  let parts = startPath.split('/');

  for (let i = parts.length - 1; i > 1; i--) {
    let toCheck = parts.slice(0, i).join('/');

    let packageJson = path.join(toCheck, 'package.json');
    let exists = fsSync.existsSync(packageJson);

    if (exists) {
      return packageJson;
    }

    // Don't traverse all the way to the root of the file system.
    if (toCheck === cwd) {
      break;
    }
  }

  return null;
}

const MANIFEST_CACHE = new Map();

/**
 * Will return the package.json#name, or config/environment#moudlePrefix (if v1 app)
 *
 * @param {string} sourcePath
 */
export function moduleName(sourcePath) {
  const workspace = findWorkspacePath(sourcePath);
  const manifest = getManifest(workspace);

  if (manifest['ember-addon']) {
    /**
     * Libraries are not allowed to customize their module name
     * to be different from their package name.
     *
     * (It's also bonkers that this is allowed for v1 apps)
     */
    return manifest.name;
  }

  /**
   * For v1 apps, we need to reference the config/environment.js file
   * to see if the modulePrefix setting differs from manifest.name;
   */
  let environmentJS = path.join(workspace, 'config/environment.js');

  /**
   * NOTE: the environment.js is a commonJS file, so we can synchronously require it
   *
   * TODO: if we have issues with loading this file later we should probably just run jscodeshift on it
   *       but that could allow us to be brittle in different ways, like if folks stray from the way the
   *       file is laid out from the blueprint defaults.
   */
  if (fsSync.existsSync(environmentJS)) {
    const envFn = ourRequire(environmentJS);
    const env = envFn('ember-scoped-css');

    return env.modulePrefix || manifest.name;
  }

  /**
   * Fallback to the true™ module™ name.
   */
  return manifest.name;
}

/**
 * @param {string} workspace
 */
function getManifest(workspace) {
  let existing = MANIFEST_CACHE.get(workspace);

  if (existing) {
    return existing;
  }

  let buffer = fsSync.readFileSync(path.join(workspace, 'package.json'));
  let content = buffer.toString();
  let json = JSON.parse(content);

  MANIFEST_CACHE.set(workspace, json);

  return json;
}
