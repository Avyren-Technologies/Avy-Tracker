import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  Image,
  StatusBar,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "../context/ThemeContext";
import AuthContext from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTokenDebugInfo, repairTokenIssues } from "../utils/tokenDebugger";
import MFAVerification from "./components/MFAVerification";
import Constants from "expo-constants";

const { width, height } = Dimensions.get("window");

// Storage keys (keep in sync with AuthContext)
const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_DATA_KEY = "user_data";
const LAST_ONLINE_LOGIN_KEY = "last_online_login";

// API URL
const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:3000";

export default function SignIn() {
  const { theme } = ThemeContext.useTheme();
  const { login, isLoading, isOffline, user, token } = AuthContext.useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{
    message: string;
    type: string;
    details?: string;
  } | null>(null);
  const [isValidIdentifier, setIsValidIdentifier] = useState(false);
  const [identifierType, setIdentifierType] = useState<
    "email" | "phone" | null
  >(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{
    isConnected: boolean;
    isInternetReachable: boolean | null;
  }>({
    isConnected: true,
    isInternetReachable: true,
  });
  const [offlineLoginAvailable, setOfflineLoginAvailable] = useState(false);
  const [checkingOfflineLogin, setCheckingOfflineLogin] = useState(false);

  // MFA-related state
  const [showMFA, setShowMFA] = useState(false);
  const [mfaSessionId, setMfaSessionId] = useState("");
  const [mfaEmail, setMfaEmail] = useState("");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const networkStatusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      card: "#FFFFFF", // White
      text: "#0F172A", // Slate-900
      textSecondary: "#475569", // Slate-600
      textTertiary: "#64748B", // Slate-500
      border: "#E2E8F0", // Slate-200
      inputBackground: "#FFFFFF", // White
      inputBorder: "#E2E8F0", // Slate-200
      inputBorderFocus: "#3B82F6", // Blue-500
      inputBorderError: "#EF4444", // Red-500
      inputBorderSuccess: "#10B981", // Emerald-500
      success: "#10B981", // Emerald-500
      warning: "#F59E0B", // Amber-500
      error: "#EF4444", // Red-500
      info: "#3B82F6", // Blue-500
    },
    // Dark theme colors
    dark: {
      primary: "#60A5FA", // Blue-400
      secondary: "#38BDF8", // Sky-400
      accent: "#818CF8", // Indigo-400
      background: "#0F172A", // Slate-900
      surface: "#1E293B", // Slate-800
      card: "#1E293B", // Slate-800
      text: "#F8FAFC", // Slate-50
      textSecondary: "#CBD5E1", // Slate-300
      textTertiary: "#94A3B8", // Slate-400
      border: "#334155", // Slate-700
      inputBackground: "#1E293B", // Slate-800
      inputBorder: "#334155", // Slate-700
      inputBorderFocus: "#60A5FA", // Blue-400
      inputBorderError: "#F87171", // Red-400
      inputBorderSuccess: "#34D399", // Emerald-400
      success: "#34D399", // Emerald-400
      warning: "#FBBF24", // Amber-400
      error: "#F87171", // Red-400
      info: "#60A5FA", // Blue-400
    },
  };

  const currentColors = colors[theme];

  useEffect(() => {
    // Check network status on mount and periodically
    checkNetworkStatus();
    checkOfflineLoginAvailability();

    // Check if there are token storage inconsistencies on mount
    checkTokenStorageHealth();

    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      }),
    ).start();

    // Set up periodic network check
    networkStatusTimerRef.current = setInterval(() => {
      checkNetworkStatus();
    }, 10000); // Check every 10 seconds

    return () => {
      if (networkStatusTimerRef.current) {
        clearInterval(networkStatusTimerRef.current);
      }
    };
  }, []);

  // Helper function to route user to correct dashboard (matches AuthContext logic)
  const routeUserToDashboard = async (role: string) => {
    try {
      // Check if we need to reset the counter for a new day (IST 12:00 AM)
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const istTime = new Date(now.getTime() + istOffset);
      const todayIST = istTime.toISOString().split("T")[0]; // YYYY-MM-DD format

      const lastResetDate = await AsyncStorage.getItem("appOpenCounterResetDate");
      const appOpenCount = await AsyncStorage.getItem("appOpenCount");

      let count = 0;

      // Reset counter if it's a new day in IST
      if (lastResetDate !== todayIST) {
        console.log(`New day detected (IST): ${todayIST}, resetting app open counter`);
        await AsyncStorage.setItem("appOpenCounterResetDate", todayIST);
        await AsyncStorage.setItem("appOpenCount", "0");
        count = 0;
      } else {
        count = appOpenCount ? parseInt(appOpenCount) : 0;
      }

      const maxShiftTrackerOpens = 5; // Show shift tracker for first 5 opens each day

      // Increment app open count
      await AsyncStorage.setItem("appOpenCount", (count + 1).toString());

      // For first few opens of the day, show shift tracker instead of dashboard
      if (count < maxShiftTrackerOpens) {
        console.log(`Daily app open count: ${count + 1}/${maxShiftTrackerOpens} - Showing shift tracker (IST: ${todayIST})`);
        router.replace("/(dashboard)/shared/shiftTracker");
      } else {
        // After max opens for the day, show normal dashboard
        console.log(`Daily app open count: ${count + 1} - Showing normal dashboard (IST: ${todayIST})`);
        switch (role) {
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
          default:
            console.error("Invalid user role:", role);
        }
      }
    } catch (error) {
      console.error("Error in routeUserToDashboard:", error);
      // Fallback to normal dashboard routing
      switch (role) {
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
        default:
          console.error("Invalid user role:", role);
      }
    }
  };

  // Check if user is already authenticated and redirect accordingly
  useEffect(() => {
    const checkAuthenticationAndRedirect = async () => {
      // Wait for AuthContext to finish loading
      if (isLoading) {
        return;
      }

      // If user is authenticated and has a valid token, redirect to appropriate dashboard
      if (user && token) {
        console.log(`User ${user.name} (${user.role}) is already authenticated, redirecting to dashboard...`);

        // Use the same routing logic as AuthContext
        await routeUserToDashboard(user.role);
      }
    };

    checkAuthenticationAndRedirect();
  }, [user, token, isLoading, router]);

  const checkNetworkStatus = async () => {
    try {
      const status = await Network.getNetworkStateAsync();
      setNetworkStatus({
        isConnected: status.isConnected === true,
        isInternetReachable: status.isInternetReachable ?? null,
      });
    } catch (error) {
      console.error("Failed to check network status:", error);
      // Default to assuming there's connectivity if we can't check
      setNetworkStatus({ isConnected: true, isInternetReachable: true });
    }
  };

  const checkOfflineLoginAvailability = async () => {
    setCheckingOfflineLogin(true);
    try {
      // Check if we have stored credentials
      const accessToken =
        (await AsyncStorage.getItem(AUTH_TOKEN_KEY)) ||
        (await SecureStore.getItemAsync(AUTH_TOKEN_KEY));

      const refreshToken =
        (await AsyncStorage.getItem(REFRESH_TOKEN_KEY)) ||
        (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY));

      const userData =
        (await AsyncStorage.getItem(USER_DATA_KEY)) ||
        (await SecureStore.getItemAsync(USER_DATA_KEY));

      const lastLoginTime = await AsyncStorage.getItem(LAST_ONLINE_LOGIN_KEY);

      // If we have all credentials, check when the last online login was
      if (accessToken && refreshToken && userData && lastLoginTime) {
        const lastLoginDate = parseInt(lastLoginTime);
        const now = Date.now();
        const daysSinceLastLogin =
          (now - lastLoginDate) / (1000 * 60 * 60 * 24);

        // If within the offline grace period (30 days)
        if (daysSinceLastLogin <= 30) {
          setOfflineLoginAvailable(true);
          console.log(
            `Offline login available - last login was ${daysSinceLastLogin.toFixed(1)} days ago`,
          );
        } else {
          setOfflineLoginAvailable(false);
          console.log(
            `Offline login expired - last login was ${daysSinceLastLogin.toFixed(1)} days ago`,
          );
        }
      } else {
        setOfflineLoginAvailable(false);
      }
    } catch (error) {
      console.error("Error checking offline login availability:", error);
      setOfflineLoginAvailable(false);
    } finally {
      setCheckingOfflineLogin(false);
    }
  };

  const checkTokenStorageHealth = async () => {
    setIsCheckingStorage(true);
    try {
      // Check for token consistency issues between AsyncStorage and SecureStore
      const tokenInfo = await getTokenDebugInfo();

      if (
        tokenInfo &&
        (tokenInfo.issues.accessTokenMismatch ||
          tokenInfo.issues.refreshTokenMissing ||
          tokenInfo.issues.refreshTokenMismatch ||
          (tokenInfo.issues.asyncAccessMissing &&
            !tokenInfo.issues.secureAccessMissing) ||
          (tokenInfo.issues.secureAccessMissing &&
            !tokenInfo.issues.asyncAccessMissing))
      ) {
        console.log(
          "Token storage inconsistencies detected, attempting repair...",
        );
        await repairTokenIssues();
      }
    } catch (error) {
      console.error("Error checking token storage:", error);
    } finally {
      setIsCheckingStorage(false);
    }
  };

  // Validation functions
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^(\+91)?[0-9]{10}$/;
    return phoneRegex.test(phone);
  };

  const validatePassword = (pwd: string) => {
    return pwd.length >= 6; // Minimum password length
  };

  const handleIdentifierChange = (text: string) => {
    let formattedText = text;
    if (/^\d+$/.test(text.replace("+91", ""))) {
      // Phone number input
      setIdentifierType("phone");
      if (!text.startsWith("+91")) {
        formattedText = "+91" + text;
      }
      setIsValidIdentifier(validatePhone(formattedText));
    } else {
      // Email input
      setIdentifierType("email");
      setIsValidIdentifier(validateEmail(text));
    }
    setIdentifier(formattedText);
    setError(null);
  };

  const resetStorageAndLogout = async () => {
    try {
      // Clear all storage
      await Promise.all([
        // Clear AsyncStorage
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
        AsyncStorage.removeItem(LAST_ONLINE_LOGIN_KEY),
        AsyncStorage.clear(),
        // Clear SecureStore
        SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_DATA_KEY),
      ]);
      Alert.alert(
        "Storage Reset",
        "Your login data has been reset. Please try signing in again.",
        [{ text: "OK" }],
      );
      setOfflineLoginAvailable(false);
    } catch (error) {
      console.error("Error clearing storage:", error);
      Alert.alert(
        "Error",
        "Failed to reset storage. Please try again or restart the app.",
      );
    }
  };

  const handleOfflineLogin = async () => {
    if (!offlineLoginAvailable) {
      setError({
        message: "Offline login unavailable",
        type: "OFFLINE_UNAVAILABLE",
        details:
          "You need to sign in at least once with an internet connection.",
      });
      return;
    }

    Keyboard.dismiss();

    try {
      // Just trigger the AuthContext initialization which will handle offline auth
      // This is a hack, but it works because AuthContext will pick up the locally stored credentials
      router.replace("/");
    } catch (error) {
      console.error("Offline login failed:", error);
      setError({
        message: "Failed to authenticate offline",
        type: "OFFLINE_ERROR",
        details: "There was a problem with your stored credentials.",
      });
    }
  };

  const handleSignIn = async () => {
    setError(null);
    Keyboard.dismiss();
    await checkNetworkStatus();

    // Network connectivity check
    if (
      !networkStatus.isConnected ||
      networkStatus.isInternetReachable === false
    ) {
      // If we have offline login available, show a different error with option
      if (offlineLoginAvailable) {
        setError({
          message: "Unable to connect to server",
          type: "OFFLINE_AVAILABLE",
          details: "You can sign in with your saved credentials.",
        });
      } else {
        setError({
          message: "Unable to connect to server",
          type: "NETWORK_ERROR",
          details: "Please check your internet connection and try again",
        });
      }
      return;
    }

    // Validate inputs
    if (!identifier || !password) {
      setError({
        message: "Please enter both email/phone and password",
        type: "VALIDATION",
      });
      return;
    }

    if (!isValidIdentifier) {
      setError({
        message: `Invalid ${identifierType || "email/phone"}`,
        type: "VALIDATION",
        details:
          identifierType === "phone"
            ? "Phone number must be a 10-digit number with country code (+91)"
            : "Please enter a valid email address",
      });
      return;
    }

    if (!validatePassword(password)) {
      setError({
        message: "Invalid password",
        type: "VALIDATION",
        details: "Password must be at least 6 characters long",
      });
      return;
    }

    try {
      console.log("Attempting login with identifier:", identifier);
      console.log("API URL:", API_URL);

      // Use the login function from AuthContext which now handles MFA
      // Convert email to lowercase for case-insensitive matching (backend expects lowercase)
      const normalizedIdentifier = identifier.includes("@")
        ? identifier.toLowerCase().trim()
        : identifier.trim();
      const result = await login(normalizedIdentifier, password);

      if (result.error) {
        console.log("Login error:", result.error, "Type:", result.errorType);

        // Handle MFA requirement
        if (result.errorType === "MFA_REQUIRED") {
          setMfaSessionId(result.sessionId || "");
          setMfaEmail(result.email || "");
          setShowMFA(true);
          setError(null);
          return;
        }

        // Handle known error types
        switch (result.errorType) {
          case "COMPANY_DISABLED":
            setError({
              message: result.error,
              type: result.errorType,
              details: "Please contact your administrator for assistance",
            });
            Alert.alert("Account Disabled", result.error, [{ text: "OK" }]);
            break;

          case "INVALID_CREDENTIALS":
            setError({
              message: result.error,
              type: result.errorType,
              details:
                "Please check your email/phone and password and try again",
            });
            break;

          case "TOKEN_STORAGE_ISSUE":
            setError({
              message: "Login data storage issue detected",
              type: result.errorType,
              details:
                "We found some inconsistencies in your login data storage. Would you like to reset it?",
            });
            Alert.alert(
              "Storage Issue Detected",
              "We found some inconsistencies in your login data storage. Would you like to reset it?",
              [
                {
                  text: "Reset & Try Again",
                  onPress: resetStorageAndLogout,
                },
                {
                  text: "Cancel",
                  style: "cancel",
                },
              ],
            );
            break;

          case "SERVER_ERROR":
            setError({
              message: "Server error",
              type: result.errorType,
              details:
                "Our servers are experiencing issues. Please try again later.",
            });
            break;

          case "NETWORK_ERROR":
            // If offline login is available, show that as an option
            if (offlineLoginAvailable) {
              setError({
                message: "Network error",
                type: "OFFLINE_AVAILABLE",
                details:
                  "Unable to connect to server. You can sign in offline with your saved credentials.",
              });
            } else {
              setError({
                message: "Network error",
                type: result.errorType,
                details:
                  "Unable to connect to server. Please check your internet connection.",
              });
            }
            break;

          default:
            setError({
              message: result.error,
              type: result.errorType || "UNKNOWN",
              details:
                "Please try again or contact support if the issue persists",
            });
        }
      } else {
        console.log("Login successful, no errors");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        responseData: error.response?.data,
      });
      console.error("Sign in error:", error);

      // Handle various error types
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          setError({
            message: "Request timed out",
            type: "TIMEOUT_ERROR",
            details: "The server took too long to respond. Please try again.",
          });
        } else if (!error.response) {
          // If offline login is available, show that as an option
          if (offlineLoginAvailable) {
            setError({
              message: "Network error",
              type: "OFFLINE_AVAILABLE",
              details:
                "Unable to connect to server. You can sign in offline with your saved credentials.",
            });
          } else {
            setError({
              message: "Network error",
              type: "NETWORK_ERROR",
              details:
                "Unable to connect to server. Please check your internet connection.",
            });
          }
        } else {
          // Server returned an error
          const statusCode = error.response.status;
          const serverError =
            error.response.data?.error || error.response.data?.message;

          switch (statusCode) {
            case 401:
              setError({
                message: "Invalid credentials",
                type: "INVALID_CREDENTIALS",
                details: "The email/phone or password you entered is incorrect",
              });
              break;
            case 403:
              setError({
                message: "Access denied",
                type: "ACCESS_DENIED",
                details:
                  serverError ||
                  "You do not have permission to access this resource",
              });
              break;
            case 404:
              setError({
                message: "Resource not found",
                type: "NOT_FOUND",
                details: "The requested resource was not found",
              });
              break;
            case 429:
              setError({
                message: "Too many attempts",
                type: "RATE_LIMIT",
                details: "Please wait a moment before trying again",
              });
              break;
            case 500:
            case 502:
            case 503:
            case 504:
              setError({
                message: "Server error",
                type: "SERVER_ERROR",
                details:
                  "Our servers are experiencing issues. Please try again later.",
              });
              break;
            default:
              setError({
                message: serverError || "An error occurred",
                type: "API_ERROR",
                details:
                  "Please try again or contact support if the issue persists",
              });
          }
        }
      } else if (error instanceof SyntaxError) {
        setError({
          message: "Invalid response format",
          type: "PARSE_ERROR",
          details: "The server returned an invalid response. Please try again.",
        });
      } else if (error instanceof TypeError) {
        // Handle platform-specific errors
        if (Platform.OS === "web" && error.message.includes("localStorage")) {
          setError({
            message: "Storage access error",
            type: "WEB_STORAGE_ERROR",
            details:
              "Please ensure cookies and local storage are enabled in your browser",
          });
        } else {
          setError({
            message: "Application error",
            type: "TYPE_ERROR",
            details: "An unexpected error occurred. Please try again.",
          });
        }
      } else {
        // Generic error fallback
        setError({
          message: "Sign in failed",
          type: "UNKNOWN",
          details:
            error.message || "An unexpected error occurred. Please try again.",
        });
      }
    }
  };

  // MFA verification handlers
  const handleMFASuccess = async (tokens: {
    accessToken: string;
    refreshToken: string;
    user: any;
  }) => {
    try {
      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, tokens.accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(tokens.user)),
        AsyncStorage.setItem(LAST_ONLINE_LOGIN_KEY, Date.now().toString()),
      ]);

      // Also store in SecureStore for better security
      if (Platform.OS !== "web") {
        try {
          await Promise.all([
            SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokens.accessToken),
            SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
            SecureStore.setItemAsync(
              USER_DATA_KEY,
              JSON.stringify(tokens.user),
            ),
          ]);
        } catch (secureError) {
          console.error("Error storing in SecureStore:", secureError);
        }
      }

      // Navigate to appropriate dashboard
      switch (tokens.user.role) {
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
    } catch (error) {
      console.error("Error handling MFA success:", error);
      setError({
        message: "Failed to complete login",
        type: "MFA_ERROR",
        details: "Please try again",
      });
    }
  };

  const handleMFABack = () => {
    setShowMFA(false);
    setMfaSessionId("");
    setMfaEmail("");
    setError(null);
  };

  // Mount animation
  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  });

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  // Show loading screen while AuthContext is initializing
  if (isLoading) {
    return (
      <>
        <StatusBar
          barStyle={theme === "dark" ? "light-content" : "dark-content"}
          backgroundColor={currentColors.background}
        />
        <View
          style={{
            flex: 1,
            backgroundColor: currentColors.background,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color={currentColors.primary} />
          <Text
            style={{
              marginTop: 16,
              fontSize: 16,
              color: currentColors.text,
              fontWeight: "500",
            }}
          >
            Checking authentication...
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={currentColors.background}
      />

      {/* Show MFA verification if needed */}
      {showMFA ? (
        <MFAVerification
          email={mfaEmail}
          sessionId={mfaSessionId}
          onVerificationSuccess={handleMFASuccess}
          onBack={handleMFABack}
        />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={Keyboard.dismiss}
            style={{
              flex: 1,
            }}
          >
            {/* Main background */}
            <View
              style={{
                flex: 1,
                backgroundColor: currentColors.background,
              }}
            >
              {/* Subtle gradient overlay */}
              <LinearGradient
                colors={[
                  currentColors.background,
                  theme === "dark"
                    ? "rgba(59, 130, 246, 0.05)"
                    : "rgba(59, 130, 246, 0.02)",
                  currentColors.background,
                ]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />

              {/* Floating geometric shapes */}
              <View
                style={{ position: "absolute", width: "100%", height: "100%" }}
              >
                {/* Blue circle */}
                <Animated.View
                  style={{
                    position: "absolute",
                    top: height * 0.1,
                    right: width * 0.1,
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: currentColors.primary,
                    opacity: 0.15,
                    transform: [{ translateY: floatingOffset }],
                  }}
                />

                {/* Sky square */}
                <Animated.View
                  style={{
                    position: "absolute",
                    bottom: height * 0.3,
                    left: width * 0.1,
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: currentColors.secondary,
                    opacity: 0.2,
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
                    top: height * 0.7,
                    right: width * 0.2,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 20,
                    borderRightWidth: 20,
                    borderBottomWidth: 35,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderBottomColor: currentColors.accent,
                    opacity: 0.1,
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

              <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
                keyboardDismissMode="interactive"
              >
                <Animated.View
                  style={{
                    flex: 1,
                    padding: 24,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }}
                >
                  {/* Logo Section */}
                  <View
                    style={{
                      alignItems: "center",
                      marginTop: 60,
                      marginBottom: 40,
                    }}
                  >
                    {/* Glow effect */}
                    <View
                      style={{
                        position: "absolute",
                        width: 200,
                        height: 200,
                        borderRadius: 100,
                        backgroundColor: currentColors.primary,
                        opacity: 0.2,
                        transform: [{ scale: 1.2 }],
                      }}
                    />

                    {/* Main logo container */}
                    <View
                      style={{
                        width: 140,
                        height: 140,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 70,
                        backgroundColor: currentColors.surface,
                        marginBottom: 24,
                        shadowColor: currentColors.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.2,
                        shadowRadius: 16,
                        elevation: 8,
                        borderWidth: 3,
                        borderColor: currentColors.primary,
                      }}
                    >
                      <Image
                        source={require("../../assets/images/adaptive-icon.png")}
                        style={{
                          width: 100,
                          height: 100,
                        }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 32,
                        fontWeight: "800",
                        color: currentColors.text,
                        marginBottom: 8,
                        textShadowColor:
                          theme === "dark"
                            ? "rgba(0, 0, 0, 0.5)"
                            : "rgba(255, 255, 255, 0.8)",
                        textShadowOffset: { width: 0, height: 2 },
                        textShadowRadius: 4,
                        letterSpacing: 1,
                      }}
                    >
                      Welcome Back
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        color: currentColors.textSecondary,
                        textAlign: "center",
                        letterSpacing: 0.5,
                        fontWeight: "500",
                      }}
                    >
                      Sign in to continue to Avy Tracker
                    </Text>
                  </View>

                  {/* Network Status Indicator */}
                  {(!networkStatus.isConnected ||
                    networkStatus.isInternetReachable === false) && (
                      <View
                        style={[
                          styles.networkErrorContainer,
                          {
                            backgroundColor:
                              theme === "dark"
                                ? "rgba(239, 68, 68, 0.1)"
                                : "rgba(239, 68, 68, 0.05)",
                            borderColor: currentColors.error,
                          },
                        ]}
                      >
                        <Ionicons
                          name="wifi"
                          size={24}
                          color={currentColors.error}
                        />
                        <Text
                          style={[
                            styles.networkErrorText,
                            { color: currentColors.error },
                          ]}
                        >
                          No internet connection.{" "}
                          {offlineLoginAvailable ? "Offline login available." : ""}
                        </Text>
                      </View>
                    )}

                  {/* Offline Mode Banner */}
                  {isOffline && (
                    <View
                      style={[
                        styles.offlineBanner,
                        {
                          backgroundColor:
                            theme === "dark"
                              ? "rgba(239, 68, 68, 0.1)"
                              : "rgba(239, 68, 68, 0.05)",
                          borderColor: currentColors.error,
                        },
                      ]}
                    >
                      <Ionicons
                        name="cloud-offline"
                        size={22}
                        color={currentColors.error}
                      />
                      <Text
                        style={[
                          styles.offlineBannerText,
                          { color: currentColors.error },
                        ]}
                      >
                        App is in offline mode. Some features may be limited.
                      </Text>
                    </View>
                  )}

                  {/* Form Section */}
                  <Animated.View
                    style={{
                      transform: [{ translateX: inputFocusAnim }],
                    }}
                  >
                    {/* Show offline login option if available */}
                    {offlineLoginAvailable &&
                      (!networkStatus.isConnected ||
                        networkStatus.isInternetReachable === false) && (
                        <TouchableOpacity
                          style={[
                            styles.offlineLoginButton,
                            {
                              backgroundColor:
                                theme === "dark"
                                  ? "rgba(59, 130, 246, 0.2)"
                                  : "rgba(59, 130, 246, 0.1)",
                              borderColor: currentColors.primary,
                            },
                          ]}
                          onPress={handleOfflineLogin}
                        >
                          <Ionicons
                            name="cloud-offline-outline"
                            size={24}
                            color={currentColors.primary}
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={[
                              styles.offlineLoginButtonText,
                              { color: currentColors.primary },
                            ]}
                          >
                            Continue with Saved Credentials
                          </Text>
                        </TouchableOpacity>
                      )}

                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          marginBottom: 8,
                          color: currentColors.text,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Email or Phone Number
                      </Text>
                      <TextInput
                        value={identifier}
                        onChangeText={handleIdentifierChange}
                        keyboardType={
                          identifierType === "phone"
                            ? "phone-pad"
                            : "email-address"
                        }
                        autoCapitalize="none"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        style={{
                          backgroundColor: currentColors.inputBackground,
                          padding: 16,
                          borderRadius: 12,
                          color: currentColors.text,
                          borderWidth: 2,
                          borderColor: isValidIdentifier
                            ? currentColors.inputBorderSuccess
                            : identifier
                              ? currentColors.inputBorderError
                              : currentColors.inputBorder,
                          shadowColor: currentColors.primary,
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                        placeholderTextColor={currentColors.textSecondary}
                        placeholder="Enter your email or phone"
                      />
                      {identifier && (
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: isValidIdentifier
                              ? currentColors.success
                              : currentColors.error,
                          }}
                        >
                          {isValidIdentifier
                            ? `Valid ${identifierType}`
                            : `Invalid ${identifierType || "format"}`}
                        </Text>
                      )}
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          marginBottom: 8,
                          color: currentColors.text,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Password
                      </Text>
                      <View style={{ position: "relative" }}>
                        <TextInput
                          value={password}
                          onChangeText={(text) => {
                            setPassword(text);
                            setError(null);
                          }}
                          secureTextEntry={!showPassword}
                          returnKeyType="done"
                          onSubmitEditing={handleSignIn}
                          style={{
                            backgroundColor: currentColors.inputBackground,
                            padding: 16,
                            paddingRight: 48,
                            borderRadius: 12,
                            color: currentColors.text,
                            borderWidth: 2,
                            borderColor: currentColors.inputBorder,
                            shadowColor: currentColors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                          }}
                          placeholderTextColor={currentColors.textSecondary}
                          placeholder="Enter your password"
                        />
                        <TouchableOpacity
                          onPress={() => setShowPassword(!showPassword)}
                          style={{
                            position: "absolute",
                            right: 16,
                            top: 16,
                            backgroundColor:
                              theme === "dark"
                                ? "rgba(40,40,48,0.85)"
                                : "rgba(255,255,255,0.85)",
                            borderRadius: 16,
                            padding: 4,
                            shadowColor: theme === "dark" ? "#000" : "#444",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.18,
                            shadowRadius: 2,
                            elevation: 3,
                          }}
                          accessible
                          accessibilityLabel={
                            showPassword ? "Hide password" : "Show password"
                          }
                          accessibilityRole="button"
                          testID="toggle-password-visibility"
                        >
                          <Ionicons
                            name={showPassword ? "eye-off" : "eye"}
                            size={22}
                            color={
                              theme === "dark"
                                ? "#FFFFFF"
                                : "#22223A"
                            }
                            style={{ opacity: 0.92 }}
                          />
                        </TouchableOpacity>
                      </View>
                      {password && !validatePassword(password) && (
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: currentColors.error,
                          }}
                        >
                          Password must be at least 6 characters
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push("/(auth)/forgot-password")}
                      style={{ alignSelf: "flex-end", marginBottom: 24 }}
                    >
                      <Text
                        style={{
                          color: currentColors.secondary,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        Forgot Password?
                      </Text>
                    </TouchableOpacity>

                    {error && (
                      <View
                        style={[
                          styles.errorContainer,
                          error.type === "COMPANY_DISABLED"
                            ? styles.companyDisabledError
                            : error.type === "NETWORK_ERROR"
                              ? styles.networkError
                              : error.type === "SERVER_ERROR"
                                ? styles.serverError
                                : error.type === "OFFLINE_AVAILABLE"
                                  ? styles.offlineAvailableError
                                  : styles.generalError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.errorText,
                            { color: currentColors.error },
                          ]}
                        >
                          {error.message}
                        </Text>
                        {error.details && (
                          <Text
                            style={[
                              styles.errorSubText,
                              { color: currentColors.textSecondary },
                            ]}
                          >
                            {error.details}
                          </Text>
                        )}
                        {error.type === "TOKEN_STORAGE_ISSUE" && (
                          <TouchableOpacity
                            style={[
                              styles.errorActionButton,
                              { backgroundColor: currentColors.error },
                            ]}
                            onPress={resetStorageAndLogout}
                          >
                            <Text style={styles.errorActionButtonText}>
                              Reset Storage
                            </Text>
                          </TouchableOpacity>
                        )}
                        {error.type === "OFFLINE_AVAILABLE" && (
                          <TouchableOpacity
                            style={[
                              styles.offlineActionButton,
                              { backgroundColor: currentColors.secondary },
                            ]}
                            onPress={handleOfflineLogin}
                          >
                            <Text style={styles.offlineActionButtonText}>
                              Continue Offline
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={handleSignIn}
                      disabled={isLoading || isCheckingStorage}
                      style={{
                        backgroundColor: currentColors.primary,
                        paddingVertical: 16,
                        paddingHorizontal: 32,
                        borderRadius: 16,
                        opacity: isLoading || isCheckingStorage ? 0.7 : 1,
                        shadowColor: currentColors.primary,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8,
                        borderWidth: 2,
                        borderColor: currentColors.secondary,
                      }}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={currentColors.surface} />
                      ) : isCheckingStorage ? (
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <ActivityIndicator
                            color={currentColors.surface}
                            size="small"
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={{
                              color: currentColors.surface,
                              textAlign: "center",
                              fontSize: 16,
                              fontWeight: "bold",
                              letterSpacing: 0.5,
                            }}
                          >
                            Preparing...
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={{
                            color: currentColors.surface,
                            textAlign: "center",
                            fontSize: 18,
                            fontWeight: "bold",
                            letterSpacing: 0.5,
                          }}
                        >
                          Sign In
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Storage health checker button */}
                    <TouchableOpacity
                      onPress={resetStorageAndLogout}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        marginTop: 16,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        backgroundColor:
                          theme === "dark"
                            ? "rgba(59, 130, 246, 0.1)"
                            : "rgba(59, 130, 246, 0.05)",
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: currentColors.primary,
                        maxWidth: "80%",
                      }}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={16}
                        color={currentColors.primary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={{
                          color: currentColors.primary,
                          fontSize: 12,
                          fontWeight: "500",
                          textAlign: "center",
                        }}
                      >
                        Reset App Data
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    width: "100%",
    borderWidth: 1,
  },
  generalError: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "#EF4444",
  },
  companyDisabledError: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "#DC2626",
  },
  networkError: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "#F59E0B",
  },
  serverError: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderColor: "#3B82F6",
  },
  offlineAvailableError: {
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderColor: "#0EA5E9",
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  errorSubText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 16,
  },
  errorActionButton: {
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: "center",
  },
  errorActionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  offlineActionButton: {
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: "center",
  },
  offlineActionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  networkErrorContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  networkErrorText: {
    fontSize: 13,
    marginLeft: 8,
    fontWeight: "500",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  offlineBannerText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: "500",
  },
  offlineLoginButton: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  offlineLoginButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
