import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { ErrorHandlingService } from './ErrorHandlingService';

interface BiometricData {
  type: 'face' | 'fingerprint' | 'voice';
  data: any;
  metadata: {
    createdAt: string;
    deviceInfo: any;
    version?: string;
  };
}

interface StoredBiometric {
  id: string;
  userId: string;
  encryptedData: string;
  hash: string;
  metadata: {
    createdAt: string;
    lastUsed: string;
    deviceInfo: any;
    version: string;
  };
}

export class BiometricStorageService {
  private static instance: BiometricStorageService;
  private readonly STORAGE_PREFIX = 'biometric_';
  private readonly ENCRYPTION_KEY_PREFIX = 'bio_key_';
  private readonly CURRENT_VERSION = '1.0';

  private constructor() {}

  public static getInstance(): BiometricStorageService {
    if (!BiometricStorageService.instance) {
      BiometricStorageService.instance = new BiometricStorageService();
    }
    return BiometricStorageService.instance;
  }

  /**
   * Store biometric data securely
   */
  public async storeBiometricData(
    userId: string,
    biometricData: BiometricData
  ): Promise<void> {
    try {
      // Generate unique ID for this biometric record
      const biometricId = await this.generateBiometricId(userId, biometricData.type);
      
      // Encrypt the biometric data
      const encryptedData = await this.encryptData(JSON.stringify(biometricData));
      
      // Create hash for integrity verification
      const hash = await this.createHash(JSON.stringify(biometricData));
      
      // Prepare storage object
      const storedBiometric: StoredBiometric = {
        id: biometricId,
        userId,
        encryptedData,
        hash,
        metadata: {
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          deviceInfo: biometricData.metadata.deviceInfo,
          version: this.CURRENT_VERSION
        }
      };

      // Store in secure storage
      const storageKey = `${this.STORAGE_PREFIX}${userId}_${biometricData.type}`;
      await SecureStore.setItemAsync(storageKey, JSON.stringify(storedBiometric));

      console.log(`Biometric data stored successfully for user ${userId}`);

    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_STORAGE_ERROR', error as Error, {
        context: 'BiometricStorageService.storeBiometricData',
        userId,
        biometricType: biometricData.type
      });
      throw new Error('Failed to store biometric data');
    }
  }

  /**
   * Retrieve biometric data
   */
  public async getBiometricData(
    userId: string,
    biometricType: 'face' | 'fingerprint' | 'voice' = 'face'
  ): Promise<BiometricData | null> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${userId}_${biometricType}`;
      const storedData = await SecureStore.getItemAsync(storageKey);

      if (!storedData) {
        return null;
      }

      const storedBiometric: StoredBiometric = JSON.parse(storedData);
      
      // Decrypt the data
      const decryptedData = await this.decryptData(storedBiometric.encryptedData);
      const biometricData: BiometricData = JSON.parse(decryptedData);
      
      // Verify data integrity
      const currentHash = await this.createHash(decryptedData);
      if (currentHash !== storedBiometric.hash) {
        throw new Error('Biometric data integrity check failed');
      }

      // Update last used timestamp
      storedBiometric.metadata.lastUsed = new Date().toISOString();
      await SecureStore.setItemAsync(storageKey, JSON.stringify(storedBiometric));

      return biometricData;

    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_RETRIEVAL_ERROR', error as Error, {
        context: 'BiometricStorageService.getBiometricData',
        userId,
        biometricType
      });
      return null;
    }
  }

  /**
   * Delete biometric data
   */
  public async deleteBiometricData(
    userId: string,
    biometricType?: 'face' | 'fingerprint' | 'voice'
  ): Promise<void> {
    try {
      if (biometricType) {
        // Delete specific biometric type
        const storageKey = `${this.STORAGE_PREFIX}${userId}_${biometricType}`;
        await SecureStore.deleteItemAsync(storageKey);
      } else {
        // Delete all biometric data for user
        const types: ('face' | 'fingerprint' | 'voice')[] = ['face', 'fingerprint', 'voice'];
        
        for (const type of types) {
          const storageKey = `${this.STORAGE_PREFIX}${userId}_${type}`;
          try {
            await SecureStore.deleteItemAsync(storageKey);
          } catch (error) {
            // Ignore if key doesn't exist
          }
        }
      }

      console.log(`Biometric data deleted for user ${userId}`);

    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_DELETION_ERROR', error as Error, {
        context: 'BiometricStorageService.deleteBiometricData',
        userId,
        biometricType
      });
      throw new Error('Failed to delete biometric data');
    }
  }

  /**
   * Check if biometric data exists
   */
  public async hasBiometricData(
    userId: string,
    biometricType: 'face' | 'fingerprint' | 'voice' = 'face'
  ): Promise<boolean> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${userId}_${biometricType}`;
      const storedData = await SecureStore.getItemAsync(storageKey);
      return storedData !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get biometric metadata without decrypting data
   */
  public async getBiometricMetadata(
    userId: string,
    biometricType: 'face' | 'fingerprint' | 'voice' = 'face'
  ): Promise<StoredBiometric['metadata'] | null> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}${userId}_${biometricType}`;
      const storedData = await SecureStore.getItemAsync(storageKey);

      if (!storedData) {
        return null;
      }

      const storedBiometric: StoredBiometric = JSON.parse(storedData);
      return storedBiometric.metadata;

    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_METADATA_ERROR', error as Error, {
        context: 'BiometricStorageService.getBiometricMetadata',
        userId,
        biometricType
      });
      return null;
    }
  }

  /**
   * Update biometric data (for template updates)
   */
  public async updateBiometricData(
    userId: string,
    biometricData: BiometricData
  ): Promise<void> {
    try {
      // Get existing metadata
      const existingMetadata = await this.getBiometricMetadata(userId, biometricData.type);
      
      if (!existingMetadata) {
        throw new Error('No existing biometric data to update');
      }

      // Update the data while preserving creation timestamp
      const updatedBiometricData = {
        ...biometricData,
        metadata: {
          ...biometricData.metadata,
          createdAt: existingMetadata.createdAt // Preserve original creation time
        }
      };

      await this.storeBiometricData(userId, updatedBiometricData);

    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_UPDATE_ERROR', error as Error, {
        context: 'BiometricStorageService.updateBiometricData',
        userId,
        biometricType: biometricData.type
      });
      throw new Error('Failed to update biometric data');
    }
  }

  /**
   * Generate unique biometric ID
   */
  private async generateBiometricId(userId: string, type: string): Promise<string> {
    const timestamp = Date.now().toString();
    const randomBytes = await Crypto.getRandomBytesAsync(16);
    const randomString = Array.from(randomBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    return `${type}_${userId}_${timestamp}_${randomString}`;
  }

  /**
   * Encrypt data using device-specific encryption
   */
  private async encryptData(data: string): Promise<string> {
    try {
      // In a real implementation, you would use a proper encryption library
      // For now, we'll use base64 encoding as a placeholder
      // In production, use crypto libraries like expo-crypto or react-native-keychain
      
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);
      
      // Simple XOR encryption with a device-specific key (placeholder)
      const key = await this.getOrCreateEncryptionKey();
      const keyBytes = encoder.encode(key);
      
      const encryptedBytes = new Uint8Array(dataBytes.length);
      for (let i = 0; i < dataBytes.length; i++) {
        encryptedBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      
      // Convert to base64
      const base64 = btoa(String.fromCharCode(...encryptedBytes));
      return base64;
      
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  private async decryptData(encryptedData: string): Promise<string> {
    try {
      // Reverse the encryption process
      const key = await this.getOrCreateEncryptionKey();
      const encoder = new TextEncoder();
      const keyBytes = encoder.encode(key);
      
      // Convert from base64
      const encryptedBytes = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // XOR decrypt
      const decryptedBytes = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      
      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
      
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }

  /**
   * Get or create device-specific encryption key
   */
  private async getOrCreateEncryptionKey(): Promise<string> {
    const keyName = `${this.ENCRYPTION_KEY_PREFIX}device`;
    
    let key = await SecureStore.getItemAsync(keyName);
    
    if (!key) {
      // Generate new key
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      key = Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      await SecureStore.setItemAsync(keyName, key);
    }
    
    return key;
  }

  /**
   * Create hash for data integrity
   */
  private async createHash(data: string): Promise<string> {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      return hash;
    } catch (error) {
      throw new Error('Hash creation failed');
    }
  }

  /**
   * Clear all biometric data (for app reset/logout)
   */
  public async clearAllBiometricData(): Promise<void> {
    try {
      // This would require getting all stored keys, which isn't directly possible with SecureStore
      // In a real implementation, you might maintain an index of stored keys
      console.log('Biometric data cleared (implementation depends on key management strategy)');
    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_CLEAR_ALL_ERROR', error as Error, {
        context: 'BiometricStorageService.clearAllBiometricData'
      });
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{
    totalUsers: number;
    totalBiometrics: number;
    storageSize: number;
  }> {
    // Placeholder implementation
    // In a real app, you'd maintain metadata about stored biometrics
    return {
      totalUsers: 0,
      totalBiometrics: 0,
      storageSize: 0
    };
  }

  /**
   * Decrypt biometric data (static method for external use)
   */
  public static async decryptBiometricData(encryptedData: any): Promise<any> {
    const instance = BiometricStorageService.getInstance();
    try {
      const decryptedData = await instance.decryptData(encryptedData.data);
      return JSON.parse(decryptedData);
    } catch (error) {
      ErrorHandlingService.logError('BIOMETRIC_DECRYPTION_ERROR', error as Error, {
        context: 'BiometricStorageService.decryptBiometricData'
      });
      throw new Error('Failed to decrypt biometric data');
    }
  }
}

export default BiometricStorageService;