const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedPackageRoot = path.resolve(workspaceRoot, 'packages/shared');
const rootNodeModules = path.resolve(workspaceRoot, 'node_modules');
const appReactRoot = path.resolve(projectRoot, 'node_modules/react');
const rootReactPosix = path
  .resolve(rootNodeModules, 'react')
  .replace(/\\/g, '/')
  .replace(/[.*+?^${}()|[\]]/g, '\\$&');

/**
 * Metro configuration for npm workspaces monorepo
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sharedPackageRoot, rootNodeModules],
  resolver: {
    unstable_enableSymlinks: false,
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      rootNodeModules,
    ],
    extraNodeModules: {
      '@healthcare-system/shared': sharedPackageRoot,
      react: appReactRoot,
    },
    blockList: exclusionList([
      new RegExp(`^${rootReactPosix}/.*`),
      /node_modules\/@healthcare-system\/.*/,
      /node_modules\/@playwright\/.*/,
      /node_modules\/playwright.*/,
      /node_modules\/vite\/.*/,
      /node_modules\/typescript\/.*/,
      /node_modules\/@types\/.*/,
      /android\/\.gradle\/.*/,
      /android\/app\/build\/.*/,
    ]),
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
