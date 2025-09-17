import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: 'fingerprint' | 'face' | 'iris' | 'none';
}

export interface BiometricSettings {
  enabled: boolean;
  required: boolean;
  lastUsed?: Date;
}

class BiometricAuthService {
  private static instance: BiometricAuthService;
  private biometricSettings: BiometricSettings = {
    enabled: false,
    required: false,
  };

  private constructor() {}

  public static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  /**
   * Check if device supports biometric authentication
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get supported biometric types on the device
   */
  async getSupportedBiometricTypes(): Promise<string[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types.map((type: LocalAuthentication.AuthenticationType) => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'face';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'none';
        }
      }).filter((type: string) => type !== 'none');
    } catch (error) {
      console.error('Error getting supported biometric types:', error);
      return [];
    }
  }

  /**
   * Get the primary biometric type available on the device
   */
  async getPrimaryBiometricType(): Promise<string> {
    const types = await this.getSupportedBiometricTypes();
    if (types.includes('face')) return 'face';
    if (types.includes('fingerprint')) return 'fingerprint';
    if (types.includes('iris')) return 'iris';
    return 'none';
  }

  /**
   * Get biometric settings for the current user
   */
  async getBiometricSettings(): Promise<BiometricSettings> {
    try {
      const settings = await AsyncStorage.getItem('biometricSettings');
      if (settings) {
        this.biometricSettings = JSON.parse(settings);
      }
      return this.biometricSettings;
    } catch (error) {
      console.error('Error getting biometric settings:', error);
      return this.biometricSettings;
    }
  }

  /**
   * Save biometric settings for the current user
   */
  async saveBiometricSettings(settings: Partial<BiometricSettings>): Promise<void> {
    try {
      this.biometricSettings = { ...this.biometricSettings, ...settings };
      await AsyncStorage.setItem('biometricSettings', JSON.stringify(this.biometricSettings));
    } catch (error) {
      console.error('Error saving biometric settings:', error);
    }
  }

  /**
   * Enable or disable biometric authentication
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.saveBiometricSettings({ enabled });
  }

  /**
   * Set whether biometric authentication is required for app access
   */
  async setBiometricRequired(required: boolean): Promise<void> {
    await this.saveBiometricSettings({ required });
  }

  /**
   * Authenticate user with biometrics
   * @param promptMessage - Message to show during authentication
   * @param allowSetup - Allow authentication even if not enabled (for initial setup)
   */
  async authenticateUser(promptMessage?: string, allowSetup: boolean = false): Promise<BiometricAuthResult> {
    try {
      console.log('Biometric authentication started:', { promptMessage, allowSetup });
      
      const settings = await this.getBiometricSettings();
      console.log('Current biometric settings:', settings);
      
      // Check if biometric is enabled (unless this is setup mode)
      if (!allowSetup && !settings.enabled) {
        console.log('Biometric authentication blocked: not enabled');
        return { success: false, error: 'Biometric authentication is not enabled' };
      }

      const isAvailable = await this.isBiometricAvailable();
      console.log('Biometric availability check:', isAvailable);
      
      if (!isAvailable) {
        console.log('Biometric authentication blocked: not available on device');
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      const biometricType = await this.getPrimaryBiometricType();
      console.log('Primary biometric type:', biometricType);
      
      if (biometricType === 'none') {
        console.log('Biometric authentication blocked: no supported types');
        return { success: false, error: 'No supported biometric authentication types found' };
      }
      
      console.log('Starting LocalAuthentication.authenticateAsync...');
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });

      console.log('LocalAuthentication result:', result);

      if (result.success) {
        // Update last used timestamp
        await this.saveBiometricSettings({ lastUsed: new Date() });
        console.log('Biometric authentication successful');
        
        return {
          success: true,
          biometricType: biometricType as 'fingerprint' | 'face' | 'iris',
        };
      } else {
        console.log('Biometric authentication failed:', result.error);
        return {
          success: false,
          error: result.error || 'Authentication failed',
          biometricType: biometricType as 'fingerprint' | 'face' | 'iris',
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed due to an unexpected error',
      };
    }
  }

  /**
   * Check if biometric authentication is required for app access
   */
  async isBiometricRequired(): Promise<boolean> {
    const settings = await this.getBiometricSettings();
    return settings.required && settings.enabled;
  }

  /**
   * Get user-friendly biometric type name
   */
  getBiometricTypeName(type: string): string {
    switch (type) {
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case 'face':
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case 'iris':
        return 'Iris Scan';
      default:
        return 'Biometric';
    }
  }

  /**
   * Get biometric icon name for UI
   */
  getBiometricIconName(type: string): string {
    switch (type) {
      case 'fingerprint':
        return 'fingerprint';
      case 'face':
        return 'face-recognition';
      case 'iris':
        return 'eye';
      default:
        return 'fingerprint';
    }
  }

  /**
   * Reset biometric settings
   */
  async resetBiometricSettings(): Promise<void> {
    try {
      this.biometricSettings = {
        enabled: false,
        required: false,
      };
      await AsyncStorage.removeItem('biometricSettings');
    } catch (error) {
      console.error('Error resetting biometric settings:', error);
    }
  }
}

export default BiometricAuthService.getInstance();
