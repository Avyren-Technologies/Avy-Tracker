import React, { useEffect, useState } from "react";
import { Stack, SplashScreen } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ThemeContext from "./context/ThemeContext";
import AuthContext from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, AppState } from "react-native";
import Constants from "expo-constants";
import { logStorageState } from "./utils/tokenDebugger";
import "../global.css";
import * as Location from "expo-location";
import { NotificationProvider } from "./context/NotificationContext";
import { TrackingProvider } from "./context/TrackingContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Network from "expo-network";
import { FaceDetectionProvider } from "@infinitered/react-native-mlkit-face-detection";
import BiometricAuthWrapper from "./components/BiometricAuthWrapper";
import PushNotificationService from "./utils/pushNotificationService";
import { useNotifications } from "./context/NotificationContext";

// Note: The background location task is defined in app/utils/backgroundLocationTask.ts
// We don't define it here to avoid duplicate task definitions which can cause issues

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Simple component to hide splash screen after authentication is ready
function SplashScreenController() {
  const { isLoading } = AuthContext.useAuth();

  // Hide splash screen once auth loading is done
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn("Error hiding splash screen:", err);
      });
    }
  }, [isLoading]);

  return null;
}

// Component to handle global notification setup
function NotificationSetup() {
  const { user, isLoading } = AuthContext.useAuth();
  
  // Safely access notifications context with error handling
  let incrementUnreadCount: (() => void) | null = null;
  try {
    const notificationsContext = useNotifications();
    incrementUnreadCount = notificationsContext.incrementUnreadCount;
  } catch (error) {
    console.log("[NotificationSetup] Notifications context not available:", error);
  }

  useEffect(() => {
    // Only set up listeners if user is authenticated and not loading
    if (user && user.role !== "super-admin" && !isLoading && incrementUnreadCount) {
      console.log("[NotificationSetup] Setting up notification listeners for user:", user.role);
      
      // Set up global notification listeners
      const cleanup = PushNotificationService.setupNotificationListeners(
        (notification) => {
          console.log("[App] Global notification received:", notification.request.content.title);
          // Safely increment unread count when notification is received
          try {
            incrementUnreadCount();
          } catch (error) {
            console.log("[NotificationSetup] Error incrementing unread count:", error);
          }
        },
        (response) => {
          console.log("[App] Global notification tapped:", response.notification.request.content.title);
          // Handle navigation based on notification data
          const data = response.notification.request.content.data;
          if (data?.screen) {
            // Navigation will be handled by the specific notification components
            console.log("[App] Navigation data:", data.screen);
          }
        }
      );

      return cleanup;
    } else {
      console.log("[NotificationSetup] Skipping notification setup - user:", !!user, "loading:", isLoading, "context:", !!incrementUnreadCount);
    }
  }, [user, isLoading]); // Removed incrementUnreadCount from dependencies to prevent re-setup

  return null;
}

// Handle unhandled JS promise rejections
const handlePromiseRejection = (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection:", event.reason);
};

// Handle global errors
const handleGlobalError = (event: ErrorEvent) => {
  console.error("Global error:", event.error);
};

function RootLayout() {
  const [networkStatus, setNetworkStatus] = useState({
    isConnected: true,
    isInternetReachable: true,
  });

  // Set up network monitoring
  useEffect(() => {
    const checkNetworkConnectivity = async () => {
      try {
        const status = await Network.getNetworkStateAsync();
        setNetworkStatus({
          isConnected: !!status.isConnected,
          isInternetReachable: !!status.isInternetReachable,
        });
      } catch (error) {
        console.error("Error checking network connectivity:", error);
      }
    };

    // Check network on mount and app state changes
    checkNetworkConnectivity();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkNetworkConnectivity();
      }
    });

    // Check network status periodically
    const intervalId = setInterval(() => {
      checkNetworkConnectivity();
    }, 30000); // every 30 seconds

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, []);

  // Set up global error handlers
  useEffect(() => {
    if (Platform.OS === "web") {
      window.addEventListener("unhandledrejection", handlePromiseRejection);
      window.addEventListener("error", handleGlobalError);

      return () => {
        window.removeEventListener(
          "unhandledrejection",
          handlePromiseRejection,
        );
        window.removeEventListener("error", handleGlobalError);
      };
    }

    // Debug token storage on app start (only in dev)
    if (__DEV__) {
      logStorageState().catch((err) =>
        console.error("Failed to log storage state:", err),
      );
    }
  }, []);

  // Error handler for the ErrorBoundary
  const handleError = (error: Error) => {
    console.error("Application error caught by root ErrorBoundary:", error);
  };

  // // Initialize location store when app starts
  // useEffect(() => {
  //   const initLocation = async () => {
  //     try {
  //       const { status } = await Location.requestForegroundPermissionsAsync();
  //       if (status !== 'granted') {
  //         console.log('Location permission denied');
  //       }
  //     } catch (error) {
  //       console.error('Error initializing location:', error);
  //     }
  //   };

  //   initLocation();
  // }, []);

  return (
    <ErrorBoundary onError={handleError}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeContext.ThemeProvider>
          <AuthContext.AuthProvider>
            <SplashScreenController />
            <NotificationProvider>
              <NotificationSetup />
              <TrackingProvider>
                <FaceDetectionProvider
                  options={{
                    performanceMode: "accurate",
                    contourMode: true,
                    landmarkMode: true,
                    classificationMode: true,
                    minFaceSize: 0.15,
                    isTrackingEnabled: true,
                  }}
                >
                  <BiometricAuthWrapper
                    onAuthenticationSuccess={() => {
                      // Biometric authentication successful, app can proceed
                      console.log("Biometric authentication successful");
                    }}
                    onAuthenticationFailure={() => {
                      // Biometric authentication failed, handle accordingly
                      console.log("Biometric authentication failed");
                    }}
                  >
                    <Stack
                      screenOptions={{
                        headerShown: false,
                      }}
                    >
                      <Stack.Screen
                        name="index"
                        options={{
                          headerShown: false,
                        }}
                      />
                      <Stack.Screen
                        name="welcome"
                        options={{
                          headerShown: false,
                        }}
                      />
                      <Stack.Screen
                        name="(auth)"
                        options={{
                          headerShown: false,
                        }}
                      />
                      <Stack.Screen
                        name="(dashboard)"
                        options={{
                          headerShown: false,
                        }}
                      />
                      <Stack.Screen
                        name="(dashboard)/employee/notifications"
                        options={{
                          title: "Notifications",
                        }}
                      />
                      <Stack.Screen
                        name="(dashboard)/Group-Admin/notifications"
                        options={{
                          title: "Notifications",
                        }}
                      />
                      <Stack.Screen
                        name="(dashboard)/management/notifications"
                        options={{
                          title: "Notifications",
                        }}
                      />
                      <Stack.Screen
                        name="(dashboard)/test-notifications"
                        options={{
                          title: "Test Notifications",
                        }}
                      />
                    </Stack>
                  </BiometricAuthWrapper>
                </FaceDetectionProvider>
              </TrackingProvider>
            </NotificationProvider>
          </AuthContext.AuthProvider>
        </ThemeContext.ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default RootLayout;
