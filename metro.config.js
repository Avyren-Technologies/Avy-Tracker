const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Get the default config
let config = getDefaultConfig(__dirname);

// Apply our custom config - only add extensions that aren't already included
config = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: [...config.resolver.sourceExts],
    assetExts: [...config.resolver.assetExts, "db"],
  },
};

// Apply NativeWind
module.exports = withNativeWind(config, { input: "./global.css" });
