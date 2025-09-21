import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  StatusBar,
  AppState,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ThemeContext from '../context/ThemeContext';
import biometricAuthService, {
  BiometricSettings,
} from '../utils/biometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [biometricSettings, setBiometricSettings] = useState<BiometricSettings>(
    {
      enabled: false,
      required: false,
    }
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // App state management
  const appStateRef = useRef(AppState.currentState);
  const lastAuthTimeRef = useRef<number>(0);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Constants
  const SESSION_TIMEOUT = 1 * 60 * 1000; // 1 minute in milliseconds
  const BIOMETRIC_AUTH_KEY = 'biometric_last_auth_time';

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

  useEffect(() => {
    checkBiometricRequirements();
    setupAppStateListener();
    checkLastAuthTime();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  // Setup app state listener for WhatsApp-like behavior
  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('App state changed:', appStateRef.current, '->', nextAppState);
      
      // App is coming to foreground
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground - checking biometric requirements');
        handleAppForeground();
      }
      
      // App is going to background
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App went to background - starting session timeout');
        startSessionTimeout();
      }
      
      appStateRef.current = nextAppState;
    });

    return () => subscription?.remove();
  };

  // Handle app coming to foreground
  const handleAppForeground = async () => {
    if (!biometricSettings.enabled || !biometricSettings.required) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAuth = now - lastAuthTimeRef.current;
    
    // If more than 5 minutes have passed or this is the first time, require biometric
    if (timeSinceLastAuth > SESSION_TIMEOUT || lastAuthTimeRef.current === 0) {
      console.log('Session expired or first time - requiring biometric authentication');
      setIsAppLocked(true);
      setShowBiometricModal(true);
      setHasAuthenticated(false);
    }
  };

  // Start session timeout when app goes to background
  const startSessionTimeout = () => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    
    sessionTimeoutRef.current = setTimeout(() => {
      console.log('Session timeout reached - app will require biometric on next open');
      setIsAppLocked(true);
      setHasAuthenticated(false);
    }, SESSION_TIMEOUT);
  };

  // Check last authentication time from storage
  const checkLastAuthTime = async () => {
    try {
      const lastAuthTime = await AsyncStorage.getItem(BIOMETRIC_AUTH_KEY);
      if (lastAuthTime) {
        lastAuthTimeRef.current = parseInt(lastAuthTime);
        const now = Date.now();
        const timeSinceLastAuth = now - lastAuthTimeRef.current;
        
        // If session is still valid, mark as authenticated
        if (timeSinceLastAuth <= SESSION_TIMEOUT) {
          setHasAuthenticated(true);
          setIsAppLocked(false);
        } else {
          // Session expired, require biometric
          setIsAppLocked(true);
          setHasAuthenticated(false);
        }
      } else {
        // First time or no previous auth, require biometric
        setIsAppLocked(true);
        setHasAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking last auth time:', error);
      setIsAppLocked(true);
      setHasAuthenticated(false);
    }
  };

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
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
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
        Animated.timing(scaleAnim, {
          toValue: 0.8,
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
        
        // Check if we need to show biometric modal immediately
        if (isAppLocked || !hasAuthenticated) {
          setShowBiometricModal(true);
        } else {
          // Already authenticated, proceed normally
          onAuthenticationSuccess();
        }
      } else {
        // No biometric required, proceed normally
        setHasAuthenticated(true);
        setIsAppLocked(false);
        onAuthenticationSuccess();
      }
    } catch (error) {
      console.error('Error checking biometric requirements:', error);
      // On error, proceed normally
      setHasAuthenticated(true);
      setIsAppLocked(false);
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
        // Save authentication time
        const now = Date.now();
        lastAuthTimeRef.current = now;
        await AsyncStorage.setItem(BIOMETRIC_AUTH_KEY, now.toString());
        
        // Update state
        setHasAuthenticated(true);
        setIsAppLocked(false);
        setShowBiometricModal(false);
        
        // Clear any pending session timeout
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        
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
    // Only allow skipping if biometric is not required
    if (!biometricSettings.required) {
      if (onAuthenticationFailure) {
        onAuthenticationFailure();
      } else {
        // Default behavior: proceed without authentication
        setShowBiometricModal(false);
        onAuthenticationSuccess();
      }
    }
    // If biometric is required, do nothing - user must authenticate
  };

  // If biometric is not required, render children normally
  if (!biometricSettings.required || !biometricSettings.enabled) {
    return <>{children}</>;
  }

  // If app is locked or not authenticated, show biometric modal and block access
  if (isAppLocked || !hasAuthenticated) {
    return (
      <>
        <Modal
          visible={showBiometricModal}
          transparent
          animationType="none"
          onRequestClose={() => {
            // Prevent closing if biometric is required
            if (biometricSettings.required) {
              return;
            }
          }}
        >
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={currentColors.background}
          />

          <View
            style={[
              styles.container,
              { backgroundColor: currentColors.background },
            ]}
          >
            {/* Background gradient */}
            <LinearGradient
              colors={[
                currentColors.primary,
                currentColors.secondary,
                currentColors.accent,
              ]}
              style={styles.backgroundGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <Animated.View
              style={[
                styles.modalContent,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim }
                  ],
                  backgroundColor: currentColors.surface,
                  borderColor: currentColors.border,
                },
              ]}
            >
              {/* Enhanced Biometric Icon with pulse animation */}
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: isDark
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(59, 130, 246, 0.05)',
                    borderColor: currentColors.primary,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={biometricAuthService.getBiometricIconName(biometricType)}
                  size={48}
                  color={currentColors.primary}
                />
              </Animated.View>

              {/* Enhanced Title */}
              <Text style={[styles.title, { color: currentColors.text }]}>
                {biometricSettings.required
                  ? 'Unlock Avy Tracker'
                  : 'Biometric Authentication Available'}
              </Text>

              {/* Enhanced Description */}
              <Text
                style={[
                  styles.description,
                  { color: currentColors.textSecondary },
                ]}
              >
                {biometricSettings.required
                  ? `Use your ${biometricAuthService
                      .getBiometricTypeName(biometricType)
                      .toLowerCase()} to securely access your account.`
                  : `Please authenticate using your ${biometricAuthService
                      .getBiometricTypeName(biometricType)
                      .toLowerCase()} to access Avy Tracker.`}
              </Text>

              {/* Enhanced Action Buttons */}
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
                  <MaterialCommunityIcons
                    name={biometricAuthService.getBiometricIconName(
                      biometricType
                    )}
                    size={20}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>
                    {isAuthenticating ? 'Authenticating...' : 'Unlock App'}
                  </Text>
                </TouchableOpacity>

                {/* Only show skip button if biometric is not required */}
                {!biometricSettings.required && (
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      {
                        borderColor: currentColors.border,
                      },
                    ]}
                    onPress={handleSkipAuthentication}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: currentColors.textSecondary },
                      ]}
                    >
                      Skip for Now
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Enhanced Security Notice */}
              <View
                style={[
                  styles.securityNotice,
                  {
                    backgroundColor: isDark
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(59, 130, 246, 0.05)',
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
                <Text
                  style={[
                    styles.securityNoticeText,
                    { color: currentColors.textSecondary },
                  ]}
                >
                  Your data is protected with enterprise-grade security.
                </Text>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Block access to children when app is locked */}
        <View style={styles.blockedContent}>
          {children}
        </View>
      </>
    );
  }

  // App is unlocked and authenticated, render children normally
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedContent: {
    flex: 1,
    opacity: 0.3,
    pointerEvents: 'none',
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
