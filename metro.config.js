const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Get the default config
let config = getDefaultConfig(__dirname);

// Apply our custom config
config = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: ["js", "jsx", "json", "ts", "tsx"],
    assetExts: ["db", "ttf", "png", "jpg"],
  },
};

// Apply NativeWind
module.exports = withNativeWind(config, { input: "./global.css" });