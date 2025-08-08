import React, { useEffect, useRef } from "react";
import "./../app/utils/backgroundLocationTask";
import {
  View,
  Text,
  Animated,
  Image,
  StatusBar,
  Platform,
  AppState,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import ThemeContext from "./context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import AuthContext from "./context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from 'expo-updates';
import * as Network from 'expo-network';

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
};

export default function SplashScreen() {
  const router = useRouter();
  const { theme } = ThemeContext.useTheme();
  const { isLoading, user, isOffline } = AuthContext.useAuth();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const offlineBadgeFadeAnim = useRef(new Animated.Value(0)).current;
  const logoGlowAnim = useRef(new Animated.Value(0)).current;
  const backgroundPulseAnim = useRef(new Animated.Value(0)).current;

  // Check for updates when app comes to foreground (production only)
  useEffect(() => {
    // Only run in production environment
    if (!__DEV__) {
      let current = AppState.currentState;
      const sub = AppState.addEventListener('change', async next => {
        if (current.match(/inactive|background/) && next === 'active') {
          try {
            // Check network connectivity before attempting update check
            const networkState = await Network.getNetworkStateAsync();
            if (networkState.isConnected && networkState.isInternetReachable) {
              const { isAvailable } = await Updates.checkForUpdateAsync();
              if (isAvailable) {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              }
            } else {
              console.log("Offline mode: Skipping update check");
            }
          } catch (error) {
            console.error("Error checking for updates:", error);
          }
        }
        current = next;
      });
      return () => sub.remove();
    }
  }, []);

  // Animation and navigation logic
  useEffect(() => {
    if (!isLoading) {
      // Background pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(backgroundPulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(backgroundPulseAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Logo animation sequence
      Animated.sequence([
        // First: Scale and fade in the logo
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        // Then: Rotate the logo and add glow effect
        Animated.parallel([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        // Finally: Slide up and fade in the text
        Animated.parallel([
          Animated.timing(slideUpAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(textFadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Animate offline badge if in offline mode
      if (isOffline) {
        Animated.timing(offlineBadgeFadeAnim, {
          toValue: 1,
          duration: 500,
          delay: 1200,
          useNativeDriver: true,
        }).start();
      }

      // Navigate based on auth state
      const timer = setTimeout(() => {
        if (user) {
          // User is already logged in, navigate to their dashboard
          switch (user.role) {
            case "employee":
              router.replace("/(dashboard)/employee/employee");
              break;
            case "group-admin":
              router.replace("/(dashboard)/Group-Admin/group-admin");
              break;
            case "management":
              router.replace("/(dashboard)/management/management");
              break;
            case "super-admin":
              router.replace("/(dashboard)/super-admin/super-admin");
              break;
          }
        } else {
          // No user logged in, go to welcome screen
          router.replace("/welcome");
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, user, isOffline]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowOpacity = logoGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const backgroundScale = backgroundPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  // Function to check and refresh Expo Push Token if needed
  const checkAndRefreshExpoToken = async () => {
    try {
      console.log('[Token Check] Verifying Expo push token validity');
      
      // Step 1: Check when the token was last successfully registered
      const lastRegistered = await AsyncStorage.getItem('pushTokenLastRegistered');
      const currentToken = await AsyncStorage.getItem('expoPushToken');
      
      // If we have both a token and registration timestamp
      if (currentToken && lastRegistered) {
        const lastRegDate = new Date(lastRegistered);
        const now = new Date();
        const daysSinceRegistration = (now.getTime() - lastRegDate.getTime()) / (1000 * 60 * 60 * 24);
        
        console.log(`[Token Check] Current token: ${currentToken}`);
        console.log(`[Token Check] Last registered: ${daysSinceRegistration.toFixed(1)} days ago`);
        
        // If token was registered within last 7 days, no need to refresh
        if (daysSinceRegistration < 7) {
          console.log('[Token Check] Token is recent, no refresh needed');
          return;
        }
        
        console.log('[Token Check] Token is older than 7 days, will refresh');
      } else {
        console.log('[Token Check] No token or registration timestamp found');
      }
      
      // Step 2: Clear the existing token
      await AsyncStorage.removeItem('expoPushToken');
      await AsyncStorage.removeItem('pushTokenLastRegistered');
      
      // Step 3: Let regular registration process handle getting a new token
      console.log('[Token Check] Cleared token cache, new token will be requested');
      
    } catch (error) {
      console.error('[Token Check] Error checking token validity:', error);
    }
  };

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.primary}
        translucent={true}
      />
      
      {/* Main background gradient - Orange to Blue */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated background elements */}
        <Animated.View
          style={{
            position: "absolute",
            top: -height * 0.2,
            left: -width * 0.2,
            right: -width * 0.2,
            bottom: -height * 0.2,
            transform: [{ scale: backgroundScale }],
            opacity: 0.1,
          }}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentBlue]}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Floating geometric shapes */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Orange circle */}
          <View
            style={{
              position: 'absolute',
              top: height * 0.1,
              right: width * 0.1,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary,
              opacity: 0.3,
              transform: [{ rotate: '45deg' }],
            }}
          />
          
          {/* Blue square */}
          <View
            style={{
              position: 'absolute',
              bottom: height * 0.2,
              left: width * 0.1,
              width: 60,
              height: 60,
              borderRadius: 12,
              backgroundColor: colors.secondary,
              opacity: 0.4,
              transform: [{ rotate: '-30deg' }],
            }}
          />
          
          {/* Orange triangle */}
          <View
            style={{
              position: 'absolute',
              top: height * 0.6,
              right: width * 0.2,
              width: 0,
              height: 0,
              borderLeftWidth: 30,
              borderRightWidth: 30,
              borderBottomWidth: 52,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.accent,
              opacity: 0.2,
            }}
          />
        </View>

        {/* Main content container */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 40,
          }}
        >
          {/* Logo container with glow effect */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { rotate: spin }],
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            {/* Glow effect */}
            <Animated.View
              style={{
                position: 'absolute',
                width: 280,
                height: 280,
                borderRadius: 140,
                backgroundColor: colors.primary,
                opacity: glowOpacity,
                transform: [{ scale: 1.2 }],
              }}
            />
            
            {/* Main logo container */}
            <View
              style={{
                width: 200,
                height: 200,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 100,
                backgroundColor: colors.white,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 12,
                borderWidth: 3,
                borderColor: colors.primary,
              }}
            >
              <Image
                source={require("../assets/images/adaptive-icon.png")}
                style={{
                  width: 140,
                  height: 140,
                }}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* App title */}
          <Animated.View
            style={{
              opacity: textFadeAnim,
              transform: [{ translateY: slideUpAnim }],
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: "800",
                color: colors.textLight,
                textAlign: 'center',
                letterSpacing: 1,
                textShadowColor: 'rgba(0, 0, 0, 0.3)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
                marginBottom: 8,
              }}
            >
              Parrot Analyzer
            </Text>
            
            <Text
              style={{
                fontSize: 16,
                color: colors.textLight,
                opacity: 0.8,
                textAlign: 'center',
                letterSpacing: 0.5,
              }}
            >
              Smart Workforce Management
            </Text>
          </Animated.View>
          
          {/* Offline mode indicator */}
          {isOffline && (
            <Animated.View 
              style={{
                opacity: offlineBadgeFadeAnim,
                marginTop: 20,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
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
        </View>

        {/* Bottom powered by text */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            opacity: textFadeAnim,
            transform: [{ translateY: slideUpAnim }],
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: colors.textLight,
              opacity: 0.7,
              letterSpacing: 0.5,
            }}
          >
            Powered by Tecosoft.ai
          </Text>
        </Animated.View>
      </LinearGradient>
    </>
  );
}
