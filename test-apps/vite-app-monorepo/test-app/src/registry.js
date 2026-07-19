import Router from './router.js';

const appName = 'vite-app-monorepo-test-app';

function formatAsResolverEntries(imports) {
  return Object.fromEntries(
    Object.entries(imports).map(([key, value]) => [
      key.replace(/\.g?(j|t)s$/, '').replace(/^\.\//, `${appName}/`),
      value,
    ])
  );
}

export const registry = {
  ...formatAsResolverEntries(
    import.meta.glob('./templates/**/*.{gjs,gts,js,ts}', { eager: true })
  ),
  [`${appName}/router`]: Router,
};
