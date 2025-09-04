// Build display string for a selector violation, including wrapper-only and at-rule chains
export default function buildDisplaySelector(rule, selector) {
  const parent = rule.parent;

  if (parent.type === 'root') {
    return selector;
  } else if (parent.type === 'atrule') {
    const params = parent.params ? ` ${parent.params}` : '';

    return buildDisplaySelector(
      parent,
      `@${parent.name}${params} { ${selector} }`,
    );
  } else if (parent.type == 'rule') {
    return buildDisplaySelector(parent, `${parent.selector} { ${selector} }`);
  }
}
