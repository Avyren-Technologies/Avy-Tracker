// Import environment variables directly
import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

// Define the configuration as a function that returns the ExpoConfig
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Daily Flow",
  slug: "dailyflow",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/adaptive-icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/4c2221ee-b651-49c8-9cdc-04c4a1c3b9b5",
    fallbackToCacheTimeout: 0,
    checkAutomatically: "ON_LOAD",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.avyrentechnologies.dailyflow",
    buildNumber: "5",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Parrot Analyzer needs your location to track attendance, calculate travel distance, and provide location-based insights.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Parrot Analyzer needs to access your location in the background to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
      NSLocationAlwaysUsageDescription:
        "Parrot Analyzer needs background location access to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
      UIBackgroundModes: ["location", "fetch"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.avyrentechnologies.dailyflow",
    googleServicesFile: "./constants/google-services.json",
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "WAKE_LOCK",
      "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    ],
    // @ts-ignore: foregroundServices is supported by Expo but not typed correctly
    foregroundServices: ["location"],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/adaptive-icon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/SplashScreen.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission:
          "The app needs access to your photos to let you set a profile picture.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/adaptive-icon.png",
        color: "#ffffff",
        sound: "default",
      },
    ],
    "expo-font",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow Parrot Analyzer to use your location to track attendance, calculate travel distance, and provide location-based insights.",
        locationAlwaysPermission:
          "Allow Parrot Analyzer to use your location in the background to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
        locationWhenInUsePermission:
          "Allow Parrot Analyzer to use your location to track attendance, calculate travel distance, and provide location-based insights.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],

  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId:
        process.env.EXPO_PROJECT_ID || "4c2221ee-b651-49c8-9cdc-04c4a1c3b9b5",
    },
    // Make environment variables available in the app via Constants.expoConfig.extra
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
  owner: "avyrentechnologies",
  runtimeVersion: {
    policy: "sdkVersion",
  },
});