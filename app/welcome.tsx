import React, { useState, useRef, useEffect } from 'react';
import "./../app/utils/backgroundLocationTask";
import { View, Text, TouchableOpacity, Animated, Image, StatusBar, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import AuthContext from './context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionsModal from './components/PermissionsModal';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Orange and Blue color scheme based on logo
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

export default function Welcome() {
    const router = useRouter();
    const { theme } = ThemeContext.useTheme();
    const { isOffline } = AuthContext.useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [networkState, setNetworkState] = useState<{isConnected: boolean, isInternetReachable: boolean | null}>({
        isConnected: true,
        isInternetReachable: true
    });
    const offlineBadgeFadeAnim = useRef(new Animated.Value(0)).current;
    const buttonScaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 1200,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            }),
        ]).start();
        
        // Check network connectivity
        checkNetworkStatus();
        
        // Animate offline badge if in offline mode
        if (isOffline) {
            Animated.timing(offlineBadgeFadeAnim, {
                toValue: 1,
                duration: 500,
                delay: 1000,
                useNativeDriver: true,
            }).start();
        }
    }, [isOffline]);
    
    const checkNetworkStatus = async () => {
        try {
            const status = await Network.getNetworkStateAsync();
            setNetworkState({
                isConnected: status.isConnected === true,
                isInternetReachable: status.isInternetReachable ?? null
            });
        } catch (error) {
            console.error('Failed to check network status:', error);
            // Default to assuming there's connectivity if we can't check
            setNetworkState({ isConnected: true, isInternetReachable: true });
        }
    };

    const handleGetStarted = async () => {
        // Check if permissions have been requested before
        try {
            // Check network connectivity first
            await checkNetworkStatus();
            
            const permissionsRequested = await AsyncStorage.getItem('permissionsRequested');
            if (permissionsRequested === 'true') {
                // If permissions were already requested before, skip to sign in
                router.push('/(auth)/signin');
            } else {
                // Show the permissions modal
                setShowPermissionsModal(true);
            }
        } catch (error) {
            console.error('Error checking permissions status:', error);
            // Default to showing the modal if there's an error
            setShowPermissionsModal(true);
        }
    };

    const handlePermissionsClose = () => {
        setShowPermissionsModal(false);
        // Navigate to sign in after permissions handling
        router.push('/(auth)/signin');
    };

    const handleButtonPress = () => {
        Animated.sequence([
            Animated.timing(buttonScaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(buttonScaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
        handleGetStarted();
    };

    return (
        <>
            <StatusBar 
                barStyle="light-content"
                backgroundColor={colors.primary}
            />
            <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={{ flex: 1 }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Floating geometric shapes */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    {/* Orange circle */}
                    <View
                        style={{
                            position: 'absolute',
                            top: height * 0.15,
                            right: width * 0.1,
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: colors.primary,
                            opacity: 0.3,
                            transform: [{ rotate: '45deg' }],
                        }}
                    />
                    
                    {/* Blue square */}
                    <View
                        style={{
                            position: 'absolute',
                            bottom: height * 0.25,
                            left: width * 0.1,
                            width: 50,
                            height: 50,
                            borderRadius: 10,
                            backgroundColor: colors.secondary,
                            opacity: 0.4,
                            transform: [{ rotate: '-30deg' }],
                        }}
                    />
                    
                    {/* Orange triangle */}
                    <View
                        style={{
                            position: 'absolute',
                            top: height * 0.5,
                            right: width * 0.15,
                            width: 0,
                            height: 0,
                            borderLeftWidth: 25,
                            borderRightWidth: 25,
                            borderBottomWidth: 43,
                            borderLeftColor: 'transparent',
                            borderRightColor: 'transparent',
                            borderBottomColor: colors.accent,
                            opacity: 0.2,
                        }}
                    />
                </View>

                <View style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 64,
                    paddingHorizontal: 24,
                }}>
                    {/* Top Section */}
                    <Animated.View style={{
                        alignItems: 'center',
                        opacity: fadeAnim,
                        transform: [
                            { translateY: slideAnim },
                            { scale: scaleAnim }
                        ]
                    }}>
                        <View style={{
                            width: 200,
                            height: 200,
                            borderRadius: 100,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 24,
                            padding: 3,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 2,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 16,
                            elevation: 12,
                        }}>
                            <View style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 100,
                                overflow: 'hidden',
                                backgroundColor: colors.white,
                                borderWidth: 2,
                                borderColor: colors.primary,
                            }}>
                                <Image 
                                    source={require('../assets/images/adaptive-icon.png')}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                    }}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                        <Text style={{
                            fontSize: 36,
                            fontWeight: '800',
                            marginBottom: 12,
                            color: colors.textLight,
                            textShadowColor: 'rgba(0, 0, 0, 0.3)',
                            textShadowOffset: { width: 0, height: 2 },
                            textShadowRadius: 4,
                            letterSpacing: 1,
                        }}>
                            Parrot Analyzer
                        </Text>
                        <Text style={{
                            textAlign: 'center',
                            fontSize: 18,
                            color: colors.textLight,
                            marginBottom: 16,
                            letterSpacing: 0.5,
                            opacity: 0.9,
                        }}>
                            Smart Workforce Management
                        </Text>                        
                        {/* Offline indicator */}
                        {isOffline && (
                            <Animated.View 
                                style={{
                                    opacity: offlineBadgeFadeAnim,
                                    marginTop: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: '#EF4444',
                                        marginRight: 8,
                                    }}
                                />
                                <Text
                                    style={{
                                        color: colors.textLight,
                                        fontSize: 14,
                                        fontWeight: '600',
                                    }}
                                >
                                    Offline Mode
                                </Text>
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* Bottom Section */}
                    <Animated.View style={{
                        alignItems: 'center',
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }}>
                        <Animated.View style={{
                            transform: [{ scale: buttonScaleAnim }]
                        }}>
                            <TouchableOpacity
                                onPress={handleButtonPress}
                                style={{
                                    backgroundColor: colors.white,
                                    paddingHorizontal: 48,
                                    paddingVertical: 16,
                                    borderRadius: 30,
                                    shadowColor: colors.primary,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                    elevation: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{
                                    color: colors.primary,
                                    fontSize: 18,
                                    fontWeight: '700',
                                    marginRight: 8,
                                }}>
                                    Get Started
                                </Text>
                                <Ionicons name="arrow-forward" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </Animated.View>
                        
                        <Text style={{
                            marginTop: 24,
                            fontSize: 14,
                            color: colors.textLight,
                            opacity: 0.7,
                            textAlign: 'center',
                            letterSpacing: 0.5,
                        }}>
                            Powered by Tecosoft.ai
                        </Text>
                    </Animated.View>
                </View>
            </LinearGradient>

            <PermissionsModal
                visible={showPermissionsModal}
                onClose={handlePermissionsClose}
            />
        </>
    );
}