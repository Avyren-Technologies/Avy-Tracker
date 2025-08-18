/**
 * useOfflineVerification Hook
 * 
 * Custom hook for managing offline verification capabilities including:
 * - Connectivity monitoring
 * - Offline face verification
 * - Data queueing and sync
 * - Cache management
 */

import { useState, useEffect, useCallback } from 'react';
import { OfflineVerificationService } from '../services/OfflineVerificationService';

interface OfflineVerificationState {
  isOnline: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  queuedItems: number;
  cachedProfiles: number;
  lastSync?: Date;
  error: string | null;
}

interface OfflineVerificationResult {
  success: boolean;
  confidence: number;
  cached: boolean;
  requiresOnlineVerification: boolean;
}

interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export const useOfflineVerification = () => {
  const [state, setState] = useState<OfflineVerificationState>({
    isOnline: true,
    isInitialized: false,
    isSyncing: false,
    queuedItems: 0,
    cachedProfiles: 0,
    error: null
  });

  /**
   * Initialize offline verification service
   */
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      await OfflineVerificationService.initialize();
      
      // Get initial stats
      const stats = await OfflineVerificationService.getStorageStats();
      const connectivity = await OfflineVerificationService.getConnectivityStatus();
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isOnline: connectivity.isConnected && connectivity.isInternetReachable,
        queuedItems: stats.queuedItems,
        cachedProfiles: stats.cachedProfiles,
        lastSync: stats.lastSync
      }));
      
      console.log('Offline verification initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize offline verification';
      setState(prev => ({ ...prev, error: errorMessage }));
      console.error('Failed to initialize offline verification:', error);
    }
  }, []);

  /**
   * Check connectivity status
   */
  const checkConnectivity = useCallback(async () => {
    try {
      const connectivity = await OfflineVerificationService.getConnectivityStatus();
      setState(prev => ({
        ...prev,
        isOnline: connectivity.isConnected && connectivity.isInternetReachable
      }));
      return connectivity;
    } catch (error) {
      console.error('Failed to check connectivity:', error);
      return { isConnected: false, isInternetReachable: false, type: 'unknown' };
    }
  }, []);

  /**
   * Perform offline face verification
   */
  const verifyFaceOffline = useCallback(async (
    userId: number,
    faceEncoding: string
  ): Promise<OfflineVerificationResult> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const result = await OfflineVerificationService.verifyFaceOffline(userId, faceEncoding);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Offline verification failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Queue verification data for later sync
   */
  const queueVerificationData = useCallback(async (verificationData: {
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
  }): Promise<string> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const queueId = await OfflineVerificationService.queueVerificationData(verificationData);
      
      // Update queued items count
      const stats = await OfflineVerificationService.getStorageStats();
      setState(prev => ({ ...prev, queuedItems: stats.queuedItems }));
      
      return queueId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to queue verification data';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Sync queued verifications with server
   */
  const syncQueuedVerifications = useCallback(async (): Promise<SyncResult> => {
    try {
      setState(prev => ({ ...prev, isSyncing: true, error: null }));
      
      const result = await OfflineVerificationService.syncQueuedVerifications();
      
      // Update stats after sync
      const stats = await OfflineVerificationService.getStorageStats();
      setState(prev => ({
        ...prev,
        isSyncing: false,
        queuedItems: stats.queuedItems,
        lastSync: stats.lastSync
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setState(prev => ({ ...prev, isSyncing: false, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Cache face profile for offline use
   */
  const cacheFaceProfile = useCallback(async (
    userId: number,
    faceEncodingHash: string,
    encryptedFaceData: string
  ): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      await OfflineVerificationService.cacheFaceProfile(userId, faceEncodingHash, encryptedFaceData);
      
      // Update cached profiles count
      const stats = await OfflineVerificationService.getStorageStats();
      setState(prev => ({ ...prev, cachedProfiles: stats.cachedProfiles }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cache face profile';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Validate location offline using cached geofences
   */
  const validateLocationOffline = useCallback(async (location: {
    latitude: number;
    longitude: number;
  }): Promise<{
    isValid: boolean;
    geofenceName?: string;
    distance?: number;
  }> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      return await OfflineVerificationService.validateLocationOffline(location);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Offline location validation failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Cache geofences for offline validation
   */
  const cacheGeofences = useCallback(async (geofences: Array<{
    id: string;
    name: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    radius: number;
  }>): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Add lastUpdated timestamp to geofences
      const geofencesWithTimestamp = geofences.map(geofence => ({
        ...geofence,
        lastUpdated: new Date()
      }));
      
      await OfflineVerificationService.cacheGeofences(geofencesWithTimestamp);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cache geofences';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Get storage statistics
   */
  const getStorageStats = useCallback(async () => {
    try {
      const stats = await OfflineVerificationService.getStorageStats();
      setState(prev => ({
        ...prev,
        queuedItems: stats.queuedItems,
        cachedProfiles: stats.cachedProfiles,
        lastSync: stats.lastSync
      }));
      return stats;
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        queuedItems: 0,
        cachedProfiles: 0,
        cachedGeofences: 0
      };
    }
  }, []);

  /**
   * Clear all offline data
   */
  const clearOfflineData = useCallback(async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      await OfflineVerificationService.clearAllOfflineData();
      
      setState(prev => ({
        ...prev,
        queuedItems: 0,
        cachedProfiles: 0,
        lastSync: undefined
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear offline data';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  /**
   * Refresh stats periodically
   */
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(async () => {
      try {
        await getStorageStats();
        await checkConnectivity();
      } catch (error) {
        console.error('Failed to refresh stats:', error);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [state.isInitialized, getStorageStats, checkConnectivity]);

  /**
   * Auto-sync when coming online
   */
  useEffect(() => {
    if (state.isOnline && state.queuedItems > 0 && !state.isSyncing) {
      syncQueuedVerifications().catch(error => {
        console.error('Auto-sync failed:', error);
      });
    }
  }, [state.isOnline, state.queuedItems, state.isSyncing, syncQueuedVerifications]);

  return {
    // State
    ...state,
    
    // Actions
    initialize,
    checkConnectivity,
    verifyFaceOffline,
    queueVerificationData,
    syncQueuedVerifications,
    cacheFaceProfile,
    validateLocationOffline,
    cacheGeofences,
    getStorageStats,
    clearOfflineData
  };
};