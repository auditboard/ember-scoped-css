import { isRelevantFile } from '../lib/path/utils.js';

function _isRelevantFile(state, cwd) {
  let fileName = state.file.opts.filename;
  let additionalRoots = state.opts?.additionalRoots;

  return isRelevantFile(fileName, {
    additionalRoots,
    cwd,
  });
}

/**
 * @param {any} env - babel plugin env, env.types is most commonly used (esp in TS)
 * @param {object} options - the options for scoped-css -- this is also available in each visitor's state.opts
 * @param {string} workingDirectory
 */
export default (env, options, workingDirectory) => {
  /**
   * This babel plugin does two things:
   * - removes the import of scopedClass, if it exists
   *   - if scopedClass was imported, it is removed from any component's "scope bag"
   *     (the scope bag being a low-level object used for passing what is "in scope" for a component)
   */
  return {
    visitor: {
      Program: {
        enter(path, state) {
          if (!_isRelevantFile(state, workingDirectory)) {
            state.canSkip = true;

            return;
          }
        },
      },
      ImportDeclaration(path, state) {
        if (state.canSkip) {
          return;
        }

        if (path.node.source.value === 'ember-scoped-css') {
          let specifier = path.node.specifiers.find(
            (x) => x.imported.name === 'scopedClass',
          );

          if (specifier) {
            state.file.opts.importedScopedClass = specifier.local.name;
          }

          if (specifier.local.name !== 'scopedClass') {
            throw new Error(
              `The scopedClass import is a psuedo-helper, and may not be renamed as it is removed at build time.`,
            );
          }

          path.remove();
        }
      },
      /**
       * Only in strict mode, do we care about remoning the scope bag reference
       */
      ObjectProperty(path, state) {
        if (!state.file.opts?.importedScopedClass) return;

        if (
          path.node.value.type === 'Identifier' &&
          path.node.value.name === state.file.opts?.importedScopedClass
        ) {
          path.remove();
        }
      },
    },
  };
};
