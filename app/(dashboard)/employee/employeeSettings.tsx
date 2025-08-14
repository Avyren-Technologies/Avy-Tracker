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
import { useRouter } from "expo-router";
import AuthContext from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

interface BaseSettingItem {
  icon: keyof typeof Ionicons.glyphMap;
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
  }, [theme]);

  React.useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
    }
  }, [user?.id]);

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
  }, [showLogoutModal]);

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

  const handleThemeToggle = (value: boolean) => {
    setDarkMode(value);
    toggleTheme();
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
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={currentColors.primary}
                        />
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