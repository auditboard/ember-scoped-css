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
 * Postfixes every class in `className`, which may be a space-separated list.
 *
 * `classesInCss` is consulted one class at a time, so it has to be keyed on
 * individual class names — a Set built from a whole space-separated list
 * matches nothing. Omit it to postfix every class unconditionally.
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
