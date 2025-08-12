import React, { useState, useRef, useEffect } from 'react';
import "./../app/utils/backgroundLocationTask";
import { View, Text, TouchableOpacity, Animated, Image, StatusBar, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import ThemeContext from './context/ThemeContext';
import AuthContext from './context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionsModal from './components/PermissionsModal';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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
    const floatingShapesAnim = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
    const isUserInteracting = useRef(false);
    const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Theme-based colors
    const colors = {
        // Light theme colors
        light: {
            primary: '#3B82F6', // Blue-500
            secondary: '#0EA5E9', // Sky-500
            accent: '#6366F1', // Indigo-500
            background: '#F8FAFC', // Slate-50
            surface: '#FFFFFF', // White
            card: '#FFFFFF', // White
            text: '#0F172A', // Slate-900
            textSecondary: '#475569', // Slate-600
            textTertiary: '#64748B', // Slate-500
            border: '#E2E8F0', // Slate-200
            success: '#10B981', // Emerald-500
            warning: '#F59E0B', // Amber-500
            error: '#EF4444', // Red-500
            info: '#3B82F6', // Blue-500
        },
        // Dark theme colors
        dark: {
            primary: '#60A5FA', // Blue-400
            secondary: '#38BDF8', // Sky-400
            accent: '#818CF8', // Indigo-400
            background: '#0F172A', // Slate-900
            surface: '#1E293B', // Slate-800
            card: '#1E293B', // Slate-800
            text: '#F8FAFC', // Slate-50
            textSecondary: '#CBD5E1', // Slate-300
            textTertiary: '#94A3B8', // Slate-400
            border: '#334155', // Slate-700
            success: '#34D399', // Emerald-400
            warning: '#FBBF24', // Amber-400
            error: '#F87171', // Red-400
            info: '#60A5FA', // Blue-400
        }
    };

    const currentColors = colors[theme];

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
        
        // Floating shapes animation
        Animated.loop(
            Animated.timing(floatingShapesAnim, {
                toValue: 1,
                duration: 10000,
                useNativeDriver: true,
            })
        ).start();
        
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

        // Start auto-scrolling after a delay
        const autoScrollTimer = setTimeout(startAutoScroll, 2000);

        return () => {
            if (autoScrollRef.current) {
                clearInterval(autoScrollRef.current);
            }
            if (pauseTimeoutRef.current) {
                clearTimeout(pauseTimeoutRef.current);
            }
            clearTimeout(autoScrollTimer);
        };
    }, [isOffline]);

    // Pause auto-scrolling when user touches the scroll view
    const handleScrollBeginDrag = () => {
        isUserInteracting.current = true;
        if (autoScrollRef.current) {
            clearInterval(autoScrollRef.current);
        }
    };

    // Resume auto-scrolling after user stops touching
    const handleScrollEndDrag = () => {
        isUserInteracting.current = false;
        // Resume after 2 seconds of no interaction
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
        }
        pauseTimeoutRef.current = setTimeout(() => {
            if (!isUserInteracting.current) {
                startAutoScroll();
            }
        }, 2000);
    };

    // Start auto-scrolling function
    const startAutoScroll = () => {
        if (scrollViewRef.current && !isUserInteracting.current) {
            let scrollPosition = 0;
            const scrollStep = 2; // Increased step size for faster movement
            const scrollInterval = 30; // Reduced interval for smoother movement
            
            autoScrollRef.current = setInterval(() => {
                if (isUserInteracting.current) return; // Don't scroll if user is interacting
                
                scrollPosition += scrollStep;
                if (scrollViewRef.current) {
                    // Smooth reset when reaching the end
                    if (scrollPosition >= 1500) {
                        scrollPosition = 0;
                        // Use animated scroll for smooth reset
                        scrollViewRef.current.scrollTo({
                            x: scrollPosition,
                            animated: true,
                        });
                    } else {
                        // Regular scroll without animation for smooth movement
                        scrollViewRef.current.scrollTo({
                            x: scrollPosition,
                            animated: false,
                        });
                    }
                }
            }, scrollInterval);
        }
    };
    
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

    const floatingOffset = floatingShapesAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 25],
    });

    return (
        <>
            <StatusBar 
                barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={currentColors.background}
            />
            
            {/* Main background */}
            <View style={{
                flex: 1,
                backgroundColor: currentColors.background,
            }}>
                {/* Subtle gradient overlay */}
                <LinearGradient
                    colors={[
                        currentColors.background,
                        theme === 'dark' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.02)',
                        currentColors.background
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
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    {/* Blue circle */}
                    <Animated.View
                        style={{
                            position: 'absolute',
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
                            position: 'absolute',
                            bottom: height * 0.25,
                            left: width * 0.1,
                            width: 50,
                            height: 50,
                            borderRadius: 10,
                            backgroundColor: currentColors.secondary,
                            opacity: 0.2,
                            transform: [{ translateY: floatingOffset.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -20],
                            }) }],
                        }}
                    />
                    
                    {/* Indigo triangle */}
                    <Animated.View
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
                            borderBottomColor: currentColors.accent,
                            opacity: 0.1,
                            transform: [{ translateY: floatingOffset.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 15],
                            }) }],
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
                        {/* Logo container with modern design */}
                        <View style={{
                            width: 200,
                            height: 200,
                            borderRadius: 100,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 32,
                            padding: 4,
                            backgroundColor: theme === 'dark' 
                                ? 'rgba(59, 130, 246, 0.1)' 
                                : 'rgba(59, 130, 246, 0.05)',
                            borderWidth: 2,
                            borderColor: theme === 'dark' 
                                ? 'rgba(59, 130, 246, 0.3)' 
                                : 'rgba(59, 130, 246, 0.2)',
                            shadowColor: currentColors.primary,
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.2,
                            shadowRadius: 16,
                            elevation: 8,
                        }}>
                            <View style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 100,
                                overflow: 'hidden',
                                backgroundColor: currentColors.surface,
                                borderWidth: 2,
                                borderColor: currentColors.primary,
                                shadowColor: currentColors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 4,
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

                        {/* App title and description */}
                        <Text style={{
                            fontSize: 36,
                            fontWeight: '800',
                            marginBottom: 12,
                            color: currentColors.text,
                            textShadowColor: theme === 'dark' 
                                ? 'rgba(0, 0, 0, 0.5)' 
                                : 'rgba(255, 255, 255, 0.8)',
                            textShadowOffset: { width: 0, height: 2 },
                            textShadowRadius: 4,
                            letterSpacing: 1,
                            textAlign: 'center',
                        }}>
                            Avy Tracker
                        </Text>
                        
                        <Text style={{
                            textAlign: 'center',
                            fontSize: 18,
                            color: currentColors.textSecondary,
                            marginBottom: 8,
                            letterSpacing: 0.5,
                            fontWeight: '500',
                        }}>
                            Smart Workforce Management
                        </Text>

                        <Text style={{
                            textAlign: 'center',
                            fontSize: 16,
                            color: currentColors.textTertiary,
                            marginBottom: 16,
                            letterSpacing: 0.5,
                            lineHeight: 22,
                            maxWidth: width * 0.8,
                        }}>
                            Advanced employee tracking, analytics, and productivity insights for modern businesses
                        </Text>
                        
                        {/* Offline indicator */}
                        {isOffline && (
                            <Animated.View 
                                style={{
                                    opacity: offlineBadgeFadeAnim,
                                    marginTop: 16,
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: theme === 'dark' 
                                        ? 'rgba(239, 68, 68, 0.2)' 
                                        : 'rgba(239, 68, 68, 0.1)',
                                    borderWidth: 1,
                                    borderColor: currentColors.error,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: currentColors.error,
                                        marginRight: 8,
                                    }}
                                />
                                <Text
                                    style={{
                                        color: currentColors.error,
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
                        {/* Get Started Button */}
                        <Animated.View style={{
                            transform: [{ scale: buttonScaleAnim }]
                        }}>
                            <TouchableOpacity
                                onPress={handleButtonPress}
                                style={{
                                    backgroundColor: currentColors.primary,
                                    paddingHorizontal: 48,
                                    paddingVertical: 18,
                                    borderRadius: 30,
                                    shadowColor: currentColors.primary,
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 12,
                                    elevation: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    borderWidth: 2,
                                    borderColor: currentColors.secondary,
                                }}
                            >
                                <Text style={{
                                    color: currentColors.surface,
                                    fontSize: 18,
                                    fontWeight: '700',
                                    marginRight: 8,
                                    letterSpacing: 0.5,
                                }}>
                                    Get Started
                                </Text>
                                <Ionicons 
                                    name="arrow-forward" 
                                    size={20} 
                                    color={currentColors.surface} 
                                />
                            </TouchableOpacity>
                        </Animated.View>
                        
                        {/* Features preview - Enhanced with comprehensive app features and auto-scrolling */}
                        <View
                            className="flex-row justify-center mt-6"
                            style={{
                                width: '100%',
                                maxWidth: width * 0.98,
                                alignSelf: 'center',
                            }}
                        >
                            <ScrollView
                                ref={scrollViewRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 4,
                                }}
                                style={{ flexGrow: 0 }}
                                onScrollBeginDrag={handleScrollBeginDrag}
                                onScrollEndDrag={handleScrollEndDrag}
                                // Auto-scroll animation
                            >
                                {[
                                    { icon: 'location', text: 'Live GPS Tracking' },
                                    { icon: 'analytics', text: 'Real-time Analytics' },
                                    { icon: 'people', text: 'Team Management' },
                                    { icon: 'shield-checkmark', text: 'Role-based Access' },
                                    { icon: 'calendar', text: 'Attendance Management' },
                                    { icon: 'card', text: 'Expense Tracking' },
                                    { icon: 'time', text: 'Leave Management' },
                                    { icon: 'chatbubbles', text: 'AI Chat Support' },
                                    { icon: 'notifications', text: 'Push Notifications' },
                                    { icon: 'document', text: 'PDF Reports' },
                                    { icon: 'trending-up', text: 'Performance Metrics' },
                                    { icon: 'map', text: 'Geofencing' },
                                    { icon: 'sync', text: 'Shift Tracking' },
                                    { icon: 'bar-chart', text: 'Travel Analytics' },
                                    { icon: 'settings', text: 'System Config' },
                                    { icon: 'cloud', text: 'Multi-tenant' }
                                ].map((feature, index) => (
                                    <View
                                        key={feature.icon}
                                        className="items-center"
                                        style={{
                                            marginHorizontal: 6,
                                            minWidth: 80,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: theme === 'dark'
                                                    ? 'rgba(59, 130, 246, 0.18)'
                                                    : 'rgba(59, 130, 246, 0.09)',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginBottom: 8,
                                                borderWidth: 1,
                                                borderColor: theme === 'dark'
                                                    ? 'rgba(59, 130, 246, 0.3)'
                                                    : 'rgba(59, 130, 246, 0.2)',
                                            }}
                                        >
                                            <Ionicons
                                                name={feature.icon as any}
                                                size={20}
                                                color={currentColors.primary}
                                            />
                                        </View>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: currentColors.textSecondary,
                                                textAlign: 'center',
                                                fontWeight: '500',
                                                lineHeight: 14,
                                            }}
                                            numberOfLines={2}
                                            adjustsFontSizeToFit
                                        >
                                            {feature.text}
                                        </Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Key Capabilities Section */}
                        {/* <View style={{
                            marginTop: 24,
                            paddingHorizontal: 20,
                        }}>
                            <Text style={{
                                fontSize: 16,
                                fontWeight: '700',
                                color: currentColors.text,
                                textAlign: 'center',
                                marginBottom: 16,
                                letterSpacing: 0.5,
                            }}>
                                Key Capabilities
                            </Text>
                            
                            <View style={{
                                backgroundColor: theme === 'dark' 
                                    ? 'rgba(59, 130, 246, 0.1)' 
                                    : 'rgba(59, 130, 246, 0.05)',
                                borderRadius: 16,
                                padding: 20,
                                borderWidth: 1,
                                borderColor: theme === 'dark' 
                                    ? 'rgba(59, 130, 246, 0.2)' 
                                    : 'rgba(59, 130, 246, 0.1)',
                            }}>
                                {[
                                    '• Real-time GPS tracking with geofencing for accurate travel metrics',
                                    '• Automated attendance logging with shift start/end tracking',
                                    '• Comprehensive leave management with multi-level approval workflows',
                                    '• Expense submission and approval system with receipt uploads',
                                    '• Role-based dashboards (Employee, Group Admin, Management, Super Admin)',
                                    '• Live chatbot support powered by Google Gemini AI',
                                    '• Advanced analytics and reporting with PDF export capabilities',
                                    '• Push notifications for real-time updates and alerts',
                                    '• Multi-tenant architecture supporting multiple companies',
                                    '• Performance metrics and travel efficiency analysis'
                                ].map((capability, index) => (
                                    <View key={index} style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        marginBottom: 8,
                                    }}>
                                        <Text style={{
                                            fontSize: 13,
                                            color: currentColors.textSecondary,
                                            lineHeight: 18,
                                            flex: 1,
                                        }}>
                                            {capability}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View> */}
                        
                        <Text style={{
                            marginTop: 32,
                            fontSize: 14,
                            color: currentColors.textTertiary,
                            opacity: 0.7,
                            textAlign: 'center',
                            letterSpacing: 0.5,
                        }}>
                            Powered by Tecosoft.ai
                        </Text>
                    </Animated.View>
                </View>
            </View>

            <PermissionsModal
                visible={showPermissionsModal}
                onClose={handlePermissionsClose}
            />
        </>
    );
}