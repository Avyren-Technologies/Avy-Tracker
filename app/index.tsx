import React, { useEffect, useRef } from "react";
import "./../app/utils/backgroundLocationTask";
import {
  View,
  Text,
  Animated,
  Image,
  StatusBar,
  Platform,
  AppState,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "./context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import AuthContext from "./context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import * as Network from "expo-network";
import { LogBox } from "react-native";

const { width, height } = Dimensions.get("window");

LogBox.ignoreLogs(["No route named", "[Layout children]: No route named"]);

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user, isOffline } = AuthContext.useAuth();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const offlineBadgeFadeAnim = useRef(new Animated.Value(0)).current;
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  const backgroundPulseAnim = useRef(new Animated.Value(0)).current;
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;

  // Theme-based colors
  const colors = {
    // Light theme colors
    light: {
      primary: "#3B82F6", // Blue-500
      secondary: "#0EA5E9", // Sky-500
      accent: "#6366F1", // Indigo-500
      background: "#F8FAFC", // Slate-50
      surface: "#FFFFFF", // White
      text: "#0F172A", // Slate-900
      textSecondary: "#475569", // Slate-600
      border: "#E2E8F0", // Slate-200
      success: "#10B981", // Emerald-500
      warning: "#F59E0B", // Amber-500
      error: "#EF4444", // Red-500
    },
    // Dark theme colors
    dark: {
      primary: "#60A5FA", // Blue-400
      secondary: "#38BDF8", // Sky-400
      accent: "#818CF8", // Indigo-400
      background: "#0F172A", // Slate-900
      surface: "#1E293B", // Slate-800
      text: "#F8FAFC", // Slate-50
      textSecondary: "#CBD5E1", // Slate-300
      border: "#334155", // Slate-700
      success: "#34D399", // Emerald-400
      warning: "#FBBF24", // Amber-400
      error: "#F87171", // Red-400
    },
  };

  const currentColors = colors[theme];

  // Check for updates when app comes to foreground (production only)
  useEffect(() => {
    // Only run in production environment
    if (!__DEV__) {
      let current = AppState.currentState;
      const sub = AppState.addEventListener("change", async (next) => {
        if (current.match(/inactive|background/) && next === "active") {
          try {
            // Check network connectivity before attempting update check
            const networkState = await Network.getNetworkStateAsync();
            if (networkState.isConnected && networkState.isInternetReachable) {
              const { isAvailable } = await Updates.checkForUpdateAsync();
              if (isAvailable) {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              }
            } else {
              console.log("Offline mode: Skipping update check");
            }
          } catch (error) {
            console.error("Error checking for updates:", error);
          }
        }
        current = next;
      });
      return () => sub.remove();
    }
  }, []);

  // Animation and navigation logic
  useEffect(() => {
    if (!isLoading) {
      // Background pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundPulseAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(backgroundPulseAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Floating shapes animation
      Animated.loop(
        Animated.timing(floatingShapesAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
      ).start();

      // Logo animation sequence
      Animated.sequence([
        // First: Scale and fade in the logo
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Then: Rotate the logo and add glow effect
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        // Finally: Slide up and fade in the text
        Animated.parallel([
          Animated.timing(slideUpAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Animate offline badge if in offline mode
      if (isOffline) {
        Animated.timing(offlineBadgeFadeAnim, {
          toValue: 1,
          duration: 500,
          delay: 1200,
          useNativeDriver: true,
        }).start();
      }

      // Navigate based on auth state and app open count
      const timer = setTimeout(async () => {
        if (user) {
          // Check if we need to reset the counter for a new day (IST 12:00 AM)
          const now = new Date();
          const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
          const istTime = new Date(now.getTime() + istOffset);
          const todayIST = istTime.toISOString().split("T")[0]; // YYYY-MM-DD format

          const lastResetDate = await AsyncStorage.getItem(
            "appOpenCounterResetDate",
          );
          const appOpenCount = await AsyncStorage.getItem("appOpenCount");

          let count = 0;

          // Reset counter if it's a new day in IST
          if (lastResetDate !== todayIST) {
            console.log(
              `New day detected (IST): ${todayIST}, resetting app open counter`,
            );
            await AsyncStorage.setItem("appOpenCounterResetDate", todayIST);
            await AsyncStorage.setItem("appOpenCount", "0");
            count = 0;
          } else {
            count = appOpenCount ? parseInt(appOpenCount) : 0;
          }

          const maxShiftTrackerOpens = 4; // Show shift tracker for first 4 opens each day

          // Increment app open count
          await AsyncStorage.setItem("appOpenCount", (count + 1).toString());

          // For first few opens of the day, show shift tracker instead of dashboard
          if (count < maxShiftTrackerOpens) {
            console.log(
              `Daily app open count: ${count + 1}/${maxShiftTrackerOpens} - Showing shift tracker (IST: ${todayIST})`,
            );
            router.replace("/(dashboard)/shared/shiftTracker");
          } else {
            // After max opens for the day, show normal dashboard
            console.log(
              `Daily app open count: ${count + 1} - Showing normal dashboard (IST: ${todayIST})`,
            );
            switch (user.role) {
              case "employee":
                router.replace("/(dashboard)/employee/employee");
                break;
              case "group-admin":
                router.replace("/(dashboard)/Group-Admin/group-admin");
                break;
              case "management":
                router.replace("/(dashboard)/management/management");
                break;
              case "super-admin":
                router.replace("/(dashboard)/super-admin/super-admin");
                break;
            }
          }
        } else {
          // No user logged in, go to welcome screen
          router.replace("/welcome");
        }
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, user]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowOpacity = logoGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const backgroundScale = backgroundPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  // Function to check and refresh Expo Push Token if needed
  const checkAndRefreshExpoToken = async () => {
    try {
      console.log("[Token Check] Verifying Expo push token validity");

      // Step 1: Check when the token was last successfully registered
      const lastRegistered = await AsyncStorage.getItem(
        "pushTokenLastRegistered",
      );
      const currentToken = await AsyncStorage.getItem("expoPushToken");

      // If we have both a token and registration timestamp
      if (currentToken && lastRegistered) {
        const lastRegDate = new Date(lastRegistered);
        const now = new Date();
        const daysSinceRegistration =
          (now.getTime() - lastRegDate.getTime()) / (1000 * 60 * 60 * 24);

        console.log(`[Token Check] Current token: ${currentToken}`);
        console.log(
          `[Token Check] Last registered: ${daysSinceRegistration.toFixed(1)} days ago`,
        );

        // If token was registered within last 7 days, no need to refresh
        if (daysSinceRegistration < 7) {
          console.log("[Token Check] Token is recent, no refresh needed");
          return;
        }

        console.log("[Token Check] Token is older than 7 days, will refresh");
      } else {
        console.log("[Token Check] No token or registration timestamp found");
      }

      // Step 2: Clear the existing token
      await AsyncStorage.removeItem("expoPushToken");
      await AsyncStorage.removeItem("pushTokenLastRegistered");

      // Step 3: Let regular registration process handle getting a new token
      console.log(
        "[Token Check] Cleared token cache, new token will be requested",
      );
    } catch (error) {
      console.error("[Token Check] Error checking token validity:", error);
    }
  };

  return (
    <>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={currentColors.background}
        translucent={true}
        animated={true}
        hidden={false}
        networkActivityIndicatorVisible={false}
      />

      {/* Main background */}
      <View
        style={{
          flex: 1,
          backgroundColor: currentColors.background,
        }}
      >
        {/* Animated background gradient */}
        <Animated.View
          style={{
            position: "absolute",
            top: -height * 0.1,
            left: -width * 0.1,
            right: -width * 0.1,
            bottom: -height * 0.1,
            transform: [{ scale: backgroundScale }],
            opacity: 0.6,
          }}
        >
          <LinearGradient
            colors={[
              currentColors.primary,
              currentColors.secondary,
              currentColors.accent,
            ]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Floating geometric shapes */}
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          {/* Blue circle */}
          <Animated.View
            style={{
              position: "absolute",
              top: height * 0.1,
              right: width * 0.1,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: currentColors.primary,
              opacity: 0.2,
              transform: [{ translateY: floatingOffset }],
            }}
          />

          {/* Sky square */}
          <Animated.View
            style={{
              position: "absolute",
              bottom: height * 0.2,
              left: width * 0.1,
              width: 60,
              height: 60,
              borderRadius: 12,
              backgroundColor: currentColors.secondary,
              opacity: 0.3,
              transform: [
                {
                  translateY: floatingOffset.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -15],
                  }),
                },
              ],
            }}
          />

          {/* Indigo triangle */}
          <Animated.View
            style={{
              position: "absolute",
              top: height * 0.6,
              right: width * 0.2,
              width: 0,
              height: 0,
              borderLeftWidth: 30,
              borderRightWidth: 30,
              borderBottomWidth: 52,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: currentColors.accent,
              opacity: 0.15,
              transform: [
                {
                  translateY: floatingOffset.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 10],
                  }),
                },
              ],
            }}
          />
        </View>

        {/* Main content container */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          {/* Logo container with glow effect */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: spin }],
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            {/* Glow effect */}
            <Animated.View
              style={{
                position: "absolute",
                width: 280,
                height: 280,
                borderRadius: 140,
                backgroundColor: currentColors.primary,
                opacity: glowOpacity,
                transform: [{ scale: 1.2 }],
              }}
            />

            {/* Main logo container */}
            <View
              style={{
                width: 200,
                height: 200,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 100,
                backgroundColor: currentColors.surface,
                shadowColor: currentColors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
                borderWidth: 3,
                borderColor: currentColors.primary,
              }}
            >
              <Image
                source={require("../assets/images/adaptive-icon.png")}
                style={{
                  width: 140,
                  height: 140,
                }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* App title */}
          <Animated.View
            style={{
              opacity: textFadeAnim,
              transform: [{ translateY: slideUpAnim }],
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: "800",
                color: currentColors.text,
                textAlign: "center",
                letterSpacing: 1,
                textShadowColor:
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.5)"
                    : "rgba(255, 255, 255, 0.8)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
                marginBottom: 8,
              }}
            >
              Avy Tracker
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: currentColors.textSecondary,
                textAlign: "center",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Smart Workforce Management Platform
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: currentColors.textSecondary,
                opacity: 0.7,
                textAlign: "center",
                letterSpacing: 0.5,
              }}
            >
              Employee Tracking & Analytics Platform
            </Text>
          </Animated.View>

          {/* Offline mode indicator */}
          {isOffline && (
            <Animated.View
              style={{
                opacity: offlineBadgeFadeAnim,
                marginTop: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(239, 68, 68, 0.1)",
                borderWidth: 1,
                borderColor: currentColors.error,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: currentColors.error,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  color: currentColors.error,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Offline Mode
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom powered by text */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            opacity: textFadeAnim,
            transform: [{ translateY: slideUpAnim }],
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: currentColors.textSecondary,
              fontWeight: "500",
              letterSpacing: 0.8,
              textAlign: "center",
              textShadowColor:
                theme === "dark"
                  ? "rgba(0, 0, 0, 0.8)"
                  : "rgba(255, 255, 255, 0.9)",
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            Powered by{" "}
            <Text
              style={{
                color: currentColors.primary,
                fontWeight: "700",
                fontSize: 18,
                letterSpacing: 1,
              }}
            >
              Avyren Technologies
            </Text>
          </Text>
        </Animated.View>
      </View>
    </>
  );
}
