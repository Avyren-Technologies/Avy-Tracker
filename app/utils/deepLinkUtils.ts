/**
 * Deep Link Utilities for Face Configuration Navigation
 * 
 * This utility provides functions to handle deep linking to face-related screens
 * from various parts of the application, ensuring proper navigation flow based
 * on user's face registration status.
 * 
 * Requirements addressed:
 * - 2.4: Face configuration settings access
 * - 4.1: Deep linking to face configuration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export interface DeepLinkOptions {
  action: 'register' | 'configure' | 'setup';
  source?: string; // Where the deep link originated from
  params?: Record<string, any>; // Additional parameters
}

/**
 * Navigate to face configuration with deep linking support
 */
export const navigateToFaceConfiguration = async (options: DeepLinkOptions) => {
  try {
    // Store deep link information for the settings screen to handle
    await AsyncStorage.setItem('deepLink_faceConfiguration', options.action);
    
    if (options.source) {
      await AsyncStorage.setItem('deepLink_source', options.source);
    }
    
    if (options.params) {
      await AsyncStorage.setItem('deepLink_params', JSON.stringify(options.params));
    }
    
    // Navigate to settings screen which will handle the deep link
    router.push('/(dashboard)/employee/employeeSettings');
    
    return true;
  } catch (error) {
    console.error('Error setting up deep link navigation:', error);
    return false;
  }
};

/**
 * Direct navigation to face registration screen
 */
export const navigateToFaceRegistration = () => {
  router.push('/screens/FaceRegistration' as any);
};

/**
 * Direct navigation to face configuration screen
 */
export const navigateToFaceConfigurationDirect = () => {
  router.push('/screens/FaceConfiguration' as any);
};

/**
 * Smart navigation that determines the appropriate screen based on registration status
 */
export const navigateToFaceSetup = async (registrationStatus?: { registered: boolean; enabled: boolean }) => {
  if (registrationStatus) {
    // If we have the status, navigate directly
    if (registrationStatus.registered) {
      navigateToFaceConfigurationDirect();
    } else {
      navigateToFaceRegistration();
    }
  } else {
    // If we don't have the status, use deep linking to let settings handle it
    await navigateToFaceConfiguration({ action: 'setup' });
  }
};

/**
 * Clear any pending deep link data
 */
export const clearDeepLinkData = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem('deepLink_faceConfiguration'),
      AsyncStorage.removeItem('deepLink_source'),
      AsyncStorage.removeItem('deepLink_params')
    ]);
  } catch (error) {
    console.error('Error clearing deep link data:', error);
  }
};

/**
 * Get pending deep link data
 */
export const getDeepLinkData = async () => {
  try {
    const [action, source, paramsStr] = await Promise.all([
      AsyncStorage.getItem('deepLink_faceConfiguration'),
      AsyncStorage.getItem('deepLink_source'),
      AsyncStorage.getItem('deepLink_params')
    ]);
    
    let params = null;
    if (paramsStr) {
      try {
        params = JSON.parse(paramsStr);
      } catch (e) {
        console.error('Error parsing deep link params:', e);
      }
    }
    
    return {
      action,
      source,
      params
    };
  } catch (error) {
    console.error('Error getting deep link data:', error);
    return {
      action: null,
      source: null,
      params: null
    };
  }
};

/**
 * Handle face configuration prompts from shift tracker or other components
 */
export const promptFaceConfiguration = async (source: string = 'unknown') => {
  return navigateToFaceConfiguration({
    action: 'setup',
    source,
    params: {
      prompt: true,
      timestamp: Date.now()
    }
  });
};