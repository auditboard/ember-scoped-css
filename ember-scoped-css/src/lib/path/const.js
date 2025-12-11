import path from 'path';

/**
 * Join will convert to whatever is appropriate fro the current platform
 */

export const leadingSlashPath = {
  embroiderDir: path.join('/node_modules/.embroider/'),
  atEmbroider: path.join('/@embroider'),
  componentsDir: path.join('/components/'),
  templatesDir: path.join('/templates/'),
  routesDir: path.join('/routes/'),
  testem: path.join('/testem'),
  src: path.join('/src/'),
  app: path.join('/app/'),
};

export const barePath = {
  pnpmDir: path.join('node_modules/.pnpm'),
};
