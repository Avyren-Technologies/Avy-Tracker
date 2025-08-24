// Import environment variables directly
import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

// Define the configuration as a function that returns the ExpoConfig
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Avy Tracker",
  slug: "avy-tracker",
  version: "1.0.3",
  orientation: "portrait",
  icon: "./assets/images/adaptive-icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  assetBundlePatterns: ["**/*"],
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/863d9167-e851-4006-9ee8-154777f31c7f",
    fallbackToCacheTimeout: 0,
    checkAutomatically: "ON_LOAD",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.avyrentechnologies.avytracker",
    buildNumber: "5",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Avy Tracker needs your location to track attendance, calculate travel distance, and provide location-based insights.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Avy Tracker needs to access your location in the background to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
      NSLocationAlwaysUsageDescription:
        "Avy Tracker needs background location access to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
      UIBackgroundModes: ["location", "fetch"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.avyrentechnologies.avytracker",
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
        image: "./assets/images/splash-icon-light.png",
        resizeMode: "contain",
        backgroundColor: "#FF6B35", // Updated to orange primary color
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
          "Allow Avy Tracker to use your location to track attendance, calculate travel distance, and provide location-based insights.",
        locationAlwaysPermission:
          "Allow Avy Tracker to use your location in the background to track attendance, calculate travel distance, and provide location-based insights even when the app is closed.",
        locationWhenInUsePermission:
          "Allow Avy Tracker to use your location to track attendance, calculate travel distance, and provide location-based insights.",
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
        process.env.EXPO_PROJECT_ID || "863d9167-e851-4006-9ee8-154777f31c7f",
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