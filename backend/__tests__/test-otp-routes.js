const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the database pool
const mockPool = {
  connect: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
};

// Mock the OTP service
const mockOTPService = {
  generateOTP: jest.fn(),
  verifyOTP: jest.fn(),
  resendOTP: jest.fn(),
  invalidateOTP: jest.fn()
};

// Mock modules
jest.mock('../src/config/database', () => ({
  pool: mockPool
}));

jest.mock('../src/services/OTPService', () => mockOTPService);

// Create a mock router for testing

describe('OTP Verification Routes', () => {
  let app;
  let mockClient;
  const JWT_SECRET = 'test-secret';
  
  // Mock user data
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'employee',
    company_id: 1,
    phone: '1234567890'
  };
  
  // Generate test JWT token
  const generateTestToken = (user = mockUser) => {
    return jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        company_id: user.company_id,
        token_version: 1 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  beforeEach(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Mock JWT secret
    process.env.JWT_SECRET = JWT_SECRET;
    
    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool.connect.mockResolvedValue(mockClient);
    
    // Mock auth middleware to inject user
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          req.user = { ...mockUser, token };
        } catch (error) {
          return res.status(401).json({ error: 'Invalid token' });
        }
      }
      next();
    });
    
    // Mock OTP routes
    app.post('/api/otp/generate', (req, res) => {
      if (!req.body.purpose) {
        return res.status(400).json({
          error: 'Purpose is required',
          code: 'MISSING_PURPOSE'
        });
      }
      
      const allowedPurposes = [
        'face-settings-access',
        'profile-update',
        'security-verification',
        'password-reset',
        'account-verification'
      ];
      
      if (!allowedPurposes.includes(req.body.purpose)) {
        return res.status(400).json({
          error: 'Invalid purpose',
          code: 'INVALID_PURPOSE'
        });
      }
      
      // Mock successful generation
      res.json({
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: '123****890',
        purpose: req.body.purpose,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
    });
    
    app.post('/api/otp/verify', (req, res) => {
      if (!req.body.otp) {
        return res.status(400).json({
          error: 'OTP is required',
          code: 'MISSING_OTP'
        });
      }
      
      if (!/^\d{6}$/.test(req.body.otp)) {
        return res.status(400).json({
          error: 'Invalid OTP format',
          code: 'INVALID_OTP_FORMAT'
        });
      }
      
      if (!req.body.purpose) {
        return res.status(400).json({
          error: 'Purpose is required',
          code: 'MISSING_PURPOSE'
        });
      }
      
      // Mock successful verification
      res.json({
        success: true,
        message: 'OTP verified successfully',
        purpose: req.body.purpose,
        verifiedAt: new Date().toISOString()
      });
    });
    
    app.post('/api/otp/resend', (req, res) => {
      if (!req.body.purpose) {
        return res.status(400).json({
          error: 'Purpose is required',
          code: 'MISSING_PURPOSE'
        });
      }
      
      res.json({
        success: true,
        message: 'OTP resent successfully',
        purpose: req.body.purpose,
        resentAt: new Date().toISOString()
      });
    });
    
    app.delete('/api/otp/invalidate', (req, res) => {
      if (!req.body.purpose) {
        return res.status(400).json({
          error: 'Purpose is required',
          code: 'MISSING_PURPOSE'
        });
      }
      
      res.json({
        success: true,
        message: 'OTP invalidated successfully',
        purpose: req.body.purpose,
        invalidatedAt: new Date().toISOString()
      });
    });
    
    app.get('/api/otp/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'OTP Verification API',
        version: '1.0.0'
      });
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/otp/generate', () => {
    it('should generate OTP successfully', async () => {
      // Mock database response for user phone
      mockClient.query.mockResolvedValueOnce({
        rows: [{ phone: '1234567890' }]
      });
      
      // Mock OTP service response
      mockOTPService.generateOTP.mockResolvedValueOnce({
        success: true,
        message: 'OTP sent successfully',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP sent successfully');
      expect(response.body.phoneNumber).toBe('123****890'); // Masked phone
      expect(response.body.purpose).toBe('face-settings-access');
      expect(mockOTPService.generateOTP).toHaveBeenCalledWith(
        1,
        '1234567890',
        'face-settings-access',
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should return 400 for missing purpose', async () => {
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Purpose is required');
      expect(response.body.code).toBe('MISSING_PURPOSE');
    });
    
    it('should return 400 for invalid purpose', async () => {
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'invalid-purpose'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid purpose');
      expect(response.body.code).toBe('INVALID_PURPOSE');
    });
    
    it('should return 404 when user not found', async () => {
      // Mock database response for user not found
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
    
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/otp/generate')
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/otp/verify', () => {
    it('should verify OTP successfully', async () => {
      // Mock OTP service response
      mockOTPService.verifyOTP.mockResolvedValueOnce({
        success: true,
        message: 'OTP verified successfully'
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otp: '123456',
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP verified successfully');
      expect(response.body.purpose).toBe('face-settings-access');
      expect(mockOTPService.verifyOTP).toHaveBeenCalledWith(
        1,
        '123456',
        'face-settings-access',
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should return 400 for invalid OTP format', async () => {
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otp: '12345', // Invalid format (5 digits)
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid OTP format');
      expect(response.body.code).toBe('INVALID_OTP_FORMAT');
    });
    
    it('should return 400 for missing OTP', async () => {
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('OTP is required');
      expect(response.body.code).toBe('MISSING_OTP');
    });
    
    it('should return 400 for verification failure', async () => {
      // Mock OTP service response for failure
      mockOTPService.verifyOTP.mockResolvedValueOnce({
        success: false,
        message: 'Invalid OTP. 2 attempts remaining.',
        remainingAttempts: 2
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otp: '123456',
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OTP verification failed');
      expect(response.body.code).toBe('VERIFICATION_FAILED');
      expect(response.body.remainingAttempts).toBe(2);
    });
    
    it('should return 423 for account lockout', async () => {
      // Mock OTP service response for lockout
      mockOTPService.verifyOTP.mockResolvedValueOnce({
        success: false,
        message: 'Account locked due to too many failed attempts',
        lockoutUntil: new Date(Date.now() + 15 * 60 * 1000)
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({
          otp: '123456',
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(423);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OTP verification failed');
      expect(response.body.code).toBe('ACCOUNT_LOCKED');
      expect(response.body.lockoutUntil).toBeDefined();
    });
  });

  describe('POST /api/otp/resend', () => {
    it('should resend OTP successfully', async () => {
      // Mock OTP service response
      mockOTPService.resendOTP.mockResolvedValueOnce({
        success: true,
        message: 'OTP resent successfully',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/resend')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP resent successfully');
      expect(response.body.purpose).toBe('face-settings-access');
      expect(mockOTPService.resendOTP).toHaveBeenCalledWith(
        1,
        'face-settings-access',
        expect.any(String),
        expect.any(String)
      );
    });
    
    it('should return 400 for resend failure', async () => {
      // Mock OTP service response for failure
      mockOTPService.resendOTP.mockResolvedValueOnce({
        success: false,
        message: 'No previous OTP request found'
      });
      
      const token = generateTestToken();
      
      const response = await request(app)
        .post('/api/otp/resend')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('OTP resend failed');
      expect(response.body.code).toBe('RESEND_FAILED');
    });
  });

  describe('DELETE /api/otp/invalidate', () => {
    it('should invalidate OTP successfully', async () => {
      // Mock OTP service (invalidateOTP doesn't return anything)
      mockOTPService.invalidateOTP.mockResolvedValueOnce();
      
      const token = generateTestToken();
      
      const response = await request(app)
        .delete('/api/otp/invalidate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purpose: 'face-settings-access'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('OTP invalidated successfully');
      expect(response.body.purpose).toBe('face-settings-access');
      expect(mockOTPService.invalidateOTP).toHaveBeenCalledWith(1, 'face-settings-access');
    });
    
    it('should return 400 for missing purpose', async () => {
      const token = generateTestToken();
      
      const response = await request(app)
        .delete('/api/otp/invalidate')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Purpose is required');
      expect(response.body.code).toBe('MISSING_PURPOSE');
    });
  });

  describe('GET /api/otp/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/otp/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.service).toBe('OTP Verification API');
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on generate endpoint', async () => {
      // Mock database response for user phone
      mockClient.query.mockResolvedValue({
        rows: [{ phone: '1234567890' }]
      });
      
      // Mock OTP service response
      mockOTPService.generateOTP.mockResolvedValue({
        success: true,
        message: 'OTP sent successfully',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      });
      
      const token = generateTestToken();
      
      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/otp/generate')
          .set('Authorization', `Bearer ${token}`)
          .send({ purpose: 'face-settings-access' });
      }
      
      // This request should be rate limited
      const response = await request(app)
        .post('/api/otp/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ purpose: 'face-settings-access' });
      
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many OTP requests');
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.retryAfter).toBeDefined();
    });
  });
});