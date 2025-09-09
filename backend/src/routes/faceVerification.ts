import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { FaceVerificationService } from '../services/FaceVerificationService';

const router = express.Router();

// Request/Response interfaces
interface RegisterFaceRequest extends Request {
  body: {
    faceEncoding: string;
    deviceInfo?: {
      userAgent?: string;
      platform?: string;
      screenResolution?: string;
      timezone?: string;
      language?: string;
      deviceModel?: string;
    };
    qualityScore?: number;
    consentGiven: boolean;
  };
}

interface VerifyFaceRequest extends Request {
  body: {
    faceEncoding: string;
    livenessDetected?: boolean;
    livenessScore?: number;
    shiftId?: number;
    verificationType: 'start' | 'end' | 'test';
    deviceInfo?: any;
    locationData?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
    qualityScore?: number;
    lightingConditions?: 'poor' | 'fair' | 'good' | 'excellent';
  };
}

interface UpdateFaceRequest extends Request {
  body: {
    faceEncoding: string;
    deviceInfo?: any;
    qualityScore?: number;
    updateReason?: string;
  };
}

// Utility function for comprehensive logging
const logRequest = (req: CustomRequest, endpoint: string, additionalData?: any) => {
  console.log(`[${new Date().toISOString()}] Face Verification API - ${endpoint}`, {
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    ...additionalData
  });
};

const logResponse = (endpoint: string, success: boolean, data?: any, error?: any) => {
  console.log(`[${new Date().toISOString()}] Face Verification API Response - ${endpoint}`, {
    success,
    data: success ? data : undefined,
    error: !success ? error : undefined,
    timestamp: new Date().toISOString()
  });
};

// Validation middleware - Enhanced to handle both base64 and JSON formats
const validateFaceEncoding = (req: Request, res: Response, next: any) => {
  const { faceEncoding } = req.body;
  
  if (!faceEncoding || typeof faceEncoding !== 'string') {
    return res.status(400).json({
      error: 'Face encoding is required and must be a string',
      code: 'INVALID_FACE_ENCODING'
    });
  }

  try {
    // Try to validate as base64 first (new enhanced ML Kit format)
    try {
      const decoded = atob(faceEncoding);
      // Check if it's a valid Float32Array (should be divisible by 4)
      if (decoded.length % 4 === 0) {
        // Valid base64 Float32Array format
        next();
        return;
      }
    } catch (base64Error) {
      // Not base64, try JSON parsing (legacy format)
    }

    // Fallback to JSON validation (legacy format)
    const parsed = JSON.parse(faceEncoding);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return res.status(400).json({
        error: 'Face encoding must be a valid JSON array or base64 string',
        code: 'INVALID_FACE_ENCODING_FORMAT'
      });
    }
    
    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Face encoding must be valid base64 or JSON format',
      code: 'INVALID_FACE_ENCODING_FORMAT'
    });
  }
};

/**
 * POST /api/face-verification/register
 * Register a new face profile for the authenticated user
 */
router.post('/register', verifyToken, validateFaceEncoding, async (req: CustomRequest & RegisterFaceRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'POST /register', {
      hasDeviceInfo: !!req.body.deviceInfo,
      qualityScore: req.body.qualityScore,
      consentGiven: req.body.consentGiven
    });

    const { faceEncoding, deviceInfo, qualityScore, consentGiven } = req.body;
    const userId = req.user!.id;

    // Validate consent
    if (!consentGiven) {
      logResponse('POST /register', false, null, 'Consent not given');
      return res.status(400).json({
        error: 'Biometric consent is required for face registration',
        code: 'CONSENT_REQUIRED'
      });
    }

    // Validate quality score if provided
    if (qualityScore !== undefined && (qualityScore < 0 || qualityScore > 1)) {
      logResponse('POST /register', false, null, 'Invalid quality score');
      return res.status(400).json({
        error: 'Quality score must be between 0 and 1',
        code: 'INVALID_QUALITY_SCORE'
      });
    }

    // Check if user is locked
    const isLocked = await FaceVerificationService.isUserLocked(userId);
    if (isLocked) {
      logResponse('POST /register', false, null, 'User locked');
      return res.status(423).json({
        error: 'Account temporarily locked due to security concerns',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Register face profile
    const profile = await FaceVerificationService.registerFaceProfile(
      userId,
      faceEncoding,
      deviceInfo,
      qualityScore
    );

    const responseData = {
      success: true,
      message: 'Face profile registered successfully',
      profileId: profile.id,
      registrationDate: profile.registration_date,
      qualityScore: profile.quality_score,
      processingTime: Date.now() - startTime
    };

    logResponse('POST /register', true, responseData);
    res.status(201).json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /register', false, null, {
      message: error.message,
      processingTime
    });

    if (error.message.includes('already has a face profile')) {
      return res.status(409).json({
        error: 'Face profile already exists for this user',
        code: 'PROFILE_EXISTS'
      });
    }

    console.error('Face registration error:', error);
    res.status(500).json({
      error: 'Failed to register face profile',
      code: 'REGISTRATION_FAILED'
    });
  }
});

/**
 * POST /api/face-verification/verify
 * Verify face against stored profile
 */
router.post('/verify', verifyToken, validateFaceEncoding, async (req: CustomRequest & VerifyFaceRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'POST /verify', {
      verificationType: req.body.verificationType,
      hasLivenessData: !!req.body.livenessDetected,
      livenessScore: req.body.livenessScore,
      shiftId: req.body.shiftId,
      qualityScore: req.body.qualityScore,
      lightingConditions: req.body.lightingConditions
    });

    const {
      faceEncoding,
      livenessDetected,
      livenessScore,
      shiftId,
      verificationType,
      deviceInfo,
      locationData,
      qualityScore,
      lightingConditions
    } = req.body;
    
    const userId = req.user!.id;

    // Validate verification type
    if (!['start', 'end', 'test'].includes(verificationType)) {
      logResponse('POST /verify', false, null, 'Invalid verification type');
      return res.status(400).json({
        error: 'Verification type must be start, end, or test',
        code: 'INVALID_VERIFICATION_TYPE'
      });
    }

    // Validate liveness score if provided
    if (livenessScore !== undefined && (livenessScore < 0 || livenessScore > 1)) {
      logResponse('POST /verify', false, null, 'Invalid liveness score');
      return res.status(400).json({
        error: 'Liveness score must be between 0 and 1',
        code: 'INVALID_LIVENESS_SCORE'
      });
    }

    // Check if user is locked
    const isLocked = await FaceVerificationService.isUserLocked(userId);
    if (isLocked) {
      logResponse('POST /verify', false, null, 'User locked');
      return res.status(423).json({
        error: 'Account temporarily locked due to failed verification attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Prepare verification data
    const verificationData = {
      shift_id: shiftId,
      verification_type: verificationType as 'start' | 'end' | 'test',
      liveness_detected: livenessDetected,
      liveness_score: livenessScore,
      device_fingerprint: deviceInfo ? JSON.stringify(deviceInfo) : undefined,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      location_data: locationData,
      face_quality_score: qualityScore,
      lighting_conditions: lightingConditions
    };

    // Perform verification
    const result = await FaceVerificationService.verifyFace(
      userId,
      faceEncoding,
      verificationData
    );

    const responseData = {
      success: result.success,
      confidence: result.confidence,
      livenessDetected: result.liveness_detected,
      livenessScore: result.liveness_score,
      verificationId: result.verification_id,
      failureReason: result.failure_reason,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    logResponse('POST /verify', result.success, responseData);
    
    if (result.success) {
      res.json(responseData);
    } else {
      res.status(401).json({
        ...responseData,
        error: 'Face verification failed',
        code: 'VERIFICATION_FAILED'
      });
    }

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /verify', false, null, {
      message: error.message,
      processingTime
    });

    if (error.message.includes('No active face profile')) {
      return res.status(404).json({
        error: 'No face profile found. Please register your face first.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    console.error('Face verification error:', error);
    res.status(500).json({
      error: 'Failed to verify face',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * GET /api/face-verification/status
 * Get face registration status for the authenticated user
 */
router.get('/status', verifyToken, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'GET /status');

    const userId = req.user!.id;

    // Get registration status
    const status = await FaceVerificationService.getFaceRegistrationStatus(userId);

    // Get verification statistics
    const stats = await FaceVerificationService.getVerificationStatistics(userId, 30);

    // Check if user is currently locked
    const isLocked = await FaceVerificationService.isUserLocked(userId);

    const responseData = {
      registered: status.registered,
      active: status.active,
      registrationDate: status.registration_date,
      verificationCount: status.verification_count,
      lastVerification: status.last_verification,
      qualityScore: status.quality_score,
      isLocked,
      // Add these fields for frontend compatibility
      face_registered: status.face_registered,
      face_enabled: status.face_enabled,
      statistics: {
        totalAttempts: parseInt(stats.total_attempts) || 0,
        successfulAttempts: parseInt(stats.successful_attempts) || 0,
        failedAttempts: parseInt(stats.failed_attempts) || 0,
        averageConfidence: parseFloat(stats.avg_confidence) || 0,
        averageSuccessConfidence: parseFloat(stats.avg_success_confidence) || 0,
        livenessDetectedCount: parseInt(stats.liveness_detected_count) || 0
      },
      processingTime: Date.now() - startTime
    };

    logResponse('GET /status', true, responseData);
    res.json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('GET /status', false, null, {
      message: error.message,
      processingTime
    });

    if (error.message.includes('User not found')) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if it's a database table missing error
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('Face verification tables not found. Please run the migration first.');
      return res.status(503).json({
        error: 'Face verification system is not properly configured. Please contact administrator.',
        code: 'SYSTEM_NOT_READY',
        details: 'Database tables are missing. Migration required.'
      });
    }

    // Check if it's a parameter binding error
    if (error.message.includes('bind message supplies') || error.message.includes('prepared statement')) {
      console.error('Database parameter binding error:', error.message);
      return res.status(500).json({
        error: 'Database configuration error. Please contact administrator.',
        code: 'DATABASE_ERROR',
        details: 'Parameter binding mismatch detected.'
      });
    }

    console.error('Face status error:', error);
    res.status(500).json({
      error: 'Failed to get face verification status',
      code: 'STATUS_ERROR'
    });
  }
});

/**
 * DELETE /api/face-verification/profile
 * Delete face profile for the authenticated user
 */
router.delete('/profile', verifyToken, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'DELETE /profile');

    const userId = req.user!.id;

    // Delete face profile
    const success = await FaceVerificationService.deleteFaceProfile(userId, userId);

    const responseData = {
      success,
      message: 'Face profile deleted successfully',
      deletedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };

    logResponse('DELETE /profile', success, responseData);
    res.json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('DELETE /profile', false, null, {
      message: error.message,
      processingTime
    });

    if (error.message.includes('No face profile found')) {
      return res.status(404).json({
        error: 'No face profile found for this user',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    console.error('Face profile deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete face profile',
      code: 'DELETION_FAILED'
    });
  }
});

/**
 * PUT /api/face-verification/update
 * Update existing face profile
 */
router.put('/update', verifyToken, validateFaceEncoding, async (req: CustomRequest & UpdateFaceRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'PUT /update', {
      hasDeviceInfo: !!req.body.deviceInfo,
      qualityScore: req.body.qualityScore,
      updateReason: req.body.updateReason
    });

    const { faceEncoding, deviceInfo, qualityScore, updateReason } = req.body;
    const userId = req.user!.id;

    // Validate quality score if provided
    if (qualityScore !== undefined && (qualityScore < 0 || qualityScore > 1)) {
      logResponse('PUT /update', false, null, 'Invalid quality score');
      return res.status(400).json({
        error: 'Quality score must be between 0 and 1',
        code: 'INVALID_QUALITY_SCORE'
      });
    }

    // Check if user is locked
    const isLocked = await FaceVerificationService.isUserLocked(userId);
    if (isLocked) {
      logResponse('PUT /update', false, null, 'User locked');
      return res.status(423).json({
        error: 'Account temporarily locked due to security concerns',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Update face profile
    const success = await FaceVerificationService.updateFaceProfile(
      userId,
      faceEncoding,
      deviceInfo,
      qualityScore
    );

    const responseData = {
      success,
      message: 'Face profile updated successfully',
      updatedAt: new Date().toISOString(),
      qualityScore,
      updateReason,
      processingTime: Date.now() - startTime
    };

    logResponse('PUT /update', success, responseData);
    res.json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('PUT /update', false, null, {
      message: error.message,
      processingTime
    });

    if (error.message.includes('No active face profile found')) {
      return res.status(404).json({
        error: 'No active face profile found. Please register first.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    console.error('Face profile update error:', error);
    res.status(500).json({
      error: 'Failed to update face profile',
      code: 'UPDATE_FAILED'
    });
  }
});

// Additional utility endpoints

/**
 * GET /api/face-verification/security-report
 * Get comprehensive security report (for debugging/admin purposes)
 */
router.get('/security-report', verifyToken, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'GET /security-report');

    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 30;

    // Validate days parameter
    if (days < 1 || days > 365) {
      return res.status(400).json({
        error: 'Days parameter must be between 1 and 365',
        code: 'INVALID_DAYS_PARAMETER'
      });
    }

    // Get security report
    const report = await FaceVerificationService.getSecurityReport(userId, days);

    const responseData = {
      ...report,
      processingTime: Date.now() - startTime
    };

    logResponse('GET /security-report', true, { reportGenerated: true });
    res.json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('GET /security-report', false, null, {
      message: error.message,
      processingTime
    });

    console.error('Security report error:', error);
    res.status(500).json({
      error: 'Failed to generate security report',
      code: 'REPORT_ERROR'
    });
  }
});

/**
 * POST /api/face-verification/unlock
 * Unlock user account (admin function - requires management or super-admin role)
 */
router.post('/unlock/:userId', verifyToken, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const targetUserId = parseInt(req.params.userId);
    const performedBy = req.user!.id;
    const performerRole = req.user!.role;

    logRequest(req, 'POST /unlock', {
      targetUserId,
      performedBy,
      performerRole
    });

    // Check permissions
    if (!['management', 'super-admin'].includes(performerRole)) {
      logResponse('POST /unlock', false, null, 'Insufficient permissions');
      return res.status(403).json({
        error: 'Insufficient permissions. Management or Super Admin role required.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate target user ID
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        error: 'Invalid user ID',
        code: 'INVALID_USER_ID'
      });
    }

    // For management role, ensure they can only unlock users in their company
    if (performerRole === 'management') {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT company_id FROM users WHERE id = $1',
          [targetUserId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Target user not found',
            code: 'USER_NOT_FOUND'
          });
        }

        if (result.rows[0].company_id !== req.user!.company_id) {
          return res.status(403).json({
            error: 'Cannot unlock users from different companies',
            code: 'CROSS_COMPANY_ACCESS_DENIED'
          });
        }
      } finally {
        client.release();
      }
    }

    // Unlock user
    const success = await FaceVerificationService.unlockUser(targetUserId, performedBy);

    const responseData = {
      success,
      message: 'User unlocked successfully',
      targetUserId,
      performedBy,
      unlockedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };

    logResponse('POST /unlock', success, responseData);
    res.json(responseData);

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /unlock', false, null, {
      message: error.message,
      processingTime
    });

    console.error('User unlock error:', error);
    res.status(500).json({
      error: 'Failed to unlock user',
      code: 'UNLOCK_FAILED'
    });
  }
});

// POST /api/face-verification/audit-log - Store verification audit log
router.post('/audit-log', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const {
      sessionId,
      userId,
      shiftAction,
      status,
      confidenceScore,
      auditLog,
      steps,
      totalLatency,
      fallbackMode,
      overrideReason
    } = req.body;

    // Validate required fields
    if (!sessionId || !userId || !shiftAction || !status) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, userId, shiftAction, status'
      });
    }

    // Ensure the requesting user matches the userId in the audit log
    if (req.user?.id !== userId) {
      return res.status(403).json({
        error: 'Access denied: Cannot submit audit log for another user'
      });
    }

    await client.query('BEGIN');

    // Insert main verification audit record
    const auditResult = await client.query(`
      INSERT INTO verification_audit_logs (
        session_id, user_id, shift_action, status, confidence_score,
        total_latency, fallback_mode, override_reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      sessionId,
      userId,
      shiftAction,
      status,
      confidenceScore || 0,
      totalLatency,
      fallbackMode || false,
      overrideReason
    ]);

    const auditId = auditResult.rows[0].id;

    // Insert verification steps
    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        await client.query(`
          INSERT INTO verification_audit_steps (
            audit_log_id, step_type, completed, retry_count, 
            latency, error_message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          auditId,
          step.type,
          step.completed || false,
          step.retryCount || 0,
          step.latency,
          step.error
        ]);
      }
    }

    // Insert detailed audit events
    if (auditLog && Array.isArray(auditLog)) {
      for (const event of auditLog) {
        await client.query(`
          INSERT INTO verification_audit_events (
            audit_log_id, timestamp, event_type, step_type,
            success, error_message, latency, details, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          auditId,
          new Date(event.timestamp),
          event.event,
          event.stepType,
          event.success,
          event.error,
          event.latency,
          JSON.stringify(event.details || {})
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Verification audit log stored successfully',
      auditId,
      sessionId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error storing verification audit log:', error);
    res.status(500).json({
      error: 'Failed to store verification audit log',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// POST /api/face-verification/sync-offline - Sync offline verification data
router.post('/sync-offline', verifyToken, async (req: CustomRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const {
      id,
      timestamp,
      shiftAction,
      faceVerification,
      locationVerification,
      userId
    } = req.body;

    // Validate required fields
    if (!id || !timestamp || !shiftAction || !userId) {
      return res.status(400).json({
        error: 'Missing required fields for offline sync'
      });
    }

    // Ensure the requesting user matches the userId in the data
    if (req.user?.id !== userId) {
      return res.status(403).json({
        error: 'Access denied: Cannot sync data for another user'
      });
    }

    await client.query('BEGIN');

    // Store offline verification data
    await client.query(`
      INSERT INTO offline_verification_sync (
        offline_id, user_id, shift_action, timestamp,
        face_verification_data, location_verification_data,
        synced_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (offline_id) DO UPDATE SET
        synced_at = NOW(),
        sync_attempts = offline_verification_sync.sync_attempts + 1
    `, [
      id,
      userId,
      shiftAction,
      new Date(timestamp),
      JSON.stringify(faceVerification || {}),
      JSON.stringify(locationVerification || {})
    ]);

    await client.query('COMMIT');

    res.json({
      message: 'Offline verification data synced successfully',
      offlineId: id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error syncing offline verification data:', error);
    res.status(500).json({
      error: 'Failed to sync offline verification data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

export default router;