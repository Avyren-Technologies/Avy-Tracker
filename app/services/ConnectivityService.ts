/**
 * ConnectivityService
 * 
 * Service for monitoring network connectivity and managing offline/online state
 * Provides real-time connectivity status and handles connectivity changes
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  isExpensive?: boolean;
  details?: any;
}

interface ConnectivityListener {
  id: string;
  callback: (state: ConnectivityState) => void;
}

export const ConnectivityService = {
  // Storage key for connectivity state
  CONNECTIVITY_STATE_KEY: 'connectivity_state',
  
  // Listeners registry
  listeners: [] as ConnectivityListener[],
  
  // Current state
  currentState: null as ConnectivityState | null,
  
  // Unsubscribe function from NetInfo
  unsubscribe: null as (() => void) | null,

  /**
   * Initialize connectivity monitoring
   */
  async initialize(): Promise<ConnectivityState> {
    try {
      // Get initial state
      const initialState = await NetInfo.fetch();
      this.currentState = this.mapNetInfoState(initialState);
      
      // Store initial state
      await this.storeConnectivityState(this.currentState);
      
      // Set up listener for connectivity changes
      this.unsubscribe = NetInfo.addEventListener(this.handleConnectivityChange.bind(this));
      
      console.log('ConnectivityService initialized:', this.currentState);
      return this.currentState;
    } catch (error) {
      console.error('Failed to initialize ConnectivityService:', error);
      
      // Return default offline state on error
      const defaultState: ConnectivityState = {
        isConnected: false,
        isInternetReachable: false,
        type: 'unknown'
      };
      
      this.currentState = defaultState;
      return defaultState;
    }
  },

  /**
   * Handle connectivity state changes
   */
  handleConnectivityChange(state: NetInfoState): void {
    const newState = this.mapNetInfoState(state);
    const previousState = this.currentState;
    
    this.currentState = newState;
    
    // Store new state
    this.storeConnectivityState(newState).catch(error => {
      console.error('Failed to store connectivity state:', error);
    });
    
    // Log connectivity changes
    if (previousState) {
      const wasOnline = previousState.isConnected && previousState.isInternetReachable;
      const isOnline = newState.isConnected && newState.isInternetReachable;
      
      if (wasOnline !== isOnline) {
        console.log(`Connectivity changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      }
    }
    
    // Notify all listeners
    this.notifyListeners(newState);
  },

  /**
   * Map NetInfo state to our connectivity state format
   */
  mapNetInfoState(state: NetInfoState): ConnectivityState {
    return {
      isConnected: state.isConnected || false,
      isInternetReachable: state.isInternetReachable || false,
      type: state.type || 'unknown',
      isExpensive: state.isWifiEnabled === false && state.type === 'cellular',
      details: state.details
    };
  },

  /**
   * Get current connectivity state
   */
  async getCurrentState(): Promise<ConnectivityState> {
    if (this.currentState) {
      return this.currentState;
    }
    
    try {
      const state = await NetInfo.fetch();
      this.currentState = this.mapNetInfoState(state);
      return this.currentState;
    } catch (error) {
      console.error('Failed to get current connectivity state:', error);
      
      // Try to get cached state
      const cachedState = await this.getCachedConnectivityState();
      if (cachedState) {
        this.currentState = cachedState;
        return cachedState;
      }
      
      // Return default offline state
      const defaultState: ConnectivityState = {
        isConnected: false,
        isInternetReachable: false,
        type: 'unknown'
      };
      
      this.currentState = defaultState;
      return defaultState;
    }
  },

  /**
   * Check if device is online (connected and internet reachable)
   */
  async isOnline(): Promise<boolean> {
    const state = await this.getCurrentState();
    return state.isConnected && state.isInternetReachable;
  },

  /**
   * Check if device is offline
   */
  async isOffline(): Promise<boolean> {
    const online = await this.isOnline();
    return !online;
  },

  /**
   * Check if connection is expensive (cellular data)
   */
  async isExpensiveConnection(): Promise<boolean> {
    const state = await this.getCurrentState();
    return state.isExpensive || false;
  },

  /**
   * Add connectivity change listener
   */
  addListener(callback: (state: ConnectivityState) => void): string {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.listeners.push({
      id,
      callback
    });
    
    // Immediately call with current state if available
    if (this.currentState) {
      callback(this.currentState);
    }
    
    return id;
  },

  /**
   * Remove connectivity change listener
   */
  removeListener(listenerId: string): void {
    this.listeners = this.listeners.filter(listener => listener.id !== listenerId);
  },

  /**
   * Notify all listeners of connectivity changes
   */
  notifyListeners(state: ConnectivityState): void {
    this.listeners.forEach(listener => {
      try {
        listener.callback(state);
      } catch (error) {
        console.error('Error in connectivity listener:', error);
      }
    });
  },

  /**
   * Store connectivity state in AsyncStorage
   */
  async storeConnectivityState(state: ConnectivityState): Promise<void> {
    try {
      const stateWithTimestamp = {
        ...state,
        timestamp: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(
        this.CONNECTIVITY_STATE_KEY,
        JSON.stringify(stateWithTimestamp)
      );
    } catch (error) {
      console.error('Failed to store connectivity state:', error);
    }
  },

  /**
   * Get cached connectivity state from AsyncStorage
   */
  async getCachedConnectivityState(): Promise<ConnectivityState | null> {
    try {
      const cached = await AsyncStorage.getItem(this.CONNECTIVITY_STATE_KEY);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      
      // Check if cached state is not too old (max 5 minutes)
      const timestamp = new Date(parsed.timestamp);
      const now = new Date();
      const ageInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
      
      if (ageInMinutes > 5) {
        return null; // Cached state is too old
      }
      
      // Remove timestamp before returning
      const { timestamp: _, ...state } = parsed;
      return state as ConnectivityState;
    } catch (error) {
      console.error('Failed to get cached connectivity state:', error);
      return null;
    }
  },

  /**
   * Test internet connectivity by making a simple request
   */
  async testInternetConnectivity(timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('Internet connectivity test failed:', error);
      return false;
    }
  },

  /**
   * Wait for online connectivity
   */
  async waitForOnline(timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnectivity = async () => {
        const isOnline = await this.isOnline();
        
        if (isOnline) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime >= timeout) {
          resolve(false);
          return;
        }
        
        // Check again in 1 second
        setTimeout(checkConnectivity, 1000);
      };
      
      checkConnectivity();
    });
  },

  /**
   * Get connectivity statistics
   */
  async getConnectivityStats(): Promise<{
    currentState: ConnectivityState;
    isOnline: boolean;
    connectionType: string;
    isExpensive: boolean;
    lastStateChange?: Date;
  }> {
    const currentState = await this.getCurrentState();
    const isOnline = currentState.isConnected && currentState.isInternetReachable;
    
    // Try to get last state change from cache
    let lastStateChange: Date | undefined;
    try {
      const cached = await AsyncStorage.getItem(this.CONNECTIVITY_STATE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        lastStateChange = new Date(parsed.timestamp);
      }
    } catch (error) {
      // Ignore error
    }
    
    return {
      currentState,
      isOnline,
      connectionType: currentState.type,
      isExpensive: currentState.isExpensive || false,
      lastStateChange
    };
  },

  /**
   * Cleanup and dispose of the service
   */
  dispose(): void {
    // Remove NetInfo listener
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    // Clear all listeners
    this.listeners = [];
    
    // Clear current state
    this.currentState = null;
    
    console.log('ConnectivityService disposed');
  }
};