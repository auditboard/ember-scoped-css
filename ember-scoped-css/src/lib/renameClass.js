/**
 * Splits a space-separated class list (the value of a `class` attribute or of
 * a `[class="..."]` selector) into its individual class names.
 *
 * @param {string} classList
 * @returns {string[]}
 */
export function splitClassList(classList) {
  return classList.split(/\s+/).filter(Boolean);
}

/**
 *
 * @param {string} className
 * @param {string} postfix
 * @param {Set<string>} [classesInCss]
 * @returns
 */
export function renameClass(className, postfix, classesInCss) {
  const renamedClasses = splitClassList(className)
    .map((c) => {
      if (!classesInCss || classesInCss.has(c)) {
        if (c.endsWith(postfix)) return c;

        return c + '_' + postfix;
      }

      return c;
    })
    .join(' ');

  const renamedWithPreservedSpaces = className.replace(
    className.trimStart().trimEnd(),
    renamedClasses,
  );

  return renamedWithPreservedSpaces;
}
