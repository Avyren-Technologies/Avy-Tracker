import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Image,
  StatusBar,
  Platform,
  Alert,
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AuthContext from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import biometricAuthService, { BiometricSettings } from "../../utils/biometricAuth";

const { width, height } = Dimensions.get("window");

interface BaseSettingItem {
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
}

interface ActionSettingItem extends BaseSettingItem {
  action: () => void;
  type?: never;
  value?: never;
  onChange?: never;
}

interface SwitchSettingItem extends BaseSettingItem {
  type: "switch";
  value: boolean;
  onChange: (value: boolean) => void;
  action?: never;
}

type SettingItem = ActionSettingItem | SwitchSettingItem;

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function EmployeeSettings() {
  const { theme, toggleTheme } = ThemeContext.useTheme();
  const { user, logout, token } = AuthContext.useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(theme === "dark");
  const [profileImage, setProfileImage] = React.useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [modalAnimation] = React.useState(new Animated.Value(0));
  const [faceRegistrationStatus, setFaceRegistrationStatus] = React.useState<{
    registered: boolean;
    enabled: boolean;
    loading: boolean;
  }>({ registered: false, enabled: true, loading: true });
  const [biometricSettings, setBiometricSettings] = React.useState<BiometricSettings>({
    enabled: false,
    required: false,
  });
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<string>('');
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [mfaLoading, setMfaLoading] = React.useState(false);

  // Animation refs
  const floatingShapesAnim = React.useRef(new Animated.Value(0)).current;

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
      success: "#34D399", // Emerald-400
      warning: "#FBBF24", // Amber-400
      error: "#F87171", // Red-400
      info: "#60A5FA", // Blue-400
    },
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    setDarkMode(theme === "dark");

    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();
  }, [theme, floatingShapesAnim]);

  React.useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
      fetchFaceRegistrationStatus();
      fetchMFAStatus();
    }
  }, [user?.id]);

  React.useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSettings();
  }, []);

  React.useEffect(() => {
    if (showLogoutModal) {
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showLogoutModal, modalAnimation]);

  const fetchProfileImage = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile-image/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.image) {
        setProfileImage(response.data.image);
      }
    } catch (error) {
      console.error("Error fetching profile image:", error);
    }
  };

  const fetchFaceRegistrationStatus = async () => {
    try {
      setFaceRegistrationStatus(prev => ({ ...prev, loading: true }));
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // CRITICAL FIX: Handle both old and new API response formats
      const faceRegistered = response.data.face_registered !== undefined 
        ? response.data.face_registered 
        : response.data.registered || false;
      
      const faceEnabled = response.data.face_enabled !== undefined 
        ? response.data.face_enabled 
        : response.data.enabled !== false;

      setFaceRegistrationStatus({
        registered: faceRegistered,
        enabled: faceEnabled,
        loading: false
      });
      
      console.log('✅ Face registration status updated:', {
        registered: faceRegistered,
        enabled: faceEnabled,
        apiResponse: response.data
      });
    } catch (error) {
      console.error("Error fetching face registration status:", error);
      setFaceRegistrationStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchMFAStatus = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/mfa-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMfaEnabled(response.data.enabled || false);
    } catch (error) {
      console.error("Error fetching MFA status:", error);
    }
  };

  const handleThemeToggle = (value: boolean) => {
    setDarkMode(value);
    toggleTheme();
  };

  const handleFaceRegistration = () => {
    router.push("/(dashboard)/employee/face-registration" as any);
  };

  const handleFaceConfiguration = () => {
    router.push("/(dashboard)/employee/face-configuration" as any);
  };

  const handleFaceSetup = () => {
    if (faceRegistrationStatus.registered) {
      handleFaceConfiguration();
    } else {
      handleFaceRegistration();
    }
  };

  // Deep linking handler for face configuration
  React.useEffect(() => {
    const handleDeepLink = async () => {
      try {
        // Check if there's a deep link parameter for face configuration
        const deepLinkAction = await AsyncStorage.getItem('deepLink_faceConfiguration');
        if (deepLinkAction) {
          await AsyncStorage.removeItem('deepLink_faceConfiguration');

          // Wait for face registration status to load
          if (!faceRegistrationStatus.loading) {
            if (deepLinkAction === 'configure' && faceRegistrationStatus.registered) {
              handleFaceConfiguration();
            } else if (deepLinkAction === 'register' && !faceRegistrationStatus.registered) {
              handleFaceRegistration();
            } else if (deepLinkAction === 'setup') {
              // Handle 'setup' action by calling handleFaceSetup which determines the right action
              handleFaceSetup();
            }
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    handleDeepLink();
  }, [faceRegistrationStatus.loading, faceRegistrationStatus.registered]);
  const checkBiometricAvailability = async () => {
    try {
      console.log('Checking biometric availability...');
      
      const isAvailable = await biometricAuthService.isBiometricAvailable();
      console.log('Biometric available:', isAvailable);
      setBiometricAvailable(isAvailable);
      
      if (isAvailable) {
        const type = await biometricAuthService.getPrimaryBiometricType();
        console.log('Primary biometric type:', type);
        setBiometricType(type);
      } else {
        console.log('Biometric not available - checking supported types...');
        const supportedTypes = await biometricAuthService.getSupportedBiometricTypes();
        console.log('Supported biometric types:', supportedTypes);
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const loadBiometricSettings = async () => {
    try {
      const settings = await biometricAuthService.getBiometricSettings();
      setBiometricSettings(settings);
    } catch (error) {
      console.error('Error loading biometric settings:', error);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    try {
      console.log('Biometric toggle requested:', enabled);
      
      if (enabled) {
        // Test biometric authentication before enabling (allow setup mode)
        const result = await biometricAuthService.authenticateUser(
          'Authenticate to enable biometric login',
          true // allowSetup = true for initial setup
        );
        
        console.log('Biometric authentication result:', result);
        
        if (result.success) {
          await biometricAuthService.setBiometricEnabled(true);
          setBiometricSettings(prev => ({ ...prev, enabled: true }));
          console.log('Biometric authentication enabled successfully');
        } else {
          console.log('Biometric authentication failed:', result.error);
          Alert.alert('Authentication Failed', result.error || 'Please try again');
        }
      } else {
        await biometricAuthService.setBiometricEnabled(false);
        setBiometricSettings(prev => ({ ...prev, enabled: false, required: false }));
        console.log('Biometric authentication disabled');
      }
    } catch (error) {
      console.error('Error toggling biometric:', error);
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const handleBiometricRequiredToggle = async (required: boolean) => {
    try {
      console.log('Biometric required toggle requested:', required);
      
      if (required) {
        // Test biometric authentication before requiring it (allow setup mode)
        const result = await biometricAuthService.authenticateUser(
          'Authenticate to require biometric login',
          true // allowSetup = true for setup
        );
        
        console.log('Biometric required authentication result:', result);
        
        if (result.success) {
          await biometricAuthService.setBiometricRequired(true);
          setBiometricSettings(prev => ({ ...prev, required: true }));
          console.log('Biometric authentication required enabled');
        } else {
          console.log('Biometric required authentication failed:', result.error);
          Alert.alert('Authentication Failed', result.error || 'Please try again');
        }
      } else {
        await biometricAuthService.setBiometricRequired(false);
        setBiometricSettings(prev => ({ ...prev, required: false }));
        console.log('Biometric authentication required disabled');
      }
    } catch (error) {
      console.error('Error toggling biometric required:', error);
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const handleMFAToggle = async (enabled: boolean) => {
    if (!user?.id) return;
    
    setMfaLoading(true);
    try {
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/setup-mfa`,
        {
          userId: user.id,
          enable: enabled
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.message) {
        setMfaEnabled(enabled);
        Alert.alert(
          'Success', 
          `MFA ${enabled ? 'enabled' : 'disabled'} successfully`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error updating MFA:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.error || 'Failed to update MFA settings'
      );
    } finally {
      setMfaLoading(false);
    }
  };

  const getBiometricIcon = (type: string): keyof typeof MaterialCommunityIcons.glyphMap => {
    switch (type) {
      case 'fingerprint':
        return 'fingerprint';
      case 'face':
        return 'face-recognition';
      case 'iris':
        return 'eye';
      default:
        return 'fingerprint';
    }
  };

  const settingsSections: SettingSection[] = [
    {
      title: "Account",
      items: [
        {
          icon: "person-outline",
          title: "Edit Profile",
          action: () => router.push("/employee/settings/editProfile"),
        },
        {
          icon: "lock-closed-outline",
          title: "Change Password",
          action: () => router.push("/employee/settings/changePassword"),
        },
        {
          icon: "notifications-outline",
          title: "Notifications",
          type: "switch",
          value: notifications,
          onChange: setNotifications,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          icon: faceRegistrationStatus.registered ? "shield-checkmark-outline" : "shield-outline",
          title: faceRegistrationStatus.registered ? "Face Configuration" : "Set Up Face Verification",
          subtitle: faceRegistrationStatus.loading
            ? "Loading..."
            : faceRegistrationStatus.registered
              ? "Manage your face profile and settings"
              : "Secure your shifts with face verification",
          action: handleFaceSetup,
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: "moon-outline",
          title: "Dark Mode",
          type: "switch",
          value: darkMode,
          onChange: handleThemeToggle,
        },
      ],
    },
    {
      title: "Security",
      items: [
        {
          icon: getBiometricIcon(biometricType),
          title: biometricAuthService.getBiometricTypeName(biometricType) + " Authentication",
          subtitle: biometricAvailable ? "Use biometric authentication for login" : "Biometric authentication not available",
          type: "switch",
          value: biometricSettings.enabled,
          onChange: handleBiometricToggle,
        },
        ...(biometricSettings.enabled ? [{
          icon: "shield-checkmark-outline" as keyof typeof Ionicons.glyphMap,
          title: "Require Biometric Login",
          subtitle: "Always require biometric authentication to access the app",
          type: "switch" as const,
          value: biometricSettings.required,
          onChange: handleBiometricRequiredToggle,
        }] : []),
        {
          icon: "two-factor-authentication",
          title: "Two-Factor Authentication",
          subtitle: mfaLoading ? "Updating..." : "Use email verification codes for additional security",
          type: "switch",
          value: mfaEnabled,
          onChange: handleMFAToggle,
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: "help-circle-outline",
          title: "Help Center",
          action: () => router.push("/employee/settings/help"),
        },
        {
          icon: "chatbox-outline",
          title: "Contact Support",
          action: () => router.push("/employee/settings/support"),
        },
        {
          icon: "document-text-outline",
          title: "Terms & Privacy",
          action: () => router.push("/employee/settings/terms"),
        },
      ],
    },
  ];

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
      router.replace("/(auth)/signin");
    } catch (error) {
      console.error("Error during logout:", error);
      router.replace("/(auth)/signin");
    }
  };

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={currentColors.background}
        translucent={true}
        animated={true}
      />

      <View style={{ flex: 1, backgroundColor: currentColors.background }}>
        {/* Main background */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Blue circle */}
            <Animated.View
              style={{
                position: "absolute",
                top: height * 0.15,
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
                bottom: height * 0.25,
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
                top: height * 0.6,
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
        </View>

        {/* Header */}
        <LinearGradient
          colors={[currentColors.surface, currentColors.background]}
          style={[
            styles.headerGradient,
            {
              paddingTop: Platform.OS === "ios" ? 44 : StatusBar.currentHeight,
              paddingBottom: 16,
              shadowColor: currentColors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(59, 130, 246, 0.2)"
                    : "rgba(59, 130, 246, 0.1)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: currentColors.border,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={currentColors.primary}
              />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: currentColors.text,
                textShadowColor:
                  theme === "dark"
                    ? "rgba(0, 0, 0, 0.5)"
                    : "rgba(255, 255, 255, 0.8)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
            >
              Settings
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {/* Profile Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: currentColors.surface,
              borderWidth: 1,
              borderColor: currentColors.border,
              shadowColor: currentColors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
              margin: 16,
              marginTop: 16,
              padding: 16,
              borderRadius: 16,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ position: "relative" }}>
              {profileImage ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                  style={[
                    styles.profileImage,
                    {
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      borderWidth: 3,
                      borderColor: currentColors.primary,
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.profileImage,
                    {
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: currentColors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 3,
                      borderColor: currentColors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={{ color: "white", fontSize: 32, fontWeight: "bold" }}
                  >
                    {user?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.statusDot,
                  {
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: currentColors.success,
                    borderWidth: 3,
                    borderColor: currentColors.surface,
                  },
                ]}
              />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  marginBottom: 4,
                  color: currentColors.text,
                }}
                numberOfLines={1}
              >
                {user?.name}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: currentColors.textSecondary,
                }}
                numberOfLines={1}
              >
                {user?.email}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor:
                      theme === "dark"
                        ? "rgba(59, 130, 246, 0.2)"
                        : "rgba(59, 130, 246, 0.1)",
                    borderWidth: 1,
                    borderColor: currentColors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: currentColors.primary,
                      fontWeight: "600",
                    }}
                  >
                    {user?.role?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {settingsSections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  marginBottom: 8,
                  paddingHorizontal: 4,
                  color: currentColors.textSecondary,
                }}
              >
                {section.title}
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  {
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: currentColors.surface,
                    borderWidth: 1,
                    borderColor: currentColors.border,
                    shadowColor: currentColors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  },
                ]}
              >
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={itemIndex}
                    style={[
                      styles.settingItem,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 16,
                        borderBottomWidth:
                          itemIndex < section.items.length - 1 ? 1 : 0,
                        borderBottomColor: currentColors.border,
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={"action" in item ? item.action : undefined}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            theme === "dark"
                              ? "rgba(59, 130, 246, 0.2)"
                              : "rgba(59, 130, 246, 0.1)",
                          borderWidth: 1,
                          borderColor: currentColors.primary,
                        }}
                      >
                        {Object.keys(MaterialCommunityIcons.glyphMap).includes(item.icon) ? (
                          <MaterialCommunityIcons
                            name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                            size={18}
                            color={currentColors.primary}
                          />
                        ) : (
                          <Ionicons
                            name={item.icon as keyof typeof Ionicons.glyphMap}
                            size={18}
                            color={currentColors.primary}
                          />
                        )}
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "500",
                            color: currentColors.text,
                          }}
                        >
                          {item.title}
                        </Text>
                        {!("type" in item) && item.subtitle && (
                          <Text
                            style={{
                              fontSize: 14,
                              marginTop: 2,
                              color: currentColors.textSecondary,
                            }}
                          >
                            {item.subtitle}
                          </Text>
                        )}
                      </View>
                    </View>
                    {item.type === "switch" ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onChange}
                        trackColor={{
                          false: currentColors.border,
                          true: currentColors.primary,
                        }}
                        thumbColor={
                          item.value
                            ? currentColors.surface
                            : currentColors.textTertiary
                        }
                        ios_backgroundColor={currentColors.border}
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={currentColors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                marginHorizontal: 16,
                marginVertical: 24,
                padding: 16,
                borderRadius: 16,
                backgroundColor: currentColors.error,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: currentColors.error,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              },
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 18,
                marginLeft: 8,
              }}
            >
              Logout
            </Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Text style={{ color: currentColors.textSecondary, fontSize: 14 }}>
              Version {process.env.EXPO_PUBLIC_APP_VERSION}
            </Text>
          </View>
        </ScrollView>


        <Modal
          visible={showLogoutModal}
          transparent
          animationType="none"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <Animated.View
            style={[
              styles.modalOverlay,
              {
                opacity: modalAnimation,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              },
            ]}
          >
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  opacity: modalAnimation,
                  transform: [
                    {
                      scale: modalAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                  ],
                  backgroundColor: currentColors.surface,
                  borderWidth: 1,
                  borderColor: currentColors.border,
                },
              ]}
            >
              <View style={{ alignItems: "center", marginBottom: 8 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor:
                      theme === "dark"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(239, 68, 68, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    borderWidth: 2,
                    borderColor: currentColors.error,
                  }}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={32}
                    color={currentColors.error}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: currentColors.text,
                  }}
                >
                  Logout Confirmation
                </Text>
              </View>

              <Text
                style={{
                  textAlign: "center",
                  marginVertical: 16,
                  paddingHorizontal: 16,
                  color: currentColors.textSecondary,
                  fontSize: 16,
                  lineHeight: 22,
                }}
              >
                Are you sure you want to logout from your account?
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  marginTop: 8,
                  paddingHorizontal: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => setShowLogoutModal(false)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginRight: 8,
                    borderRadius: 12,
                    backgroundColor: currentColors.border,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontWeight: "600",
                      color: currentColors.text,
                      fontSize: 16,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmLogout}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginLeft: 8,
                    borderRadius: 12,
                    backgroundColor: currentColors.error,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      color: "white",
                      fontWeight: "600",
                      fontSize: 16,
                    }}
                  >
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  statusDot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingItem: {
    backgroundColor: 'transparent',
  },
  logoutButton: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
}); 