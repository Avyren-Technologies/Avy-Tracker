import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Animated, Keyboard, Image, StatusBar, ScrollView, StyleSheet, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from '../context/ThemeContext';
import AuthContext from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTokenDebugInfo, repairTokenIssues } from '../utils/tokenDebugger';

const { width, height } = Dimensions.get('window');

// Orange and Blue color scheme based on logo (matching splash screen)
const colors = {
  primary: '#FF6B35', // Vibrant orange
  secondary: '#1E3A8A', // Rich blue
  accent: '#F97316', // Lighter orange
  accentBlue: '#3B82F6', // Lighter blue
  white: '#FFFFFF',
  black: '#000000',
  textLight: '#FFFFFF',
  textDark: '#1F2937',
  textSecondary: '#6B7280',
};

// Storage keys (keep in sync with AuthContext)
const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_DATA_KEY = "user_data";
const LAST_ONLINE_LOGIN_KEY = "last_online_login";

export default function SignIn() {
    const { theme } = ThemeContext.useTheme();
    const { login, isLoading, isOffline } = AuthContext.useAuth();
    const router = useRouter();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<{ message: string; type: string; details?: string } | null>(null);
    const [isValidIdentifier, setIsValidIdentifier] = useState(false);
    const [identifierType, setIdentifierType] = useState<'email' | 'phone' | null>(null);
    const [isCheckingStorage, setIsCheckingStorage] = useState(false);
    const [networkStatus, setNetworkStatus] = useState<{isConnected: boolean, isInternetReachable: boolean | null}>({ 
        isConnected: true, 
        isInternetReachable: true 
    });
    const [offlineLoginAvailable, setOfflineLoginAvailable] = useState(false);
    const [checkingOfflineLogin, setCheckingOfflineLogin] = useState(false);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const inputFocusAnim = useRef(new Animated.Value(0)).current;
    const networkStatusTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Check network status on mount and periodically
        checkNetworkStatus();
        checkOfflineLoginAvailability();

        // Check if there are token storage inconsistencies on mount
        checkTokenStorageHealth();

        // Set up periodic network check
        networkStatusTimerRef.current = setInterval(() => {
            checkNetworkStatus();
        }, 10000); // Check every 10 seconds

        return () => {
            if (networkStatusTimerRef.current) {
                clearInterval(networkStatusTimerRef.current);
            }
        };
    }, []);

    const checkNetworkStatus = async () => {
        try {
            const status = await Network.getNetworkStateAsync();
            setNetworkStatus({
                isConnected: status.isConnected === true,
                isInternetReachable: status.isInternetReachable ?? null
            });
        } catch (error) {
            console.error('Failed to check network status:', error);
            // Default to assuming there's connectivity if we can't check
            setNetworkStatus({ isConnected: true, isInternetReachable: true });
        }
    };

    const checkOfflineLoginAvailability = async () => {
        setCheckingOfflineLogin(true);
        try {
            // Check if we have stored credentials
            const accessToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY) || 
                               await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
            
            const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY) || 
                                await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
            
            const userData = await AsyncStorage.getItem(USER_DATA_KEY) || 
                            await SecureStore.getItemAsync(USER_DATA_KEY);
            
            const lastLoginTime = await AsyncStorage.getItem(LAST_ONLINE_LOGIN_KEY);
            
            // If we have all credentials, check when the last online login was
            if (accessToken && refreshToken && userData && lastLoginTime) {
                const lastLoginDate = parseInt(lastLoginTime);
                const now = Date.now();
                const daysSinceLastLogin = (now - lastLoginDate) / (1000 * 60 * 60 * 24);
                
                // If within the offline grace period (30 days)
                if (daysSinceLastLogin <= 30) {
                    setOfflineLoginAvailable(true);
                    console.log(`Offline login available - last login was ${daysSinceLastLogin.toFixed(1)} days ago`);
                } else {
                    setOfflineLoginAvailable(false);
                    console.log(`Offline login expired - last login was ${daysSinceLastLogin.toFixed(1)} days ago`);
                }
            } else {
                setOfflineLoginAvailable(false);
            }
        } catch (error) {
            console.error('Error checking offline login availability:', error);
            setOfflineLoginAvailable(false);
        } finally {
            setCheckingOfflineLogin(false);
        }
    };

    const checkTokenStorageHealth = async () => {
        setIsCheckingStorage(true);
        try {
            // Check for token consistency issues between AsyncStorage and SecureStore
            const tokenInfo = await getTokenDebugInfo();
            
            if (tokenInfo && (
                tokenInfo.issues.accessTokenMismatch || 
                tokenInfo.issues.refreshTokenMissing ||
                tokenInfo.issues.refreshTokenMismatch ||
                (tokenInfo.issues.asyncAccessMissing && !tokenInfo.issues.secureAccessMissing) ||
                (tokenInfo.issues.secureAccessMissing && !tokenInfo.issues.asyncAccessMissing)
            )) {
                console.log('Token storage inconsistencies detected, attempting repair...');
                await repairTokenIssues();
            }
        } catch (error) {
            console.error('Error checking token storage:', error);
        } finally {
            setIsCheckingStorage(false);
        }
    };

    // Validation functions
    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string) => {
        const phoneRegex = /^(\+91)?[0-9]{10}$/;
        return phoneRegex.test(phone);
    };

    const validatePassword = (pwd: string) => {
        return pwd.length >= 6; // Minimum password length
    };

    const handleIdentifierChange = (text: string) => {
        let formattedText = text;
        if (/^\d+$/.test(text.replace('+91', ''))) {
            // Phone number input
            setIdentifierType('phone');
            if (!text.startsWith('+91')) {
                formattedText = '+91' + text;
            }
            setIsValidIdentifier(validatePhone(formattedText));
        } else {
            // Email input
            setIdentifierType('email');
            setIsValidIdentifier(validateEmail(text));
        }
        setIdentifier(formattedText);
        setError(null);
    };

    const resetStorageAndLogout = async () => {
        try {
            // Clear all storage
            await Promise.all([
                // Clear AsyncStorage
                AsyncStorage.removeItem(AUTH_TOKEN_KEY),
                AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
                AsyncStorage.removeItem(USER_DATA_KEY),
                AsyncStorage.removeItem(LAST_ONLINE_LOGIN_KEY),
                AsyncStorage.clear(),
                // Clear SecureStore
                SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
                SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
                SecureStore.deleteItemAsync(USER_DATA_KEY)
            ]);
            Alert.alert(
                "Storage Reset",
                "Your login data has been reset. Please try signing in again.",
                [{ text: "OK" }]
            );
            setOfflineLoginAvailable(false);
        } catch (error) {
            console.error("Error clearing storage:", error);
            Alert.alert(
                "Error",
                "Failed to reset storage. Please try again or restart the app."
            );
        }
    };

    const handleOfflineLogin = async () => {
        if (!offlineLoginAvailable) {
            setError({
                message: "Offline login unavailable",
                type: "OFFLINE_UNAVAILABLE",
                details: "You need to sign in at least once with an internet connection."
            });
            return;
        }
        
        Keyboard.dismiss();
        
        try {
            // Just trigger the AuthContext initialization which will handle offline auth
            // This is a hack, but it works because AuthContext will pick up the locally stored credentials
            router.replace("/");
        } catch (error) {
            console.error("Offline login failed:", error);
            setError({
                message: "Failed to authenticate offline",
                type: "OFFLINE_ERROR",
                details: "There was a problem with your stored credentials."
            });
        }
    };

    const handleSignIn = async () => {
        setError(null);
        Keyboard.dismiss();
        await checkNetworkStatus();

        // Network connectivity check
        if (!networkStatus.isConnected || networkStatus.isInternetReachable === false) {
            // If we have offline login available, show a different error with option
            if (offlineLoginAvailable) {
                setError({
                    message: "Unable to connect to server",
                    type: "OFFLINE_AVAILABLE",
                    details: "You can sign in with your saved credentials."
                });
            } else {
                setError({
                    message: "Unable to connect to server",
                    type: "NETWORK_ERROR",
                    details: "Please check your internet connection and try again"
                });
            }
            return;
        }

        // Validate inputs
        if (!identifier || !password) {
            setError({
                message: "Please enter both email/phone and password",
                type: "VALIDATION",
            });
            return;
        }

        if (!isValidIdentifier) {
            setError({
                message: `Invalid ${identifierType || 'email/phone'}`,
                type: "VALIDATION",
                details: identifierType === 'phone' 
                    ? "Phone number must be a 10-digit number with country code (+91)" 
                    : "Please enter a valid email address"
            });
            return;
        }

        if (!validatePassword(password)) {
            setError({
                message: "Invalid password",
                type: "VALIDATION",
                details: "Password must be at least 6 characters long"
            });
            return;
        }

        try {
            const result = await login(identifier, password);

            if (result.error) {
                // Handle known error types
                switch (result.errorType) {
                    case "COMPANY_DISABLED":
                        setError({
                            message: result.error,
                            type: result.errorType,
                            details: "Please contact your administrator for assistance"
                        });
                        Alert.alert("Account Disabled", result.error, [{ text: "OK" }]);
                        break;
                    
                    case "INVALID_CREDENTIALS":
                        setError({
                            message: result.error,
                            type: result.errorType,
                            details: "Please check your email/phone and password and try again"
                        });
                        break;

                    case "TOKEN_STORAGE_ISSUE":
                        setError({
                            message: "Login data storage issue detected",
                            type: result.errorType,
                            details: "We found some inconsistencies in your login data storage. Would you like to reset it?"
                        });
                        Alert.alert(
                            "Storage Issue Detected",
                            "We found some inconsistencies in your login data storage. Would you like to reset it?",
                            [
                                {
                                    text: "Reset & Try Again",
                                    onPress: resetStorageAndLogout
                                },
                                {
                                    text: "Cancel",
                                    style: "cancel"
                                }
                            ]
                        );
                        break;

                    case "SERVER_ERROR":
                        setError({
                            message: "Server error",
                            type: result.errorType,
                            details: "Our servers are experiencing issues. Please try again later."
                        });
                        break;

                    case "NETWORK_ERROR":
                        // If offline login is available, show that as an option
                        if (offlineLoginAvailable) {
                            setError({
                                message: "Network error",
                                type: "OFFLINE_AVAILABLE",
                                details: "Unable to connect to server. You can sign in offline with your saved credentials."
                            });
                        } else {
                            setError({
                                message: "Network error",
                                type: result.errorType,
                                details: "Unable to connect to server. Please check your internet connection."
                            });
                        }
                        break;
                        
                    default:
                        setError({
                            message: result.error,
                            type: result.errorType || "UNKNOWN",
                            details: "Please try again or contact support if the issue persists"
                        });
                }
            }
        } catch (error: any) {
            console.error("Sign in error:", error);
            
            // Handle various error types
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNABORTED') {
                    setError({
                        message: "Request timed out",
                        type: "TIMEOUT_ERROR",
                        details: "The server took too long to respond. Please try again."
                    });
                } else if (!error.response) {
                    // If offline login is available, show that as an option
                    if (offlineLoginAvailable) {
                        setError({
                            message: "Network error",
                            type: "OFFLINE_AVAILABLE",
                            details: "Unable to connect to server. You can sign in offline with your saved credentials."
                        });
                    } else {
                        setError({
                            message: "Network error",
                            type: "NETWORK_ERROR",
                            details: "Unable to connect to server. Please check your internet connection."
                        });
                    }
                } else {
                    // Server returned an error
                    const statusCode = error.response.status;
                    const serverError = error.response.data?.error || error.response.data?.message;
                    
                    switch (statusCode) {
                        case 401:
                            setError({
                                message: "Invalid credentials",
                                type: "INVALID_CREDENTIALS",
                                details: "The email/phone or password you entered is incorrect"
                            });
                            break;
                        case 403:
                            setError({
                                message: "Access denied",
                                type: "ACCESS_DENIED",
                                details: serverError || "You do not have permission to access this resource"
                            });
                            break;
                        case 404:
                            setError({
                                message: "Resource not found",
                                type: "NOT_FOUND",
                                details: "The requested resource was not found"
                            });
                            break;
                        case 429:
                            setError({
                                message: "Too many attempts",
                                type: "RATE_LIMIT",
                                details: "Please wait a moment before trying again"
                            });
                            break;
                        case 500:
                        case 502:
                        case 503:
                        case 504:
                            setError({
                                message: "Server error",
                                type: "SERVER_ERROR",
                                details: "Our servers are experiencing issues. Please try again later."
                            });
                            break;
                        default:
                            setError({
                                message: serverError || "An error occurred",
                                type: "API_ERROR",
                                details: "Please try again or contact support if the issue persists"
                            });
                    }
                }
            } else if (error instanceof SyntaxError) {
                setError({
                    message: "Invalid response format",
                    type: "PARSE_ERROR",
                    details: "The server returned an invalid response. Please try again."
                });
            } else if (error instanceof TypeError) {
                // Handle platform-specific errors
                if (Platform.OS === 'web' && error.message.includes('localStorage')) {
                    setError({
                        message: "Storage access error",
                        type: "WEB_STORAGE_ERROR",
                        details: "Please ensure cookies and local storage are enabled in your browser"
                    });
                } else {
                    setError({
                        message: "Application error",
                        type: "TYPE_ERROR",
                        details: "An unexpected error occurred. Please try again."
                    });
                }
            } else {
                // Generic error fallback
                setError({
                    message: "Sign in failed",
                    type: "UNKNOWN",
                    details: error.message || "An unexpected error occurred. Please try again."
                });
            }
        }
    };

    // Mount animation
    useState(() => {
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
    });

    return (
        <>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.primary}
            />
            <TouchableOpacity
                activeOpacity={1}
                onPress={Keyboard.dismiss}
                style={{
                    flex: 1,
                }}
            >
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={{ flex: 1 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    {/* Floating geometric shapes */}
                    <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
                        {/* Orange circle */}
                        <View
                            style={{
                                position: 'absolute',
                                top: height * 0.1,
                                right: width * 0.1,
                                width: 60,
                                height: 60,
                                borderRadius: 30,
                                backgroundColor: colors.accent,
                                opacity: 0.2,
                                transform: [{ rotate: '45deg' }],
                            }}
                        />
                        
                        {/* Blue square */}
                        <View
                            style={{
                                position: 'absolute',
                                bottom: height * 0.3,
                                left: width * 0.1,
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                backgroundColor: colors.accentBlue,
                                opacity: 0.3,
                                transform: [{ rotate: '-30deg' }],
                            }}
                        />
                        
                        {/* Orange triangle */}
                        <View
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
                                borderBottomColor: colors.accent,
                                opacity: 0.15,
                            }}
                        />
                    </View>
                    
                    <ScrollView
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
                            {/* Logo Section */}
                            <View style={{
                                alignItems: 'center',
                                marginTop: 60,
                                marginBottom: 40,
                            }}>
                                {/* Glow effect */}
                                <View style={{
                                    position: 'absolute',
                                    width: 200,
                                    height: 200,
                                    borderRadius: 100,
                                    backgroundColor: colors.primary,
                                    opacity: 0.3,
                                    transform: [{ scale: 1.2 }],
                                }} />
                                
                                {/* Main logo container */}
                                <View style={{
                                    width: 140,
                                    height: 140,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 70,
                                    backgroundColor: colors.white,
                                    marginBottom: 24,
                                    shadowColor: colors.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 16,
                                    elevation: 12,
                                    borderWidth: 3,
                                    borderColor: colors.primary,
                                }}>
                                    <Image
                                        source={require('../../assets/images/adaptive-icon.png')}
                                        style={{
                                            width: 100,
                                            height: 100,
                                        }}
                                        resizeMode="contain"
                                    />
                                </View>
                                <Text style={{
                                    fontSize: 32,
                                    fontWeight: '800',
                                    color: colors.textLight,
                                    marginBottom: 8,
                                    textShadowColor: 'rgba(0, 0, 0, 0.3)',
                                    textShadowOffset: { width: 0, height: 2 },
                                    textShadowRadius: 4,
                                    letterSpacing: 1,
                                }}>
                                    Welcome Back
                                </Text>
                                <Text style={{
                                    fontSize: 16,
                                    color: colors.textLight,
                                    opacity: 0.9,
                                    textAlign: 'center',
                                    letterSpacing: 0.5,
                                }}>
                                    Sign in to continue to Parrot Analyzer
                                </Text>
                            </View>

                            {/* Network Status Indicator */}
                            {(!networkStatus.isConnected || networkStatus.isInternetReachable === false) && (
                                <View style={styles.networkErrorContainer}>
                                    <Ionicons name="wifi" size={24} color="#DC2626" />
                                    <Text style={styles.networkErrorText}>
                                        No internet connection. {offlineLoginAvailable ? 'Offline login available.' : ''}
                                    </Text>
                                </View>
                            )}

                            {/* Offline Mode Banner */}
                            {isOffline && (
                                <View style={[
                                    styles.offlineBanner,
                                    { backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)' }
                                ]}>
                                    <Ionicons name="cloud-offline" size={22} color={theme === 'dark' ? '#FCA5A5' : '#DC2626'} />
                                    <Text style={[
                                        styles.offlineBannerText,
                                        { color: theme === 'dark' ? '#FCA5A5' : '#DC2626' }
                                    ]}>
                                        App is in offline mode. Some features may be limited.
                                    </Text>
                                </View>
                            )}

                            {/* Form Section */}
                            <Animated.View style={{
                                transform: [{ translateX: inputFocusAnim }]
                            }}>
                                {/* Show offline login option if available */}
                                {offlineLoginAvailable && (!networkStatus.isConnected || networkStatus.isInternetReachable === false) && (
                                    <TouchableOpacity
                                        style={[styles.offlineLoginButton, {
                                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                            borderColor: 'rgba(255, 255, 255, 0.4)',
                                        }]}
                                        onPress={handleOfflineLogin}
                                    >
                                        <Ionicons 
                                            name="cloud-offline-outline" 
                                            size={24} 
                                            color={colors.textLight} 
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={[styles.offlineLoginButtonText, { color: colors.textLight }]}>
                                            Continue with Saved Credentials
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{
                                        marginBottom: 8,
                                        color: colors.textLight,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}>
                                        Email or Phone Number
                                    </Text>
                                    <TextInput
                                        value={identifier}
                                        onChangeText={handleIdentifierChange}
                                        keyboardType={identifierType === 'phone' ? 'phone-pad' : 'email-address'}
                                        autoCapitalize="none"
                                        style={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                            padding: 16,
                                            borderRadius: 12,
                                            color: colors.textDark,
                                            borderWidth: 2,
                                            borderColor: isValidIdentifier
                                                ? '#10B981'
                                                : identifier
                                                    ? '#EF4444'
                                                    : 'rgba(255, 255, 255, 0.3)',
                                            shadowColor: colors.primary,
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 4,
                                            elevation: 3,
                                        }}
                                        placeholderTextColor={colors.textSecondary}
                                        placeholder="Enter your email or phone"
                                    />
                                    {identifier && (
                                        <Text style={{
                                            marginTop: 4,
                                            fontSize: 12,
                                            color: isValidIdentifier ? '#10B981' : '#EF4444',
                                        }}>
                                            {isValidIdentifier
                                                ? `Valid ${identifierType}`
                                                : `Invalid ${identifierType || 'format'}`}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{
                                        marginBottom: 8,
                                        color: colors.textLight,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}>
                                        Password
                                    </Text>
                                    <View style={{ position: 'relative' }}>
                                        <TextInput
                                            value={password}
                                            onChangeText={(text) => {
                                                setPassword(text);
                                                setError(null);
                                            }}
                                            secureTextEntry={!showPassword}
                                            style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                padding: 16,
                                                paddingRight: 48,
                                                borderRadius: 12,
                                                color: colors.textDark,
                                                borderWidth: 2,
                                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                                shadowColor: colors.primary,
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 4,
                                                elevation: 3,
                                            }}
                                            placeholderTextColor={colors.textSecondary}
                                            placeholder="Enter your password"
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowPassword(!showPassword)}
                                            style={{
                                                position: 'absolute',
                                                right: 16,
                                                top: 16,
                                            }}
                                        >
                                            <Ionicons
                                                name={showPassword ? 'eye-off' : 'eye'}
                                                size={24}
                                                color={colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    {password && !validatePassword(password) && (
                                        <Text style={{
                                            marginTop: 4,
                                            fontSize: 12,
                                            color: '#EF4444',
                                        }}>
                                            Password must be at least 6 characters
                                        </Text>
                                    )}
                                </View>

                                <TouchableOpacity
                                    onPress={() => router.push('/(auth)/forgot-password')}
                                    style={{ alignSelf: 'flex-end', marginBottom: 24 }}
                                >
                                    <Text style={{
                                        color: colors.accentBlue,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}>
                                        Forgot Password?
                                    </Text>
                                </TouchableOpacity>

                                {error && (
                                    <View style={[
                                        styles.errorContainer,
                                        error.type === 'COMPANY_DISABLED' ? styles.companyDisabledError : 
                                        error.type === 'NETWORK_ERROR' ? styles.networkError :
                                        error.type === 'SERVER_ERROR' ? styles.serverError :
                                        error.type === 'OFFLINE_AVAILABLE' ? styles.offlineAvailableError :
                                        styles.generalError
                                    ]}>
                                        <Text style={styles.errorText}>{error.message}</Text>
                                        {error.details && (
                                            <Text style={styles.errorSubText}>
                                                {error.details}
                                            </Text>
                                        )}
                                        {error.type === 'TOKEN_STORAGE_ISSUE' && (
                                            <TouchableOpacity 
                                                style={styles.errorActionButton}
                                                onPress={resetStorageAndLogout}
                                            >
                                                <Text style={styles.errorActionButtonText}>Reset Storage</Text>
                                            </TouchableOpacity>
                                        )}
                                        {error.type === 'OFFLINE_AVAILABLE' && (
                                            <TouchableOpacity 
                                                style={styles.offlineActionButton}
                                                onPress={handleOfflineLogin}
                                            >
                                                <Text style={styles.offlineActionButtonText}>Continue Offline</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleSignIn}
                                    disabled={isLoading || isCheckingStorage}
                                    style={{
                                        backgroundColor: colors.primary,
                                        paddingVertical: 16,
                                        paddingHorizontal: 32,
                                        borderRadius: 16,
                                        opacity: (isLoading || isCheckingStorage) ? 0.7 : 1,
                                        shadowColor: colors.primary,
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: 0.4,
                                        shadowRadius: 12,
                                        elevation: 8,
                                        borderWidth: 2,
                                        borderColor: colors.accent,
                                    }}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : isCheckingStorage ? (
                                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                                            <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
                                            <Text style={{
                                                color: '#ffffff',
                                                textAlign: 'center',
                                                fontSize: 16,
                                                fontWeight: 'bold',
                                                letterSpacing: 0.5,
                                            }}>
                                                Preparing...
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={{
                                            color: '#ffffff',
                                            textAlign: 'center',
                                            fontSize: 18,
                                            fontWeight: 'bold',
                                            letterSpacing: 0.5,
                                        }}>
                                            Sign In
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                {/* Storage health checker button */}
                                <TouchableOpacity
                                    onPress={resetStorageAndLogout}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        alignSelf: 'center',
                                        marginTop: 16,
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                        maxWidth: '80%',
                                    }}
                                >
                                    <Ionicons 
                                        name="refresh-outline" 
                                        size={16} 
                                        color={colors.textLight} 
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={{
                                        color: colors.textLight,
                                        fontSize: 12,
                                        fontWeight: '500',
                                        textAlign: 'center',
                                    }}>
                                        Reset App Data
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </Animated.View>
                    </ScrollView>
                </LinearGradient>
            </TouchableOpacity>
        </>
    );
}

const styles = StyleSheet.create({
    errorContainer: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        width: '100%',
    },
    generalError: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
    },
    companyDisabledError: {
        backgroundColor: '#DC2626',
        borderColor: '#B91C1C',
        borderWidth: 1,
    },
    networkError: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderWidth: 1,
    },
    serverError: {
        backgroundColor: '#DBEAFE',
        borderColor: '#3B82F6',
        borderWidth: 1,
    },
    offlineAvailableError: {
        backgroundColor: '#E0F2FE',
        borderColor: '#0EA5E9',
        borderWidth: 1,
    },
    errorText: {
        color: '#991B1B',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
    errorSubText: {
        color: '#991B1B',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    errorActionButton: {
        backgroundColor: '#B91C1C',
        padding: 8,
        borderRadius: 4,
        marginTop: 10,
        alignSelf: 'center',
    },
    errorActionButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    offlineActionButton: {
        backgroundColor: '#0EA5E9',
        padding: 8,
        borderRadius: 4,
        marginTop: 10,
        alignSelf: 'center',
    },
    offlineActionButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    networkErrorContainer: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#DC2626',
        borderWidth: 1,
    },
    networkErrorText: {
        color: '#DC2626',
        fontSize: 13,
        marginLeft: 8,
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    offlineBannerText: {
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    offlineLoginButton: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
    },
    offlineLoginButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});