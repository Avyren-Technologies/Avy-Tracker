/**
 * OfflineVerificationService
 * 
 * Handles offline face verification capabilities including:
 * - Cached face encodings for offline verification
 * - Verification data queueing system
 * - Sync functionality for queued verifications
 * - Offline geofence validation
 * - Cached data management
 * - Connectivity status monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import BiometricStorageService from './BiometricStorageService';
import * as FaceVerificationService from './FaceVerificationService';

interface OfflineVerificationData {
  id: string;
  userId: number;
  faceEncoding: string;
  timestamp: Date;
  verificationType: 'start' | 'end' | 'registration' | 'update';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  confidence: number;
  livenessDetected: boolean;
  deviceFingerprint: string;
  synced: boolean;
}

interface CachedFaceProfile {
  userId: number;
  faceEncodingHash: string;
  encryptedFaceData: string;
  lastUpdated: Date;
  expiresAt: Date;
}

interface GeofenceCache {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  lastUpdated: Date;
}

interface ConnectivityStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

export const OfflineVerificationService = {
  // Storage keys
  OFFLINE_QUEUE_KEY: 'offline_verification_queue',
  CACHED_PROFILES_KEY: 'cached_face_profiles',
  GEOFENCE_CACHE_KEY: 'cached_geofences',
  LAST_SYNC_KEY: 'last_sync_timestamp',

  // Cache expiry (7 days as per requirements)
  CACHE_EXPIRY_DAYS: 7,
  
  // Sync retry configuration
  MAX_RETRY_ATTEMPTS: 5,
  RETRY_DELAY_BASE: 1000, // 1 second base delay

  /**
   * Initialize offline verification service
   */
  async initialize(): Promise<void> {
    try {
      // Set up connectivity monitoring
      await this.setupConnectivityMonitoring();
      
      // Clean up expired cache data
      await this.cleanupExpiredCache();
      
      // Attempt initial sync if connected
      const connectivity = await this.getConnectivityStatus();
      if (connectivity.isConnected && connectivity.isInternetReachable) {
        await this.syncQueuedVerifications();
      }
      
      console.log('OfflineVerificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineVerificationService:', error);
      throw error;
    }
  },

  /**
   * Set up connectivity monitoring
   */
  async setupConnectivityMonitoring(): Promise<void> {
    NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      
      if (isConnected) {
        // Connection restored, attempt to sync queued data
        this.syncQueuedVerifications().catch(error => {
          console.error('Auto-sync failed after connectivity restored:', error);
        });
      }
    });
  },

  /**
   * Get current connectivity status
   */
  async getConnectivityStatus(): Promise<ConnectivityStatus> {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected || false,
      isInternetReachable: state.isInternetReachable || false,
      type: state.type || 'unknown'
    };
  },

  /**
   * Cache face profile for offline verification
   */
  async cacheFaceProfile(userId: number, faceEncodingHash: string, encryptedFaceData: string): Promise<void> {
    try {
      const cachedProfiles = await this.getCachedProfiles();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.CACHE_EXPIRY_DAYS);

      const profileToCache: CachedFaceProfile = {
        userId,
        faceEncodingHash,
        encryptedFaceData,
        lastUpdated: new Date(),
        expiresAt
      };

      // Remove existing profile for this user
      const updatedProfiles = cachedProfiles.filter(profile => profile.userId !== userId);
      updatedProfiles.push(profileToCache);

      await AsyncStorage.setItem(this.CACHED_PROFILES_KEY, JSON.stringify(updatedProfiles));
      console.log(`Face profile cached for user ${userId}`);
    } catch (error) {
      console.error('Failed to cache face profile:', error);
      throw error;
    }
  },

  /**
   * Get cached face profiles
   */
  async getCachedProfiles(): Promise<CachedFaceProfile[]> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHED_PROFILES_KEY);
      if (!cached) return [];

      const profiles: CachedFaceProfile[] = JSON.parse(cached);
      
      // Filter out expired profiles
      const now = new Date();
      return profiles.filter(profile => new Date(profile.expiresAt) > now);
    } catch (error) {
      console.error('Failed to get cached profiles:', error);
      return [];
    }
  },

  /**
   * Perform offline face verification using cached data
   */
  async verifyFaceOffline(userId: number, currentEncoding: string): Promise<{
    success: boolean;
    confidence: number;
    cached: boolean;
    requiresOnlineVerification: boolean;
  }> {
    try {
      const cachedProfiles = await this.getCachedProfiles();
      const userProfile = cachedProfiles.find(profile => profile.userId === userId);

      if (!userProfile) {
        return {
          success: false,
          confidence: 0,
          cached: false,
          requiresOnlineVerification: true
        };
      }

      // Check if cached data is still valid
      const now = new Date();
      if (new Date(userProfile.expiresAt) <= now) {
        return {
          success: false,
          confidence: 0,
          cached: false,
          requiresOnlineVerification: true
        };
      }

      // Decrypt cached face data
      const encryptedDataObject = JSON.parse(userProfile.encryptedFaceData);
      const decryptedFaceData = await BiometricStorageService.decryptBiometricData(encryptedDataObject);
      
      // Compare face encodings (simplified comparison for offline use)
      const confidence = await this.compareFaceEncodingsOffline(decryptedFaceData, currentEncoding);
      const success = confidence >= 0.7; // Threshold for offline verification

      return {
        success,
        confidence,
        cached: true,
        requiresOnlineVerification: false
      };
    } catch (error) {
      console.error('Offline face verification failed:', error);
      return {
        success: false,
        confidence: 0,
        cached: false,
        requiresOnlineVerification: true
      };
    }
  },

  /**
   * Compare face encodings offline (simplified algorithm)
   */
  async compareFaceEncodingsOffline(storedEncoding: string, currentEncoding: string): Promise<number> {
    try {
      // Simple cosine similarity calculation for offline comparison
      const stored = JSON.parse(storedEncoding);
      const current = JSON.parse(currentEncoding);

      if (!Array.isArray(stored) || !Array.isArray(current) || stored.length !== current.length) {
        return 0;
      }

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < stored.length; i++) {
        dotProduct += stored[i] * current[i];
        normA += stored[i] * stored[i];
        normB += current[i] * current[i];
      }

      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      return Math.max(0, Math.min(1, similarity)); // Clamp between 0 and 1
    } catch (error) {
      console.error('Face encoding comparison failed:', error);
      return 0;
    }
  },

  /**
   * Queue verification data for later sync
   */
  async queueVerificationData(verificationData: Omit<OfflineVerificationData, 'id' | 'synced'>): Promise<string> {
    try {
      const queue = await this.getVerificationQueue();
      const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queuedData: OfflineVerificationData = {
        ...verificationData,
        id,
        synced: false
      };

      queue.push(queuedData);
      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      
      console.log(`Verification data queued with ID: ${id}`);
      return id;
    } catch (error) {
      console.error('Failed to queue verification data:', error);
      throw error;
    }
  },

  /**
   * Get verification queue
   */
  async getVerificationQueue(): Promise<OfflineVerificationData[]> {
    try {
      const queue = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Failed to get verification queue:', error);
      return [];
    }
  },

  /**
   * Sync queued verifications with server
   */
  async syncQueuedVerifications(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const connectivity = await this.getConnectivityStatus();
      if (!connectivity.isConnected || !connectivity.isInternetReachable) {
        throw new Error('No internet connection available for sync');
      }

      const queue = await this.getVerificationQueue();
      const unsyncedData = queue.filter(item => !item.synced);

      if (unsyncedData.length === 0) {
        return { synced: 0, failed: 0, errors: [] };
      }

      let syncedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const data of unsyncedData) {
        try {
          await this.syncSingleVerification(data);
          
          // Mark as synced
          const updatedQueue = queue.map(item => 
            item.id === data.id ? { ...item, synced: true } : item
          );
          await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
          
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync verification ${data.id}:`, error);
          errors.push(`${data.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          failedCount++;
        }
      }

      // Clean up synced items older than 24 hours
      await this.cleanupSyncedItems();

      console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);
      return { synced: syncedCount, failed: failedCount, errors };
    } catch (error) {
      console.error('Sync operation failed:', error);
      throw error;
    }
  },

  /**
   * Sync single verification with exponential backoff
   */
  async syncSingleVerification(data: OfflineVerificationData, attempt: number = 1): Promise<void> {
    try {
      // Call the appropriate API endpoint based on verification type
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/sync-offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers as needed
        },
        body: JSON.stringify({
          userId: data.userId,
          verificationType: data.verificationType,
          timestamp: data.timestamp,
          confidence: data.confidence,
          livenessDetected: data.livenessDetected,
          location: data.location,
          deviceFingerprint: data.deviceFingerprint,
          offlineId: data.id
        })
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      console.log(`Successfully synced verification ${data.id}`);
    } catch (error) {
      if (attempt < this.MAX_RETRY_ATTEMPTS) {
        const delay = this.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        console.log(`Retrying sync for ${data.id} in ${delay}ms (attempt ${attempt + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.syncSingleVerification(data, attempt + 1);
      }
      
      throw error;
    }
  },

  /**
   * Cache geofences for offline validation
   */
  async cacheGeofences(geofences: GeofenceCache[]): Promise<void> {
    try {
      const cacheData = geofences.map(geofence => ({
        ...geofence,
        lastUpdated: new Date()
      }));

      await AsyncStorage.setItem(this.GEOFENCE_CACHE_KEY, JSON.stringify(cacheData));
      console.log(`Cached ${geofences.length} geofences for offline use`);
    } catch (error) {
      console.error('Failed to cache geofences:', error);
      throw error;
    }
  },

  /**
   * Get cached geofences
   */
  async getCachedGeofences(): Promise<GeofenceCache[]> {
    try {
      const cached = await AsyncStorage.getItem(this.GEOFENCE_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to get cached geofences:', error);
      return [];
    }
  },

  /**
   * Validate location against cached geofences
   */
  async validateLocationOffline(location: { latitude: number; longitude: number }): Promise<{
    isValid: boolean;
    geofenceName?: string;
    distance?: number;
  }> {
    try {
      const cachedGeofences = await this.getCachedGeofences();
      
      for (const geofence of cachedGeofences) {
        const distance = this.calculateDistance(
          location,
          geofence.coordinates
        );

        if (distance <= geofence.radius) {
          return {
            isValid: true,
            geofenceName: geofence.name,
            distance
          };
        }
      }

      return { isValid: false };
    } catch (error) {
      console.error('Offline location validation failed:', error);
      return { isValid: false };
    }
  },

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },

  /**
   * Clean up expired cache data
   */
  async cleanupExpiredCache(): Promise<void> {
    try {
      // Clean up expired face profiles
      const profiles = await this.getCachedProfiles();
      const validProfiles = profiles.filter(profile => new Date(profile.expiresAt) > new Date());
      await AsyncStorage.setItem(this.CACHED_PROFILES_KEY, JSON.stringify(validProfiles));

      // Clean up old geofence cache (older than 24 hours)
      const geofences = await this.getCachedGeofences();
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      const validGeofences = geofences.filter(geofence => 
        new Date(geofence.lastUpdated) > oneDayAgo
      );
      await AsyncStorage.setItem(this.GEOFENCE_CACHE_KEY, JSON.stringify(validGeofences));

      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  },

  /**
   * Clean up synced items older than 24 hours
   */
  async cleanupSyncedItems(): Promise<void> {
    try {
      const queue = await this.getVerificationQueue();
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const filteredQueue = queue.filter(item => {
        if (item.synced && new Date(item.timestamp) < oneDayAgo) {
          return false; // Remove old synced items
        }
        return true;
      });

      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(filteredQueue));
      console.log(`Cleaned up ${queue.length - filteredQueue.length} old synced items`);
    } catch (error) {
      console.error('Failed to cleanup synced items:', error);
    }
  },

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    queuedItems: number;
    cachedProfiles: number;
    cachedGeofences: number;
    lastSync?: Date;
  }> {
    try {
      const queue = await this.getVerificationQueue();
      const profiles = await this.getCachedProfiles();
      const geofences = await this.getCachedGeofences();
      
      const lastSyncStr = await AsyncStorage.getItem(this.LAST_SYNC_KEY);
      const lastSync = lastSyncStr ? new Date(lastSyncStr) : undefined;

      return {
        queuedItems: queue.filter(item => !item.synced).length,
        cachedProfiles: profiles.length,
        cachedGeofences: geofences.length,
        lastSync
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        queuedItems: 0,
        cachedProfiles: 0,
        cachedGeofences: 0
      };
    }
  },

  /**
   * Clear all offline data (for testing or reset purposes)
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.OFFLINE_QUEUE_KEY,
        this.CACHED_PROFILES_KEY,
        this.GEOFENCE_CACHE_KEY,
        this.LAST_SYNC_KEY
      ]);
      console.log('All offline data cleared');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }
};