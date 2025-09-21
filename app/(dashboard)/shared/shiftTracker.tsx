import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Animated,
  Easing,
  Alert,
  InteractionManager,
  Platform,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format, differenceInSeconds } from "date-fns";
import axios from "axios";
import AuthContext from "../../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { useGeofencing } from "../../hooks/useGeofencing";
import useLocationStore from "../../store/locationStore";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { Location as AppLocation } from "../../types/liveTracking";
import { AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import new components
import FaceVerificationModal from "../../components/FaceVerificationModal";
import OTPVerification from "../../components/OTPVerification";
import VerificationOrchestrator from "../../components/VerificationOrchestrator";
import LiveTrackingMap from "../shared/components/map/LiveTrackingMap";

// Import deep link utilities
import { promptFaceConfiguration } from "../../utils/deepLinkUtils";

// Import types - define locally since verification types may not be exported
interface FaceVerificationResult {
  success: boolean;
  confidence?: number;
  error?: string;
  imageData?: string;
}

interface ShiftData {
  date: string;
  startTime: string;
  endTime: string | null;
  duration: string | null;
}

interface ShiftStatus {
  isActive: boolean;
  startTime: string | null;
}

interface RecentShift {
  id: number;
  start_time: string;
  end_time: string | null;
  duration: string;
  date: string;
}

interface WarningMessage {
  title: string;
  message: string;
}

interface VerificationState {
  faceVerificationRequired: boolean;
  locationVerificationRequired: boolean;
  verificationInProgress: boolean;
  verificationResults: {
    face: FaceVerificationResult | null;
    location: LocationResult | null;
  };
  currentStep: "location" | "face" | "complete";
  retryCount: number;
  maxRetries: number;
  canOverride: boolean;
  overrideReason?: string;
}

interface LocationResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  isInGeofence?: boolean;
  geofenceName?: string;
  error?: string;
  confidence?: number;
}

interface OfflineVerificationData {
  id: string;
  timestamp: number;
  shiftAction: "start" | "end";
  faceVerification?: FaceVerificationResult;
  locationVerification?: LocationResult;
  userId: number;
  synced: boolean;
}

// Add notification-related constants
const SHIFT_WARNING_TIME_MS = 8 * 60 * 60 * 1000 + 55 * 60 * 1000; // 8 hours 55 minutes in milliseconds
const SHIFT_LIMIT_TIME_MS = 9 * 60 * 60 * 1000; // 9 hours in milliseconds

const NOTIFICATION_CHANNELS = {
  ACTIVE_SHIFT: "active-shift",
  SHIFT_WARNING: "shift-warning",
  SHIFT_LIMIT: "shift-limit",
} as const;

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Add these warning messages array before the component
const warningMessages: WarningMessage[] = [
  {
    title: "Important Shift Notice",
    message:
      "Please start and end your shifts properly on time. Never forget to end your shift before leaving.",
  },
  {
    title: "Warning",
    message:
      "Do not logout or uninstall the app without ending your active shift first.",
  },
];

// Update the combined warning message format to include titles
const combinedWarningMessage = {
  title: "Important Notices",
  notices: warningMessages.map((msg) => ({
    title: msg.title,
    message: msg.message,
  })),
};

// Update the TimerPicker component with manual time selection
const TimerPicker = ({
  visible,
  onClose,
  onSelectHours,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectHours: (hours: number) => void;
  isDark: boolean;
}) => {
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");

  const handleManualSubmit = () => {
    const hours = parseFloat(manualHours) || 0;
    const minutes = parseFloat(manualMinutes) || 0;
    const totalHours = hours + minutes / 60;

    if (totalHours <= 0) {
      Alert.alert("Invalid Time", "Please enter a valid duration");
      return;
    }

    if (totalHours > 24) {
      Alert.alert("Invalid Duration", "Duration cannot exceed 24 hours");
      return;
    }

    onSelectHours(totalHours);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className={`m-5 p-6 rounded-xl ${
            isDark ? "bg-gray-800" : "bg-white"
          } w-5/6`}
        >
          <Text
            className={`text-xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Set Shift Duration
          </Text>

          {/* Preset durations */}
          <Text
            className={`text-sm font-medium mb-2 ${
              isDark ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Preset Durations
          </Text>
          <View className="flex-row flex-wrap justify-between gap-2 mb-4">
            {[4, 6, 8, 9, 10, 12].map((hours) => (
              <TouchableOpacity
                key={hours}
                onPress={() => onSelectHours(hours)}
                className={`p-4 rounded-lg mb-2 w-[48%] ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {hours} Hours
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual time selection */}
          <View className="mt-4">
            <Text
              className={`text-sm font-medium mb-2 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Custom Duration
            </Text>
            <View className="flex-row justify-between items-center gap-2">
              <View className="flex-1">
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Hours
                </Text>
                <TextInput
                  value={manualHours}
                  onChangeText={(text) =>
                    setManualHours(text.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${
                    isDark
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Minutes
                </Text>
                <TextInput
                  value={manualMinutes}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!text || (num >= 0 && num < 60)) {
                      setManualMinutes(text.replace(/[^0-9]/g, ""));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="0"
                  className={`p-3 rounded-lg ${
                    isDark
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                />
              </View>
              <TouchableOpacity
                onPress={handleManualSubmit}
                className="bg-blue-500 p-3 rounded-lg mt-4"
              >
                <Text className="text-white font-semibold">Set</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="mt-6 p-4 rounded-lg bg-gray-500"
          >
            <Text className="text-white text-center font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Add this helper function at the top level
const getApiEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee";
    case "group-admin":
      return "/api/group-admin";
    case "management":
      return "/api/management";
    default:
      return "/api/employee";
  }
};

// Add this helper function for role-specific titles
const getRoleSpecificTitle = (role: string) => {
  switch (role) {
    case "employee":
      return "Employee Shift Tracker";
    case "group-admin":
      return "Group Admin Shift Tracker";
    case "management":
      return "Management Shift Tracker";
    default:
      return "Shift Tracker";
  }
};

// Format elapsed time from seconds to hours and minutes
const formatElapsedTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

// Add this function to format coordinates for display
const formatCoordinates = (latitude?: number, longitude?: number) => {
  if (latitude === undefined || longitude === undefined) return "Unknown";
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

// Rate limiting for Nominatim API
let lastRequestTime = 0;
const REQUEST_INTERVAL = 1000; // 1 second between requests

// Enhanced function to get address from coordinates using OpenStreetMap Nominatim API
const getLocationAddress = async (
  latitude: number,
  longitude: number,
): Promise<string> => {
  try {
    // Check if we have valid coordinates
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.log("Invalid coordinates provided for geocoding");
      return "Unknown Location";
    }

    // Rate limiting: ensure we don't make requests too frequently
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < REQUEST_INTERVAL) {
      await new Promise((resolve) =>
        setTimeout(resolve, REQUEST_INTERVAL - timeSinceLastRequest),
      );
    }
    lastRequestTime = Date.now();

    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`,
      {
        headers: {
          "User-Agent":
            "AvyTracker/1.0 (com.avyren.avytracker; contact@avyren.com)",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.display_name) {
      // Extract address components from Nominatim response
      const address = data.address || {};

      // Build concise address from available components
      const addressParts = [];

      // Try to get street-level information first
      if (address.house_number && address.road) {
        addressParts.push(`${address.house_number} ${address.road}`);
      } else if (address.road) {
        addressParts.push(address.road);
      } else if (address.pedestrian) {
        addressParts.push(address.pedestrian);
      } else if (address.footway) {
        addressParts.push(address.footway);
      }

      // Add locality information
      if (address.city) {
        addressParts.push(address.city);
      } else if (address.town) {
        addressParts.push(address.town);
      } else if (address.village) {
        addressParts.push(address.village);
      } else if (address.hamlet) {
        addressParts.push(address.hamlet);
      } else if (address.suburb) {
        addressParts.push(address.suburb);
      }

      // Add administrative area
      if (address.state) {
        addressParts.push(address.state);
      } else if (address.county) {
        addressParts.push(address.county);
      } else if (address.region) {
        addressParts.push(address.region);
      }

      // Return concise address if we have components
      if (addressParts.length > 0) {
        return addressParts.join(", ");
      }

      // Fallback to display_name if no components found
      const displayName = data.display_name;
      if (displayName) {
        // Split by comma and take first 2 parts for brevity
        const parts = displayName.split(",").map((part: string) => part.trim());
        return parts.slice(0, 2).join(", ");
      }
    }

    // Fallback to coordinates if geocoding fails
    console.log("No geocoding results found, using coordinates");
    return formatCoordinates(latitude, longitude);
  } catch (error) {
    console.error("Error getting address:", error);

    // Provide more specific error handling
    if (error instanceof Error) {
      if (error.message.includes("HTTP error")) {
        console.log("Nominatim API error, using coordinates fallback");
      } else if (error.message.includes("fetch")) {
        console.log(
          "Network error during geocoding, using coordinates fallback",
        );
      }
    }

    // Always fallback to coordinates
    return formatCoordinates(latitude, longitude);
  }
};

const getNotificationEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee-notifications/notify-admin";
    case "group-admin":
      return "/api/group-admin-notifications/notify-admin";
    default:
      return "/api/employee-notifications/notify-admin";
  }
};

// Add a custom InAppNotification component
const InAppNotification = ({
  visible,
  message,
  type = "info",
  duration = 5000,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  duration?: number;
  onDismiss: () => void;
}) => {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onDismiss();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, opacity, onDismiss]);

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case "success":
        return isDark ? "#065f46" : "#10b981";
      case "warning":
        return isDark ? "#92400e" : "#f59e0b";
      case "error":
        return isDark ? "#991b1b" : "#ef4444";
      default:
        return isDark ? "#1e40af" : "#3b82f6";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return "checkmark-circle";
      case "warning":
        return "warning";
      case "error":
        return "alert-circle";
      default:
        return "information-circle";
    }
  };

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: Platform.OS === "ios" ? 50 : 20,
          left: 16,
          right: 16,
          backgroundColor: getBackgroundColor(),
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
          zIndex: 9999,
          opacity,
        },
      ]}
    >
      <Ionicons name={getIcon()} size={24} color="#fff" />
      <Text
        style={{
          color: "#fff",
          marginLeft: 10,
          flex: 1,
          fontSize: 14,
          fontWeight: "500",
        }}
      >
        {message}
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Add this function to safely access battery level
const getBatteryLevel = (location: any): number | undefined => {
  if (!location) return undefined;

  // Check if batteryLevel exists directly on the location object
  if (typeof location.batteryLevel === "number") {
    return location.batteryLevel;
  }

  // Check if battery exists directly on the location object (some implementations use this)
  if (typeof location.battery === "number") {
    return location.battery;
  }

  return undefined;
};

// Create a helper function to convert EnhancedLocation to Location
// Add this after the formatCoordinates function (around line 90)
const convertToLocation = (enhancedLocation: any): AppLocation | null => {
  if (!enhancedLocation) return null;

  // If it already has the format of our Location type
  if (typeof enhancedLocation.latitude === "number") {
    return enhancedLocation as AppLocation;
  }

  // If it has coords structure (EnhancedLocation), extract needed properties
  if (enhancedLocation.coords) {
    return {
      latitude: enhancedLocation.coords.latitude,
      longitude: enhancedLocation.coords.longitude,
      accuracy: enhancedLocation.coords.accuracy || null,
      altitude: enhancedLocation.coords.altitude || null,
      altitudeAccuracy: enhancedLocation.coords.altitudeAccuracy || null,
      heading: enhancedLocation.coords.heading || null,
      speed: enhancedLocation.coords.speed || null,
      timestamp: enhancedLocation.timestamp || Date.now(),
      batteryLevel: enhancedLocation.batteryLevel,
      isMoving: enhancedLocation.isMoving,
    };
  }

  return null;
};

export default function EmployeeShiftTracker() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Helper function to handle back navigation with fallback to role-specific dashboard
  const handleBackNavigation = () => {
    // Check if we can go back by checking the navigation state
    // If we're on the first screen (shiftTracker as landing page), navigate to dashboard
    const canGoBack = router.canGoBack();
    
    if (canGoBack) {
      router.back();
    } else {
      // No back history available, navigate to role-specific dashboard
      console.log("No back history available, navigating to role-specific dashboard");
      navigateToDashboard();
    }
  };

  // Helper function to navigate to role-specific dashboard
  const navigateToDashboard = () => {
    switch (user?.role) {
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
        // Fallback to employee dashboard if role is unknown
        router.replace("/(dashboard)/employee/employee");
        break;
    }
  };

  // Animated values
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const spinValue = React.useRef(new Animated.Value(0)).current;

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      // If we can go back normally, do that
      if (router.canGoBack()) {
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we're on the landing page, navigate to dashboard instead of closing app
        console.log("Android back button pressed - navigating to dashboard");
        navigateToDashboard();
        return true; // Prevent default behavior (closing app)
      }
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [user?.role]);
  const [addressRefreshAnim] = useState(new Animated.Value(0));

  // State
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isShiftStatusLoading, setIsShiftStatusLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [shiftHistory, setShiftHistory] = useState<ShiftData[]>([]);
  // Add state for currentAddress
  const [currentAddress, setCurrentAddress] = useState<string>(
    "Acquiring location...",
  );
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    message: string;
    type: "success" | "info";
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    title: "",
    message: "",
    type: "info",
    showCancel: false,
  });
  const [recentShifts, setRecentShifts] = useState<RecentShift[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [timerDuration, setTimerDuration] = useState<number | null>(null);
  const [timerEndTime, setTimerEndTime] = useState<Date | null>(null);
  const [currentWarningIndex, setCurrentWarningIndex] = useState(-1);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  // Add geofence validation state
  const [locationValidated, setLocationValidated] = useState(false);
  const [showLocationError, setShowLocationError] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState("");
  const [isLocationServiceEnabled, setIsLocationServiceEnabled] =
    useState(true);
  const [locationWatchId, setLocationWatchId] = useState<string | null>(null);
  const [locationOffTimer, setLocationOffTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [inAppNotification, setInAppNotification] = useState<{
    visible: boolean;
    message: string;
    type: "info" | "warning" | "error" | "success";
  }>({
    visible: false,
    message: "",
    type: "info",
  });
  const [locationCheckInterval, setLocationCheckInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [isAddressRefreshing, setIsAddressRefreshing] = useState(false);

  // Add button debouncing state and cooldown
  const [isProcessingShift, setIsProcessingShift] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [shiftCooldownUntil, setShiftCooldownUntil] = useState<Date | null>(
    null,
  );
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState(0);

  // Face verification state
  const [showFaceVerificationModal, setShowFaceVerificationModal] =
    useState(false);
  const [faceVerificationMode, setFaceVerificationMode] = useState<
    "register" | "verify"
  >("verify");
  const [verificationState, setVerificationState] = useState<VerificationState>(
    {
      faceVerificationRequired: false,
      locationVerificationRequired: false,
      verificationInProgress: false,
      verificationResults: {
        face: null,
        location: null,
      },
      currentStep: "location",
      retryCount: 0,
      maxRetries: 3,
      canOverride: false,
    },
  );

  // Enhanced verification orchestrator state
  const [showVerificationOrchestrator, setShowVerificationOrchestrator] =
    useState(false);
  const [pendingShiftAction, setPendingShiftAction] = useState<
    "start" | "end" | null
  >(null);
  const [verificationConfig, setVerificationConfig] = useState({
    requireLocation: true,
    requireFace: true,
    allowLocationFallback: true,
    allowFaceFallback: true,
    maxRetries: 3,
    timeoutMs: 30000,
    confidenceThreshold: 0.7,
  });
  const [showManagerOverride, setShowManagerOverride] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [offlineVerificationQueue, setOfflineVerificationQueue] = useState<
    OfflineVerificationData[]
  >([]);
  const [faceRegistrationRequired, setFaceRegistrationRequired] =
    useState(false);

  // Get the API endpoint based on user role
  const apiEndpoint = getApiEndpoint(user?.role || "employee");

  // Initialize location tracking hooks
  const {
    currentLocation,
    isInGeofence,
    batteryLevel,
    setIsInGeofence,
    setBatteryLevel,
  } = useLocationStore();

  const { getCurrentLocation, startTracking, stopTracking } =
    useLocationTracking({
      onError: (error) => {
        console.error("Location tracking error:", error);
        setLocationErrorMessage(
          "Location tracking encountered an error. Please check your device settings and try again.",
        );
        setShowLocationError(true);
      },
    });

  const { isLocationInAnyGeofence, getCurrentGeofence, geofences } =
    useGeofencing();

  // Check if the user can override geofence restrictions
  const [canOverrideGeofence, setCanOverrideGeofence] = useState(false);

  // Function declarations (moved up to avoid hoisting issues)
  const updateShiftState = useCallback(
    (active: boolean, startTime: Date | null) => {
      setIsShiftActive(active);
      setShiftStart(startTime);

      if (active && startTime) {
        setElapsedTime(0);
        // startAnimations will be called from useEffect
      } else {
        setElapsedTime(0);
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
      }
    },
    [pulseAnim, rotateAnim],
  );

  const showWarningMessages = useCallback(() => {
    if (warningMessages.length > 0) {
      setCurrentWarningIndex(0);
      setShowWarningModal(true);
    }
  }, []);

  // CRITICAL FIX: Add ref to prevent multiple cooldown timers
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const setShiftCooldown = useCallback(async () => {
    // CRITICAL FIX: Clear existing cooldown timer
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }

    const cooldownDuration = 30000; // 30 seconds
    const cooldownEnd = new Date(Date.now() + cooldownDuration);
    setShiftCooldownUntil(cooldownEnd);
    setCooldownTimeLeft(cooldownDuration / 1000);

    // Start countdown timer
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownTimeLeft((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          setShiftCooldownUntil(null);
          setCooldownTimeLeft(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Face verification utility functions
  const checkFaceRegistrationStatus = useCallback(async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const isRegistered = response.data?.face_registered || false;
      setFaceRegistrationRequired(!isRegistered);
      return isRegistered;
    } catch (error) {
      console.error("Error checking face registration status:", error);
      return false;
    }
  }, [token]);

  const performLocationVerification =
    useCallback(async (): Promise<LocationResult> => {
      try {
        // Use cached location first for faster response
        let appLocation = convertToLocation(currentLocation);

        // If no cached location or it's stale, get fresh location
        const isLocationStale =
          !appLocation?.timestamp ||
          new Date().getTime() - new Date(appLocation.timestamp).getTime() >
            120000; // 2 minutes

        if (!appLocation || isLocationStale) {
          try {
            const locationPromise = getCurrentLocation();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Location timeout")), 5000);
            });

            const locationResult = await Promise.race([
              locationPromise,
              timeoutPromise,
            ]);
            if (locationResult) {
              appLocation = convertToLocation(locationResult);
              if (
                locationResult &&
                typeof locationResult === "object" &&
                "coords" in locationResult
              ) {
                useLocationStore
                  .getState()
                  .setCurrentLocation(locationResult as any);
              }
            }
          } catch (locationError) {
            console.log("Location fetch failed, using cached location");
          }
        }

        if (!appLocation) {
          console.error(
            "Location verification failed: Unable to get current location",
          );
          return {
            success: false,
            error:
              "Unable to determine your current location. Please check that location services are enabled and try again.",
            confidence: 0,
          };
        }

        // Check geofence status
        const isInside = isLocationInAnyGeofence(appLocation);
        const currentGeofence = getCurrentGeofence();

        // Log detailed information for debugging
        console.log("Location verification details:", {
          location: {
            latitude: appLocation.latitude,
            longitude: appLocation.longitude,
            accuracy: appLocation.accuracy,
          },
          isInsideGeofence: isInside,
          currentGeofence: currentGeofence?.name || "None",
          canOverride: canOverrideGeofence,
        });

        // If not inside geofence and no override permission, fail verification
        if (!isInside && !canOverrideGeofence) {
          console.error(
            "Location verification failed: Not inside any geofence and no override permission",
          );
          return {
            success: false,
            latitude: appLocation.latitude || 0,
            longitude: appLocation.longitude || 0,
            accuracy: appLocation.accuracy || 0,
            isInGeofence: false,
            error: `You are currently outside the designated work area "${currentGeofence?.name || "Unknown"}". Please move to a work area or contact your administrator for permission to work from this location.`,
            confidence: 0,
          };
        }

        // If inside geofence or has override permission, succeed
        console.log(
          "Location verification successful:",
          isInside ? "Inside geofence" : "Override allowed",
        );
        return {
          success: true,
          latitude: appLocation.latitude || 0,
          longitude: appLocation.longitude || 0,
          accuracy: appLocation.accuracy || 0,
          isInGeofence: isInside,
          geofenceName: currentGeofence?.name,
          confidence: isInside ? 1.0 : 0.8, // Higher confidence when inside geofence
        };
      } catch (error) {
        console.error("Location verification failed:", error);
        return {
          success: false,
          error:
            "Location verification encountered an unexpected error. Please try again or contact support if the issue persists.",
          confidence: 0,
        };
      }
    }, [
      currentLocation,
      getCurrentLocation,
      isLocationInAnyGeofence,
      getCurrentGeofence,
      canOverrideGeofence,
    ]);

  // Wrapper function for VerificationOrchestrator that returns boolean but handles detailed errors
  const performLocationVerificationBoolean =
    useCallback(async (): Promise<boolean> => {
      const result = await performLocationVerification();
      if (!result.success && result.error) {
        setLocationErrorMessage(result.error);
        setShowLocationError(true);
      }
      return result.success;
    }, [performLocationVerification]);

  const queueOfflineVerification = useCallback(
    async (
      data: Omit<OfflineVerificationData, "id" | "timestamp" | "synced">,
    ) => {
      const offlineData: OfflineVerificationData = {
        ...data,
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        synced: false,
      };

      try {
        const existingQueue = await AsyncStorage.getItem(
          "offlineVerificationQueue",
        );
        const queue = existingQueue ? JSON.parse(existingQueue) : [];
        queue.push(offlineData);

        await AsyncStorage.setItem(
          "offlineVerificationQueue",
          JSON.stringify(queue),
        );
        setOfflineVerificationQueue(queue);

        console.log("Queued offline verification:", offlineData.id);
      } catch (error) {
        console.error("Error queueing offline verification:", error);
      }
    },
    [],
  );

  const syncOfflineVerifications = useCallback(async () => {
    try {
      const queueData = await AsyncStorage.getItem("offlineVerificationQueue");
      if (!queueData) return;

      const queue: OfflineVerificationData[] = JSON.parse(queueData);
      const unsyncedItems = queue.filter((item) => !item.synced);

      if (unsyncedItems.length === 0) return;

      console.log(`Syncing ${unsyncedItems.length} offline verifications`);

      for (const item of unsyncedItems) {
        try {
          await axios.post(
            `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/sync-offline`,
            item,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          // Mark as synced
          item.synced = true;
        } catch (error) {
          console.error(
            `Failed to sync offline verification ${item.id}:`,
            error,
          );
        }
      }

      // Update storage with synced items
      await AsyncStorage.setItem(
        "offlineVerificationQueue",
        JSON.stringify(queue),
      );
      setOfflineVerificationQueue(queue);

      // Clean up old synced items (older than 7 days)
      const cleanupThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleanedQueue = queue.filter(
        (item) => !item.synced || item.timestamp > cleanupThreshold,
      );

      if (cleanedQueue.length !== queue.length) {
        await AsyncStorage.setItem(
          "offlineVerificationQueue",
          JSON.stringify(cleanedQueue),
        );
        setOfflineVerificationQueue(cleanedQueue);
      }
    } catch (error) {
      console.error("Error syncing offline verifications:", error);
    }
  }, [token]);

  const resetVerificationState = useCallback(() => {
    setVerificationState({
      faceVerificationRequired: false,
      locationVerificationRequired: false,
      verificationInProgress: false,
      verificationResults: {
        face: null,
        location: null,
      },
      currentStep: "location",
      retryCount: 0,
      maxRetries: 3,
      canOverride: false,
    });
    setShowFaceVerificationModal(false);
    setShowOTPVerification(false);
    setShowManagerOverride(false);
    setPendingShiftAction(null);
  }, []);

  // Face verification handlers
  const handleFaceVerificationError = useCallback(
    (error: any) => {
      console.error("Face verification failed:", error);

      setVerificationState((prev) => ({
        ...prev,
        retryCount: prev.retryCount + 1,
      }));

      setShowFaceVerificationModal(false);

      // Check if max retries reached
      if (verificationState.retryCount >= verificationState.maxRetries - 1) {
        // Show manager override option
        setVerificationState((prev) => ({
          ...prev,
          canOverride: true,
        }));
        setShowManagerOverride(true);
      } else {
        // Show retry option with face setup option
        const buttons = [
          {
            text: "Cancel",
            style: "cancel" as const,
            onPress: () => resetVerificationState(),
          },
          {
            text: "Retry",
            onPress: () => {
              setShowFaceVerificationModal(true);
            },
          },
        ];

        // Add face setup option if face is not registered or verification keeps failing
        if (
          error.message?.includes("not registered") ||
          error.message?.includes("profile not found") ||
          verificationState.retryCount >= 2
        ) {
          buttons.splice(1, 0, {
            text: "Setup Face",
            onPress: async () => {
              resetVerificationState();
              await promptFaceConfiguration("shift-tracker-error");
            },
          });
        }

        Alert.alert(
          "Face Verification Failed",
          `${error.message}\n\nWould you like to try again? (${verificationState.retryCount + 1}/${verificationState.maxRetries})`,
          buttons,
        );
      }
    },
    [verificationState.retryCount, verificationState.maxRetries],
  );

  const handleManagerOverride = useCallback(async (reason: string) => {
    try {
      // Request manager override via OTP
      setShowOTPVerification(true);
      setVerificationState((prev) => ({
        ...prev,
        overrideReason: reason,
      }));
    } catch (error) {
      console.error("Error requesting manager override:", error);
      showInAppNotification("Failed to request manager override", "error");
    }
  }, []);

  const handleOTPSuccess = useCallback(async () => {
    console.log(
      "OTP verification successful - proceeding with manager override",
    );
    setShowOTPVerification(false);

    // Mark verification as overridden and proceed
    setVerificationState((prev) => ({
      ...prev,
      verificationResults: {
        ...prev.verificationResults,
        face: {
          success: true,
          confidence: 0,
          livenessDetected: false,
          faceEncoding: "",
          timestamp: new Date(),
          overridden: true,
          overrideReason: prev.overrideReason,
        },
      },
    }));

    await proceedWithShiftAction();
  }, []);

  const executeShiftStart = useCallback(
    async (verificationData: any) => {
      const now = new Date();

      // Prepare location data from verification results
      const locationData = verificationData.locationVerification?.success
        ? {
            latitude: verificationData.locationVerification.latitude,
            longitude: verificationData.locationVerification.longitude,
            accuracy: verificationData.locationVerification.accuracy || 0,
          }
        : undefined;

      // Make API call with verification data
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/start`,
        {
          startTime: formatDateForBackend(now),
          location: locationData,
          faceVerification: verificationData.faceVerification,
          verificationTimestamp: verificationData.timestamp,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        },
      );

      // Update UI state
      updateShiftState(true, now);

      // Store shift status
      await AsyncStorage.setItem(
        `${user?.role}-shiftStatus`,
        JSON.stringify({
          isActive: true,
          startTime: now.toISOString(),
          verificationData,
        }),
      );

      // Show success message
      setModalData({
        title: "Shift Started Successfully",
        message: `Your shift has started at ${format(now, "hh:mm a")} with verified identity and location.`,
        type: "success",
        showCancel: false,
      });
      setShowModal(true);

      // Set cooldown and background operations
      await setShiftCooldown();
      InteractionManager.runAfterInteractions(async () => {
        await scheduleFastNotifications();
        showWarningMessages();
      });
    },
    [apiEndpoint, token, user?.role, updateShiftState, setShiftCooldown],
  );

  const executeShiftEnd = useCallback(
    async (verificationData: any) => {
      const now = new Date();
      if (!shiftStart) return;

      // Prepare location data from verification results
      const locationData = verificationData.locationVerification?.success
        ? {
            latitude: verificationData.locationVerification.latitude,
            longitude: verificationData.locationVerification.longitude,
            accuracy: verificationData.locationVerification.accuracy || 0,
          }
        : undefined;

      // Make API call with verification data
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/end`,
        {
          endTime: formatDateForBackend(now),
          location: locationData,
          faceVerification: verificationData.faceVerification,
          verificationTimestamp: verificationData.timestamp,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        },
      );

      // Update UI state
      updateShiftState(false, null);

      // Clear shift status
      await AsyncStorage.removeItem(`${user?.role}-shiftStatus`);

      // Calculate duration
      const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));

      // Show success message
      setModalData({
        title: "Shift Completed Successfully",
        message: `Your shift has ended at ${format(now, "hh:mm a")} with verified identity and location.\n\nDuration: ${duration}`,
        type: "success",
        showCancel: false,
      });
      setShowModal(true);

      // Set cooldown and background operations
      await setShiftCooldown();
      InteractionManager.runAfterInteractions(async () => {
        await cancelShiftNotifications();
        await loadShiftHistoryFromBackend();
      });
    },
    [
      apiEndpoint,
      token,
      shiftStart,
      updateShiftState,
      user?.role,
      setShiftCooldown,
    ],
  );

  // Add this function before the useEffect
  const fetchAndUpdateGeofencePermissions = async () => {
    // Only check permissions for employee role
    if (user?.role !== "employee" || !user?.id || !token) {
      return;
    }

    try {
      console.log("Fetching fresh geofence permissions");

      // Always fetch fresh permissions from API first
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/employee/permissions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data && Array.isArray(response.data.permissions)) {
        // Update state with fresh permissions
        setCanOverrideGeofence(
          response.data.permissions.includes("can_override_geofence"),
        );

        // Cache fresh permissions in AsyncStorage
        await AsyncStorage.setItem(
          `user-${user.id}-permissions`,
          JSON.stringify(response.data.permissions),
        );

        console.log("Updated geofence permissions cache");
      }
    } catch (error) {
      console.error("Error fetching fresh permissions:", error);

      // If API call fails, try to use cached permissions as fallback
      try {
        const cachedPermissions = await AsyncStorage.getItem(
          `user-${user.id}-permissions`,
        );
        if (cachedPermissions) {
          const permissions = JSON.parse(cachedPermissions);
          setCanOverrideGeofence(permissions.includes("can_override_geofence"));
          console.log("Using cached permissions as fallback");
        }
      } catch (storageError) {
        console.error("Error reading cached permissions:", storageError);
      }
    }
  };

  // Add this near other useEffect hooks
  useFocusEffect(
    useCallback(() => {
      console.log("ShiftTracker screen focused - fetching fresh permissions");
      fetchAndUpdateGeofencePermissions();
    }, [user, token]),
  );

  // Add a new useEffect to fetch permissions on mount
  useEffect(() => {
    console.log("ShiftTracker mounted - fetching initial permissions");
    fetchAndUpdateGeofencePermissions();
    checkFaceRegistrationStatus();
    syncOfflineVerifications();
  }, [checkFaceRegistrationStatus, syncOfflineVerifications]);

  // Load persistent state and cooldown
  useEffect(() => {
    loadShiftStatus();
    loadShiftHistoryFromBackend();
    checkIfShiftAutoEnded(); // Add this line
    loadShiftCooldown(); // Load any existing cooldown

    // CRITICAL FIX: Cleanup function to clear all timers on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
      if (dashboardUpdateTimeoutRef.current) {
        clearTimeout(dashboardUpdateTimeoutRef.current);
        dashboardUpdateTimeoutRef.current = null;
      }
    };
  }, []);

  // Load cooldown state from AsyncStorage
  const loadShiftCooldown = async () => {
    try {
      const cooldownData = await AsyncStorage.getItem(
        `${user?.role}-shiftCooldown`,
      );
      if (cooldownData) {
        const cooldownUntil = new Date(JSON.parse(cooldownData));
        if (cooldownUntil > new Date()) {
          setShiftCooldownUntil(cooldownUntil);
        } else {
          // Cooldown expired, remove from storage
          await AsyncStorage.removeItem(`${user?.role}-shiftCooldown`);
        }
      }
    } catch (error) {
      console.error("Error loading cooldown state:", error);
    }
  };

  // Clear cooldown state
  const clearShiftCooldown = useCallback(async () => {
    try {
      // CRITICAL FIX: Clear cooldown timer
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }

      setShiftCooldownUntil(null);
      setCooldownTimeLeft(0);
      await AsyncStorage.removeItem(`${user?.role}-shiftCooldown`);
    } catch (error) {
      console.error("Error clearing cooldown state:", error);
    }
  }, [user?.role]);

  // Animation effects
  useEffect(() => {
    if (isShiftActive) {
      // Start animations when shift becomes active
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [isShiftActive, pulseAnim, rotateAnim]);

  // Add this effect near other animation effects
  useEffect(() => {
    if (isAddressRefreshing) {
      Animated.loop(
        Animated.timing(addressRefreshAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      addressRefreshAnim.setValue(0);
    }
  }, [isAddressRefreshing]);

  // Add this with other interpolations
  const addressRefreshRotate = addressRefreshAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // CRITICAL FIX: Add ref to prevent timer recreation on every render
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // CRITICAL FIX: Add debouncing to prevent excessive dashboard updates
  const dashboardUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDashboardUpdateRef = useRef<number>(0);

  const updateEmployeeDashboard = useCallback(async () => {
    // CRITICAL FIX: Debounce dashboard updates to prevent excessive calls
    const now = Date.now();
    const timeSinceLastUpdate = now - lastDashboardUpdateRef.current;

    // Only update if at least 5 seconds have passed since last update
    if (timeSinceLastUpdate < 5000) {
      return;
    }

    // Clear existing timeout
    if (dashboardUpdateTimeoutRef.current) {
      clearTimeout(dashboardUpdateTimeoutRef.current);
    }

    // Debounce the actual update
    dashboardUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const dashboardData = {
          shiftStatus: isShiftActive ? "Active Shift" : "No Active Shift",
          attendanceStatus: isShiftActive ? "Present" : "Not Marked",
          currentShiftDuration: formatTime(elapsedTime),
        };
        await AsyncStorage.setItem(
          `${user?.role}-dashboardStatus`,
          JSON.stringify(dashboardData),
        );
        lastDashboardUpdateRef.current = Date.now();
      } catch (error) {
        console.error("Error updating dashboard:", error);
      }
    }, 1000); // 1 second debounce
  }, [isShiftActive, elapsedTime, user?.role]);

  // Format elapsed time helper function
  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Timer effect with cooldown countdown
  useEffect(() => {
    // CRITICAL FIX: Clear existing timer to prevent multiple timers
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // CRITICAL FIX: Only create timer if we need it
    if (isShiftActive || shiftCooldownUntil) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        setCurrentTime(now);

        if (isShiftActive && shiftStart) {
          setElapsedTime(differenceInSeconds(now, shiftStart));
          // CRITICAL FIX: Debounce dashboard updates to prevent excessive calls
          updateEmployeeDashboard();
        }

        // Update cooldown countdown
        if (shiftCooldownUntil) {
          const timeLeft = Math.max(
            0,
            Math.ceil((shiftCooldownUntil.getTime() - now.getTime()) / 1000),
          );
          setCooldownTimeLeft(timeLeft);

          if (timeLeft === 0) {
            clearShiftCooldown();
          }
        }
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [
    isShiftActive,
    shiftStart,
    shiftCooldownUntil,
    updateEmployeeDashboard,
    clearShiftCooldown,
  ]);

  const loadShiftStatus = async () => {
    const startTime = Date.now();
    const minLoadingTime = 1000; // Minimum 1 second loading time for better UX
    
    try {
      const status = await AsyncStorage.getItem(`${user?.role}-shiftStatus`);

      if (status) {
        const { isActive, startTime: shiftStartTime } = JSON.parse(status);

        if (isActive) {
          // Before restoring from AsyncStorage, verify with backend that shift is still active
          try {
            const response = await axios.get(
              `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/current`,
              { headers: { Authorization: `Bearer ${token}` } },
            );

            if (response.data) {
              // Shift is still active on backend, restore from AsyncStorage
              setIsShiftActive(isActive);
              if (isActive && shiftStartTime) {
                setShiftStart(new Date(shiftStartTime));
              }

              // Now that we've confirmed the shift is active, check for timer
              checkExistingTimer();
            } else {
              // Shift was ended on backend but not in local storage
              console.log(
                "Shift not active on backend but active in AsyncStorage - fixing inconsistency",
              );
              await AsyncStorage.removeItem(`${user?.role}-shiftStatus`);
              showInAppNotification(
                "Your shift was automatically ended while you were offline",
                "info",
              );
            }
          } catch (error) {
            console.error("Error verifying shift status with backend:", error);
            // Fall back to local storage if we can't verify with backend
            setIsShiftActive(isActive);
            if (isActive && shiftStartTime) {
              setShiftStart(new Date(shiftStartTime));
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading shift status:", error);
    } finally {
      // Ensure minimum loading time for better UX
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      // Always set loading to false when shift status loading is complete
      setIsShiftStatusLoading(false);
    }
  };

  const loadShiftHistoryFromBackend = async () => {
    try {
      const currentMonth = format(new Date(), "yyyy-MM");
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/attendance/${currentMonth}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const convertedHistory: ShiftData[] = response.data
        .map((shift: any) => {
          try {
            const startTime = new Date(shift.shifts[0]?.shift_start);
            const endTime = shift.shifts[0]?.shift_end
              ? new Date(shift.shifts[0].shift_end)
              : null;

            return {
              date: format(startTime, "yyyy-MM-dd"),
              startTime: format(startTime, "HH:mm:ss"),
              endTime: endTime ? format(endTime, "HH:mm:ss") : null,
              duration: shift.total_hours
                ? formatTime(parseFloat(shift.total_hours.toString()) * 3600)
                : null,
            };
          } catch (err) {
            console.error("Error parsing shift data:", err, shift);
            return null;
          }
        })
        .filter(Boolean);

      console.log("Converted history:", convertedHistory);
      setShiftHistory(convertedHistory);
    } catch (error) {
      console.error("Error loading shift history:", error);
    }
  };

  // Add this helper function at the top
  const formatDateForBackend = (date: Date) => {
    // Format date in local timezone without any conversion
    return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  };

  // Modify the notification scheduling code
  const schedulePersistentNotification = async () => {
    try {
      // Cancel any existing notifications
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Notifications are required to track your shift status.",
        );
        return;
      }

      // Set up notification channels for Android
      if (Platform.OS === "android") {
        // Active shift channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
          {
            name: "Active Shift",
            importance: Notifications.AndroidImportance.HIGH,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
            showBadge: true,
          },
        );

        // Shift warning channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.SHIFT_WARNING,
          {
            name: "Shift Warnings",
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 500, 250, 500],
            showBadge: true,
          },
        );

        // Shift limit channel
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.SHIFT_LIMIT,
          {
            name: "Shift Limit Alert",
            importance: Notifications.AndroidImportance.MAX,
            lockscreenVisibility:
              Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: "default",
            enableVibrate: true,
            vibrationPattern: [0, 1000, 500, 1000],
            showBadge: true,
          },
        );
      }

      // Schedule the persistent notification
      const activeShiftId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🟢 Active Shift Running ⏰",
          body:
            "⚡ Live: Your shift is in progress!\n🔔 Remember to end your shift before leaving\n⏱️ Started at: " +
            format(shiftStart || new Date(), "hh:mm a"),
          priority: "max",
          sticky: false,
          color: "#3B82F6",
          badge: 1,
          vibrate: [0, 250, 250, 250],
          ...(Platform.OS === "android" && {
            channelId: NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
            actions: [
              {
                identifier: "dismiss",
                title: "Dismiss",
                icon: "ic_close",
              },
            ],
          }),
          ...(Platform.OS === "ios" && {
            interruptionLevel: "timeSensitive",
          }),
          data: {
            type: "active-shift",
            startTime: shiftStart?.toISOString() || new Date().toISOString(),
            notificationId: "activeShift",
          },
        },
        trigger: null,
      });

      // Store the notification ID for later cancellation
      await AsyncStorage.setItem(
        `${user?.role}-activeShiftNotificationId`,
        activeShiftId,
      );

      // Calculate seconds from now until the warning should trigger
      // Based on shift start time + warning offset
      const now = new Date();
      const shiftStartTime = shiftStart || now;

      // Calculate warning time: shift start + warning time (7h 55m)
      const warningTime = new Date(
        shiftStartTime.getTime() + SHIFT_WARNING_TIME_MS,
      );
      const secondsUntilWarning = Math.max(
        0,
        Math.floor((warningTime.getTime() - now.getTime()) / 1000),
      );

      // Calculate limit time: shift start + limit time (9h)
      const limitTime = new Date(
        shiftStartTime.getTime() + SHIFT_LIMIT_TIME_MS,
      );
      const secondsUntilLimit = Math.max(
        0,
        Math.floor((limitTime.getTime() - now.getTime()) / 1000),
      );

      // Initialize notification IDs
      let warningId: string | undefined;
      let limitId: string | undefined;

      // Only schedule warning notification if shift just started or still has time before warning
      if (secondsUntilWarning > 0) {
        // Schedule warning notification (8 hours 55 minutes from shift start)
        warningId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Shift Duration Warning",
            body: "Your shift will reach 9 hours in 5 minutes. Please prepare to end your shift.",
            priority: "max",
            sound: true,
            vibrate: [0, 500, 250, 500],
            ...(Platform.OS === "android" && {
              channelId: NOTIFICATION_CHANNELS.SHIFT_WARNING,
            }),
            ...(Platform.OS === "ios" && {
              interruptionLevel: "timeSensitive",
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            repeats: false,
            seconds: secondsUntilWarning,
          },
        });
      }

      // Only schedule limit notification if shift just started or still has time before limit
      if (secondsUntilLimit > 0) {
        // Schedule limit notification (9 hours from shift start)
        limitId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "⛔ Shift Duration Limit Reached",
            body: "You have completed 9 hours of work. Please end your shift now.",
            priority: "max",
            sound: true,
            vibrate: [0, 1000, 500, 1000],
            ...(Platform.OS === "android" && {
              channelId: NOTIFICATION_CHANNELS.SHIFT_LIMIT,
            }),
            ...(Platform.OS === "ios" && {
              interruptionLevel: "critical",
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            repeats: false,
            seconds: secondsUntilLimit,
          },
        });
      }

      // Store all notification IDs
      await AsyncStorage.setItem(
        `${user?.role}-shiftNotifications`,
        JSON.stringify({
          activeShiftId,
          warningId: warningId || null,
          limitId: limitId || null,
        }),
      );
    } catch (error) {
      console.error("Error scheduling notifications:", error);
    }
  };

  // Optimized notification scheduling for faster shift start
  const scheduleFastNotifications = async () => {
    try {
      // Cancel any existing notifications first
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      }

      // Quick permission check - use cached result if available
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        // Request permissions in background, don't block
        Notifications.requestPermissionsAsync().catch((error) => {
          console.log("Permission request failed:", error);
        });
        return; // Skip notifications if no permission
      }

      // Set up notification channels for Android (optimized)
      if (Platform.OS === "android") {
        // Only set up active shift channel immediately, others can be done later
        await Notifications.setNotificationChannelAsync(
          NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
          {
            name: "Active Shift",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
            enableVibrate: true,
            showBadge: true,
          },
        );
      }

      // Schedule the main active shift notification immediately
      const activeShiftId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🟢 Active Shift Running ⏰",
          body: `⚡ Live: Your shift is in progress!\n🔔 Remember to end your shift before leaving\n⏱️ Started at: ${format(shiftStart || new Date(), "hh:mm a")}`,
          priority: "max",
          sticky: false,
          color: "#3B82F6",
          badge: 1,
          ...(Platform.OS === "android" && {
            channelId: NOTIFICATION_CHANNELS.ACTIVE_SHIFT,
          }),
          ...(Platform.OS === "ios" && {
            interruptionLevel: "timeSensitive",
          }),
          data: {
            type: "active-shift",
            startTime: shiftStart?.toISOString() || new Date().toISOString(),
            notificationId: "activeShift",
          },
        },
        trigger: null,
      });

      // Store the main notification ID immediately
      await AsyncStorage.setItem(
        `${user?.role}-activeShiftNotificationId`,
        activeShiftId,
      );

      // Schedule warning and limit notifications in background
      setTimeout(async () => {
        try {
          // Set up remaining notification channels for Android
          if (Platform.OS === "android") {
            await Promise.all([
              Notifications.setNotificationChannelAsync(
                NOTIFICATION_CHANNELS.SHIFT_WARNING,
                {
                  name: "Shift Warnings",
                  importance: Notifications.AndroidImportance.MAX,
                  sound: "default",
                  enableVibrate: true,
                  showBadge: true,
                },
              ),
              Notifications.setNotificationChannelAsync(
                NOTIFICATION_CHANNELS.SHIFT_LIMIT,
                {
                  name: "Shift Limit Alert",
                  importance: Notifications.AndroidImportance.MAX,
                  sound: "default",
                  enableVibrate: true,
                  showBadge: true,
                },
              ),
            ]);
          }

          // Calculate timing for warning and limit notifications
          const now = new Date();
          const shiftStartTime = shiftStart || now;

          const warningTime = new Date(
            shiftStartTime.getTime() + SHIFT_WARNING_TIME_MS,
          );
          const secondsUntilWarning = Math.max(
            0,
            Math.floor((warningTime.getTime() - now.getTime()) / 1000),
          );

          const limitTime = new Date(
            shiftStartTime.getTime() + SHIFT_LIMIT_TIME_MS,
          );
          const secondsUntilLimit = Math.max(
            0,
            Math.floor((limitTime.getTime() - now.getTime()) / 1000),
          );

          let warningId: string | undefined;
          let limitId: string | undefined;

          // Schedule warning notification if needed
          if (secondsUntilWarning > 0) {
            warningId = await Notifications.scheduleNotificationAsync({
              content: {
                title: "⚠️ Shift Duration Warning",
                body: "Your shift will reach 9 hours in 5 minutes. Please prepare to end your shift.",
                priority: "max",
                sound: true,
                ...(Platform.OS === "android" && {
                  channelId: NOTIFICATION_CHANNELS.SHIFT_WARNING,
                }),
                ...(Platform.OS === "ios" && {
                  interruptionLevel: "timeSensitive",
                }),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                repeats: false,
                seconds: secondsUntilWarning,
              },
            });
          }

          // Schedule limit notification if needed
          if (secondsUntilLimit > 0) {
            limitId = await Notifications.scheduleNotificationAsync({
              content: {
                title: "⛔ Shift Duration Limit Reached",
                body: "You have completed 9 hours of work. Please end your shift now.",
                priority: "max",
                sound: true,
                ...(Platform.OS === "android" && {
                  channelId: NOTIFICATION_CHANNELS.SHIFT_LIMIT,
                }),
                ...(Platform.OS === "ios" && {
                  interruptionLevel: "critical",
                }),
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                repeats: false,
                seconds: secondsUntilLimit,
              },
            });
          }

          // Store all notification IDs
          await AsyncStorage.setItem(
            `${user?.role}-shiftNotifications`,
            JSON.stringify({
              activeShiftId,
              warningId: warningId || null,
              limitId: limitId || null,
            }),
          );
        } catch (error) {
          console.error("Error scheduling delayed notifications:", error);
        }
      }, 100); // Small delay to not block the main thread
    } catch (error) {
      console.error("Error scheduling fast notifications:", error);
    }
  };

  // Add function to cancel all shift-related notifications
  const cancelShiftNotifications = async () => {
    try {
      const notificationIdsString = await AsyncStorage.getItem(
        `${user?.role}-shiftNotifications`,
      );
      if (notificationIdsString) {
        const { activeShiftId, warningId, limitId } = JSON.parse(
          notificationIdsString,
        );

        // Cancel all notifications, but only if they exist
        const cancelPromises = [];

        if (activeShiftId) {
          cancelPromises.push(
            Notifications.cancelScheduledNotificationAsync(activeShiftId),
          );
        }

        if (warningId) {
          cancelPromises.push(
            Notifications.cancelScheduledNotificationAsync(warningId),
          );
        }

        if (limitId) {
          cancelPromises.push(
            Notifications.cancelScheduledNotificationAsync(limitId),
          );
        }

        if (cancelPromises.length > 0) {
          await Promise.all(cancelPromises);
        }

        // Clear stored notification IDs
        await AsyncStorage.removeItem(`${user?.role}-shiftNotifications`);
        setNotificationId(null);
      }
    } catch (error) {
      console.error("Error canceling notifications:", error);
    }
  };

  // Add a function to show in-app notifications
  const showInAppNotification = (
    message: string,
    type: "info" | "warning" | "error" | "success" = "info",
  ) => {
    // First dismiss any existing notification
    setInAppNotification({
      visible: false,
      message: "",
      type: "info",
    });

    // Then show new notification after a small delay
    setTimeout(() => {
      setInAppNotification({
        visible: true,
        message,
        type,
      });
    }, 300);
  };

  // Initialize location on component mount with retry mechanism
  useEffect(() => {
    const initializeLocationWithRetry = async () => {
      try {
        // Only initialize location for employee and group-admin roles
        if (user?.role === "management") {
          return;
        }

        // First check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();

        if (!locationEnabled) {
          // Immediately show location prompt
          setLocationErrorMessage(
            "Location services are required for shift tracking. Please enable location services in your device settings to continue.",
          );
          setShowLocationError(true);
          setIsLocationServiceEnabled(false);
          return;
        }

        setIsLocationServiceEnabled(true);

        // Check if we have a cached location first
        const cachedLocation = useLocationStore.getState().currentLocation;
        if (cachedLocation && cachedLocation.latitude && cachedLocation.longitude) {
          console.log("Using cached location for initialization");
          // Update address in background
          getLocationAddress(cachedLocation.latitude, cachedLocation.longitude)
            .then((address) => setCurrentAddress(address))
            .catch((error) => console.log("Error getting address:", error));
        }

        // Try to get fresh location with progressive timeout and retry
        let location = null;
        let lastError = null;

        // Try with different timeout values and accuracy settings
        const attempts = [
          { timeout: 15000, accuracy: Location.Accuracy.BestForNavigation },
          { timeout: 20000, accuracy: Location.Accuracy.High },
          { timeout: 25000, accuracy: Location.Accuracy.Balanced },
        ];

        for (let i = 0; i < attempts.length; i++) {
          const { timeout, accuracy } = attempts[i];
          console.log(`Location attempt ${i + 1}/${attempts.length} with ${timeout}ms timeout and ${accuracy} accuracy`);
          
          try {
            const locationPromise = Location.getCurrentPositionAsync({
              accuracy,
            });
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("Location timeout")), timeout);
            });

            location = await Promise.race([locationPromise, timeoutPromise]);
            
            if (location) {
              console.log(`Location obtained successfully on attempt ${i + 1}`);
              break;
            }
          } catch (error) {
            console.log(`Location attempt ${i + 1} failed:`, error);
            lastError = error;
            
            // If this is not the last attempt, wait a bit before trying again
            if (i < attempts.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (location) {
          // Update the store with the fresh location
          if (
            location &&
            typeof location === "object" &&
            "coords" in location
          ) {
            useLocationStore.getState().setCurrentLocation(location as any);
          }

          // Update address in background
          const appLocation = convertToLocation(location);
          if (appLocation?.latitude && appLocation?.longitude) {
            getLocationAddress(appLocation.latitude, appLocation.longitude)
              .then((address) => setCurrentAddress(address))
              .catch((error) => console.log("Error getting address:", error));
          }
        } else {
          // All attempts failed, but we might have a cached location
          if (cachedLocation && cachedLocation.latitude && cachedLocation.longitude) {
            console.log("Using cached location as fallback after failed attempts");
            // Don't show error modal if we have cached location
            return;
          }
          
          // No cached location and all attempts failed
          console.error("All location attempts failed:", lastError);
          setLocationErrorMessage(
            "Unable to determine your current location. Please ensure location permissions are granted and try again. You can still use the app with limited functionality.",
          );
          setShowLocationError(true);
        }
      } catch (error: any) {
        console.error("Error initializing location:", error);
        setLocationErrorMessage(
          error.message ||
            "Failed to initialize location services. Please check your device settings and try again.",
        );
        setShowLocationError(true);
      }
    };

    initializeLocationWithRetry();
  }, [user?.role]);

  // Enhanced button validation with cooldown check
  const isShiftActionAllowed = useCallback(() => {
    const now = Date.now();

    // Check debounce (2 second rapid click protection)
    if (now - lastClickTime < 2000) {
      return { allowed: false, reason: "Please wait before clicking again" };
    }

    // Check cooldown (5 minute protection after shift actions)
    if (shiftCooldownUntil && shiftCooldownUntil > new Date()) {
      const minutesLeft = Math.ceil(cooldownTimeLeft / 60);
      return {
        allowed: false,
        reason: `Action cooldown active. Wait ${minutesLeft} minute${minutesLeft > 1 ? "s" : ""} before ${isShiftActive ? "ending" : "starting"} a shift.`,
      };
    }

    setLastClickTime(now);
    return { allowed: true, reason: null };
  }, [lastClickTime, shiftCooldownUntil, cooldownTimeLeft, isShiftActive]);

  // Fix the useEffect that updates battery level
  useEffect(() => {
    if (currentLocation) {
      // Update geofence status in the store - this was missing
      const isInside = isLocationInAnyGeofence(currentLocation);
      setIsInGeofence(isInside);
      console.log("Updated geofence status:", { isInside, currentLocation });

      // Update battery level if available
      const battery = getBatteryLevel(currentLocation);
      if (battery !== undefined) {
        setBatteryLevel(battery);
      }
    }
  }, [
    currentLocation,
    isLocationInAnyGeofence,
    setIsInGeofence,
    setBatteryLevel,
  ]);

  // Monitor location services status during active shift
  useEffect(() => {
    // Only monitor location services for employee role
    if (!isShiftActive || user?.role !== "employee") {
      return;
    }

    // Setup interval to check location services status
    const intervalId = setInterval(async () => {
      try {
        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();

        // Only take action if the state has changed
        if (locationEnabled !== isLocationServiceEnabled) {
          setIsLocationServiceEnabled(locationEnabled);

          if (!locationEnabled) {
            // Location services disabled - show notification and start countdown
            showInAppNotification(
              "Location services are turned off. Please enable location services immediately to continue your shift, or it will end automatically in 5 minutes.",
              "warning",
            );

            // Cancel any existing timer before creating a new one
            if (locationOffTimer) {
              clearTimeout(locationOffTimer);
              setLocationOffTimer(null);
            }

            // Start new countdown timer to end shift
            const timer = setTimeout(
              () => {
                if (isShiftActive) {
                  // Show a confirmation dialog instead of auto-ending
                  setModalData({
                    title: "Location Services Disabled",
                    message:
                      "Your shift needs to be ended because location services have been disabled for over 5 minutes. Would you like to enable location services now or end your shift?",
                    type: "info",
                    showCancel: true,
                  });

                  // Store the original modal action
                  const originalConfirmEndShift = confirmEndShift;

                  // Temporarily override confirmEndShift to handle this special case
                  (confirmEndShift as any) = async () => {
                    // Restore original function
                    (confirmEndShift as any) = originalConfirmEndShift;

                    // End shift without location validation
                    const now = new Date();
                    if (!shiftStart) return;

                    // Immediately update UI state
                    setShowModal(false);
                    setIsShiftActive(false);
                    setShiftStart(null);
                    pulseAnim.setValue(1);
                    rotateAnim.setValue(0);

                    // Clear monitoring resources
                    if (locationOffTimer) {
                      clearTimeout(locationOffTimer);
                      setLocationOffTimer(null);
                    }

                    if (locationCheckInterval) {
                      clearInterval(locationCheckInterval);
                      setLocationCheckInterval(null);
                    }

                    if (locationWatchId) {
                      clearInterval(locationWatchId as any);
                      setLocationWatchId(null);
                    }

                    // Calculate duration
                    const duration = formatElapsedTime(
                      differenceInSeconds(now, shiftStart),
                    );

                    // Show completion modal
                    setModalData({
                      title: "Shift Completed",
                      message: `Total Duration: ${duration}\nStart: ${format(
                        shiftStart,
                        "hh:mm a",
                      )}\nEnd: ${format(now, "hh:mm a")}`,
                      type: "success",
                      showCancel: false,
                    });
                    setShowModal(true);

                    // Process in background
                    InteractionManager.runAfterInteractions(async () => {
                      try {
                        await cancelShiftNotifications();

                        // Create shift data for API
                        const newShiftData: ShiftData = {
                          date: format(shiftStart, "yyyy-MM-dd"),
                          startTime: format(shiftStart, "HH:mm:ss"),
                          endTime: format(now, "HH:mm:ss"),
                          duration,
                        };

                        // End shift API calls
                        await Promise.all([
                          axios.post(
                            `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/end`,
                            {
                              endTime: formatDateForBackend(now),
                              locationServicesDisabled: true, // Add flag to indicate why shift ended
                            },
                            {
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          ),
                          AsyncStorage.removeItem(`${user?.role}-shiftStatus`),
                          AsyncStorage.setItem(
                            `${user?.role}-shiftHistory`,
                            JSON.stringify([newShiftData, ...shiftHistory]),
                          ),
                        ]);

                        // Refresh data
                        await Promise.all([
                          loadShiftHistoryFromBackend(),
                          fetchRecentShifts(),
                        ]);
                        setLocationValidated(false);
                      } catch (error: any) {
                        console.error("Error ending shift:", error);
                        showInAppNotification(
                          error.response?.data?.error ||
                            "Failed to end shift. Please try again.",
                          "error",
                        );
                      }
                    });
                  };

                  // Override the cancel action
                  const setShowModalOriginal = setShowModal;
                  (setShowModal as any) = (value: boolean) => {
                    // If canceling, try to enable location
                    if (!value) {
                      // Restore functions
                      (confirmEndShift as any) = originalConfirmEndShift;
                      (setShowModal as any) = setShowModalOriginal;

                      // Reset the timer
                      if (locationOffTimer) {
                        clearTimeout(locationOffTimer);
                      }

                      // Try to enable location
                      Location.requestForegroundPermissionsAsync().then(
                        ({ status }) => {
                          if (status === "granted") {
                            Location.getCurrentPositionAsync({
                              accuracy: Location.Accuracy.Balanced,
                              mayShowUserSettingsDialog: true,
                            }).catch(() => {
                              // Start a new timer if enabling location failed
                              const newTimer = setTimeout(
                                () => {
                                  if (isShiftActive) {
                                    showInAppNotification(
                                      "Your shift will end soon if location services remain disabled.",
                                      "warning",
                                    );
                                  }
                                },
                                4 * 60 * 1000,
                              ); // Give another 4 minutes
                              setLocationOffTimer(newTimer);
                            });
                          }
                        },
                      );
                    }

                    // Call original function
                    setShowModalOriginal(value);
                  };

                  setShowModal(true);
                }
              },
              5 * 60 * 1000,
            ); // 5 minutes

            setLocationOffTimer(timer);
          } else {
            // Location services turned back on - show notification and cancel timer
            showInAppNotification(
              "Location services have been re-enabled. Your shift will continue normally.",
              "success",
            );

            // Cancel countdown timer if it exists
            if (locationOffTimer) {
              clearTimeout(locationOffTimer);
              setLocationOffTimer(null);
            }
          }
        }
      } catch (error) {
        console.error("Error checking location services:", error);
      }
    }, 5000); // Check every 5 seconds

    setLocationCheckInterval(intervalId);

    return () => {
      // Clean up interval on unmount or when shift becomes inactive
      if (locationCheckInterval) {
        clearInterval(locationCheckInterval);
      }

      // Clear any existing timer
      if (locationOffTimer) {
        clearTimeout(locationOffTimer);
        setLocationOffTimer(null);
      }
    };
  }, [isShiftActive, isLocationServiceEnabled, user?.role]);

  // Add this helper function to safely get location
  const safeGetCurrentLocation = async (): Promise<AppLocation | null> => {
    try {
      // Get the location from the hook
      const locationResult = await getCurrentLocation();

      // Convert it to our app location format
      return locationResult ? convertToLocation(locationResult) : null;
    } catch (error) {
      console.error("Error getting current location:", error);
      return null;
    }
  };

  // Optimized validateLocationForShift function for faster response
  const validateLocationForShift = async (): Promise<boolean> => {
    // Management and group-admin roles don't need location validation
    if (user?.role === "management" || user?.role === "group-admin") {
      setLocationValidated(true);
      return true;
    }

    try {
      // Quick location services check
      const locationEnabled = await Location.hasServicesEnabledAsync();
      if (!locationEnabled) {
        setLocationErrorMessage(
          "Location services are currently disabled on your device. Please enable location services in your device settings to continue with shift tracking.",
        );
        setShowLocationError(true);
        return false;
      }

      // Use cached location aggressively (allow up to 2 minutes old for faster response)
      let appLocation = convertToLocation(currentLocation);
      const isLocationStale =
        !appLocation?.timestamp ||
        new Date().getTime() - new Date(appLocation.timestamp).getTime() >
          30000;

      if (!appLocation || isLocationStale) {
        // Try to get fresh location with short timeout
        try {
          const locationPromise = getCurrentLocation();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Location timeout")), 3000); // 3 second timeout
          });

          const freshLocation = await Promise.race([
            locationPromise,
            timeoutPromise,
          ]);
          if (freshLocation) {
            appLocation = convertToLocation(freshLocation);
            // Update the store with the fresh location only if it's a valid location object
            if (
              freshLocation &&
              typeof freshLocation === "object" &&
              "coords" in freshLocation
            ) {
              useLocationStore
                .getState()
                .setCurrentLocation(freshLocation as any);
            }
          }
        } catch (locationError) {
          // If fresh location fails but we have cached location, use it
          if (appLocation) {
            console.log("Using cached location due to fresh location timeout");
          } else {
            throw new Error(
              "Unable to determine your current location. Please check your internet connection and location permissions.",
            );
          }
        }
      }

      if (!appLocation) {
        throw new Error(
          "Unable to determine your current location. Please check your internet connection and location permissions.",
        );
      }

      // Quick geofence check
      const isInside = isLocationInAnyGeofence(appLocation);

      // Fast permission logic:
      // 1. If user is inside geofence: Allow immediately
      if (isInside) {
        setLocationValidated(true);
        return true;
      }

      // 2. If user is outside geofence but has override permission: Allow with warning
      if (canOverrideGeofence) {
        setLocationValidated(true);
        // Show async warning (don't block)
        setTimeout(() => {
          showInAppNotification(
            "You are outside designated work areas but using your override permission to continue.",
            "warning",
          );
        }, 100);
        return true;
      }

      // 3. If user is outside geofence and doesn't have override permission: Block
      const currentGeofence = getCurrentGeofence();
      setLocationErrorMessage(
        `You are currently outside the designated work area "${currentGeofence?.name || "Unknown"}". Please move to a work area or contact your administrator for permission to work from this location.`,
      );
      setShowLocationError(true);
      return false;
    } catch (error: any) {
      setLocationErrorMessage(
        error.message ||
          "Location validation encountered an error. Please try again or contact support if the issue persists.",
      );
      setShowLocationError(true);
      return false;
    }
  };

  // Optimized handleStartShift - fast UI updates, background processing
  const handleStartShift = async () => {
    // Enhanced validation with cooldown check
    const validation = isShiftActionAllowed();
    if (!validation.allowed || isProcessingShift) {
      if (validation.reason) {
        showInAppNotification(validation.reason, "warning");
      }
      return;
    }

    setIsProcessingShift(true);

    try {
      // Check if face registration is required
      const isFaceRegistered = await checkFaceRegistrationStatus();

      if (!isFaceRegistered) {
        setIsProcessingShift(false);

        // Show user-friendly prompt to set up face verification
        // Show user-friendly modal to set up face verification
        setModalData({
          title: "Face Verification Setup Required",
          message:
            "To start your shift securely, you need to set up face verification first. This helps ensure only you can start and end your shifts.",
          type: "info",
          showCancel: true,
          confirmText: "Set Up Now",
          cancelText: "Cancel",
          onConfirm: async () => {
            // Navigate directly to face registration page
            router.push("/(dashboard)/employee/face-registration");
          },
          onCancel: () => {
            console.log("User cancelled face verification setup");
          },
        });
        setShowModal(true);
        return;
      }

      // Initialize verification state
      setPendingShiftAction("start");
      setVerificationState((prev) => ({
        ...prev,
        faceVerificationRequired: true,
        locationVerificationRequired: true,
        verificationInProgress: true,
        currentStep: "location",
      }));

      // Step 1: Perform location verification
      const locationResult = await performLocationVerification();

      // Check location requirements for employees
      if (user?.role === "employee" && !locationResult.success) {
        setLocationErrorMessage(
          locationResult.error ||
            "Location verification failed. Please try again.",
        );
        setShowLocationError(true);
        setIsProcessingShift(false);
        resetVerificationState();
        return;
      }

      // Store location verification result
      setVerificationState((prev) => ({
        ...prev,
        verificationResults: {
          ...prev.verificationResults,
          location: locationResult,
        },
        currentStep: "face",
      }));

      // Step 2: Perform face verification
      setFaceVerificationMode("verify");
      setShowFaceVerificationModal(true);
      setIsProcessingShift(false);
    } catch (error: any) {
      console.error("Error in shift start verification:", error);
      setIsProcessingShift(false);
      resetVerificationState();

      setModalData({
        title: "Verification Error",
        message: "Failed to start verification process. Please try again.",
        type: "info",
        showCancel: false,
      });
      setShowModal(true);
    }
  };

  // Enhanced handleEndShift with face verification
  const handleEndShift = async () => {
    // Enhanced validation with cooldown check
    const validation = isShiftActionAllowed();
    if (!validation.allowed || isProcessingShift) {
      if (validation.reason) {
        showInAppNotification(validation.reason, "warning");
      }
      return;
    }

    // Show confirmation dialog first
    Alert.alert(
      "End Shift?",
      "Are you sure you want to end your current shift?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "End Shift",
          onPress: () => startEndShiftVerification("end"),
        },
      ],
    );
  };

  const startEndShiftVerification = useCallback(
    async (action: "start" | "end") => {
      try {
        setIsProcessingShift(true);
        setPendingShiftAction(action);

        // Check if face registration is required for both start and end actions
        const isFaceRegistered = await checkFaceRegistrationStatus();

        if (!isFaceRegistered) {
          setIsProcessingShift(false);

          // Show user-friendly modal to set up face verification
          setModalData({
            title: "Face Verification Setup Required",
            message: `To ${action} your shift securely, you need to set up face verification first. This helps ensure only you can ${action} your shifts.`,
            type: "info",
            showCancel: true,
            confirmText: "Set Up Now",
            cancelText: "Cancel",
            onConfirm: async () => {
              // Navigate directly to face registration page
              router.push("/(dashboard)/employee/face-registration");
            },
            onCancel: () => {
              console.log(
                `User cancelled face verification setup for ${action}`,
              );
            },
          });
          setShowModal(true);
          return;
        }

        // Configure verification requirements based on shift action and user settings
        const config = {
          requireLocation: true,
          requireFace: true,
          allowLocationFallback: action === "end", // Allow location fallback for shift end
          allowFaceFallback: false, // Face verification is always required
          maxRetries: 3,
          timeoutMs: 30000,
          confidenceThreshold: 0.7,
        };

        setVerificationConfig(config);

        // Show verification orchestrator
        setShowVerificationOrchestrator(true);
      } catch (error) {
        console.error("Error starting verification:", error);
        setIsProcessingShift(false);
        showInAppNotification(
          "Failed to start verification. Please try again.",
          "error",
        );
      }
    },
    [],
  );

  const handleLocationVerificationSuccess = useCallback(
    (locationResult: LocationResult) => {
      setVerificationState((prev) => ({
        ...prev,
        verificationResults: {
          ...prev.verificationResults,
          location: locationResult,
        },
        currentStep: "face",
      }));

      // Show face verification
      setShowFaceVerificationModal(true);
    },
    [],
  );

  const handleFaceVerificationSuccess = useCallback(
    async (faceResult: FaceVerificationResult) => {
      setVerificationState((prev) => ({
        ...prev,
        verificationResults: {
          ...prev.verificationResults,
          face: faceResult,
        },
        currentStep: "complete",
        verificationInProgress: false,
      }));

      setShowFaceVerificationModal(false);

      // If this was the last required verification step, proceed with shift action
      if (verificationState.currentStep === "face") {
        await proceedWithShiftAction();
      }
    },
    [verificationState.currentStep],
  );

  const proceedWithShiftAction = useCallback(async () => {
    if (!pendingShiftAction) return;

    try {
      setVerificationState((prev) => ({
        ...prev,
        verificationInProgress: true,
      }));

      const { face: faceResult, location: locationResult } =
        verificationState.verificationResults;

      // Prepare verification data for API
      const verificationData = {
        faceVerification: faceResult,
        locationVerification: locationResult,
        timestamp: new Date().toISOString(),
      };

      if (pendingShiftAction === "start") {
        await executeShiftStart(verificationData);
      } else {
        await executeShiftEnd(verificationData);
      }

      // Reset verification state
      resetVerificationState();
    } catch (error) {
      console.error("Error during verification flow:", error);
      showInAppNotification("Verification failed. Please try again.", "error");
      resetVerificationState();
    }
  }, [
    pendingShiftAction,
    verificationState.verificationResults,
    resetVerificationState,
  ]);

  // Enhanced verification orchestrator handlers
  const handleVerificationSuccess = useCallback(
    async (summary: any) => {
      try {
        setShowVerificationOrchestrator(false);
        setIsProcessingShift(true);

        console.log("Verification completed successfully:", summary);

        // Extract verification results from summary
        const locationStep = summary.completedSteps.includes("location");
        const faceStep = summary.completedSteps.includes("face");

        // Prepare verification data for API
        const verificationData = {
          sessionId: summary.sessionId,
          confidenceScore: summary.confidenceScore,
          fallbackMode: summary.fallbackMode,
          completedSteps: summary.completedSteps,
          totalLatency: summary.totalLatency,
          locationVerified: locationStep,
          faceVerified: faceStep,
        };

        // Proceed with shift action
        if (pendingShiftAction === "start") {
          await executeShiftStart(verificationData);
        } else if (pendingShiftAction === "end") {
          await executeShiftEnd(verificationData);
        }

        // Reset state
        setPendingShiftAction(null);
        setIsProcessingShift(false);

        // Show success notification
        showInAppNotification(
          `Shift ${pendingShiftAction} completed successfully with ${summary.confidenceScore}% confidence`,
          "success",
        );
      } catch (error) {
        console.error("Error processing verification success:", error);
        setIsProcessingShift(false);
        showInAppNotification(
          "Failed to process verification. Please try again.",
          "error",
        );
      }
    },
    [pendingShiftAction],
  );

  const handleVerificationError = useCallback((error: string) => {
    console.error("Verification failed:", error);
    setShowVerificationOrchestrator(false);
    setIsProcessingShift(false);
    setPendingShiftAction(null);

    showInAppNotification(
      error || "Verification failed. Please try again.",
      "error",
    );
  }, []);

  const handleVerificationCancel = useCallback(() => {
    console.log("Verification cancelled by user");
    setShowVerificationOrchestrator(false);
    setIsProcessingShift(false);
    setPendingShiftAction(null);

    showInAppNotification("Verification cancelled", "info");
  }, []);

  // Optimized confirmEndShift - fast UI updates, background processing
  const confirmEndShift = async () => {
    setIsProcessingShift(true);

    try {
      const now = new Date();
      if (!shiftStart) {
        setIsProcessingShift(false);
        return;
      }

      // Quick location check for employees (non-blocking)
      let locationData: any = undefined;
      if (user?.role === "employee" && !timerEndTime) {
        try {
          // Use cached location first for faster response
          let appLocation = convertToLocation(currentLocation);

          // If no cached location or it's stale, get fresh location with short timeout
          const isLocationStale =
            !appLocation?.timestamp ||
            new Date().getTime() - new Date(appLocation.timestamp).getTime() >
              120000; // 2 minutes

          if (!appLocation || isLocationStale) {
            try {
              const locationPromise = getCurrentLocation();
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Location timeout")), 3000); // 3 second timeout
              });

              const locationResult = await Promise.race([
                locationPromise,
                timeoutPromise,
              ]);
              if (locationResult) {
                appLocation = convertToLocation(locationResult);
                if (
                  locationResult &&
                  typeof locationResult === "object" &&
                  "coords" in locationResult
                ) {
                  useLocationStore
                    .getState()
                    .setCurrentLocation(locationResult as any);
                }
              }
            } catch (locationError) {
              console.log(
                "Quick location fetch failed for shift end, using cached location",
              );
            }
          }

          // Quick geofence validation
          if (appLocation) {
            const isInside = isLocationInAnyGeofence(appLocation);

            // Only block if outside geofence AND no override permission
            if (!isInside && !canOverrideGeofence) {
              const currentGeofence = getCurrentGeofence();
              setLocationErrorMessage(
                `You are currently outside the designated work area "${currentGeofence?.name || "Unknown"}". Please move to a work area or contact your administrator for permission to end your shift from this location.`,
              );
              setShowLocationError(true);
              setIsProcessingShift(false);
              return;
            }
            locationData = {
              latitude: appLocation.latitude,
              longitude: appLocation.longitude,
              accuracy: appLocation.accuracy || 0,
            };
          }
        } catch (error) {
          console.log(
            "Location validation failed for shift end, proceeding without location data",
          );
        }
      }

      // Cancel any active timer immediately (non-blocking)
      if (timerEndTime) {
        setTimerDuration(null);
        setTimerEndTime(null);

        // Cancel timer in background - don't wait for response
        axios
          .delete(
            `${process.env.EXPO_PUBLIC_API_URL}/api/shift-timer/shift/timer`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .catch((error) => {
            console.log("Non-critical error cancelling timer:", error);
          });
      }

      // Close modal immediately for better UX
      setShowModal(false);

      // Calculate duration for immediate feedback
      const duration = formatElapsedTime(differenceInSeconds(now, shiftStart));

      // Make API call with shorter timeout
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/end`,
        {
          endTime: formatDateForBackend(now),
          location: locationData,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000, // Reduced from 15s to 8s
        },
      );

      // Immediately update UI state after successful API response
      updateShiftState(false, null);

      // Clear monitoring resources immediately
      if (locationOffTimer) {
        clearTimeout(locationOffTimer);
        setLocationOffTimer(null);
      }
      if (locationCheckInterval) {
        clearInterval(locationCheckInterval);
        setLocationCheckInterval(null);
      }
      if (locationWatchId) {
        clearInterval(locationWatchId as any);
        setLocationWatchId(null);
      }

      // Store basic shift status change immediately
      await AsyncStorage.removeItem(`${user?.role}-shiftStatus`);

      // Handle Sparrow warnings and show modal immediately
      let modalTitle = "Shift Completed";
      let modalMessage = `Your shift has ended successfully.\n\nTotal Duration: ${duration}\nStart: ${format(shiftStart, "hh:mm a")}\nEnd: ${format(now, "hh:mm a")}`;

      if (response.data.sparrowWarning) {
        const warningMessage =
          response.data.sparrowMessage ||
          "There was an issue with the attendance system.";

        if (response.data.sparrowErrorType === "SPARROW_COOLDOWN_ERROR") {
          modalTitle = "Attendance Error";
          modalMessage =
            response.data.sparrowErrors?.[0] ||
            "You need to wait before ending your shift.";
        } else {
          modalTitle =
            response.data.sparrowErrorType === "SPARROW_ROSTER_ERROR"
              ? "Roster Warning"
              : response.data.sparrowErrorType === "SPARROW_SCHEDULE_ERROR"
                ? "Schedule Warning"
                : "Attendance Warning";
          modalMessage = warningMessage;
        }
      } else {
        modalMessage += "\n\nProcessing attendance in the background...";
      }

      // Show completion modal immediately
      setModalData({
        title: modalTitle,
        message: modalMessage,
        type: "success",
        showCancel: false,
      });
      setShowModal(true);

      // Set cooldown after successful shift end
      await setShiftCooldown();

      // Move heavy operations to background
      InteractionManager.runAfterInteractions(async () => {
        try {
          // Create shift data for history
          const newShiftData: ShiftData = {
            date: format(shiftStart, "yyyy-MM-dd"),
            startTime: format(shiftStart, "HH:mm:ss"),
            endTime: format(now, "HH:mm:ss"),
            duration,
          };

          // Cancel notifications and update storage in background
          const backgroundPromises = [
            cancelShiftNotifications(),
            AsyncStorage.setItem(
              `${user?.role}-shiftHistory`,
              JSON.stringify([newShiftData, ...shiftHistory]),
            ),
            loadShiftHistoryFromBackend(),
            fetchRecentShifts(),
          ];

          // Send admin notification if not management
          if (user?.role !== "management") {
            backgroundPromises.push(
              axios
                .post(
                  `${process.env.EXPO_PUBLIC_API_URL}${getNotificationEndpoint(user?.role || "employee")}`,
                  {
                    title: `🔴 Shift Ended, by ${user?.name}`,
                    message: `👤 ${user?.name} has completed their shift\n⏱️ Duration: ${duration}\n🕒 Start: ${format(shiftStart, "hh:mm a")}\n🕕 End: ${format(now, "hh:mm a")}`,
                    type: "shift-end",
                  },
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  },
                )
                .then(() => {})
                .catch((error) =>
                  console.log("Admin notification failed:", error),
                ),
            );
          }

          // Execute all background operations
          await Promise.allSettled(backgroundPromises);

          // Update modal message to show completion
          if (!response.data.sparrowWarning) {
            setModalData((prev) => ({
              ...prev,
              message: prev.message.replace(
                "Processing attendance in the background...",
                "Attendance has been successfully registered.",
              ),
            }));
          }
        } catch (error) {
          console.error("Background operations failed for shift end:", error);
          showInAppNotification(
            "Shift ended but some background operations failed",
            "warning",
          );
        }
      });

      // Reset location validation state
      setLocationValidated(false);
    } catch (error: any) {
      console.error("Error ending shift:", error);

      // Revert UI state on error
      updateShiftState(true, shiftStart);

      let errorMessage = "Failed to end shift. Please try again.";
      if (error.code === "ECONNABORTED") {
        errorMessage =
          "Request timed out. Please check your connection and try again.";
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      setModalData({
        title: "Error Ending Shift",
        message: errorMessage,
        type: "info",
        showCancel: false,
      });
      setShowModal(true);
    } finally {
      setIsProcessingShift(false);
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const fetchRecentShifts = async () => {
    try {
      setIsRefreshing(true);
      const response = await axios.get<RecentShift[]>(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shifts/recent`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // Process and set the recent shifts
      const formattedShifts = response.data.map((shift: RecentShift) => {
        // Since timestamps are already in IST from backend, just create Date objects
        const startDate = new Date(shift.start_time);
        const endDate = shift.end_time ? new Date(shift.end_time) : null;

        return {
          ...shift,
          date: format(startDate, "yyyy-MM-dd"),
          // Format times in 12-hour format
          start_time: format(startDate, "hh:mm a"),
          end_time: endDate ? format(endDate, "hh:mm a") : "Ongoing",
          duration: shift.duration
            ? parseFloat(shift.duration).toFixed(1)
            : "0.0",
        };
      });

      setRecentShifts(formattedShifts);
    } catch (error) {
      console.error("Error fetching recent shifts:", error);
      Alert.alert("Error", "Failed to fetch recent shifts");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecentShifts();
  }, []);

  // Add this effect to handle the refresh animation
  React.useEffect(() => {
    if (isRefreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [isRefreshing]);

  // Add this with other interpolations
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Update the handleSetTimer function with proper timezone handling
  const handleSetTimer = async (hours: number) => {
    try {
      // Show loading state immediately
      setShowTimerPicker(false);
      showInAppNotification("Setting up auto-end timer...", "info");

      // Call the backend API to set the timer
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/shift-timer/shift/timer`,
        { durationHours: hours },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.success) {
        // The endTime from server is in IST format
        const endTimeString = response.data.timer.endTime;
        console.log("Received end time from server (IST):", endTimeString);

        // Parse the time string and ensure it's treated as IST
        let endTime: Date;

        if (endTimeString.includes("+") || endTimeString.includes("Z")) {
          // Time string has timezone info, use it directly
          endTime = new Date(endTimeString);
        } else {
          // Time string doesn't have timezone info, treat as IST
          // Add +05:30 offset to make it clear it's IST
          endTime = new Date(endTimeString + "+05:30");
        }

        console.log("Parsed end time as IST:", endTime.toString());
        console.log("Local time representation:", endTime.toLocaleString());

        setTimerDuration(hours);
        setTimerEndTime(endTime);

        // Show confirmation modal
        setModalData({
          title: "Timer Set",
          message: `Your shift will automatically end at ${format(
            endTime,
            "hh:mm a",
          )}. This will happen even if the app is closed.`,
          type: "success",
          showCancel: false,
        });
        setShowModal(true);

        showInAppNotification("Auto-end timer set successfully", "success");
      } else {
        showInAppNotification("Failed to set timer", "error");
      }
    } catch (error: any) {
      console.error("Error setting timer:", error);
      showInAppNotification(
        error.response?.data?.error || "Failed to set timer",
        "error",
      );
    }
  };

  // Modify the handleCancelTimer function to handle 404 responses
  const handleCancelTimer = async () => {
    try {
      showInAppNotification("Cancelling auto-end timer...", "info");

      // Call the backend API to cancel the timer
      const response = await axios.delete(
        `${process.env.EXPO_PUBLIC_API_URL}/api/shift-timer/shift/timer`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.success) {
        // Reset local state
        setTimerDuration(null);
        setTimerEndTime(null);
        showInAppNotification("Auto-end timer cancelled", "success");
      } else {
        showInAppNotification("Failed to cancel timer", "error");
      }
    } catch (error: any) {
      console.error("Error cancelling timer:", error);

      // Handle 404 response (no active timer) as a non-error condition
      if (error.response?.status === 404) {
        // No active timer found, which is fine - reset the UI
        setTimerDuration(null);
        setTimerEndTime(null);
        showInAppNotification("No active timer found", "info");
      } else {
        // For other errors, show the error message
        showInAppNotification(
          error.response?.data?.error || "Failed to cancel timer",
          "error",
        );
      }
    }
  };

  // Update the checkExistingTimer function to handle IST time
  const checkExistingTimer = async () => {
    try {
      // Only check if we don't have a timer set locally
      if (!timerEndTime && isShiftActive) {
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/shift-timer/shift/timer`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.data.success && response.data.timer) {
          // Log the response to help debug timezone issues
          console.log("Retrieved timer from server:", response.data.timer);

          // The endTime from server is in IST format
          const endTimeString = response.data.timer.endTime;
          console.log("Server returned end time (IST):", endTimeString);

          // Parse the time string and ensure it's treated as IST
          // If the time string already has timezone info, use it directly
          // If not, we need to manually handle it as IST
          let endTime: Date;

          if (endTimeString.includes("+") || endTimeString.includes("Z")) {
            // Time string has timezone info, use it directly
            endTime = new Date(endTimeString);
          } else {
            // Time string doesn't have timezone info, treat as IST
            // Add +05:30 offset to make it clear it's IST
            endTime = new Date(endTimeString + "+05:30");
          }

          console.log("Parsed end time as IST:", endTime.toString());
          console.log("Local time representation:", endTime.toLocaleString());

          setTimerDuration(response.data.timer.durationHours);
          setTimerEndTime(endTime);

          // Only show notification if the timer is still in the future
          if (endTime > new Date()) {
            showInAppNotification(
              `Auto-end timer active: Shift will end at ${format(endTime, "hh:mm a")}`,
              "info",
            );
          }
        }
      }
    } catch (error: any) {
      // Handle 404 (not found) as an expected condition
      if (error.response?.status === 404) {
        console.log(
          `[TIMER] No active timer found for ${user?.role} - this is normal`,
        );
        // Ensure local state is reset
        setTimerDuration(null);
        setTimerEndTime(null);
      } else {
        // Log other errors that are actual problems
        console.error(`[TIMER] Error checking for existing timer:`, error);
      }
    }
  };

  // Add useEffect to check for existing timer when shift becomes active
  useEffect(() => {
    if (isShiftActive) {
      checkExistingTimer();
    }
  }, [isShiftActive]);

  // Modify the timer UI section
  {
    isShiftActive && !timerEndTime && (
      <View className="mt-6">
        <TouchableOpacity
          onPress={() => setShowTimerPicker(true)}
          className={`px-6 py-3 rounded-lg flex-row items-center justify-center ${
            isDark ? "bg-blue-600" : "bg-blue-500"
          }`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <Ionicons name="timer-outline" size={24} color="white" />
          <Text className="text-white font-semibold ml-2">
            Set Auto-End Timer
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  {
    timerEndTime && (
      <View className="mt-4 items-center">
        <Text
          className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
        >
          Shift will end in
        </Text>
        <View className="flex-row items-center">
          <Ionicons
            name="timer-outline"
            size={20}
            color={isDark ? "#60A5FA" : "#3B82F6"}
          />
          <Text
            className={`ml-2 font-semibold ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`}
          >
            {format(timerEndTime, "hh:mm a")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCancelTimer}
          className="mt-2 px-4 py-2 rounded-lg bg-red-500"
        >
          <Text className="text-white font-semibold">Cancel Timer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Add this near other useEffect hooks
  useEffect(() => {
    // Handle notification dismissal attempts
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "active-shift" && isShiftActive) {
          // Reschedule the notification if it was dismissed and shift is still active
          schedulePersistentNotification();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isShiftActive]);

  // Add this near your other useEffect hooks
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { type, notificationId } =
          response.notification.request.content.data || {};

        if (
          type === "active-shift" &&
          response.actionIdentifier === "dismiss"
        ) {
          // Cancel the notification when dismiss is pressed
          Notifications.dismissNotificationAsync(
            response.notification.request.identifier,
          );
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Create a function to handle refresh
  const onRefresh = useCallback(async () => {
    console.log("Refreshing data and permissions");
    setIsRefreshing(true);

    try {
      // Run these operations in parallel
      await Promise.all([
        fetchAndUpdateGeofencePermissions(),
        loadShiftHistoryFromBackend(),
        fetchRecentShifts(),
      ]);

      // Show success notification
      showInAppNotification("Data refreshed successfully", "success");
    } catch (error) {
      console.error("Error during refresh:", error);
      showInAppNotification("Failed to refresh some data", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [user, token]);

  // Add useEffect to update address when location changes
  useEffect(() => {
    const updateAddress = async () => {
      if (currentLocation?.latitude && currentLocation?.longitude) {
        const address = await getLocationAddress(
          currentLocation.latitude,
          currentLocation.longitude,
        );
        setCurrentAddress(address);
      }
    };

    updateAddress();
  }, [currentLocation]);

  // Add this useEffect for cleanup when component unmounts
  useEffect(() => {
    // Return cleanup function
    return () => {
      // If shift is active when component unmounts, make sure to clean up resources
      // but don't actually end the shift (that would happen through the UI)
      if (isShiftActive) {
        // Clean up any location monitoring resources
        if (locationOffTimer) {
          clearTimeout(locationOffTimer);
        }

        if (locationCheckInterval) {
          clearInterval(locationCheckInterval);
        }

        if (locationWatchId) {
          clearInterval(locationWatchId as any);
        }
      }
    };
  }, [isShiftActive, locationOffTimer, locationCheckInterval, locationWatchId]);

  // Add this function after fetchRecentShifts
  const checkIfShiftAutoEnded = async () => {
    // Only check if we think we have an active shift
    if (!isShiftActive || !shiftStart) {
      return;
    }

    try {
      // Check with backend if the shift is still active
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/shift/current`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const currentShiftOnServer = response.data;

      // If we think shift is active but backend shows no active shift,
      // the shift was likely auto-ended
      if (!currentShiftOnServer) {
        console.log("Detected auto-ended shift - updating UI");

        // Update local state
        setIsShiftActive(false);
        setShiftStart(null);
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);

        // Clear shift status in AsyncStorage
        await AsyncStorage.removeItem(`${user?.role}-shiftStatus`);

        // Cancel any notifications
        await cancelShiftNotifications();

        // Reset timer state
        setTimerDuration(null);
        setTimerEndTime(null);

        // Show notification to user
        showInAppNotification(
          "Your shift was automatically ended by the timer",
          "info",
        );

        // Refresh shift history data
        await Promise.all([loadShiftHistoryFromBackend(), fetchRecentShifts()]);
      }
    } catch (error) {
      console.error("Error checking if shift was auto-ended:", error);
    }
  };

  // Add a useFocusEffect to check for auto-ended shifts when screen regains focus
  useFocusEffect(
    useCallback(() => {
      console.log("ShiftTracker screen focused - checking shift status");
      checkIfShiftAutoEnded();
      fetchAndUpdateGeofencePermissions();
    }, [user, token]),
  );

  // Add a periodic check during active shifts to detect auto-ended shifts
  useEffect(() => {
    // Only run this effect if a shift is active
    if (!isShiftActive) {
      return;
    }

    // Check every minute if the shift was auto-ended
    const autoEndCheckInterval = setInterval(() => {
      checkIfShiftAutoEnded();
    }, 60000); // Check every minute

    return () => {
      clearInterval(autoEndCheckInterval);
    };
  }, [isShiftActive]);

  // Add this near other useEffect hooks
  useEffect(() => {
    // Set up notification listeners for auto-ended shifts
    const notificationReceivedListener =
      Notifications.addNotificationReceivedListener((notification) => {
        // Check if this is a shift-end-auto notification
        const data = notification.request.content.data;
        if (data?.type === "shift-end-auto" && isShiftActive) {
          console.log("Received auto-end notification - updating UI");

          // Update the UI immediately
          setIsShiftActive(false);
          setShiftStart(null);
          pulseAnim.setValue(1);
          rotateAnim.setValue(0);

          // Clear AsyncStorage
          AsyncStorage.removeItem(`${user?.role}-shiftStatus`);

          // Cancel any scheduled warning/limit notifications
          cancelShiftNotifications();

          // Reset timer state
          setTimerDuration(null);
          setTimerEndTime(null);

          // Refresh data
          loadShiftHistoryFromBackend();
          fetchRecentShifts();
        }
      });

    // Clean up listener on unmount
    return () => {
      notificationReceivedListener.remove();
    };
  }, [isShiftActive]);

  // Add this effect to handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // When app comes to foreground from background
      if (nextAppState === "active" && isShiftActive) {
        console.log("App came to foreground, checking if shift was auto-ended");
        checkIfShiftAutoEnded();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isShiftActive]);

  // Add this function before the return statement
  const handleAddressRefresh = async () => {
    try {
      setIsAddressRefreshing(true);
      const location = await getCurrentLocation();

      if (location) {
        const appLocation = convertToLocation(location);
        if (appLocation?.latitude && appLocation?.longitude) {
          const address = await getLocationAddress(
            appLocation.latitude,
            appLocation.longitude,
          );
          setCurrentAddress(address);
        }
      }
    } catch (error) {
      console.error("Error refreshing address:", error);
      showInAppNotification("Failed to update location", "error");
    } finally {
      setIsAddressRefreshing(false);
    }
  };

  // // Add a new useEffect to periodically update location in the background
  // // when the app is active and in the foreground
  // useEffect(() => {
  //   // Create a periodic refresh for location data when app is in foreground
  //   const locationRefreshInterval = setInterval(async () => {
  //     try {
  //       // Only refresh when app is in foreground
  //       if (AppState.currentState === 'active') {
  //         console.log("Background location refresh");
  //         const location = await getCurrentLocation();

  //         if (location) {
  //           // Update the store with fresh location
  //           useLocationStore.getState().setCurrentLocation(location);

  //           // Update address in background
  //           const appLocation = convertToLocation(location);
  //           if (appLocation?.latitude && appLocation?.longitude) {
  //             getLocationAddress(appLocation.latitude, appLocation.longitude)
  //               .then(address => setCurrentAddress(address))
  //               .catch(error => console.log("Error getting address:", error));
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Background location refresh failed:", error);
  //     }
  //   }, 60000); // Refresh every 60 seconds when app is in foreground

  //   return () => {
  //     clearInterval(locationRefreshInterval);
  //   };
  // }, [user?.role]);

  // Handler functions for embedded map integration
  const handleMapLocationUpdate = useCallback((location: AppLocation) => {
    console.log("Map location updated:", location);

    // Update the current location in the store
    if (location.latitude && location.longitude) {
      const enhancedLocation = {
        coords: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || null,
          altitude: location.altitude || null,
          altitudeAccuracy: location.altitudeAccuracy || null,
          heading: location.heading || null,
          speed: location.speed || null,
        },
        timestamp:
          typeof location.timestamp === "string"
            ? new Date(location.timestamp).getTime()
            : location.timestamp || Date.now(),
        batteryLevel: location.batteryLevel,
        isMoving: location.isMoving,
      };

      useLocationStore.getState().setCurrentLocation(enhancedLocation);

      // Update address
      getLocationAddress(location.latitude, location.longitude)
        .then((address) => setCurrentAddress(address))
        .catch((error) =>
          console.log("Error getting address from map:", error),
        );
    }
  }, []);

  const handleGeofenceStatusChange = useCallback(
    (isInside: boolean, geofenceName?: string) => {
      console.log("Geofence status changed:", { isInside, geofenceName });

      // Update geofence status in store
      const currentGeofence = getCurrentGeofence();
      setIsInGeofence(isInside, currentGeofence?.id);

      // Show notification for geofence changes during active shift
      if (isShiftActive) {
        const message = isInside
          ? `Entered work area: ${geofenceName || "Unknown"}`
          : `Exited work area: ${geofenceName || "Unknown"}`;

        showInAppNotification(message, isInside ? "success" : "warning");
      }
    },
    [isShiftActive, getCurrentGeofence, setIsInGeofence],
  );

  const handleLocationRetry = useCallback(async () => {
    try {
      setShowLocationError(false);
      setLocationErrorMessage("");

      // Show loading state
      showInAppNotification("Retrying location...", "info");

      // Use the same robust retry mechanism as initialization
      let location = null;
      let lastError = null;

      // Try with different timeout values and accuracy settings
      const attempts = [
        { timeout: 15000, accuracy: Location.Accuracy.BestForNavigation },
        { timeout: 20000, accuracy: Location.Accuracy.High },
        { timeout: 25000, accuracy: Location.Accuracy.Balanced },
      ];

      for (let i = 0; i < attempts.length; i++) {
        const { timeout, accuracy } = attempts[i];
        console.log(`Location retry attempt ${i + 1}/${attempts.length} with ${timeout}ms timeout and ${accuracy} accuracy`);
        
        try {
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy,
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Location timeout")), timeout);
          });

          location = await Promise.race([locationPromise, timeoutPromise]);
          
          if (location) {
            console.log(`Location obtained successfully on retry attempt ${i + 1}`);
            break;
          }
        } catch (error) {
          console.log(`Location retry attempt ${i + 1} failed:`, error);
          lastError = error;
          
          // If this is not the last attempt, wait a bit before trying again
          if (i < attempts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (location) {
        // Update the store with the fresh location
        if (
          location &&
          typeof location === "object" &&
          "coords" in location
        ) {
          useLocationStore.getState().setCurrentLocation(location as any);
        }

        const appLocation = convertToLocation(location);
        if (appLocation?.latitude && appLocation?.longitude) {
          // Update address
          const address = await getLocationAddress(
            appLocation.latitude,
            appLocation.longitude,
          );
          setCurrentAddress(address);

          // Check geofence status
          const isInside = isLocationInAnyGeofence(appLocation);
          const currentGeofence = getCurrentGeofence();
          setIsInGeofence(isInside, currentGeofence?.id);

          showInAppNotification("Location updated successfully", "success");
        }
      } else {
        // All retry attempts failed
        console.error("All location retry attempts failed:", lastError);
        setLocationErrorMessage(
          "Unable to determine your current location after multiple attempts. Please ensure location permissions are granted and try again. You can still use the app with limited functionality.",
        );
        setShowLocationError(true);
        showInAppNotification(
          "Location retry failed. Please check your device settings.",
          "error",
        );
      }
    } catch (error) {
      console.error("Location retry failed:", error);
      setLocationErrorMessage(
        "Location retry failed. Please check your device settings and try again.",
      );
      setShowLocationError(true);
      showInAppNotification(
        "Location retry failed. Please check your device settings.",
        "error",
      );
    }
  }, [
    isLocationInAnyGeofence,
    getCurrentGeofence,
    setIsInGeofence,
  ]);

  return (
    <SafeAreaView
      className={`flex-1 pb-4 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <StatusBar
        backgroundColor={isDark ? "#1F2937" : "#FFFFFF"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        className="pb-4"
        style={styles.header}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={handleBackNavigation}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-2xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {getRoleSpecificTitle(user?.role || "employee")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6", "#10B981"]}
            tintColor={isDark ? "#60A5FA" : "#3B82F6"}
            title="Refreshing permissions and data..."
            titleColor={isDark ? "#D1D5DB" : "#6B7280"}
          />
        }
      >
        {(user?.role === "employee" || user?.role === "group-admin") && (
          <View
            className={`rounded-lg p-4 mb-4 ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className={`font-semibold ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Location Status
              </Text>
              <View
                className={`px-2 py-1 rounded-full ${
                  isInGeofence ? "bg-green-100" : "bg-yellow-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    isInGeofence ? "text-green-800" : "text-yellow-800"
                  }`}
                >
                  {isInGeofence ? "In Work Area" : "Outside Work Area"}
                </Text>
              </View>
            </View>

            {/* Small Integrated Map Section */}
            <View className="mb-2">
              <View style={styles.mapContainer}>
                <LiveTrackingMap
                  containerStyle={styles.smallMap}
                  geofences={geofences}
                  currentGeofence={getCurrentGeofence()}
                  routeCoordinates={[]}
                  showControls={true}
                  showUserPaths={true}
                  showGeofences={true}
                  defaultFullscreen={true}
                />
              </View>

              {/* Location Info Panel */}
              <View
                className={`mt-3 p-3 rounded-lg ${isDark ? "bg-gray-800" : "bg-white"}`}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text
                      className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Current Position
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text
                        className={`text-sm ${isDark ? "text-white" : "text-gray-800"}`}
                        numberOfLines={2}
                      >
                        {currentAddress}
                      </Text>
                      <TouchableOpacity
                        onPress={handleAddressRefresh}
                        disabled={isAddressRefreshing}
                        className="ml-2"
                      >
                        <Animated.View
                          style={{
                            transform: [{ rotate: addressRefreshRotate }],
                          }}
                        >
                          <Ionicons
                            name="refresh-outline"
                            size={16}
                            color={isDark ? "#9CA3AF" : "#6B7280"}
                          />
                        </Animated.View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View className="ml-4">
                    <Text
                      className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Battery
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons
                        name={
                          batteryLevel > 75
                            ? "battery-full"
                            : batteryLevel > 45
                              ? "battery-half"
                              : batteryLevel > 15
                                ? "battery-half"
                                : "battery-dead"
                        }
                        size={16}
                        color={
                          batteryLevel > 20
                            ? isDark
                              ? "#10B981"
                              : "#059669"
                            : "#EF4444"
                        }
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        className={`text-sm ${
                          batteryLevel > 20
                            ? isDark
                              ? "text-green-400"
                              : "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {batteryLevel}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Location accuracy indicator */}
                {currentLocation?.coords?.accuracy && (
                  <View className="mt-2">
                    <Text
                      className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Accuracy: {Math.round(currentLocation.coords.accuracy)}m
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {/* <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Current Position
                  </Text>
                  <View className="flex-row items-center">
                    <Text className={`${isDark ? "text-white" : "text-gray-800"}`}>
                      {currentAddress}
                    </Text>
                    <TouchableOpacity 
                      onPress={handleAddressRefresh}
                      disabled={isAddressRefreshing}
                      className="ml-2"
                    >
                      <Animated.View style={{ transform: [{ rotate: addressRefreshRotate }] }}>
                        <Ionicons
                          name="refresh-outline"
                          size={16}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text
                    className={`text-xs text-right ${
                      isDark ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Battery
                  </Text>
                  <View className="flex-row items-center justify-end">
                    <Ionicons
                      name={
                        batteryLevel > 75
                          ? "battery-full"
                          : batteryLevel > 45
                          ? "battery-half"
                          : batteryLevel > 15
                          ? "battery-half"
                          : "battery-dead"
                      }
                      size={16}
                      color={
                        batteryLevel > 20
                          ? isDark
                            ? "#10B981"
                            : "#059669"
                          : "#EF4444"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className={`${
                        batteryLevel > 20
                          ? isDark
                            ? "text-green-400"
                            : "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {batteryLevel}%
                    </Text>
                  </View>
                </View>
              </View> */}

            {/* Geofence status indicators */}
            {/* <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center">
                <Ionicons
                  name={isInGeofence ? "location" : "location-outline"}
                  size={16}
                  color={isInGeofence ? "#10B981" : "#F59E0B"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {isInGeofence 
                    ? `Inside: ${getCurrentGeofence()?.name || 'Work Area'}`
                    : 'Outside work areas'
                  }
                </Text>
              </View>
              

            </View> */}

            {/* Add geofence override indicator */}
            {canOverrideGeofence && (
              <View className="mt-2 px-3 py-1 bg-blue-100 self-start rounded-full">
                <Text className="text-xs text-blue-800 font-medium">
                  Geofence Override Enabled
                </Text>
              </View>
            )}

            {/* Location error handling */}
            {showLocationError && (
              <View className="mt-2 p-3 bg-red-100 rounded-lg">
                <View className="flex-row items-center">
                  <Ionicons name="warning" size={16} color="#EF4444" />
                  <Text className="text-red-800 text-sm font-medium ml-2">
                    Location Error
                  </Text>
                </View>
                <Text className="text-red-700 text-sm mt-1">
                  {locationErrorMessage}
                </Text>
                <TouchableOpacity
                  onPress={handleLocationRetry}
                  className="mt-2 px-3 py-1 bg-red-500 rounded-md self-start"
                >
                  <Text className="text-white text-xs font-medium">
                    Retry Location
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View
          className={`rounded-lg p-6 mb-6 ${
            isDark ? "bg-gray-800" : "bg-white"
          }`}
        >
          <Text
            className={`text-center text-4xl font-bold mb-4 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {format(currentTime, "HH:mm:ss")}
          </Text>
          <Text
            className={`text-center text-lg ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {format(currentTime, "EEEE, MMMM do, yyyy")}
          </Text>
        </View>

        <View className="items-center mb-6">
          {/* Cooldown indicator */}
          {shiftCooldownUntil !== null && cooldownTimeLeft > 0 && (
            <View
              className={`mb-4 px-4 py-2 rounded-lg ${isDark ? "bg-orange-900" : "bg-orange-100"}`}
            >
              <Text
                className={`text-center text-sm ${isDark ? "text-orange-300" : "text-orange-800"}`}
              >
                Action cooldown: {Math.floor(cooldownTimeLeft / 60)}m{" "}
                {cooldownTimeLeft % 60}s remaining
              </Text>
            </View>
          )}

          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
            }}
          >
            <TouchableOpacity
              onPress={
                isShiftActive
                  ? () => startEndShiftVerification("end")
                  : () => startEndShiftVerification("start")
              }
              disabled={
                isShiftStatusLoading ||
                isProcessingShift ||
                (shiftCooldownUntil !== null && cooldownTimeLeft > 0)
              }
              className={`w-40 h-40 rounded-full items-center justify-center ${
                isShiftStatusLoading ||
                isProcessingShift ||
                (shiftCooldownUntil !== null && cooldownTimeLeft > 0)
                  ? "bg-gray-400"
                  : isShiftActive
                    ? "bg-red-500"
                    : "bg-green-500"
              }`}
              style={{
                opacity:
                  isShiftStatusLoading ||
                  isProcessingShift ||
                  (shiftCooldownUntil !== null && cooldownTimeLeft > 0)
                    ? 0.7
                    : 1.0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              {isShiftStatusLoading ? (
                <View className="items-center justify-center">
                  <Animated.View style={{ transform: [{ rotate }] }}>
                    <Ionicons
                      name="hourglass-outline"
                      size={60}
                      color="white"
                    />
                  </Animated.View>
                  <Text className="text-white text-lg font-bold mt-2">
                    Loading...
                  </Text>
                </View>
              ) : isProcessingShift ? (
                <View className="items-center justify-center">
                  <Animated.View style={{ transform: [{ rotate }] }}>
                    <Ionicons
                      name="hourglass-outline"
                      size={60}
                      color="white"
                    />
                  </Animated.View>
                  <Text className="text-white text-lg font-bold mt-2">
                    Processing...
                  </Text>
                </View>
              ) : shiftCooldownUntil !== null && cooldownTimeLeft > 0 ? (
                <View className="items-center justify-center">
                  <Ionicons name="timer-outline" size={60} color="white" />
                  <Text className="text-white text-lg font-bold mt-2">
                    Cooldown
                  </Text>
                  <Text className="text-white text-xs">
                    {Math.floor(cooldownTimeLeft / 60)}:
                    {(cooldownTimeLeft % 60).toString().padStart(2, "0")}
                  </Text>
                </View>
              ) : (
                <View className="items-center justify-center">
                  <Animated.View style={{ transform: [{ rotate }] }}>
                    <Ionicons
                      name={isShiftActive ? "power" : "power-outline"}
                      size={60}
                      color="white"
                    />
                  </Animated.View>
                  <Text className="text-white text-xl font-bold mt-2">
                    {isShiftActive ? "End Shift" : "Start Shift"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {isShiftActive && !timerEndTime && !isProcessingShift && (
            <View className="mt-6">
              <TouchableOpacity
                onPress={() => setShowTimerPicker(true)}
                className={`px-6 py-3 rounded-lg flex-row items-center justify-center ${
                  isDark ? "bg-blue-600" : "bg-blue-500"
                }`}
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Ionicons name="timer-outline" size={24} color="white" />
                <Text className="text-white font-semibold ml-2">
                  Set Auto-End Timer
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {timerEndTime && !isProcessingShift && (
            <View className="mt-4 items-center">
              <Text
                className={`text-sm ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Shift will end in
              </Text>
              <View className="flex-row items-center">
                <Ionicons
                  name="timer-outline"
                  size={20}
                  color={isDark ? "#60A5FA" : "#3B82F6"}
                />
                <Text
                  className={`ml-2 font-semibold ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  {format(timerEndTime, "hh:mm a")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCancelTimer}
                className="mt-2 px-4 py-2 rounded-lg bg-red-500"
              >
                <Text className="text-white font-semibold">Cancel Timer</Text>
              </TouchableOpacity>
            </View>
          )}

          {isShiftActive && (
            <View className="mt-6">
              <Text
                className={`text-center text-lg ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Current Shift Duration
              </Text>
              <Text
                className={`text-center text-3xl font-bold ${
                  isDark ? "text-blue-400" : "text-blue-500"
                }`}
              >
                {formatTime(elapsedTime)}
              </Text>
            </View>
          )}
        </View>

        <View className="mt-4">
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className={`text-lg font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Recent Shifts
            </Text>
            <TouchableOpacity
              onPress={fetchRecentShifts}
              disabled={isRefreshing}
              className={`p-2 rounded-full ${
                isDark ? "bg-gray-800" : "bg-gray-100"
              }`}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {recentShifts.length > 0 ? (
            recentShifts.map((shift: RecentShift, index: number) => (
              <View
                key={index}
                className={`mb-3 p-4 rounded-lg ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
                style={[
                  styles.shiftCard,
                  { borderLeftWidth: 4, borderLeftColor: "#3B82F6" },
                ]}
              >
                <View>
                  <Text
                    className={`text-sm mb-2 ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    {format(new Date(shift.date), "EEEE, MMMM do, yyyy")}
                  </Text>
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text
                        className={`text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Shift Time
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          className={`text-base font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {shift.start_time} - {shift.end_time}
                        </Text>
                      </View>
                    </View>
                    <View>
                      <Text
                        className={`text-sm text-right ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Duration
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons
                          name="hourglass-outline"
                          size={16}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          className={`text-base font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {shift.duration} hrs
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View
              className={`p-8 rounded-lg ${
                isDark ? "bg-gray-800" : "bg-white"
              }`}
            >
              <View className="items-center">
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={isDark ? "#4B5563" : "#9CA3AF"}
                />
                <Text
                  className={`text-center mt-2 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  No recent shifts found
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push("/(dashboard)/shared/attendanceManagement")
          }
          className={`mx-4 my-6 p-4 rounded-xl flex-row items-center justify-center ${
            isDark ? "bg-blue-900" : "bg-blue-500"
          }`}
          style={styles.attendanceButton}
        >
          <Ionicons name="calendar-outline" size={24} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">
            Attendance Management
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <Text
              className={`text-xl font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {modalData.title}
            </Text>
            <Text
              className={`text-base mb-6 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {modalData.message}
            </Text>
            <View className={`flex-row justify-between gap-4`}>
              {modalData.showCancel && (
                <TouchableOpacity
                  onPress={() => {
                    if (modalData.onCancel) {
                      modalData.onCancel();
                    }
                    setShowModal(false);
                  }}
                  className="flex-1 py-3 rounded-lg bg-gray-500"
                >
                  <Text className="text-white text-center font-semibold">
                    {modalData.cancelText || "Cancel"}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (modalData.onConfirm) {
                    modalData.onConfirm();
                  } else if (modalData.showCancel) {
                    confirmEndShift();
                  }
                  setShowModal(false);
                }}
                className={`flex-1 py-3 rounded-lg ${
                  modalData.type === "success" ? "bg-green-500" : "bg-blue-500"
                }`}
              >
                <Text className="text-white text-center font-semibold">
                  {modalData.confirmText ||
                    (modalData.showCancel ? "Confirm" : "OK")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TimerPicker
        visible={showTimerPicker}
        onClose={() => setShowTimerPicker(false)}
        onSelectHours={handleSetTimer}
        isDark={isDark}
      />

      {/* Warning Modal */}
      <Modal visible={showWarningModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="warning-outline" size={24} color="#EF4444" />
              <Text className={`ml-2 text-xl font-bold text-red-500`}>
                {combinedWarningMessage.title}
              </Text>
            </View>

            {combinedWarningMessage.notices.map((notice, index) => (
              <View key={index} className="mb-4">
                <Text className={`text-lg font-semibold text-red-500 mb-2`}>
                  {notice.title}
                </Text>
                <Text
                  className={`text-base ${
                    isDark ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {notice.message}
                </Text>
                {index === 0 && <View className="h-px bg-gray-300 my-4" />}
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setShowWarningModal(false)}
              className="mt-2 py-3 rounded-lg bg-blue-500"
            >
              <Text className="text-white text-center font-semibold">
                I Understand
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add InAppNotification component */}
      <InAppNotification
        visible={inAppNotification.visible}
        message={inAppNotification.message}
        type={inAppNotification.type}
        onDismiss={() =>
          setInAppNotification({ ...inAppNotification, visible: false })
        }
      />

      {/* Enhanced Location error modal */}
      <Modal visible={showLocationError} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="location-outline" size={24} color="#EF4444" />
              <Text className={`ml-2 text-xl font-bold text-red-500`}>
                Location Error
              </Text>
            </View>
            <Text
              className={`text-base mb-6 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {locationErrorMessage}
            </Text>
            <View className="flex-row justify-between gap-4">
              <TouchableOpacity
                onPress={() => setShowLocationError(false)}
                className="flex-1 py-3 rounded-lg bg-gray-500"
              >
                <Text className="text-white text-center font-semibold">
                  Later
                </Text>
              </TouchableOpacity>
              {canOverrideGeofence && (
                <TouchableOpacity
                  onPress={async () => {
                    setShowLocationError(false);

                    try {
                      // This will trigger the system location prompt if location is disabled
                      const { status: foregroundStatus } =
                        await Location.requestForegroundPermissionsAsync();

                      if (foregroundStatus === "granted") {
                        // If permissions are granted, try to get location which will prompt location services
                        try {
                          await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                            // This is important - it forces the location prompt even when location services are off
                            mayShowUserSettingsDialog: true,
                          });

                          // If we get here, location services should be enabled
                          showInAppNotification(
                            "Location services enabled successfully.",
                            "success",
                          );

                          // Reinitialize location
                          const location = await getCurrentLocation();
                          if (location) {
                            // Update geofence status
                            const locationForGeofenceCheck = convertToLocation(
                              location,
                            ) as AppLocation | null;
                            const isInside =
                              locationForGeofenceCheck !== null
                                ? isLocationInAnyGeofence(
                                    locationForGeofenceCheck,
                                  )
                                : false;
                            console.log(
                              "Location enabled, updated geofence status:",
                              { isInside, location },
                            );
                          }
                        } catch (locationError) {
                          console.error(
                            "Error requesting location:",
                            locationError,
                          );
                          // The user likely denied the location services prompt
                          showInAppNotification(
                            "Please enable location services to use all app features.",
                            "warning",
                          );
                        }
                      } else {
                        // Permission denied
                        showInAppNotification(
                          "Location permission is required for shift tracking.",
                          "warning",
                        );
                      }
                    } catch (error) {
                      console.error(
                        "Error requesting location permission:",
                        error,
                      );
                      showInAppNotification(
                        "Unable to request location access. Please enable location from your device settings.",
                        "error",
                      );
                    }
                  }}
                  className="flex-1 py-3 rounded-lg bg-blue-500"
                >
                  <Text className="text-white text-center font-semibold">
                    Enable Location
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceVerificationModal}
        mode={faceVerificationMode}
        onSuccess={handleFaceVerificationSuccess}
        onError={handleFaceVerificationError}
        onCancel={() => {
          setShowFaceVerificationModal(false);
          resetVerificationState();
        }}
        retryCount={verificationState.retryCount}
        maxRetries={verificationState.maxRetries}
        title={
          faceVerificationMode === "register"
            ? "Register Your Face"
            : "Verify Your Identity"
        }
        subtitle={
          faceVerificationMode === "register"
            ? "Please register your face to enable secure shift operations"
            : "Please look at the camera and blink to verify your identity"
        }
      />

      {/* Manager Override Modal */}
      <Modal
        visible={showManagerOverride}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManagerOverride(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${isDark ? "bg-gray-800" : "bg-white"} w-5/6`}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="shield-checkmark" size={24} color="#f59e0b" />
              <Text
                className={`text-xl font-bold ml-2 ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Manager Override Required
              </Text>
            </View>

            <Text
              className={`text-base mb-4 ${isDark ? "text-gray-300" : "text-gray-600"}`}
            >
              Face verification failed after {verificationState.maxRetries}{" "}
              attempts. A manager override is required to proceed with the shift
              operation.
            </Text>

            <Text
              className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}
            >
              This will require OTP verification from a manager.
            </Text>

            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setShowManagerOverride(false);
                  resetVerificationState();
                }}
                className={`px-4 py-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-200"}`}
              >
                <Text
                  className={`font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowManagerOverride(false);
                  handleManagerOverride(
                    "Face verification failed - manager override requested",
                  );
                }}
                className="px-4 py-2 rounded-lg bg-orange-500"
              >
                <Text className="text-white font-semibold">
                  Request Override
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <OTPVerification
        visible={showOTPVerification}
        purpose="manager_override"
        phoneNumber={user?.phone || ""}
        onSuccess={handleOTPSuccess}
        onError={(error) => {
          console.error("OTP verification failed:", error);
          setShowOTPVerification(false);
          showInAppNotification(
            "Manager override failed. Please try again.",
            "error",
          );
        }}
        onCancel={() => {
          setShowOTPVerification(false);
          resetVerificationState();
        }}
        title="Manager Override Verification"
        subtitle="Enter the OTP sent to the manager's phone to authorize this override"
        maxAttempts={3}
        expiryMinutes={5}
      />

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceVerificationModal}
        mode="verify"
        onSuccess={handleFaceVerificationSuccess}
        onError={handleFaceVerificationError}
        onCancel={() => {
          setShowFaceVerificationModal(false);
          resetVerificationState();
        }}
        title="Face Verification Required"
        subtitle="Please look at the camera to verify your identity"
        retryCount={verificationState.retryCount}
        maxRetries={verificationState.maxRetries}
      />

      {/* Verification Progress Overlay */}
      {verificationState.verificationInProgress && (
        <Modal transparent visible={true}>
          <View className="flex-1 justify-center items-center bg-black/50">
            <View
              className={`p-6 rounded-xl ${isDark ? "bg-gray-800" : "bg-white"} w-4/5`}
            >
              <View className="items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text
                  className={`text-lg font-semibold mt-4 ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Processing Verification
                </Text>
                <Text
                  className={`text-sm mt-2 text-center ${isDark ? "text-gray-300" : "text-gray-600"}`}
                >
                  {verificationState.currentStep === "location"
                    ? "Verifying your location..."
                    : verificationState.currentStep === "face"
                      ? "Processing face verification..."
                      : "Completing shift operation..."}
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Enhanced Verification Orchestrator */}
      <VerificationOrchestrator
        visible={showVerificationOrchestrator}
        userId={Number(user?.id) || 0}
        token={token || ""}
        shiftAction={pendingShiftAction || "start"}
        config={verificationConfig}
        onSuccess={handleVerificationSuccess}
        onCancel={handleVerificationCancel}
        onError={handleVerificationError}
        locationVerificationFn={
          performLocationVerificationBoolean as () => Promise<boolean>
        }
        canOverrideGeofence={canOverrideGeofence}
      />

      {/* In-app notification */}
      <InAppNotification
        visible={inAppNotification.visible}
        message={inAppNotification.message}
        type={inAppNotification.type}
        onDismiss={() =>
          setInAppNotification((prev) => ({ ...prev, visible: false }))
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingBottom: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  attendanceButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shiftCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  smallMap: {
    flex: 1,
    borderRadius: 12,
  },
});
