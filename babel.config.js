module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind", // ✅ NativeWind support without babel preset
        },
      ],
    ],
    plugins: [
      "react-native-worklets/plugin", // ✅ Correct plugin for Reanimated 4.x
    ],
  };
};
