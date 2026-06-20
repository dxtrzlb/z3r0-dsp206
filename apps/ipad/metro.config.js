// Metro for the npm-workspaces monorepo: watch the repo root and resolve the @z3r0/core TS
// source (its package "exports" points at ./src/index.ts, transpiled via babel-preset-expo).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
