const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

/**
 * doc/06 §9 — sans `watchFolders` sur la racine, Metro ne résout pas les packages
 * du monorepo liés en workspace. C'est l'erreur d'installation n°1 en React Native.
 */
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
