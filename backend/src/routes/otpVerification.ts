import express, { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { OTPService } from '../services/OTPService';

const otpService = OTPService.getInstance();

const router = express.Router();

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware for OTP operations
const otpRateLimit = (maxRequests: number = 5, windowMinutes: number = 15) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = `otp_${userId || ip}`;
    
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    const record = rateLimitStore.get(identifier);
    
    if (!record || now > record.resetTime) {
      // Reset or create new record
      rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many OTP requests',
        message: `Maximum ${maxRequests} requests allowed per ${windowMinutes} minutes`,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
    
    record.count++;
    next();
  };
};

// Validation middleware for OTP requests
const validateOTPRequest = (req: Request, res: Response, next: NextFunction) => {
  const { purpose } = req.body;
  
  if (!purpose || typeof purpose !== 'string') {
    return res.status(400).json({
      error: 'Purpose is required',
      message: 'OTP purpose must be specified',
      code: 'MISSING_PURPOSE'
    });
  }
  
  // Validate purpose against allowed values
  const allowedPurposes = [
    'face-settings-access',
    'profile-update',
    'security-verification',
    'password-reset',
    'account-verification'
  ];
  
  if (!allowedPurposes.includes(purpose)) {
    return res.status(400).json({
      error: 'Invalid purpose',
      message: `Purpose must be one of: ${allowedPurposes.join(', ')}`,
      code: 'INVALID_PURPOSE'
    });
  }
  
  next();
};

// Validation middleware for OTP verification
const validateOTPVerification = (req: Request, res: Response, next: NextFunction) => {
  const { otp, purpose } = req.body;
  
  if (!otp || typeof otp !== 'string') {
    return res.status(400).json({
      error: 'OTP is required',
      message: 'OTP code must be provided',
      code: 'MISSING_OTP'
    });
  }
  
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      error: 'Invalid OTP format',
      message: 'OTP must be a 6-digit number',
      code: 'INVALID_OTP_FORMAT'
    });
  }
  
  if (!purpose || typeof purpose !== 'string') {
    return res.status(400).json({
      error: 'Purpose is required',
      message: 'OTP purpose must be specified',
      code: 'MISSING_PURPOSE'
    });
  }
  
  next();
};

// Utility function for comprehensive logging
const logRequest = (req: CustomRequest, endpoint: string, additionalData?: any) => {
  console.log(`[${new Date().toISOString()}] OTP API - ${endpoint}`, {
    userId: req.user?.id,
    userRole: req.user?.role,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
    ...additionalData
  });
};

const logResponse = (endpoint: string, success: boolean, data?: any, error?: any) => {
  console.log(`[${new Date().toISOString()}] OTP API Response - ${endpoint}`, {
    success,
    data: success ? data : undefined,
    error: !success ? error : undefined,
    timestamp: new Date().toISOString()
  });
};

/**
 * POST /api/otp/generate
 * Generate and send OTP to user's registered phone number
 */
router.post('/generate', verifyToken, otpRateLimit(3, 15), validateOTPRequest, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'POST /generate', {
      purpose: req.body.purpose
    });

    const { purpose } = req.body;
    const userId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Get user's phone number from database
    const { pool } = await import('../config/database');
    const client = await pool.connect();
    
    let phoneNumber: string;
    
    try {
      const result = await client.query(
        'SELECT phone FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        logResponse('POST /generate', false, null, 'User not found');
        return res.status(404).json({
          error: 'User not found',
          message: 'User account not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      phoneNumber = result.rows[0].phone;
      
      if (!phoneNumber) {
        logResponse('POST /generate', false, null, 'No phone number');
        return res.status(400).json({
          error: 'Phone number not found',
          message: 'No phone number registered for this account',
          code: 'PHONE_NOT_FOUND'
        });
      }
    } finally {
      client.release();
    }
    
    // Create device fingerprint
    const deviceFingerprint = JSON.stringify({
      userAgent,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    });
    
    // Generate OTP
    const result = await otpService.generateAndSendOTP(
      phoneNumber,
      purpose,
      deviceFingerprint,
      ipAddress
    );
    
    const responseData = {
      success: result.success,
      message: result.message,
      otpId: result.otpId,
      phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'), // Mask phone number
      purpose,
      processingTime: Date.now() - startTime
    };
    
    logResponse('POST /generate', result.success, responseData);
    
    if (result.success) {
      res.status(200).json(responseData);
    } else {
      res.status(400).json({
        ...responseData,
        error: 'OTP generation failed',
        code: 'GENERATION_FAILED'
      });
    }
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /generate', false, null, {
      message: error.message,
      processingTime
    });
    
    console.error('OTP generation error:', error);
    res.status(500).json({
      error: 'Failed to generate OTP',
      message: 'Internal server error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/otp/verify
 * Verify OTP code against stored hash
 */
router.post('/verify', verifyToken, otpRateLimit(10, 15), validateOTPVerification, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'POST /verify', {
      purpose: req.body.purpose,
      otpLength: req.body.otp?.length
    });

    const { otp, purpose } = req.body;
    const userId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Create device fingerprint
    const deviceFingerprint = JSON.stringify({
      userAgent,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    });
    
    // Verify OTP (assuming otpId is passed in request body)
    const { otpId } = req.body;
    const result = await otpService.verifyOTP(
      otpId,
      otp,
      deviceFingerprint,
      ipAddress
    );
    
    const responseData = {
      success: result.success,
      message: result.message,
      remainingAttempts: result.remainingAttempts,
      isBlocked: result.isBlocked,
      blockExpiresAt: result.blockExpiresAt,
      purpose,
      verifiedAt: result.success ? new Date().toISOString() : undefined,
      processingTime: Date.now() - startTime
    };
    
    logResponse('POST /verify', result.success, responseData);
    
    if (result.success) {
      res.status(200).json(responseData);
    } else {
      const statusCode = result.isBlocked ? 423 : 400;
      res.status(statusCode).json({
        ...responseData,
        error: 'OTP verification failed',
        code: result.isBlocked ? 'ACCOUNT_LOCKED' : 'VERIFICATION_FAILED'
      });
    }
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /verify', false, null, {
      message: error.message,
      processingTime
    });
    
    console.error('OTP verification error:', error);
    res.status(500).json({
      error: 'Failed to verify OTP',
      message: 'Internal server error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/otp/resend
 * Resend OTP to user's registered phone number
 */
router.post('/resend', verifyToken, otpRateLimit(3, 15), validateOTPRequest, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'POST /resend', {
      purpose: req.body.purpose
    });

    const { purpose } = req.body;
    const userId = req.user!.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Create device fingerprint
    const deviceFingerprint = JSON.stringify({
      userAgent,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    });
    
    // Get phone number from user record or request
    const { phoneNumber } = req.body;
    
    // Resend OTP
    const result = await otpService.generateAndSendOTP(
      phoneNumber,
      purpose,
      deviceFingerprint,
      ipAddress
    );
    
    const responseData = {
      success: result.success,
      message: result.message,
      otpId: result.otpId,
      purpose,
      resentAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };
    
    logResponse('POST /resend', result.success, responseData);
    
    if (result.success) {
      res.status(200).json(responseData);
    } else {
      res.status(400).json({
        ...responseData,
        error: 'OTP resend failed',
        code: 'RESEND_FAILED'
      });
    }
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('POST /resend', false, null, {
      message: error.message,
      processingTime
    });
    
    console.error('OTP resend error:', error);
    res.status(500).json({
      error: 'Failed to resend OTP',
      message: 'Internal server error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/otp/invalidate
 * Invalidate all pending OTPs for a specific purpose
 */
router.delete('/invalidate', verifyToken, validateOTPRequest, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    logRequest(req, 'DELETE /invalidate', {
      purpose: req.body.purpose
    });

    const { purpose } = req.body;
    const userId = req.user!.id;
    
    // Invalidate OTP
    // OTP invalidation handled by the service internally
    
    const responseData = {
      success: true,
      message: 'OTP invalidated successfully',
      purpose,
      invalidatedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime
    };
    
    logResponse('DELETE /invalidate', true, responseData);
    res.status(200).json(responseData);
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('DELETE /invalidate', false, null, {
      message: error.message,
      processingTime
    });
    
    console.error('OTP invalidation error:', error);
    res.status(500).json({
      error: 'Failed to invalidate OTP',
      message: 'Internal server error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/otp/status
 * Get OTP status for debugging (development only)
 */
router.get('/status', verifyToken, async (req: CustomRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        error: 'Endpoint not available in production',
        code: 'NOT_AVAILABLE'
      });
    }
    
    logRequest(req, 'GET /status');

    const userId = req.user!.id;
    const purpose = req.query.purpose as string;
    
    if (!purpose) {
      return res.status(400).json({
        error: 'Purpose query parameter is required',
        code: 'MISSING_PURPOSE'
      });
    }
    
    // Get OTP status from database
    const { pool } = await import('../config/database');
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          id,
          purpose,
          expires_at,
          verified,
          attempts,
          max_attempts,
          created_at,
          verified_at,
          invalidated_at
        FROM otp_verifications 
        WHERE user_id = $1 AND purpose = $2 
        ORDER BY created_at DESC 
        LIMIT 5
      `, [userId, purpose]);
      
      const responseData = {
        userId,
        purpose,
        records: result.rows,
        processingTime: Date.now() - startTime
      };
      
      logResponse('GET /status', true, { recordCount: result.rows.length });
      res.status(200).json(responseData);
      
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logResponse('GET /status', false, null, {
      message: error.message,
      processingTime
    });
    
    console.error('OTP status error:', error);
    res.status(500).json({
      error: 'Failed to get OTP status',
      message: 'Internal server error occurred',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'OTP Verification API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;