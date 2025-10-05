import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
  Platform,
  StatusBar as RNStatusBar,
  Modal,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import biometricAuthService, {
  BiometricSettings,
} from '../../utils/biometricAuth';
import axios from 'axios';

interface SettingItem {
  icon: string;
  label: string;
  action: () => void;
  showArrow?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
}

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export default function ManagementSettings() {
  const { theme, toggleTheme } = ThemeContext.useTheme();
  const { logout, user, token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [modalAnimation] = React.useState(new Animated.Value(0));
  const [biometricSettings, setBiometricSettings] =
    React.useState<BiometricSettings>({
      enabled: false,
      required: false,
    });
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<string>('');
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [mfaLoading, setMfaLoading] = React.useState(false);
  const [faceRegistrationStatus, setFaceRegistrationStatus] = React.useState<{
    registered: boolean;
    enabled: boolean;
    loading: boolean;
  }>({ registered: false, enabled: true, loading: true });

  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    } else {
      RNStatusBar.setBackgroundColor(isDark ? '#111827' : '#F9FAFB');
      RNStatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }
  }, [isDark]);

  React.useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSettings();
    fetchMFAStatus();
    fetchFaceRegistrationStatus();
  }, [token, user]);

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

  const checkBiometricAvailability = async () => {
    try {
      const isAvailable = await biometricAuthService.isBiometricAvailable();
      setBiometricAvailable(isAvailable);

      if (isAvailable) {
        const type = await biometricAuthService.getPrimaryBiometricType();
        setBiometricType(type);
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

  const fetchMFAStatus = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/auth/mfa-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMfaEnabled(response.data.enabled || false);
    } catch (error) {
      console.error('Error fetching MFA status:', error);
    }
  };

  const fetchFaceRegistrationStatus = async () => {
    // Don't make API call if token is null or user is not authenticated
    if (!token || !user) {
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: true }));
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Handle both old and new API response formats
      const faceRegistered =
        response.data.face_registered !== undefined
          ? response.data.face_registered
          : response.data.registered || false;

      const faceEnabled =
        response.data.face_enabled !== undefined
          ? response.data.face_enabled
          : response.data.enabled !== false;

      setFaceRegistrationStatus({
        registered: faceRegistered,
        enabled: faceEnabled,
        loading: false,
      });

      console.log('✅ Management Face registration status updated:', {
        registered: faceRegistered,
        enabled: faceEnabled,
        apiResponse: response.data,
      });
    } catch (error) {
      console.error('Error fetching face registration status:', error);
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: false }));
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
          setBiometricSettings((prev) => ({ ...prev, enabled: true }));
          console.log('Biometric authentication enabled successfully');
        } else {
          console.log('Biometric authentication failed:', result.error);
          Alert.alert(
            'Authentication Failed',
            result.error || 'Please try again'
          );
        }
      } else {
        await biometricAuthService.setBiometricEnabled(false);
        setBiometricSettings((prev) => ({
          ...prev,
          enabled: false,
          required: false,
        }));
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
          setBiometricSettings((prev) => ({ ...prev, required: true }));
          console.log('Biometric authentication required enabled');
        } else {
          console.log(
            'Biometric required authentication failed:',
            result.error
          );
          Alert.alert(
            'Authentication Failed',
            result.error || 'Please try again'
          );
        }
      } else {
        await biometricAuthService.setBiometricRequired(false);
        setBiometricSettings((prev) => ({ ...prev, required: false }));
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
          enable: enabled,
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

  const handleFaceRegistration = () => {
    router.push('/(dashboard)/management/face-registration' as any);
  };

  const handleFaceConfiguration = () => {
    router.push('/(dashboard)/management/face-configuration' as any);
  };

  const handleFaceSetup = () => {
    if (faceRegistrationStatus.registered) {
      handleFaceConfiguration();
    } else {
      handleFaceRegistration();
    }
  };

  const handleThemeToggle = async () => {
    toggleTheme();

    try {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/(auth)/signin');
    }
  };

  const settingsSections: SettingSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Profile Settings',
          action: () => router.push('/(dashboard)/management/settings/profile'),
          showArrow: true,
        },
        {
          icon: 'shield-outline',
          label: 'Privacy & Security',
          action: () => router.push('/(dashboard)/management/settings/privacy'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Face Verification',
      items: [
        {
          icon: faceRegistrationStatus.registered
            ? 'shield-checkmark-outline'
            : 'shield-outline',
          label: faceRegistrationStatus.registered
            ? 'Face Configuration'
            : 'Set Up Face Verification',
          action: handleFaceSetup,
          showArrow: true,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          icon: biometricAuthService.getBiometricIconName(biometricType),
          label:
            biometricAuthService.getBiometricTypeName(biometricType) +
            ' Authentication',
          isSwitch: true,
          switchValue: biometricSettings.enabled,
          action: () => {},
        },
        ...(biometricSettings.enabled
          ? [
              {
                icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
                label: 'Require Biometric Login',
                isSwitch: true,
                switchValue: biometricSettings.required,
                action: () => {},
              },
            ]
          : []),
        {
          icon: 'two-factor-authentication',
          label: 'Two-Factor Authentication',
          isSwitch: true,
          switchValue: mfaEnabled,
          action: () => {},
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          action: () =>
            router.push('/(dashboard)/management/settings/notifications'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Management Tools',
      items: [
        {
          icon: 'bar-chart-outline',
          label: 'Report Settings',
          action: () => router.push('/(dashboard)/management/settings/reports'),
          showArrow: true,
        },
        {
          icon: 'people-outline',
          label: 'Team Management',
          action: () => router.push('/(dashboard)/management/settings/team'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help & Support',
          action: () => router.push('/(dashboard)/management/settings/help'),
          showArrow: true,
        },
        {
          icon: 'information-circle-outline',
          label: 'About',
          action: () => router.push('/(dashboard)/management/settings/about'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: isDark ? 'moon' : 'sunny',
          label: 'Dark Mode',
          isSwitch: true,
          switchValue: isDark,
          action: () => {
            handleThemeToggle();
          },
        },
      ],
    },
  ];

  return (
    <View
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-[#F9FAFB]'}`}
      style={styles.container}
    >
      <RNStatusBar
        backgroundColor={isDark ? '#111827' : '#F9FAFB'}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      <View
        className={isDark ? 'bg-gray-900' : 'bg-[#F9FAFB]'}
        style={styles.header}
      >
        <View className="flex-row items-center px-5 pt-4 pb-5">
          <TouchableOpacity
            onPress={() => router.back()}
            className={`w-11 h-11 rounded-full items-center justify-center shadow-sm ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color={isDark ? '#FFFFFF' : '#000000'}
              style={{ marginLeft: -1 }}
            />
          </TouchableOpacity>
          <Text
            className={`text-[26px] font-bold ml-4 ${
              isDark ? 'text-white' : 'text-[#111827]'
            }`}
          >
            Settings
          </Text>
        </View>
      </View>

      <ScrollView
        className={isDark ? 'bg-gray-900' : 'bg-[#F9FAFB]'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        style={styles.scrollView}
      >
        {settingsSections.map((section, sectionIndex) => (
          <View key={section.title} className="mb-7">
            <Text
              className={`px-5 py-2.5 text-[13px] font-semibold uppercase tracking-wide ${
                isDark ? 'text-gray-400' : 'text-[#6B7280]'
              }`}
            >
              {section.title}
            </Text>
            <View
              className={`mx-5 rounded-2xl border ${
                isDark
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-[#F3F4F6]'
              }`}
            >
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.isSwitch ? undefined : item.action}
                  className={`flex-row items-center justify-between py-4 px-5 ${
                    index !== section.items.length - 1
                      ? isDark
                        ? 'border-b border-gray-700'
                        : 'border-b border-[#F3F4F6]'
                      : ''
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <View
                      className={`w-[42px] h-[42px] rounded-full items-center justify-center ${
                        isDark ? 'bg-gray-700' : 'bg-[#F9FAFB]'
                      }`}
                    >
                      {Object.keys(MaterialCommunityIcons.glyphMap).includes(
                        item.icon
                      ) ? (
                        <MaterialCommunityIcons
                          name={
                            item.icon as keyof typeof MaterialCommunityIcons.glyphMap
                          }
                          size={24}
                          color={isDark ? '#FFFFFF' : '#000000'}
                          style={{ opacity: 0.9 }}
                        />
                      ) : (
                        <Ionicons
                          name={item.icon as keyof typeof Ionicons.glyphMap}
                          size={24}
                          color={isDark ? '#FFFFFF' : '#000000'}
                          style={{ opacity: 0.9 }}
                        />
                      )}
                    </View>
                    <Text
                      className={`ml-4 text-[16px] font-semibold ${
                        isDark ? 'text-white' : 'text-[#111827]'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.isSwitch ? (
                    <Switch
                      value={item.switchValue}
                      onValueChange={(value) => {
                        if (item.label.includes('Two-Factor Authentication')) {
                          handleMFAToggle(value);
                        } else if (item.label.includes('Require Biometric')) {
                          handleBiometricRequiredToggle(value);
                        } else if (item.label.includes('Authentication')) {
                          handleBiometricToggle(value);
                        } else if (item.label.includes('Dark Mode')) {
                          item.action();
                        }
                      }}
                      trackColor={{
                        false: isDark ? '#4B5563' : '#E5E7EB',
                        true: '#3B82F6',
                      }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={isDark ? '#4B5563' : '#E5E7EB'}
                      style={{ transform: [{ scale: 0.85 }] }}
                    />
                  ) : (
                    item.showArrow && (
                      <Ionicons
                        name="chevron-forward"
                        size={22}
                        color={isDark ? '#9CA3AF' : '#9CA3AF'}
                      />
                    )
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View className="h-6" />

        <TouchableOpacity
          onPress={handleLogout}
          className="mx-5 mb-5 bg-red-600 rounded-2xl"
        >
          <Text className="text-white font-bold text-[17px] text-center py-4">
            Logout
          </Text>
        </TouchableOpacity>

        <View className="mb-10 items-center">
          <Text
            className={`text-[13px] font-medium ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
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
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              },
            ]}
          >
            <View className="items-center mb-2">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text
                className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                Logout Confirmation
              </Text>
            </View>

            <Text
              className={`text-center my-4 px-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
            >
              Are you sure you want to logout from your account?
            </Text>

            <View className="flex-row mt-2 px-2">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                className={`flex-1 py-3 mr-2 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
              >
                <Text
                  className={`text-center font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}
                >
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
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : RNStatusBar.currentHeight || 0,
  },
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
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
