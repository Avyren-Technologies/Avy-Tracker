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
  PanResponder,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  // const fadeAnim = React.useRef(new Animated.Value(0)).current;
  // const slideAnim = React.useRef(new Animated.Value(30)).current;
  // const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  // Bottom sheet animation values
  const bottomSheetAnim = React.useRef(new Animated.Value(height)).current;
  const backdropAnim = React.useRef(new Animated.Value(0)).current;

  // App state management
  const appStateRef = useRef(AppState.currentState);
  const lastAuthTimeRef = useRef<number>(0);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constants
  // const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds (increased from 1 minute)
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

  // Pan responder for bottom sheet gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 0 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          bottomSheetAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Dismiss bottom sheet
          dismissBottomSheet();
        } else {
          // Snap back to original position
          Animated.spring(bottomSheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const dismissBottomSheet = () => {
    Animated.parallel([
      Animated.timing(bottomSheetAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBiometricModal(false);
    });
  };

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

  // Handle app coming to foreground (WhatsApp-like behavior)
  const handleAppForeground = async () => {
    if (!biometricSettings.enabled || !biometricSettings.required) {
      return;
    }

    // Always require biometric when app comes to foreground from background (like WhatsApp)
    console.log('App came to foreground - requiring biometric authentication');
    setIsAppLocked(true);
    setShowBiometricModal(true);
    setHasAuthenticated(false);
  };

  // Start session timeout when app goes to background
  const startSessionTimeout = () => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    
    // Don't set a timeout that will force close the app
    // Just mark that we need to check authentication when app comes back to foreground
    console.log('App went to background - will require biometric on next foreground');
  };

  // Check last authentication time from storage
  const checkLastAuthTime = async () => {
    try {
      const lastAuthTime = await AsyncStorage.getItem(BIOMETRIC_AUTH_KEY);
      if (lastAuthTime) {
        lastAuthTimeRef.current = parseInt(lastAuthTime);
        // On app start, don't require biometric unless it's been a very long time (24 hours)
        const now = Date.now();
        const timeSinceLastAuth = now - lastAuthTimeRef.current;
        const maxSessionTime = 24 * 60 * 60 * 1000; // 24 hours
        
        if (timeSinceLastAuth <= maxSessionTime) {
          // App just started, allow access without biometric
          setHasAuthenticated(true);
          setIsAppLocked(false);
        } else {
          // Been too long, require biometric
          setIsAppLocked(true);
          setHasAuthenticated(false);
        }
      } else {
        // First time, allow access without biometric
        setHasAuthenticated(true);
        setIsAppLocked(false);
      }
    } catch (error) {
      console.error('Error checking last auth time:', error);
      // On error, allow access
      setHasAuthenticated(true);
      setIsAppLocked(false);
    }
  };

  useEffect(() => {
    if (showBiometricModal) {
      // Show bottom sheet with spring animation
      Animated.parallel([
        Animated.spring(bottomSheetAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation for biometric icon
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
      // Hide bottom sheet
      Animated.parallel([
        Animated.timing(bottomSheetAnim, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 300,
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
        
        // Clear any pending session timeout
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        
        // Dismiss bottom sheet with animation
        dismissBottomSheet();
        
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
        dismissBottomSheet();
        onAuthenticationSuccess();
      }
    }
    // If biometric is required, do nothing - user must authenticate
  };

  // If biometric is not required, render children normally
  if (!biometricSettings.required || !biometricSettings.enabled) {
    return <>{children}</>;
  }

  // If app is locked or not authenticated, show biometric bottom sheet and block access
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
            backgroundColor="transparent"
            translucent
          />

          {/* Backdrop */}
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={() => {
                if (!biometricSettings.required) {
                  dismissBottomSheet();
                }
              }}
            />
          </Animated.View>

          {/* Bottom Sheet */}
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: bottomSheetAnim }],
                backgroundColor: currentColors.surface,
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Handle bar */}
            <View style={[styles.handleBar, { backgroundColor: currentColors.border }]} />

            {/* Content */}
            <View style={styles.bottomSheetContent}>
              {/* Biometric Icon with pulse animation */}
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

              {/* Title */}
              <Text style={[styles.title, { color: currentColors.text }]}>
                {biometricSettings.required
                  ? 'Unlock Avy Tracker'
                  : 'Biometric Authentication Available'}
              </Text>

              {/* Description */}
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

              {/* Security Notice */}
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
            </View>
          </Animated.View>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    maxHeight: height * 0.7,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Safe area for iOS
    alignItems: 'center',
  },
  blockedContent: {
    flex: 1,
    opacity: 0.3,
    pointerEvents: 'none',
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
