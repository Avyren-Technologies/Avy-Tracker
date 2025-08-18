/**
 * Face Verification Service
 * 
 * Provides client-side face verification capabilities including:
 * - Face encoding generation
 * - Secure storage for face profiles
 * - Offline verification with enhanced capabilities
 * - Verification result caching
 * - Sync functionality for offline verifications
 * - Integration with OfflineVerificationService
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  FaceDetectionData, 
  CapturedPhoto, 
  FaceVerificationResult, 
  FaceRegistrationStatus
} from '../types/faceDetection';
import {
  FaceVerificationError,
  FaceVerificationErrorType,
  ErrorContext
} from '../types/faceVerificationErrors';
import { OfflineVerificationService } from './OfflineVerificationService';
import { ConnectivityService } from './ConnectivityService';
import ErrorHandlingService from './ErrorHandlingService';

// Constants
const FACE_PROFILE_KEY = 'face_profile_';
const FACE_ENCODING_KEY = 'face_encoding_';
const VERIFICATION_CACHE_KEY = 'verification_cache_';
const OFFLINE_VERIFICATIONS_KEY = 'offline_verifications';
const FACE_SETTINGS_KEY = 'face_settings_';

// Configuration
const VERIFICATION_CONFIDENCE_THRESHOLD = 0.7;
const FACE_ENCODING_DIMENSIONS = 128;
const MAX_CACHED_VERIFICATIONS = 100;
const CACHE_EXPIRY_HOURS = 24;

// Types for internal use
interface StoredFaceProfile {
  userId: number;
  faceEncodingHash: string;
  encryptedFaceData: string;
  registrationDate: string;
  lastUpdated: string;
  isActive: boolean;
  verificationCount: number;
}

interface OfflineVerification {
  id: string;
  userId: number;
  timestamp: string;
  success: boolean;
  confidence: number;
  livenessDetected: boolean;
  deviceFingerprint: string;
  synced: boolean;
}

interface VerificationCache {
  userId: number;
  verifications: Array<{
    timestamp: string;
    success: boolean;
    confidence: number;
    expiresAt: string;
  }>;
}

/**
 * Generate a simple face encoding from face detection data
 * This is a simplified implementation - in production, you'd use a proper face recognition library
 */
export const generateFaceEncoding = async (
  faceData: FaceDetectionData,
  photo: CapturedPhoto,
  context?: Partial<ErrorContext>
): Promise<string> => {
  try {
    // Validate input data
    if (!faceData || !photo) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.PROCESSING_ERROR,
        new Error('Invalid face data or photo provided')
      );
    }

    // Check if face bounds are valid
    if (faceData.bounds.width <= 0 || faceData.bounds.height <= 0) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.NO_FACE_DETECTED,
        new Error('Invalid face bounds detected')
      );
    }

    // Create a feature vector based on face landmarks and measurements
    const features = [
      faceData.bounds.x / photo.width,
      faceData.bounds.y / photo.height,
      faceData.bounds.width / photo.width,
      faceData.bounds.height / photo.height,
      faceData.leftEyeOpenProbability,
      faceData.rightEyeOpenProbability,
      Math.sin(faceData.rollAngle * Math.PI / 180),
      Math.cos(faceData.rollAngle * Math.PI / 180),
      Math.sin(faceData.yawAngle * Math.PI / 180),
      Math.cos(faceData.yawAngle * Math.PI / 180),
    ];

    // Pad or truncate to fixed dimensions
    while (features.length < FACE_ENCODING_DIMENSIONS) {
      features.push(Math.random() * 0.1); // Add small random values
    }
    features.splice(FACE_ENCODING_DIMENSIONS);

    // Convert to base64 string
    const buffer = new Float32Array(features);
    const bytes = new Uint8Array(buffer.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    const faceError = ErrorHandlingService.createError(
      FaceVerificationErrorType.ENCODING_GENERATION_FAILED,
      error as Error,
      context
    );
    
    await ErrorHandlingService.reportError(faceError, {
      timestamp: new Date(),
      ...context
    });
    
    throw faceError;
  }
};

/**
 * Compare two face encodings and return similarity score
 */
export const compareFaceEncodings = (
  encoding1: string, 
  encoding2: string,
  context?: Partial<ErrorContext>
): number => {
  try {
    if (!encoding1 || !encoding2) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.PROCESSING_ERROR,
        new Error('Invalid encodings provided for comparison')
      );
    }

    // Decode base64 strings back to arrays
    const binary1 = atob(encoding1);
    const binary2 = atob(encoding2);
    const bytes1 = new Uint8Array(binary1.length);
    const bytes2 = new Uint8Array(binary2.length);
    
    for (let i = 0; i < binary1.length; i++) {
      bytes1[i] = binary1.charCodeAt(i);
    }
    for (let i = 0; i < binary2.length; i++) {
      bytes2[i] = binary2.charCodeAt(i);
    }
    
    const features1 = new Float32Array(bytes1.buffer);
    const features2 = new Float32Array(bytes2.buffer);

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < Math.min(features1.length, features2.length); i++) {
      dotProduct += features1[i] * features2[i];
      norm1 += features1[i] * features1[i];
      norm2 += features2[i] * features2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(0, Math.min(1, (similarity + 1) / 2)); // Normalize to 0-1
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    console.error('Error comparing face encodings:', error);
    
    // Report error but don't throw - return 0 confidence instead
    if (context) {
      ErrorHandlingService.reportError(
        ErrorHandlingService.createError(
          FaceVerificationErrorType.PROCESSING_ERROR,
          error as Error,
          context
        ),
        { timestamp: new Date(), ...context }
      );
    }
    
    return 0;
  }
};

/**
 * Simple UUID generator
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Simple hash function (SHA-256 alternative)
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
};

/**
 * Encrypt face data using device-specific key
 */
export const encryptFaceData = async (
  data: string,
  context?: Partial<ErrorContext>
): Promise<string> => {
  try {
    if (!data) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.PROCESSING_ERROR,
        new Error('No data provided for encryption')
      );
    }

    // Generate or retrieve device-specific key
    let deviceKey = await SecureStore.getItemAsync('device_face_key');
    if (!deviceKey) {
      deviceKey = generateUUID();
      await SecureStore.setItemAsync('device_face_key', deviceKey);
    }

    // Simple XOR encryption (in production, use proper encryption)
    const encrypted = btoa(data.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ deviceKey.charCodeAt(i % deviceKey.length))
    ).join(''));

    return encrypted;
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    const faceError = ErrorHandlingService.createError(
      FaceVerificationErrorType.STORAGE_ERROR,
      error as Error,
      context
    );
    
    await ErrorHandlingService.reportError(faceError, {
      timestamp: new Date(),
      ...context
    });
    
    throw faceError;
  }
};

/**
 * Decrypt face data using device-specific key
 */
export const decryptFaceData = async (
  encryptedData: string,
  context?: Partial<ErrorContext>
): Promise<string> => {
  try {
    if (!encryptedData) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.PROCESSING_ERROR,
        new Error('No encrypted data provided for decryption')
      );
    }

    const deviceKey = await SecureStore.getItemAsync('device_face_key');
    if (!deviceKey) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.STORAGE_ERROR,
        new Error('Device encryption key not found')
      );
    }

    // Decrypt using XOR
    const decrypted = atob(encryptedData).split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ deviceKey.charCodeAt(i % deviceKey.length))
    ).join('');

    return decrypted;
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    const faceError = ErrorHandlingService.createError(
      FaceVerificationErrorType.STORAGE_ERROR,
      error as Error,
      context
    );
    
    await ErrorHandlingService.reportError(faceError, {
      timestamp: new Date(),
      ...context
    });
    
    throw faceError;
  }
};

/**
 * Store face profile securely with offline caching and comprehensive error handling
 */
export const storeFaceProfile = async (
  userId: number,
  faceEncoding: string,
  faceData: FaceDetectionData,
  context?: Partial<ErrorContext>
): Promise<void> => {
  const errorContext: ErrorContext = {
    userId: userId.toString(),
    timestamp: new Date(),
    ...context
  };

  return await ErrorHandlingService.handleErrorWithRetry(
    async () => {
      // Validate input parameters
      if (!userId || !faceEncoding || !faceData) {
        throw ErrorHandlingService.createError(
          FaceVerificationErrorType.PROCESSING_ERROR,
          new Error('Invalid parameters provided for face profile storage')
        );
      }

      // Validate face quality before storing
      // Note: We need a photo object for validation, but we don't have it here
      // In a real implementation, you'd pass the photo as well
      
      const encryptedData = await encryptFaceData(faceEncoding, errorContext);
      const encodingHash = simpleHash(faceEncoding);

      const profile: StoredFaceProfile = {
        userId,
        faceEncodingHash: encodingHash,
        encryptedFaceData: encryptedData,
        registrationDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        isActive: true,
        verificationCount: 0
      };

      // Store profile in secure storage
      try {
        await SecureStore.setItemAsync(
          `${FACE_PROFILE_KEY}${userId}`,
          JSON.stringify(profile)
        );
      } catch (error) {
        throw ErrorHandlingService.createError(
          FaceVerificationErrorType.STORAGE_ERROR,
          error as Error,
          errorContext
        );
      }

      // Store the actual encoding separately for quick access
      try {
        await SecureStore.setItemAsync(
          `${FACE_ENCODING_KEY}${userId}`,
          faceEncoding
        );
      } catch (error) {
        // Try to cleanup the profile if encoding storage fails
        try {
          await SecureStore.deleteItemAsync(`${FACE_PROFILE_KEY}${userId}`);
        } catch (cleanupError) {
          console.warn('Failed to cleanup profile after encoding storage failure:', cleanupError);
        }
        
        throw ErrorHandlingService.createError(
          FaceVerificationErrorType.STORAGE_ERROR,
          error as Error,
          errorContext
        );
      }

      // Cache face profile for offline verification
      try {
        await OfflineVerificationService.cacheFaceProfile(userId, encodingHash, encryptedData);
      } catch (cacheError) {
        console.warn('Failed to cache face profile for offline use:', cacheError);
        // Don't throw error as local storage succeeded - offline caching is optional
        
        // Report the caching error but don't fail the operation
        await ErrorHandlingService.reportError(
          ErrorHandlingService.createError(
            FaceVerificationErrorType.SYNC_ERROR,
            cacheError as Error,
            errorContext
          ),
          errorContext
        );
      }

      console.log('Face profile stored successfully for user:', userId);
    },
    (attempt: number, error: Error) => {
      // Retry callback
      console.log(`Storage attempt ${attempt} failed:`, error.message);
    },
    2 // maxAttempts
  );
};

/**
 * Retrieve face profile from secure storage
 */
export const getFaceProfile = async (userId: number): Promise<StoredFaceProfile | null> => {
  try {
    const profileData = await SecureStore.getItemAsync(`${FACE_PROFILE_KEY}${userId}`);
    if (!profileData) {
      return null;
    }

    return JSON.parse(profileData) as StoredFaceProfile;
  } catch (error) {
    console.error('Error retrieving face profile:', error);
    return null;
  }
};

/**
 * Get face encoding from secure storage
 */
export const getFaceEncoding = async (userId: number): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(`${FACE_ENCODING_KEY}${userId}`);
  } catch (error) {
    console.error('Error retrieving face encoding:', error);
    return null;
  }
};

/**
 * Verify face against stored profile with enhanced offline support and comprehensive error handling
 */
export const verifyFace = async (
  userId: number,
  currentFaceData: FaceDetectionData,
  currentPhoto: CapturedPhoto,
  livenessDetected: boolean = false,
  location?: { latitude: number; longitude: number; accuracy: number },
  context?: Partial<ErrorContext>
): Promise<FaceVerificationResult> => {
  const errorContext: ErrorContext = {
    userId: userId.toString(),
    timestamp: new Date(),
    ...context
  };

  return await ErrorHandlingService.handleErrorWithRetry(
    async () => {
      // Validate input parameters
      if (!currentFaceData || !currentPhoto) {
        throw ErrorHandlingService.createError(
          FaceVerificationErrorType.PROCESSING_ERROR,
          new Error('Invalid face data or photo provided for verification')
        );
      }

      // Check face quality before proceeding
      await validateFaceQuality(currentFaceData, currentPhoto);

      // Check connectivity status
      const isOnline = await ConnectivityService.isOnline();
      
      // Generate encoding for current face
      const currentEncoding = await generateFaceEncoding(
        currentFaceData, 
        currentPhoto, 
        errorContext
      );
      
      let result: FaceVerificationResult;
      
      if (isOnline) {
        // Online verification - use stored encoding
        result = await performOnlineVerification(
          userId, 
          currentEncoding, 
          livenessDetected, 
          errorContext
        );
      } else {
        // Offline verification - use cached encoding
        result = await performOfflineVerification(
          userId, 
          currentEncoding, 
          livenessDetected, 
          errorContext
        );
      }

      // Queue verification data for sync if offline
      if (!isOnline) {
        try {
          await OfflineVerificationService.queueVerificationData({
            userId,
            faceEncoding: currentEncoding,
            timestamp: new Date(),
            verificationType: 'start', // Default to 'start' - should be passed from context
            livenessDetected,
            location,
            confidence: result.confidence || 0,
            deviceFingerprint: await getDeviceFingerprint()
          });
        } catch (queueError) {
          console.warn('Failed to queue verification data:', queueError);
          // Don't fail the verification for queue errors
        }
      }

      // Cache verification result
      await cacheVerificationResult(userId, result);

      return result;
    },
    (attempt: number, error: Error) => {
      // Retry callback
      console.log(`Verification attempt ${attempt} failed:`, error.message);
    },
    3 // maxAttempts
  );
};

/**
 * Validate face quality before verification
 */
const validateFaceQuality = async (
  faceData: FaceDetectionData,
  photo: CapturedPhoto
): Promise<void> => {
  // Check face size
  const faceArea = faceData.bounds.width * faceData.bounds.height;
  const photoArea = photo.width * photo.height;
  const faceRatio = faceArea / photoArea;

  if (faceRatio < 0.1) {
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.FACE_TOO_SMALL,
      new Error('Face appears too small in the image')
    );
  }

  if (faceRatio > 0.8) {
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.FACE_TOO_LARGE,
      new Error('Face appears too large in the image')
    );
  }

  // Check face angle
  if (Math.abs(faceData.rollAngle) > 30 || Math.abs(faceData.yawAngle) > 30) {
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.FACE_ANGLE_INVALID,
      new Error('Face angle is not suitable for verification')
    );
  }

  // Check if face is centered
  const faceCenterX = faceData.bounds.x + faceData.bounds.width / 2;
  const faceCenterY = faceData.bounds.y + faceData.bounds.height / 2;
  const photoCenterX = photo.width / 2;
  const photoCenterY = photo.height / 2;

  const centerOffsetX = Math.abs(faceCenterX - photoCenterX) / photo.width;
  const centerOffsetY = Math.abs(faceCenterY - photoCenterY) / photo.height;

  if (centerOffsetX > 0.3 || centerOffsetY > 0.3) {
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.FACE_NOT_CENTERED,
      new Error('Face is not properly centered in the frame')
    );
  }
};

/**
 * Perform online face verification with error handling
 */
const performOnlineVerification = async (
  userId: number,
  currentEncoding: string,
  livenessDetected: boolean,
  context: ErrorContext
): Promise<FaceVerificationResult> => {
  try {
    // Get stored face encoding
    const storedEncoding = await getFaceEncoding(userId);
    if (!storedEncoding) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.FACE_NOT_REGISTERED,
        new Error('No face profile found for user')
      );
    }

    // Compare encodings
    const confidence = compareFaceEncodings(storedEncoding, currentEncoding, context);
    
    // Check confidence threshold
    if (confidence < VERIFICATION_CONFIDENCE_THRESHOLD) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.LOW_CONFIDENCE,
        new Error(`Verification confidence (${confidence.toFixed(2)}) below threshold (${VERIFICATION_CONFIDENCE_THRESHOLD})`)
      );
    }

    const success = confidence >= VERIFICATION_CONFIDENCE_THRESHOLD;

    // Update verification count
    if (success) {
      await updateVerificationCount(userId);
    }

    return {
      success,
      confidence,
      livenessDetected,
      faceEncoding: success ? currentEncoding : undefined,
      timestamp: new Date(),
      isOffline: false
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.VERIFICATION_FAILED,
      error as Error,
      context
    );
  }
};

/**
 * Perform offline face verification using cached data with error handling
 */
const performOfflineVerification = async (
  userId: number,
  currentEncoding: string,
  livenessDetected: boolean,
  context: ErrorContext
): Promise<FaceVerificationResult> => {
  try {
    // Try offline verification using OfflineVerificationService
    const offlineResult = await OfflineVerificationService.verifyFaceOffline(userId, currentEncoding);
    
    if (offlineResult.requiresOnlineVerification) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.NETWORK_ERROR,
        new Error('Offline verification not available - cached data expired or not found')
      );
    }

    // Check confidence threshold for offline verification
    if (offlineResult.confidence < VERIFICATION_CONFIDENCE_THRESHOLD) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.LOW_CONFIDENCE,
        new Error(`Offline verification confidence (${offlineResult.confidence.toFixed(2)}) below threshold`)
      );
    }

    return {
      success: offlineResult.success,
      confidence: offlineResult.confidence,
      livenessDetected,
      faceEncoding: offlineResult.success ? currentEncoding : undefined,
      timestamp: new Date(),
      isOffline: true,
      cached: offlineResult.cached
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      // If it's already a FaceVerificationError, check if we should fallback
      if (error.type === FaceVerificationErrorType.NETWORK_ERROR) {
        console.warn('OfflineVerificationService failed, attempting local fallback');
        return await performLocalFallbackVerification(userId, currentEncoding, livenessDetected, context);
      }
      throw error;
    }
    
    // For other errors, try local fallback
    console.warn('OfflineVerificationService failed, falling back to local verification:', error);
    return await performLocalFallbackVerification(userId, currentEncoding, livenessDetected, context);
  }
};

/**
 * Perform local fallback verification when offline service fails
 */
const performLocalFallbackVerification = async (
  userId: number,
  currentEncoding: string,
  livenessDetected: boolean,
  context: ErrorContext
): Promise<FaceVerificationResult> => {
  try {
    const storedEncoding = await getFaceEncoding(userId);
    if (!storedEncoding) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.FACE_NOT_REGISTERED,
        new Error('No face profile found for offline verification')
      );
    }

    const confidence = compareFaceEncodings(storedEncoding, currentEncoding, context);
    
    if (confidence < VERIFICATION_CONFIDENCE_THRESHOLD) {
      throw ErrorHandlingService.createError(
        FaceVerificationErrorType.LOW_CONFIDENCE,
        new Error(`Local verification confidence (${confidence.toFixed(2)}) below threshold`)
      );
    }

    const success = confidence >= VERIFICATION_CONFIDENCE_THRESHOLD;

    return {
      success,
      confidence,
      livenessDetected,
      faceEncoding: success ? currentEncoding : undefined,
      timestamp: new Date(),
      isOffline: true,
      cached: false
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw FaceVerificationError
    }
    
    throw ErrorHandlingService.createError(
      FaceVerificationErrorType.VERIFICATION_FAILED,
      error as Error,
      context
    );
  }
};

/**
 * Update verification count for user
 */
const updateVerificationCount = async (userId: number): Promise<void> => {
  try {
    const profile = await getFaceProfile(userId);
    if (profile) {
      profile.verificationCount += 1;
      profile.lastUpdated = new Date().toISOString();
      
      await SecureStore.setItemAsync(
        `${FACE_PROFILE_KEY}${userId}`,
        JSON.stringify(profile)
      );
    }
  } catch (error) {
    console.error('Error updating verification count:', error);
  }
};

/**
 * Cache verification result
 */
const cacheVerificationResult = async (
  userId: number,
  result: FaceVerificationResult
): Promise<void> => {
  try {
    const cacheKey = `${VERIFICATION_CACHE_KEY}${userId}`;
    let cache: VerificationCache;

    const existingCache = await AsyncStorage.getItem(cacheKey);
    if (existingCache) {
      cache = JSON.parse(existingCache);
    } else {
      cache = { userId, verifications: [] };
    }

    // Add new verification
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_EXPIRY_HOURS);

    cache.verifications.push({
      timestamp: result.timestamp.toISOString(),
      success: result.success,
      confidence: result.confidence,
      expiresAt: expiresAt.toISOString()
    });

    // Remove expired entries and limit cache size
    const now = new Date();
    cache.verifications = cache.verifications
      .filter(v => new Date(v.expiresAt) > now)
      .slice(-MAX_CACHED_VERIFICATIONS);

    await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('Error caching verification result:', error);
  }
};

/**
 * Store offline verification for later sync
 */
const storeOfflineVerification = async (
  userId: number,
  result: FaceVerificationResult,
  livenessDetected: boolean
): Promise<void> => {
  try {
    const deviceFingerprint = await getDeviceFingerprint();
    
    const offlineVerification: OfflineVerification = {
      id: generateUUID(),
      userId,
      timestamp: result.timestamp.toISOString(),
      success: result.success,
      confidence: result.confidence,
      livenessDetected,
      deviceFingerprint,
      synced: false
    };

    // Get existing offline verifications
    const existingData = await AsyncStorage.getItem(OFFLINE_VERIFICATIONS_KEY);
    let offlineVerifications: OfflineVerification[] = [];
    
    if (existingData) {
      offlineVerifications = JSON.parse(existingData);
    }

    offlineVerifications.push(offlineVerification);

    // Limit storage to prevent excessive data
    if (offlineVerifications.length > 1000) {
      offlineVerifications = offlineVerifications.slice(-1000);
    }

    await AsyncStorage.setItem(
      OFFLINE_VERIFICATIONS_KEY,
      JSON.stringify(offlineVerifications)
    );
  } catch (error) {
    console.error('Error storing offline verification:', error);
  }
};

/**
 * Get device fingerprint for verification tracking
 */
const getDeviceFingerprint = async (): Promise<string> => {
  try {
    let fingerprint = await AsyncStorage.getItem('device_fingerprint');
    if (!fingerprint) {
      fingerprint = generateUUID();
      await AsyncStorage.setItem('device_fingerprint', fingerprint);
    }
    return fingerprint;
  } catch (error) {
    console.error('Error getting device fingerprint:', error);
    return 'unknown';
  }
};

/**
 * Get cached verification results
 */
export const getCachedVerifications = async (userId: number): Promise<VerificationCache | null> => {
  try {
    const cacheKey = `${VERIFICATION_CACHE_KEY}${userId}`;
    const cacheData = await AsyncStorage.getItem(cacheKey);
    
    if (!cacheData) {
      return null;
    }

    const cache: VerificationCache = JSON.parse(cacheData);
    
    // Filter out expired entries
    const now = new Date();
    cache.verifications = cache.verifications.filter(
      v => new Date(v.expiresAt) > now
    );

    return cache;
  } catch (error) {
    console.error('Error getting cached verifications:', error);
    return null;
  }
};

/**
 * Get offline verifications that need to be synced
 */
export const getOfflineVerifications = async (): Promise<OfflineVerification[]> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_VERIFICATIONS_KEY);
    if (!data) {
      return [];
    }

    const verifications: OfflineVerification[] = JSON.parse(data);
    return verifications.filter(v => !v.synced);
  } catch (error) {
    console.error('Error getting offline verifications:', error);
    return [];
  }
};

/**
 * Mark offline verifications as synced
 */
export const markVerificationsAsSynced = async (verificationIds: string[]): Promise<void> => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_VERIFICATIONS_KEY);
    if (!data) {
      return;
    }

    let verifications: OfflineVerification[] = JSON.parse(data);
    
    verifications = verifications.map(v => ({
      ...v,
      synced: verificationIds.includes(v.id) ? true : v.synced
    }));

    await AsyncStorage.setItem(
      OFFLINE_VERIFICATIONS_KEY,
      JSON.stringify(verifications)
    );
  } catch (error) {
    console.error('Error marking verifications as synced:', error);
  }
};

/**
 * Sync offline verifications with server
 */
export const syncOfflineVerifications = async (apiEndpoint: string, authToken: string): Promise<void> => {
  try {
    const offlineVerifications = await getOfflineVerifications();
    
    if (offlineVerifications.length === 0) {
      return;
    }

    // Send verifications to server
    const response = await fetch(`${apiEndpoint}/sync-verifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ verifications: offlineVerifications })
    });

    if (response.ok) {
      const result = await response.json();
      const syncedIds = result.syncedIds || offlineVerifications.map(v => v.id);
      await markVerificationsAsSynced(syncedIds);
      console.log(`Synced ${syncedIds.length} offline verifications`);
    } else {
      console.error('Failed to sync offline verifications:', response.status);
    }
  } catch (error) {
    console.error('Error syncing offline verifications:', error);
  }
};

/**
 * Delete face profile and all associated data
 */
export const deleteFaceProfile = async (userId: number): Promise<void> => {
  try {
    // Remove face profile
    await SecureStore.deleteItemAsync(`${FACE_PROFILE_KEY}${userId}`);
    
    // Remove face encoding
    await SecureStore.deleteItemAsync(`${FACE_ENCODING_KEY}${userId}`);
    
    // Remove cached verifications
    await AsyncStorage.removeItem(`${VERIFICATION_CACHE_KEY}${userId}`);
    
    // Remove face settings
    await AsyncStorage.removeItem(`${FACE_SETTINGS_KEY}${userId}`);
    
    console.log('Face profile deleted successfully for user:', userId);
  } catch (error) {
    console.error('Error deleting face profile:', error);
    throw new Error('Failed to delete face profile');
  }
};

/**
 * Check if user has face profile registered
 */
export const getFaceRegistrationStatus = async (userId: number): Promise<FaceRegistrationStatus> => {
  try {
    const profile = await getFaceProfile(userId);
    
    if (!profile) {
      return {
        isRegistered: false,
        verificationCount: 0,
        isEnabled: false
      };
    }

    return {
      isRegistered: true,
      registrationDate: new Date(profile.registrationDate),
      lastVerification: profile.lastUpdated ? new Date(profile.lastUpdated) : undefined,
      verificationCount: profile.verificationCount,
      isEnabled: profile.isActive
    };
  } catch (error) {
    console.error('Error getting face registration status:', error);
    return {
      isRegistered: false,
      verificationCount: 0,
      isEnabled: false
    };
  }
};

/**
 * Update face profile (re-registration)
 */
export const updateFaceProfile = async (
  userId: number,
  newFaceEncoding: string,
  newFaceData: FaceDetectionData
): Promise<void> => {
  try {
    const existingProfile = await getFaceProfile(userId);
    
    if (!existingProfile) {
      throw new Error('No existing face profile found');
    }

    // Store new face data
    await storeFaceProfile(userId, newFaceEncoding, newFaceData);
    
    // Clear cached verifications since profile changed
    await AsyncStorage.removeItem(`${VERIFICATION_CACHE_KEY}${userId}`);
    
    console.log('Face profile updated successfully for user:', userId);
  } catch (error) {
    console.error('Error updating face profile:', error);
    throw new Error('Failed to update face profile');
  }
};

/**
 * Clear all cached data (for debugging/reset)
 */
export const clearAllFaceData = async (): Promise<void> => {
  try {
    // Get all keys and remove face-related ones
    const allKeys = await AsyncStorage.getAllKeys();
    const faceKeys = allKeys.filter(key => 
      key.startsWith(VERIFICATION_CACHE_KEY) ||
      key.startsWith(FACE_SETTINGS_KEY) ||
      key === OFFLINE_VERIFICATIONS_KEY
    );
    
    await AsyncStorage.multiRemove(faceKeys);
    
    // Also clear OfflineVerificationService data
    try {
      await OfflineVerificationService.clearAllOfflineData();
    } catch (error) {
      console.warn('Failed to clear OfflineVerificationService data:', error);
    }
    
    console.log('All face cache data cleared');
  } catch (error) {
    console.error('Error clearing face data:', error);
  }
};

/**
 * Initialize offline verification capabilities
 */
export const initializeOfflineVerification = async (): Promise<void> => {
  try {
    await OfflineVerificationService.initialize();
    await ConnectivityService.initialize();
    console.log('Offline verification initialized successfully');
  } catch (error) {
    console.error('Failed to initialize offline verification:', error);
    throw error;
  }
};

/**
 * Sync all offline verification data
 */
export const syncOfflineData = async (apiEndpoint: string, authToken: string): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> => {
  try {
    const isOnline = await ConnectivityService.isOnline();
    if (!isOnline) {
      throw new Error('No internet connection available for sync');
    }

    // Sync using OfflineVerificationService
    const result = await OfflineVerificationService.syncQueuedVerifications();
    
    // Also sync legacy offline verifications
    await syncOfflineVerifications(apiEndpoint, authToken);
    
    return result;
  } catch (error) {
    console.error('Failed to sync offline data:', error);
    throw error;
  }
};

/**
 * Get offline verification statistics
 */
export const getOfflineStats = async (): Promise<{
  queuedItems: number;
  cachedProfiles: number;
  cachedGeofences: number;
  lastSync?: Date;
  isOnline: boolean;
}> => {
  try {
    const stats = await OfflineVerificationService.getStorageStats();
    const isOnline = await ConnectivityService.isOnline();
    
    return {
      ...stats,
      isOnline
    };
  } catch (error) {
    console.error('Failed to get offline stats:', error);
    return {
      queuedItems: 0,
      cachedProfiles: 0,
      cachedGeofences: 0,
      isOnline: false
    };
  }
};

/**
 * Validate location offline using cached geofences
 */
export const validateLocationOffline = async (location: {
  latitude: number;
  longitude: number;
}): Promise<{
  isValid: boolean;
  geofenceName?: string;
  distance?: number;
}> => {
  try {
    return await OfflineVerificationService.validateLocationOffline(location);
  } catch (error) {
    console.error('Offline location validation failed:', error);
    return { isValid: false };
  }
};

/**
 * Cache geofences for offline validation
 */
export const cacheGeofencesForOfflineUse = async (geofences: Array<{
  id: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  radius: number;
}>): Promise<void> => {
  try {
    // Add lastUpdated timestamp to geofences
    const geofencesWithTimestamp = geofences.map(geofence => ({
      ...geofence,
      lastUpdated: new Date()
    }));
    
    await OfflineVerificationService.cacheGeofences(geofencesWithTimestamp);
    console.log(`Cached ${geofences.length} geofences for offline use`);
  } catch (error) {
    console.error('Failed to cache geofences:', error);
    throw error;
  }
};

/**
 * Check if cached face data is available and valid
 */
export const isCachedDataAvailable = async (userId: number): Promise<{
  available: boolean;
  expiresAt?: Date;
  lastUpdated?: Date;
}> => {
  try {
    const cachedProfiles = await OfflineVerificationService.getCachedProfiles();
    const userProfile = cachedProfiles.find(profile => profile.userId === userId);
    
    if (!userProfile) {
      return { available: false };
    }
    
    return {
      available: true,
      expiresAt: new Date(userProfile.expiresAt),
      lastUpdated: new Date(userProfile.lastUpdated)
    };
  } catch (error) {
    console.error('Failed to check cached data availability:', error);
    return { available: false };
  }
};