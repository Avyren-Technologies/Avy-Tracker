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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AuthContext from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const [faceRegistrationStatus, setFaceRegistrationStatus] = React.useState<{
    registered: boolean;
    enabled: boolean;
    loading: boolean;
  }>({ registered: false, enabled: true, loading: true });

  React.useEffect(() => {
    setDarkMode(theme === "dark");
  }, [theme]);

  React.useEffect(() => {
    if (user?.id) {
      fetchProfileImage();
      fetchFaceRegistrationStatus();
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

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: theme === "dark" ? "#111827" : "#F3F4F6" }}
    >
      <StatusBar
        backgroundColor={theme === "dark" ? "#1F2937" : "#FFFFFF"}
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
      />

      <LinearGradient
        colors={
          theme === "dark" ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]
        }
        className="pb-4"
        style={[
          styles.headerGradient,
          { paddingTop: Platform.OS === "ios" ? 44 : StatusBar.currentHeight },
        ]}
      >
        <View className="flex-row items-center justify-between px-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 rounded-full"
            style={{
              backgroundColor: theme === "dark" ? "#374151" : "#F3F4F6",
            }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme === "dark" ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"
              }`}
          >
            Settings
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View
        className={`mx-4 mt-4 p-4 rounded-2xl ${theme === "dark" ? "bg-gray-800" : "bg-white"
          }`}
        style={styles.profileCard}
      >
        <View className="flex-row items-center">
          <View className="relative">
            {profileImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                className="w-20 h-20 rounded-full"
                style={styles.profileImage}
              />
            ) : (
              <View
                className="w-20 h-20 rounded-full bg-blue-500 items-center justify-center"
                style={styles.profileImage}
              >
                <Text className="text-white text-3xl font-bold">
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-green-500 border-2 border-white"
              style={styles.statusDot}
            />
          </View>
          <View className="ml-4 flex-1">
            <Text
              className={`text-xl font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              numberOfLines={1}
            >
              {user?.name}
            </Text>
            <Text
              className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
              numberOfLines={1}
            >
              {user?.email}
            </Text>
            <View className="flex-row items-center mt-1">
              <View
                className={`px-2 py-1 rounded-full ${theme === "dark" ? "bg-blue-900/50" : "bg-blue-100"
                  }`}
              >
                <Text
                  className={`text-xs ${theme === "dark" ? "text-blue-300" : "text-blue-800"
                    }`}
                >
                  {user?.role?.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text
              className={`text-sm font-semibold mb-2 px-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"
                }`}
            >
              {section.title}
            </Text>
            <View
              className={`rounded-2xl overflow-hidden ${theme === "dark" ? "bg-gray-800" : "bg-white"
                }`}
              style={styles.sectionCard}
            >
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  className={`flex-row items-center justify-between p-4 ${itemIndex < section.items.length - 1 ? "border-b" : ""
                    } ${theme === "dark" ? "border-gray-700" : "border-gray-100"
                    }`}
                  onPress={"action" in item ? item.action : undefined}
                  style={styles.settingItem}
                >
                  <View className="flex-row items-center flex-1">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                        }`}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={theme === "dark" ? "#FFFFFF" : "#374151"}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text
                        className={`text-base font-medium ${theme === "dark" ? "text-white" : "text-gray-900"
                          }`}
                      >
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text
                          className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"
                            }`}
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
                      trackColor={{ false: "#767577", true: "#3B82F6" }}
                      thumbColor={item.value ? "#FFFFFF" : "#F4F3F4"}
                      ios_backgroundColor="#3e3e3e"
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          className="mx-4 my-6 p-4 rounded-2xl bg-red-500 flex-row items-center justify-center"
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          <Text className="text-white font-semibold text-lg ml-2">Logout</Text>
        </TouchableOpacity>
        <View className="items-center mb-8">
          <Text className="text-gray-500 text-sm">
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
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }
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
                backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF",
              },
            ]}
          >
            <View className="items-center mb-2">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Logout Confirmation
              </Text>
            </View>

            <Text className={`text-center my-4 px-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
              Are you sure you want to logout from your account?
            </Text>

            <View className="flex-row mt-2 px-2">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className={`flex-1 py-3 mr-2 rounded-xl ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`}
              >
                <Text className={`text-center font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmLogout}
                className="flex-1 py-3 ml-2 rounded-xl bg-red-500"
              >
                <Text className="text-center text-white font-semibold">
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
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