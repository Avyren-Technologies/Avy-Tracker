import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../context/ThemeContext';
import biometricAuthService, { BiometricSettings } from '../utils/biometricAuth';

const { width, height } = Dimensions.get('window');

interface BiometricAuthWrapperProps {
  children: React.ReactNode;
  onAuthenticationSuccess: () => void;
  onAuthenticationFailure?: () => void;
}

export default function BiometricAuthWrapper({
  children,
  onAuthenticationSuccess,
  onAuthenticationFailure,
}: BiometricAuthWrapperProps) {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === 'dark';
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings>({
    enabled: false,
    required: false,
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  useEffect(() => {
    checkBiometricRequirements();
  }, []);

  useEffect(() => {
    if (showBiometricModal) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showBiometricModal]);

  const checkBiometricRequirements = async () => {
    try {
      const settings = await biometricAuthService.getBiometricSettings();
      setBiometricSettings(settings);

      if (settings.required && settings.enabled) {
        const type = await biometricAuthService.getPrimaryBiometricType();
        setBiometricType(type);
        setShowBiometricModal(true);
      } else {
        // No biometric required, proceed normally
        onAuthenticationSuccess();
      }
    } catch (error) {
      console.error('Error checking biometric requirements:', error);
      // On error, proceed normally
      onAuthenticationSuccess();
    }
  };

  const handleBiometricAuthentication = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    try {
      const result = await biometricAuthService.authenticateUser(
        'Authenticate to access Avy Tracker'
      );

      if (result.success) {
        setShowBiometricModal(false);
        onAuthenticationSuccess();
      } else {
        // Show error but keep modal open for retry
        console.error('Biometric authentication failed:', result.error);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSkipAuthentication = () => {
    if (onAuthenticationFailure) {
      onAuthenticationFailure();
    } else {
      // Default behavior: proceed without authentication
      setShowBiometricModal(false);
      onAuthenticationSuccess();
    }
  };

  // If biometric is not required, render children normally
  if (!biometricSettings.required || !biometricSettings.enabled) {
    return <>{children}</>;
  }

  // Theme-based colors
  const colors = {
    light: {
      primary: '#3B82F6',
      secondary: '#0EA5E9',
      accent: '#6366F1',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#475569',
      border: '#E2E8F0',
      error: '#EF4444',
    },
    dark: {
      primary: '#60A5FA',
      secondary: '#38BDF8',
      accent: '#818CF8',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      textSecondary: '#CBD5E1',
      border: '#334155',
      error: '#F87171',
    },
  };

  const currentColors = colors[theme];

  return (
    <>
      <Modal
        visible={showBiometricModal}
        transparent
        animationType="none"
        onRequestClose={() => {}} // Prevent closing with back button
      >
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={currentColors.background}
        />

        <View style={[styles.container, { backgroundColor: currentColors.background }]}>
          {/* Background gradient */}
          <LinearGradient
            colors={[currentColors.primary, currentColors.secondary, currentColors.accent]}
            style={styles.backgroundGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <Animated.View
            style={[
              styles.modalContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                backgroundColor: currentColors.surface,
                borderColor: currentColors.border,
              },
            ]}
          >
            {/* Biometric Icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: currentColors.primary,
                },
              ]}
            >
              <Ionicons
                name={biometricAuthService.getBiometricIconName(biometricType) as keyof typeof Ionicons.glyphMap}
                size={48}
                color={currentColors.primary}
              />
            </View>

            {/* Title */}
            <Text
              style={[
                styles.title,
                { color: currentColors.text },
              ]}
            >
              Biometric Authentication Required
            </Text>

            {/* Description */}
            <Text
              style={[
                styles.description,
                { color: currentColors.textSecondary },
              ]}
            >
              Please authenticate using your {biometricAuthService.getBiometricTypeName(biometricType).toLowerCase()} to access Avy Tracker.
            </Text>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: currentColors.primary,
                    opacity: isAuthenticating ? 0.6 : 1,
                  },
                ]}
                onPress={handleBiometricAuthentication}
                disabled={isAuthenticating}
              >
                <Ionicons
                  name={biometricAuthService.getBiometricIconName(biometricType) as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryButtonText}>
                  {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: currentColors.border,
                  },
                ]}
                onPress={handleSkipAuthentication}
              >
                <Text style={[styles.secondaryButtonText, { color: currentColors.textSecondary }]}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security Notice */}
            <View
              style={[
                styles.securityNotice,
                {
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: currentColors.primary,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={currentColors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.securityNoticeText, { color: currentColors.textSecondary }]}>
                This adds an extra layer of security to protect your account and company data.
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Render children when not showing biometric modal */}
      {!showBiometricModal && children}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  modalContent: {
    width: width * 0.85,
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
