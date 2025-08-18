import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface EnvironmentConfig {
  // Server Configuration
  port: number;
  nodeEnv: string;
  apiBaseUrl: string;
  frontendUrl: string;

  // Database Configuration
  database: {
    url: string;
  };

  // JWT Configuration
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };

  // SMS Configuration
  sms: {
    provider: 'twilio' | 'aws' | 'console';
    twilio?: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
    aws?: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      snsTopicArn: string;
    };
  };

  // AI Configuration
  ai: {
    googleApiKey?: string;
    model: string;
  };

  // Face Verification Configuration
  faceVerification: {
    threshold: number;
    livenessThreshold: number;
    maxAttempts: number;
    timeout: number;
  };

  // Geofence Configuration
  geofence: {
    defaultRadius: number;
    accuracyThreshold: number;
    maxZones: number;
  };

  // File Storage Configuration
  storage: {
    uploadDir: string;
    maxFileSize: number;
    allowedFileTypes: string[];
  };

  // Redis Configuration
  redis: {
    url: string;
    password?: string;
    db: number;
  };

  // Email Configuration
  email: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };

  // Security Configuration
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    sessionSecret: string;
    corsOrigin: string;
    helmetEnabled: boolean;
    httpsOnly: boolean;
    secureCookies: boolean;
  };

  // Biometric Configuration
  biometric: {
    encryptionKey: string;
    storageTtl: number;
    backupEnabled: boolean;
  };

  // Offline Sync Configuration
  offline: {
    syncInterval: number;
    maxRecords: number;
    retentionDays: number;
  };

  // Monitoring Configuration
  monitoring: {
    logLevel: string;
    enableRequestLogging: boolean;
    sentryDsn?: string;
    datadogApiKey?: string;
  };

  // Feature Flags
  features: {
    faceVerification: boolean;
    otpVerification: boolean;
    geofenceTracking: boolean;
    offlineMode: boolean;
    biometricStorage: boolean;
    advancedAnalytics: boolean;
  };

  // Development Configuration
  development: {
    enableMockServices: boolean;
    skipEmailVerification: boolean;
    enableDebugLogging: boolean;
    testPhoneNumber?: string;
    testOtpCode?: string;
  };
}

class EnvironmentService {
  private static instance: EnvironmentService;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  private loadConfiguration(): EnvironmentConfig {
    return {
      // Server Configuration
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',

      // Database Configuration
      database: {
        url: process.env.DATABASE_URL || '',
        // Removed separate database config fields - only using DATABASE_URL
      },

      // JWT Configuration
      jwt: {
        secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
      },

      // SMS Configuration
      sms: {
        provider: this.determineSmsProvider(),
        twilio: process.env.TWILIO_ACCOUNT_SID ? {
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
        } : undefined,
        aws: process.env.AWS_ACCESS_KEY_ID ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          region: process.env.AWS_REGION || 'us-east-1',
          snsTopicArn: process.env.AWS_SNS_TOPIC_ARN || ''
        } : undefined
      },

      // AI Configuration
      ai: {
        googleApiKey: process.env.GOOGLE_AI_API_KEY,
        model: process.env.GOOGLE_AI_MODEL || 'gemini-pro'
      },

      // Face Verification Configuration
      faceVerification: {
        threshold: parseFloat(process.env.FACE_VERIFICATION_THRESHOLD || '0.85'),
        livenessThreshold: parseFloat(process.env.FACE_LIVENESS_THRESHOLD || '0.7'),
        maxAttempts: parseInt(process.env.MAX_FACE_VERIFICATION_ATTEMPTS || '3', 10),
        timeout: parseInt(process.env.FACE_VERIFICATION_TIMEOUT || '30000', 10)
      },

      // Geofence Configuration
      geofence: {
        defaultRadius: parseInt(process.env.DEFAULT_GEOFENCE_RADIUS || '100', 10),
        accuracyThreshold: parseInt(process.env.GEOFENCE_ACCURACY_THRESHOLD || '10', 10),
        maxZones: parseInt(process.env.MAX_GEOFENCE_ZONES || '50', 10)
      },

      // File Storage Configuration
      storage: {
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
        allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf').split(',')
      },

      // Redis Configuration
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10)
      },

      // Email Configuration
      email: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.EMAIL_FROM || 'noreply@yourcompany.com'
      },

      // Security Configuration
      security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
        corsOrigin: process.env.CORS_ORIGIN || '*',
        helmetEnabled: process.env.HELMET_ENABLED === 'true',
        httpsOnly: process.env.HTTPS_ONLY === 'true',
        secureCookies: process.env.SECURE_COOKIES === 'true'
      },

      // Biometric Configuration
      biometric: {
        encryptionKey: process.env.BIOMETRIC_ENCRYPTION_KEY || 'fallback-32-char-encryption-key!!',
        storageTtl: parseInt(process.env.BIOMETRIC_STORAGE_TTL || '2592000', 10), // 30 days
        backupEnabled: process.env.BIOMETRIC_BACKUP_ENABLED === 'true'
      },

      // Offline Sync Configuration
      offline: {
        syncInterval: parseInt(process.env.OFFLINE_SYNC_INTERVAL || '300000', 10), // 5 minutes
        maxRecords: parseInt(process.env.MAX_OFFLINE_RECORDS || '1000', 10),
        retentionDays: parseInt(process.env.OFFLINE_RETENTION_DAYS || '30', 10)
      },

      // Monitoring Configuration
      monitoring: {
        logLevel: process.env.LOG_LEVEL || 'info',
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
        sentryDsn: process.env.SENTRY_DSN,
        datadogApiKey: process.env.DATADOG_API_KEY
      },

      // Feature Flags
      features: {
        faceVerification: process.env.ENABLE_FACE_VERIFICATION !== 'false',
        otpVerification: process.env.ENABLE_OTP_VERIFICATION !== 'false',
        geofenceTracking: process.env.ENABLE_GEOFENCE_TRACKING !== 'false',
        offlineMode: process.env.ENABLE_OFFLINE_MODE !== 'false',
        biometricStorage: process.env.ENABLE_BIOMETRIC_STORAGE !== 'false',
        advancedAnalytics: process.env.ENABLE_ADVANCED_ANALYTICS === 'true'
      },

      // Development Configuration
      development: {
        enableMockServices: process.env.ENABLE_MOCK_SERVICES === 'true',
        skipEmailVerification: process.env.SKIP_EMAIL_VERIFICATION === 'true',
        enableDebugLogging: process.env.ENABLE_DEBUG_LOGGING === 'true',
        testPhoneNumber: process.env.TEST_PHONE_NUMBER,
        testOtpCode: process.env.TEST_OTP_CODE
      }
    };
  }

  private determineSmsProvider(): 'twilio' | 'aws' | 'console' {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return 'twilio';
    }
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return 'aws';
    }
    return 'console';
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate critical configuration
    if (this.config.nodeEnv === 'production') {
      // Production-specific validations
      if (this.config.jwt.secret === 'fallback-secret-change-in-production') {
        errors.push('JWT_SECRET must be set in production');
      }
      if (this.config.security.sessionSecret === 'fallback-session-secret') {
        errors.push('SESSION_SECRET must be set in production');
      }
      if (this.config.biometric.encryptionKey === 'fallback-32-char-encryption-key!!') {
        errors.push('BIOMETRIC_ENCRYPTION_KEY must be set in production');
      }
      if (!this.config.database.url) {
        errors.push('DATABASE_URL must be set');
      }
      if (this.config.features.otpVerification && this.config.sms.provider === 'console') {
        errors.push('SMS provider must be configured for OTP verification in production');
      }
    }

    // Validate biometric encryption key length
    if (this.config.biometric.encryptionKey.length !== 32) {
      errors.push('BIOMETRIC_ENCRYPTION_KEY must be exactly 32 characters long');
    }

    // Validate face verification thresholds
    if (this.config.faceVerification.threshold < 0 || this.config.faceVerification.threshold > 1) {
      errors.push('FACE_VERIFICATION_THRESHOLD must be between 0 and 1');
    }
    if (this.config.faceVerification.livenessThreshold < 0 || this.config.faceVerification.livenessThreshold > 1) {
      errors.push('FACE_LIVENESS_THRESHOLD must be between 0 and 1');
    }

    // Validate port range
    if (this.config.port < 1 || this.config.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    if (errors.length > 0) {
      console.error('Environment Configuration Errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      if (this.config.nodeEnv === 'production') {
        throw new Error('Invalid production configuration. Please fix the errors above.');
      } else {
        console.warn('Configuration warnings detected. Application will continue with fallback values.');
      }
    }
  }

  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  public get(key: keyof EnvironmentConfig): any {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  public isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Get masked configuration for logging (removes sensitive data)
  public getMaskedConfig(): Partial<EnvironmentConfig> {
    const masked = JSON.parse(JSON.stringify(this.config));
    // Mask sensitive fields
    if (masked.jwt) {
      masked.jwt.secret = '***';
      masked.jwt.refreshSecret = '***';
    }
    if (masked.database) {
      masked.database.url = masked.database.url.replace(/:([^:@]+)@/, ':***@');
    }
    if (masked.sms?.twilio) {
      masked.sms.twilio.authToken = '***';
    }
    if (masked.sms?.aws) {
      masked.sms.aws.secretAccessKey = '***';
    }
    if (masked.ai) {
      masked.ai.googleApiKey = masked.ai.googleApiKey ? '***' : undefined;
    }
    if (masked.email) {
      masked.email.password = '***';
    }
    if (masked.security) {
      masked.security.sessionSecret = '***';
    }
    if (masked.biometric) {
      masked.biometric.encryptionKey = '***';
    }
    return masked;
  }
}

export const environmentService = EnvironmentService.getInstance();
export default environmentService;