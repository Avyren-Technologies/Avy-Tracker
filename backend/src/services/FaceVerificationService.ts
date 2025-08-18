import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { QueryResult } from 'pg';

// Types and interfaces
interface FaceProfile {
  id: number;
  user_id: number;
  face_encoding_hash: string;
  encrypted_face_data: string;
  encryption_key_hash: string;
  registration_date: Date;
  last_updated: Date;
  is_active: boolean;
  verification_count: number;
  last_verification_at?: Date;
  quality_score?: number;
}

interface VerificationResult {
  success: boolean;
  confidence: number;
  liveness_detected: boolean;
  liveness_score?: number;
  failure_reason?: string;
  verification_id: number;
  device_fingerprint?: string;
}

interface FaceRegistrationStatus {
  registered: boolean;
  active: boolean;
  registration_date?: Date;
  verification_count: number;
  last_verification?: Date;
  quality_score?: number;
}

interface DeviceFingerprint {
  fingerprint_hash: string;
  device_info: any;
  is_trusted: boolean;
  risk_score: number;
}

interface VerificationAttempt {
  user_id: number;
  shift_id?: number;
  verification_type: 'start' | 'end' | 'registration' | 'update' | 'test';
  face_encoding: string;
  liveness_detected?: boolean;
  liveness_score?: number;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  location_data?: any;
  face_quality_score?: number;
  lighting_conditions?: 'poor' | 'fair' | 'good' | 'excellent';
}

export class FaceVerificationService {
  // Configuration constants
  private static readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
  private static readonly HIGH_CONFIDENCE_THRESHOLD = 0.85;
  private static readonly LIVENESS_THRESHOLD = 0.70;
  private static readonly QUALITY_THRESHOLD = 0.70;
  private static readonly MAX_VERIFICATION_ATTEMPTS = 3;
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private static readonly MAX_REQUESTS_PER_WINDOW = 10;
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits

  /**
   * Register a new face profile for a user
   */
  static async registerFaceProfile(
    userId: number,
    faceEncoding: string,
    deviceInfo?: any,
    qualityScore?: number
  ): Promise<FaceProfile> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already has a face profile
      const existingProfile = await client.query(
        'SELECT id FROM face_verification_profiles WHERE user_id = $1',
        [userId]
      );

      if (existingProfile.rows.length > 0) {
        throw new Error('User already has a face profile registered');
      }

      // Generate encryption key and encrypt face data
      const encryptionKey = crypto.randomBytes(this.KEY_LENGTH);
      const encryptedData = this.encryptFaceData(faceEncoding, encryptionKey);
      const faceHash = this.generateFaceHash(faceEncoding);
      const keyHash = encryptionKey.toString('hex'); // Store the actual key (in production, use secure key management)

      // Insert face profile
      const profileResult = await client.query(`
        INSERT INTO face_verification_profiles (
          user_id, face_encoding_hash, encrypted_face_data, encryption_key_hash,
          quality_score, registration_device_info
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [userId, faceHash, encryptedData, keyHash, qualityScore, JSON.stringify(deviceInfo || {})]);

      // Update user table
      await client.query(`
        UPDATE users 
        SET face_registered = true, 
            face_registration_completed_at = CURRENT_TIMESTAMP,
            biometric_consent_given = true,
            biometric_consent_date = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);

      // Log the registration
      await this.logVerificationAttempt(client, {
        user_id: userId,
        verification_type: 'registration',
        face_encoding: faceEncoding,
        face_quality_score: qualityScore,
        device_fingerprint: deviceInfo ? this.generateDeviceFingerprint(deviceInfo) : undefined
      }, true, 1.0);

      // Create audit log
      await this.createAuditLog(client, userId, 'profile_created', {
        quality_score: qualityScore,
        device_info: deviceInfo
      });

      await client.query('COMMIT');
      return profileResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify a face against stored profile
   */
  static async verifyFace(
    userId: number,
    currentEncoding: string,
    verificationData: Partial<VerificationAttempt>
  ): Promise<VerificationResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check rate limiting
      await this.checkRateLimit(client, userId);

      // Get user's face profile
      const profileResult = await client.query(`
        SELECT * FROM face_verification_profiles 
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

      if (profileResult.rows.length === 0) {
        throw new Error('No active face profile found for user');
      }

      const profile = profileResult.rows[0];

      // Decrypt stored face data
      const encryptionKey = Buffer.from(profile.encryption_key_hash, 'hex');
      const storedEncoding = this.decryptFaceData(
        profile.encrypted_face_data,
        encryptionKey
      );

      // Compare face encodings
      const confidence = this.compareFaceEncodings(storedEncoding, currentEncoding);
      const success = confidence >= this.DEFAULT_CONFIDENCE_THRESHOLD;

      // Validate liveness if provided
      const livenessValid = verificationData.liveness_score 
        ? verificationData.liveness_score >= this.LIVENESS_THRESHOLD
        : false;

      // Determine overall success
      const overallSuccess = success && (verificationData.liveness_detected || false);

      // Generate device fingerprint if device info provided
      const deviceFingerprint = verificationData.device_fingerprint || 
        (verificationData ? this.generateDeviceFingerprint(verificationData) : undefined);

      // Log verification attempt
      const logResult = await this.logVerificationAttempt(
        client,
        {
          ...verificationData,
          user_id: userId,
          face_encoding: currentEncoding,
          device_fingerprint: deviceFingerprint
        },
        overallSuccess,
        confidence,
        verificationData.liveness_score,
        overallSuccess ? undefined : this.getFailureReason(confidence, livenessValid)
      );

      // Update profile statistics
      if (overallSuccess) {
        await client.query(`
          UPDATE face_verification_profiles 
          SET verification_count = verification_count + 1,
              last_verification_at = CURRENT_TIMESTAMP,
              last_updated = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [userId]);

        await client.query(`
          UPDATE users 
          SET last_face_verification = CURRENT_TIMESTAMP,
              face_verification_success_count = face_verification_success_count + 1,
              face_verification_failures = 0
          WHERE id = $1
        `, [userId]);
      } else {
        // Increment failure count
        await client.query(`
          UPDATE users 
          SET face_verification_failures = face_verification_failures + 1
          WHERE id = $1
        `, [userId]);

        // Check if user should be locked
        await this.checkAndApplyUserLock(client, userId);
      }

      // Update device fingerprint
      if (deviceFingerprint) {
        await this.updateDeviceFingerprint(client, userId, deviceFingerprint, verificationData);
      }

      await client.query('COMMIT');

      return {
        success: overallSuccess,
        confidence,
        liveness_detected: verificationData.liveness_detected || false,
        liveness_score: verificationData.liveness_score,
        failure_reason: overallSuccess ? undefined : this.getFailureReason(confidence, livenessValid),
        verification_id: logResult.rows[0].id,
        device_fingerprint: deviceFingerprint
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update existing face profile
   */
  static async updateFaceProfile(
    userId: number,
    newEncoding: string,
    deviceInfo?: any,
    qualityScore?: number
  ): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if profile exists
      const existingProfile = await client.query(
        'SELECT id FROM face_verification_profiles WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      if (existingProfile.rows.length === 0) {
        throw new Error('No active face profile found for user');
      }

      // Generate new encryption key and encrypt face data
      const encryptionKey = crypto.randomBytes(this.KEY_LENGTH);
      const encryptedData = this.encryptFaceData(newEncoding, encryptionKey);
      const faceHash = this.generateFaceHash(newEncoding);
      const keyHash = encryptionKey.toString('hex'); // Store the actual key (in production, use secure key management)

      // Update face profile
      await client.query(`
        UPDATE face_verification_profiles 
        SET face_encoding_hash = $1,
            encrypted_face_data = $2,
            encryption_key_hash = $3,
            quality_score = $4,
            last_updated = CURRENT_TIMESTAMP,
            verification_count = 0
        WHERE user_id = $5
      `, [faceHash, encryptedData, keyHash, qualityScore, userId]);

      // Log the update
      await this.logVerificationAttempt(client, {
        user_id: userId,
        verification_type: 'update',
        face_encoding: newEncoding,
        face_quality_score: qualityScore,
        device_fingerprint: deviceInfo ? this.generateDeviceFingerprint(deviceInfo) : undefined
      }, true, 1.0);

      // Create audit log
      await this.createAuditLog(client, userId, 'profile_updated', {
        quality_score: qualityScore,
        device_info: deviceInfo
      });

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete face profile
   */
  static async deleteFaceProfile(userId: number, performedBy?: number): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if profile exists
      const existingProfile = await client.query(
        'SELECT id FROM face_verification_profiles WHERE user_id = $1',
        [userId]
      );

      if (existingProfile.rows.length === 0) {
        throw new Error('No face profile found for user');
      }

      // Soft delete - deactivate profile
      await client.query(`
        UPDATE face_verification_profiles 
        SET is_active = false, last_updated = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId]);

      // Update user table
      await client.query(`
        UPDATE users 
        SET face_registered = false,
            face_enabled = false,
            face_verification_failures = 0,
            face_locked_until = NULL
        WHERE id = $1
      `, [userId]);

      // Create audit log
      await this.createAuditLog(client, userId, 'profile_deleted', {
        performed_by: performedBy,
        deletion_reason: 'user_request'
      }, performedBy);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get face registration status
   */
  static async getFaceRegistrationStatus(userId: number): Promise<FaceRegistrationStatus> {
    const result = await pool.query(`
      SELECT 
        fvp.is_active as registered,
        fvp.is_active,
        fvp.registration_date,
        fvp.verification_count,
        fvp.last_verification_at,
        fvp.quality_score,
        u.face_registered,
        u.face_enabled
      FROM users u
      LEFT JOIN face_verification_profiles fvp ON u.id = fvp.user_id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];
    return {
      registered: row.registered || false,
      active: row.is_active || false,
      registration_date: row.registration_date,
      verification_count: row.verification_count || 0,
      last_verification: row.last_verification_at,
      quality_score: row.quality_score
    };
  }

  /**
   * Encrypt face data using AES-256-CBC
   */
  private static encryptFaceData(faceData: string, key: Buffer): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(faceData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt face data using AES-256-CBC
   */
  private static decryptFaceData(encryptedData: string, key: Buffer): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt face data');
    }
  }

  /**
   * Compare face encodings using cosine similarity
   */
  private static compareFaceEncodings(stored: string, current: string): number {
    try {
      // Parse face encodings (assuming they're JSON arrays of numbers)
      const storedVector = JSON.parse(stored);
      const currentVector = JSON.parse(current);

      if (!Array.isArray(storedVector) || !Array.isArray(currentVector)) {
        throw new Error('Invalid face encoding format');
      }

      if (storedVector.length !== currentVector.length) {
        throw new Error('Face encoding dimension mismatch');
      }

      // Calculate cosine similarity
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < storedVector.length; i++) {
        dotProduct += storedVector[i] * currentVector[i];
        normA += storedVector[i] * storedVector[i];
        normB += currentVector[i] * currentVector[i];
      }

      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);

      if (normA === 0 || normB === 0) {
        return 0;
      }

      const similarity = dotProduct / (normA * normB);
      
      // Convert similarity to confidence score (0-1)
      return Math.max(0, Math.min(1, (similarity + 1) / 2));

    } catch (error) {
      console.error('Error comparing face encodings:', error);
      return 0;
    }
  }

  /**
   * Generate face hash for quick comparison
   */
  private static generateFaceHash(faceEncoding: string): string {
    return crypto.createHash('sha256').update(faceEncoding).digest('hex');
  }

  /**
   * Generate device fingerprint
   */
  private static generateDeviceFingerprint(deviceInfo: any): string {
    const fingerprintData = {
      userAgent: deviceInfo.userAgent || '',
      platform: deviceInfo.platform || '',
      screenResolution: deviceInfo.screenResolution || '',
      timezone: deviceInfo.timezone || '',
      language: deviceInfo.language || '',
      deviceModel: deviceInfo.deviceModel || ''
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Log verification attempt
   */
  private static async logVerificationAttempt(
    client: any,
    attempt: Partial<VerificationAttempt>,
    success: boolean,
    confidence: number,
    livenessScore?: number,
    failureReason?: string
  ): Promise<QueryResult> {
    return await client.query(`
      INSERT INTO face_verification_logs (
        user_id, shift_id, verification_type, success, confidence_score,
        liveness_detected, liveness_score, failure_reason, device_fingerprint,
        ip_address, user_agent, location_data, face_quality_score, lighting_conditions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      attempt.user_id,
      attempt.shift_id,
      attempt.verification_type,
      success,
      confidence,
      attempt.liveness_detected || false,
      livenessScore,
      failureReason,
      attempt.device_fingerprint,
      attempt.ip_address,
      attempt.user_agent,
      attempt.location_data ? JSON.stringify(attempt.location_data) : null,
      attempt.face_quality_score,
      attempt.lighting_conditions
    ]);
  }

  /**
   * Create audit log entry
   */
  private static async createAuditLog(
    client: any,
    userId: number,
    actionType: string,
    actionDetails: any,
    performedBy?: number
  ): Promise<void> {
    await client.query(`
      INSERT INTO biometric_audit_logs (
        user_id, action_type, action_details, performed_by
      ) VALUES ($1, $2, $3, $4)
    `, [userId, actionType, JSON.stringify(actionDetails), performedBy]);
  }

  /**
   * Check rate limiting
   */
  private static async checkRateLimit(client: any, userId: number): Promise<void> {
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW);
    
    const result = await client.query(`
      SELECT COUNT(*) as attempt_count
      FROM face_verification_logs
      WHERE user_id = $1 AND created_at > $2
    `, [userId, windowStart]);

    const attemptCount = parseInt(result.rows[0].attempt_count);
    
    if (attemptCount >= this.MAX_REQUESTS_PER_WINDOW) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
  }

  /**
   * Check and apply user lock if too many failures
   */
  private static async checkAndApplyUserLock(client: any, userId: number): Promise<void> {
    const result = await client.query(
      'SELECT face_verification_failures FROM users WHERE id = $1',
      [userId]
    );

    const failures = result.rows[0]?.face_verification_failures || 0;
    
    if (failures >= this.MAX_VERIFICATION_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await client.query(`
        UPDATE users 
        SET face_locked_until = $1
        WHERE id = $2
      `, [lockUntil, userId]);

      // Create audit log
      await this.createAuditLog(client, userId, 'security_breach_detected', {
        reason: 'too_many_failed_attempts',
        failure_count: failures,
        locked_until: lockUntil
      });
    }
  }

  /**
   * Update device fingerprint
   */
  private static async updateDeviceFingerprint(
    client: any,
    userId: number,
    fingerprint: string,
    deviceInfo?: any
  ): Promise<void> {
    await client.query(`
      INSERT INTO device_fingerprints (
        user_id, fingerprint_hash, device_info, last_seen
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, fingerprint_hash) 
      DO UPDATE SET 
        last_seen = CURRENT_TIMESTAMP,
        device_info = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, fingerprint, JSON.stringify(deviceInfo || {})]);
  }

  /**
   * Get failure reason based on verification results
   */
  private static getFailureReason(confidence: number, livenessValid: boolean): string {
    if (confidence < this.DEFAULT_CONFIDENCE_THRESHOLD) {
      if (confidence < 0.5) {
        return 'Face does not match registered profile';
      } else {
        return 'Face match confidence too low';
      }
    }
    
    if (!livenessValid) {
      return 'Liveness detection failed - please ensure you are looking at the camera';
    }
    
    return 'Verification failed';
  }

  /**
   * Get verification statistics for a user
   */
  static async getVerificationStatistics(userId: number, days: number = 30): Promise<any> {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_attempts,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_attempts,
        AVG(confidence_score) as avg_confidence,
        AVG(CASE WHEN success = true THEN confidence_score END) as avg_success_confidence,
        COUNT(CASE WHEN liveness_detected = true THEN 1 END) as liveness_detected_count
      FROM face_verification_logs
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2
    `, [userId, days]);

    return result.rows[0];
  }

  /**
   * Clean up old verification logs (for data retention compliance)
   */
  static async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const result = await pool.query(`
      DELETE FROM face_verification_logs
      WHERE created_at < NOW() - INTERVAL '1 day' * $1
    `, [retentionDays]);

    return result.rowCount || 0;
  }

  /**
   * Check if user is currently locked due to failed attempts
   */
  static async isUserLocked(userId: number): Promise<boolean> {
    const result = await pool.query(`
      SELECT face_locked_until FROM users 
      WHERE id = $1 AND face_locked_until > CURRENT_TIMESTAMP
    `, [userId]);

    return result.rows.length > 0;
  }

  /**
   * Unlock user (admin function)
   */
  static async unlockUser(userId: number, performedBy: number): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE users 
        SET face_locked_until = NULL, face_verification_failures = 0
        WHERE id = $1
      `, [userId]);

      // Create audit log
      await this.createAuditLog(client, userId, 'profile_accessed', {
        action: 'user_unlocked',
        performed_by: performedBy
      }, performedBy);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get device risk assessment
   */
  static async getDeviceRiskAssessment(userId: number, deviceFingerprint: string): Promise<{
    riskScore: number;
    isTrusted: boolean;
    isBlocked: boolean;
    firstSeen?: Date;
    lastSeen?: Date;
  }> {
    const result = await pool.query(`
      SELECT risk_score, is_trusted, blocked, first_seen, last_seen
      FROM device_fingerprints
      WHERE user_id = $1 AND fingerprint_hash = $2
    `, [userId, deviceFingerprint]);

    if (result.rows.length === 0) {
      return {
        riskScore: 50, // Medium risk for new devices
        isTrusted: false,
        isBlocked: false
      };
    }

    const row = result.rows[0];
    return {
      riskScore: row.risk_score,
      isTrusted: row.is_trusted,
      isBlocked: row.blocked,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen
    };
  }

  /**
   * Update device trust level (admin function)
   */
  static async updateDeviceTrust(
    userId: number, 
    deviceFingerprint: string, 
    trusted: boolean,
    performedBy: number
  ): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE device_fingerprints 
        SET is_trusted = $1, risk_score = $2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3 AND fingerprint_hash = $4
      `, [trusted, trusted ? 10 : 80, userId, deviceFingerprint]);

      // Create audit log
      await this.createAuditLog(client, userId, 'profile_accessed', {
        action: 'device_trust_updated',
        device_fingerprint: deviceFingerprint,
        trusted,
        performed_by: performedBy
      }, performedBy);

      await client.query('COMMIT');
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get comprehensive security report for a user
   */
  static async getSecurityReport(userId: number, days: number = 30): Promise<any> {
    const client = await pool.connect();
    
    try {
      // Get verification statistics
      const verificationStats = await this.getVerificationStatistics(userId, days);
      
      // Get device information
      const deviceResult = await client.query(`
        SELECT 
          fingerprint_hash,
          device_info,
          is_trusted,
          risk_score,
          first_seen,
          last_seen
        FROM device_fingerprints
        WHERE user_id = $1
        ORDER BY last_seen DESC
      `, [userId]);

      // Get recent security events
      const securityEvents = await client.query(`
        SELECT 
          action_type,
          action_details,
          created_at
        FROM biometric_audit_logs
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '$2 days'
        ORDER BY created_at DESC
        LIMIT 20
      `, [userId, days]);

      // Get user status
      const userStatus = await client.query(`
        SELECT 
          face_registered,
          face_enabled,
          face_verification_failures,
          face_locked_until,
          last_face_verification
        FROM users
        WHERE id = $1
      `, [userId]);

      return {
        verificationStats,
        devices: deviceResult.rows,
        securityEvents: securityEvents.rows,
        userStatus: userStatus.rows[0],
        reportGeneratedAt: new Date()
      };

    } finally {
      client.release();
    }
  }
}

export default FaceVerificationService;