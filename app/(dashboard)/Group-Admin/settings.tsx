import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  StatusBar,
  Modal,
  Animated,
  Dimensions,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../../components/BottomNav';
import { groupAdminNavItems } from './utils/navigationItems';
import React, { useState, useEffect, useRef } from 'react';
import { getCurrentColors } from '../../utils/themeColors';
import biometricAuthService, {
  BiometricSettings,
} from '../../utils/biometricAuth';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

interface SettingsItem {
  icon: string;
  label: string;
  action: () => void;
  showArrow?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
}

export default function GroupAdminSettings() {
  const { theme, toggleTheme } = ThemeContext.useTheme();
  const { logout, user, token } = AuthContext.useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings>(
    {
      enabled: false,
      required: false,
    }
  );
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [faceRegistrationStatus, setFaceRegistrationStatus] = useState<{
    registered: boolean;
    enabled: boolean;
    loading: boolean;
  }>({ registered: false, enabled: true, loading: true });

  // Get current theme colors
  const currentColors = getCurrentColors(theme);

  // Animation refs
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();

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

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricSettings();
    fetchMFAStatus();
    fetchFaceRegistrationStatus();
  }, [token, user]);

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

      console.log('✅ Group-Admin Face registration status updated:', {
        registered: faceRegistered,
        enabled: faceEnabled,
        apiResponse: response.data,
      });
    } catch (error) {
      console.error('Error fetching face registration status:', error);
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: false }));
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

  const handleFaceRegistration = () => {
    router.push('/(dashboard)/Group-Admin/face-registration');
  };

  const handleFaceConfiguration = () => {
    router.push('/(dashboard)/Group-Admin/face-configuration');
  };

  const handleFaceSetup = () => {
    if (faceRegistrationStatus.registered) {
      handleFaceConfiguration();
    } else {
      handleFaceRegistration();
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      logout();
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/(auth)/signin');
    }
  };

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const settingsSections = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Profile Settings',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/ProfileSettings'),
          showArrow: true,
        } as SettingsItem,
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/Notifications'),
          showArrow: true,
        },
        {
          icon: 'shield-outline',
          label: 'Privacy & Security',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/PrivacySecurity'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Security',
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
        {
          icon: biometricAuthService.getBiometricIconName(biometricType),
          label:
            biometricAuthService.getBiometricTypeName(biometricType) +
            ' Authentication',
          action: () => {},
          isSwitch: true,
          switchValue: biometricSettings.enabled,
        },
        ...(biometricSettings.enabled
          ? [
              {
                icon: 'shield-checkmark-outline',
                label: 'Require Biometric Login',
                action: () => {},
                isSwitch: true,
                switchValue: biometricSettings.required,
              },
            ]
          : []),
        {
          icon: 'two-factor-authentication',
          label: 'Two-Factor Authentication',
          action: () => {},
          isSwitch: true,
          switchValue: mfaEnabled,
        },
      ],
    },
    {
      title: 'Group Management',
      items: [
        {
          icon: 'people-outline',
          label: 'User Permissions',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/UserPermissions'),
          showArrow: true,
        },
        {
          icon: 'map-outline',
          label: 'Tracking Settings',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/TrackingSettings'),
          showArrow: true,
        },
        {
          icon: 'receipt-outline',
          label: 'Expense Approval Rules',
          action: () =>
            router.push(
              '/(dashboard)/Group-Admin/settings/ExpenseApprovalRules'
            ),
          showArrow: true,
        },
        // {
        //     icon: 'git-branch-outline',
        //     label: 'Leave Workflow Config',
        //     action: () => router.push('/(dashboard)/Group-Admin/settings/LeaveWorkflowConfig'),
        //     showArrow: true
        // }
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: theme === 'dark' ? 'moon' : 'sunny',
          label: 'Dark Mode',
          action: toggleTheme,
          isSwitch: true,
          switchValue: theme === 'dark',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Help & Support',
          action: () =>
            router.push('/(dashboard)/Group-Admin/settings/HelpSupport'),
          showArrow: true,
        },
        {
          icon: 'information-circle-outline',
          label: 'About',
          action: () => router.push('/(dashboard)/Group-Admin/settings/About'),
          showArrow: true,
        },
      ],
    },
  ];

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={currentColors.background}
        translucent={false}
        animated={true}
      />

      <SafeAreaView
        style={{ flex: 1, backgroundColor: currentColors.background }}
      >
        {/* Main background */}
        <View
          style={{
            position: 'absolute',
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
              theme === 'dark'
                ? 'rgba(59, 130, 246, 0.05)'
                : 'rgba(59, 130, 246, 0.02)',
              currentColors.background,
            ]}
            style={{
              position: 'absolute',
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
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Blue circle */}
            <Animated.View
              style={{
                position: 'absolute',
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
                position: 'absolute',
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
                position: 'absolute',
                top: height * 0.7,
                right: width * 0.2,
                width: 0,
                height: 0,
                borderLeftWidth: 20,
                borderRightWidth: 20,
                borderBottomWidth: 35,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
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
        <View
          style={[
            styles.header,
            {
              backgroundColor: currentColors.surface,
              borderBottomColor: currentColors.border,
              shadowColor: currentColors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor:
                theme === 'dark'
                  ? 'rgba(59, 130, 246, 0.2)'
                  : 'rgba(59, 130, 246, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
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
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.headerTitle,
                {
                  color: currentColors.text,
                  textShadowColor:
                    theme === 'dark'
                      ? 'rgba(0, 0, 0, 0.5)'
                      : 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                },
              ]}
            >
              Settings
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Settings Content */}
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {settingsSections.map((section, sectionIndex) => (
            <View
              key={section.title}
              className={`mb-6 ${sectionIndex !== 0 ? 'mt-2' : ''}`}
              style={styles.section}
            >
              <Text
                className={`px-6 py-2 text-sm font-semibold ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
                style={styles.sectionTitle}
              >
                {section.title}
              </Text>
              <View
                className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                style={styles.sectionContent}
              >
                {section.items.map((item, index) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={item.action}
                    className={`flex-row items-center justify-between px-6 py-4`}
                    style={[
                      styles.settingItem,
                      index !== section.items.length - 1 &&
                        styles.settingItemBorder,
                      { borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' },
                    ]}
                  >
                    <View
                      className="flex-row items-center"
                      style={styles.settingItemLeft}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              theme === 'dark' ? '#374151' : '#F3F4F6',
                          },
                        ]}
                      >
                        {Object.keys(MaterialCommunityIcons.glyphMap).includes(
                          item.icon
                        ) ? (
                          <MaterialCommunityIcons
                            name={
                              item.icon as keyof typeof MaterialCommunityIcons.glyphMap
                            }
                            size={22}
                            color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                          />
                        ) : (
                          <Ionicons
                            name={item.icon as keyof typeof Ionicons.glyphMap}
                            size={22}
                            color={theme === 'dark' ? '#FFFFFF' : '#000000'}
                          />
                        )}
                      </View>
                      <Text
                        className={`text-base ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}
                        style={styles.settingLabel}
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
                          false: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                          true: '#60A5FA',
                        }}
                        thumbColor={item.switchValue ? '#3B82F6' : '#F3F4F6'}
                        style={styles.switch}
                      />
                    ) : (
                      item.showArrow && (
                        <View style={styles.arrowContainer}>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                          />
                        </View>
                      )
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Enhanced Logout Button with Gradient */}
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButtonContainer}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C']}
              className="p-4 rounded-xl"
              style={styles.logoutGradient}
            >
              <Text
                className="text-white font-semibold text-base"
                style={styles.logoutText}
              >
                Logout
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Version Info with Enhanced Styling */}
          <View style={styles.versionContainer}>
            <Text
              className={`text-center ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
              style={styles.versionText}
            >
              Version {process.env.EXPO_PUBLIC_APP_VERSION}
            </Text>
          </View>
        </ScrollView>

        <BottomNav items={groupAdminNavItems} />

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
                  backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                },
              ]}
            >
              <View className="items-center mb-2">
                <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                  <Ionicons name="log-out-outline" size={32} color="#EF4444" />
                </View>
                <Text
                  className={`text-xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Logout Confirmation
                </Text>
              </View>

              <Text
                className={`text-center my-4 px-4 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                Are you sure you want to logout from your account?
              </Text>

              <View className="flex-row mt-2 px-2">
                <TouchableOpacity
                  onPress={() => setShowLogoutModal(false)}
                  className={`flex-1 py-3 mr-2 rounded-xl ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-800'
                    }`}
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
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  backButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionContent: {
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  switch: {
    transform: [{ scale: 0.9 }],
  },
  arrowContainer: {
    padding: 4,
  },
  logoutButtonContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  logoutGradient: {
    borderRadius: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  versionContainer: {
    marginTop: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    opacity: 0.7,
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
