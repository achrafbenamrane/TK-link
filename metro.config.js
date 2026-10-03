const path = require('path');

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Aperçu navigateur : la carte native n'a pas de version web embarquée. On la
// remplace UNIQUEMENT pour `web` ; iOS et Android gardent la vraie bibliothèque.
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@rnmapbox/maps') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'scripts/web-stubs/rnmapbox.js') };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
