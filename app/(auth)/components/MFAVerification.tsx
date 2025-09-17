import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Keyboard,
  StatusBar,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../../context/ThemeContext';
import AuthContext from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

interface MFAVerificationProps {
  email: string;
  sessionId: string;
  onVerificationSuccess: (tokens: { accessToken: string; refreshToken: string; user: any }) => void;
  onBack: () => void;
}

export default function MFAVerification({ 
  email, 
  sessionId, 
  onVerificationSuccess, 
  onBack 
}: MFAVerificationProps) {
  const { theme } = ThemeContext.useTheme();
  const { verifyMFA } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === 'dark';
  const scrollViewRef = useRef<ScrollView>(null);

  // OTP state - array of 6 digits
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [otpExpires, setOtpExpires] = useState<Date | null>(null);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);

  // Refs for the 6 input boxes
  const inputRefs = useRef<TextInput[]>([]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;

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
      inputBackground: '#FFFFFF',
      inputBorder: '#E2E8F0',
      inputBorderFocus: '#3B82F6',
      inputBorderError: '#EF4444',
      success: '#10B981',
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
      inputBackground: '#1E293B',
      inputBorder: '#334155',
      inputBorderFocus: '#60A5FA',
      inputBorderError: '#F87171',
      success: '#34D399',
      error: '#F87171',
    }
  };

  const currentColors = colors[theme];

  useEffect(() => {
    // Start animations
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

    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
      })
    ).start();

    // Start countdown for resend button
    startCountdown();
  }, []);

  const startCountdown = () => {
    setResendDisabled(true);
    setCountdown(60);
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle OTP digit input
  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    const digit = text.replace(/[^0-9]/g, '');
    
    // Update the digit at the specified index
    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = digit;
    setOtpDigits(newOtpDigits);
    
    // Clear error when user starts typing
    if (error) setError('');

    // Auto-focus next input if digit was entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    const otp = getOtpString();
    console.log('OTP digits changed:', otpDigits, 'OTP string:', otp, 'Length:', otp.length, 'Auto-submit triggered:', autoSubmitTriggered);
    
    // Only auto-submit if we have exactly 6 digits and this isn't the initial state
    if (otp.length === 6 && !isLoading && !error && !autoSubmitTriggered && otpDigits.some(digit => digit !== '')) {
      console.log('Auto-submitting OTP:', otp);
      setAutoSubmitTriggered(true);
      // Small delay to ensure the last digit is properly set
      setTimeout(() => {
        handleVerifyOTP();
      }, 100);
    }
  }, [otpDigits, isLoading, error, autoSubmitTriggered]);

  // Handle backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Get the complete OTP string
  const getOtpString = () => otpDigits.join('');

  const handleVerifyOTP = async () => {
    const otp = getOtpString();
    console.log('handleVerifyOTP called with OTP:', otp, 'Length:', otp.length);
    
    if (otp.length !== 6) {
      console.log('OTP length check failed:', otp.length);
      setError('Please enter a complete 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyMFA(email, otp, sessionId);
      
      if (result.error) {
        setError(result.error);
        // Clear OTP on error for security
        setOtpDigits(['', '', '', '', '', '']);
        setAutoSubmitTriggered(false);
        // Focus first input
        inputRefs.current[0]?.focus();
      } else {
        // MFA verification successful, the AuthContext will handle navigation
        // We can close this component
        onBack();
      }
    } catch (error: any) {
      console.error('MFA verification error:', error);
      
      // Handle specific error types
      if (error.response?.status === 400) {
        setError(error.response.data?.error || 'Invalid verification code. Please try again.');
      } else if (error.response?.status === 401) {
        setError('Session expired. Please request a new code.');
      } else if (!error.response) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Failed to verify code. Please try again.');
      }
      
      // Clear OTP on error for security
      setOtpDigits(['', '', '', '', '', '']);
      setAutoSubmitTriggered(false);
      // Focus first input
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendDisabled) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/resend-mfa-otp`, {
        email,
        sessionId,
      });

      setError('');
      startCountdown();
      
      // Clear previous OTP
      setOtpDigits(['', '', '', '', '', '']);
      setAutoSubmitTriggered(false);
      
      // Show success message
      setError('New verification code sent successfully');
      setTimeout(() => setError(''), 3000);
      
      // Focus first input
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else if (!error.response) {
          setError('Network error. Please check your internet connection');
        } else {
          setError('Failed to resend code. Please try again');
        }
      } else {
        setError('Failed to resend code. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={currentColors.background}
      />
      
      <View style={{ flex: 1, backgroundColor: currentColors.background }}>
        {/* Animated background gradient */}
        <Animated.View
          style={{
            position: "absolute",
            top: -height * 0.1,
            left: -width * 0.1,
            right: -width * 0.1,
            bottom: -height * 0.1,
            opacity: 0.6,
          }}
        >
          <LinearGradient
            colors={[currentColors.primary, currentColors.secondary, currentColors.accent]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Floating geometric shapes */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
              opacity: 0.2,
              transform: [{ translateY: floatingOffset }],
            }}
          />
          
          {/* Sky square */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: height * 0.2,
              left: width * 0.1,
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: currentColors.secondary,
              opacity: 0.3,
              transform: [{ translateY: floatingOffset.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -15],
              }) }],
            }}
          />
          
          {/* Indigo triangle */}
          <Animated.View
            style={{
              position: 'absolute',
              top: height * 0.6,
              right: width * 0.2,
              width: 0,
              height: 0,
              borderLeftWidth: 25,
              borderRightWidth: 25,
              borderBottomWidth: 43,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: currentColors.accent,
              opacity: 0.15,
              transform: [{ translateY: floatingOffset.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10],
              }) }],
            }}
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              flex: 1,
              padding: 24,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Header */}
            <View style={{ marginTop: 15, marginBottom: 40 }}>
              <TouchableOpacity
                onPress={onBack}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                  backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(243, 244, 246, 0.8)',
                  marginBottom: 24,
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 1.41,
                }}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={isDark ? '#FFFFFF' : '#111827'}
                />
              </TouchableOpacity>

              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '800',
                  color: currentColors.text,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                Two-Factor Authentication
              </Text>
              
              <Text
                style={{
                  fontSize: 16,
                  color: currentColors.textSecondary,
                  textAlign: 'center',
                  lineHeight: 24,
                }}
              >
                We've sent a verification code to{' '}
                <Text style={{ fontWeight: '600', color: currentColors.primary }}>
                  {email}
                </Text>
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={[
                styles.errorContainer,
                { 
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                  borderColor: currentColors.error,
                }
              ]}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={currentColors.error}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.errorText, { color: currentColors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* OTP Input - 6 separate boxes */}
            <View style={styles.inputContainer}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: currentColors.text,
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                Enter Verification Code
              </Text>
              
              <View style={styles.otpContainer}>
                {otpDigits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      if (ref) inputRefs.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    placeholder="•"
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: isDark ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        borderColor: error ? currentColors.inputBorderError : currentColors.inputBorder,
                        borderWidth: 2,
                      }
                    ]}
                    placeholderTextColor={currentColors.textSecondary}
                    autoFocus={index === 0}
                    selectTextOnFocus
                  />
                ))}
              </View>
              
              <Text
                style={{
                  fontSize: 14,
                  color: currentColors.textSecondary,
                  textAlign: 'center',
                  marginTop: 16,
                }}
              >
                Code expires in 10 minutes
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={{ marginTop: 32 }}>
              <TouchableOpacity
                onPress={handleVerifyOTP}
                disabled={isLoading || getOtpString().length !== 6}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: currentColors.primary,
                    opacity: (isLoading || getOtpString().length !== 6) ? 0.6 : 1,
                  }
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Verify & Sign In
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resendDisabled || isLoading}
                style={[
                  styles.secondaryButton,
                  {
                    borderColor: currentColors.primary,
                    opacity: (resendDisabled || isLoading) ? 0.6 : 1,
                  }
                ]}
              >
                <Ionicons
                  name="refresh-outline"
                  size={20}
                  color={currentColors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.secondaryButtonText, { color: currentColors.primary }]}>
                  {resendDisabled 
                    ? `Resend in ${countdown}s` 
                    : 'Resend Code'
                  }
                </Text>
              </TouchableOpacity>
            </View>

            {/* Security Notice */}
            <View style={[
              styles.securityNotice,
              { 
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                borderColor: currentColors.primary,
              }
            ]}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={currentColors.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.securityNoticeText, { color: currentColors.textSecondary }]}>
                This adds an extra layer of security to your account. Never share this code with anyone.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    flexDirection: 'row',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    borderWidth: 1,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
