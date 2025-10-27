import path from 'path';

/**
 * Join will convert to whatever is appropriate fro the current platform
 */

export const leadingSlashPath = {
  embroiderDir: path.join('/node_modules/.embroider/'),
  atEmbroider: path.join('/@embroider'),
  componentsDir: path.join('/components/'),
  templatesDir: path.join('/templates/'),
  testem: path.join('/testem'),
  src: path.join('/src/'),
};

export const barePath = {
  pnpmDir: path.join('node_modules/.pnpm'),
};
