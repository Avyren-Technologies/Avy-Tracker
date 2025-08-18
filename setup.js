#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

class EnhancedShiftTrackerSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.config = {};
  }

  async run() {
    console.log('🚀 Enhanced Shift Tracker Setup Wizard');
    console.log('=====================================\n');
    
    console.log('This wizard will help you configure your Enhanced Shift Tracker application.');
    console.log('You can skip any step by pressing Enter to use default values.\n');

    try {
      await this.gatherBasicConfig();
      await this.gatherDatabaseConfig();
      await this.gatherSMSConfig();
      await this.gatherSecurityConfig();
      await this.gatherFeatureConfig();
      await this.generateEnvFile();
      await this.showNextSteps();
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async question(prompt, defaultValue = '') {
    return new Promise((resolve) => {
      const displayPrompt = defaultValue 
        ? `${prompt} (default: ${defaultValue}): `
        : `${prompt}: `;
        
      this.rl.question(displayPrompt, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  async gatherBasicConfig() {
    console.log('📋 Basic Configuration');
    console.log('----------------------');
    
    this.config.NODE_ENV = await this.question('Environment (development/production)', 'development');
    this.config.PORT = await this.question('Server port', '3000');
    this.config.API_BASE_URL = await this.question('API base URL', `http://localhost:${this.config.PORT}`);
    this.config.FRONTEND_URL = await this.question('Frontend URL', 'http://localhost:3001');
    
    console.log('');
  }

  async gatherDatabaseConfig() {
    console.log('🗄️  Database Configuration');
    console.log('---------------------------');
    
    const useConnectionString = await this.question('Use database connection string? (y/n)', 'n');
    
    if (useConnectionString.toLowerCase() === 'y') {
      this.config.DATABASE_URL = await this.question('Database connection string');
    } else {
      this.config.DB_HOST = await this.question('Database host', 'localhost');
      this.config.DB_PORT = await this.question('Database port', '5432');
      this.config.DB_NAME = await this.question('Database name', 'shift_tracker_db');
      this.config.DB_USER = await this.question('Database user', 'shift_tracker_user');
      this.config.DB_PASSWORD = await this.question('Database password');
      
      // Construct connection string
      this.config.DATABASE_URL = `postgresql://${this.config.DB_USER}:${this.config.DB_PASSWORD}@${this.config.DB_HOST}:${this.config.DB_PORT}/${this.config.DB_NAME}`;
    }
    
    console.log('');
  }

  async gatherSMSConfig() {
    console.log('📱 SMS Configuration');
    console.log('--------------------');
    
    const smsProvider = await this.question('SMS Provider (twilio/aws/console)', 'console');
    
    if (smsProvider === 'twilio') {
      console.log('\n📞 Twilio Configuration:');
      this.config.TWILIO_ACCOUNT_SID = await this.question('Twilio Account SID');
      this.config.TWILIO_AUTH_TOKEN = await this.question('Twilio Auth Token');
      this.config.TWILIO_PHONE_NUMBER = await this.question('Twilio Phone Number (with +)');
    } else if (smsProvider === 'aws') {
      console.log('\n☁️  AWS SNS Configuration:');
      this.config.AWS_ACCESS_KEY_ID = await this.question('AWS Access Key ID');
      this.config.AWS_SECRET_ACCESS_KEY = await this.question('AWS Secret Access Key');
      this.config.AWS_REGION = await this.question('AWS Region', 'us-east-1');
      this.config.AWS_SNS_TOPIC_ARN = await this.question('SNS Topic ARN (optional)');
    } else {
      console.log('📝 Using console SMS provider (development mode)');
    }
    
    console.log('');
  }

  async gatherSecurityConfig() {
    console.log('🔐 Security Configuration');
    console.log('-------------------------');
    
    // Generate secure secrets
    this.config.JWT_SECRET = this.generateSecureSecret(64);
    this.config.JWT_REFRESH_SECRET = this.generateSecureSecret(64);
    this.config.SESSION_SECRET = this.generateSecureSecret(32);
    this.config.BIOMETRIC_ENCRYPTION_KEY = this.generateSecureSecret(32);
    
    console.log('✅ Generated secure secrets automatically');
    
    this.config.BCRYPT_ROUNDS = await this.question('Bcrypt rounds (10-15)', '12');
    
    if (this.config.NODE_ENV === 'production') {
      this.config.CORS_ORIGIN = await this.question('CORS origin (production)', 'https://yourapp.com');
      this.config.HTTPS_ONLY = 'true';
      this.config.SECURE_COOKIES = 'true';
      this.config.HELMET_ENABLED = 'true';
    } else {
      this.config.CORS_ORIGIN = '*';
      this.config.HTTPS_ONLY = 'false';
      this.config.SECURE_COOKIES = 'false';
      this.config.HELMET_ENABLED = 'false';
    }
    
    console.log('');
  }

  async gatherFeatureConfig() {
    console.log('🎛️  Feature Configuration');
    console.log('-------------------------');
    
    const enableFaceVerification = await this.question('Enable face verification? (y/n)', 'y');
    this.config.ENABLE_FACE_VERIFICATION = enableFaceVerification.toLowerCase() === 'y' ? 'true' : 'false';
    
    if (this.config.ENABLE_FACE_VERIFICATION === 'true') {
      this.config.FACE_VERIFICATION_THRESHOLD = await this.question('Face verification threshold (0.0-1.0)', '0.85');
      this.config.FACE_LIVENESS_THRESHOLD = await this.question('Face liveness threshold (0.0-1.0)', '0.7');
      this.config.MAX_FACE_VERIFICATION_ATTEMPTS = await this.question('Max face verification attempts', '3');
    }
    
    const enableOTPVerification = await this.question('Enable OTP verification? (y/n)', 'y');
    this.config.ENABLE_OTP_VERIFICATION = enableOTPVerification.toLowerCase() === 'y' ? 'true' : 'false';
    
    const enableGeofencing = await this.question('Enable geofence tracking? (y/n)', 'y');
    this.config.ENABLE_GEOFENCE_TRACKING = enableGeofencing.toLowerCase() === 'y' ? 'true' : 'false';
    
    if (this.config.ENABLE_GEOFENCE_TRACKING === 'true') {
      this.config.DEFAULT_GEOFENCE_RADIUS = await this.question('Default geofence radius (meters)', '100');
      this.config.MAX_GEOFENCE_ZONES = await this.question('Max geofence zones per company', '50');
    }
    
    const enableOfflineMode = await this.question('Enable offline mode? (y/n)', 'y');
    this.config.ENABLE_OFFLINE_MODE = enableOfflineMode.toLowerCase() === 'y' ? 'true' : 'false';
    
    const enableBiometricStorage = await this.question('Enable biometric storage? (y/n)', 'y');
    this.config.ENABLE_BIOMETRIC_STORAGE = enableBiometricStorage.toLowerCase() === 'y' ? 'true' : 'false';
    
    console.log('');
  }

  generateSecureSecret(length) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  async generateEnvFile() {
    console.log('📝 Generating Environment File');
    console.log('------------------------------');
    
    const envContent = this.buildEnvContent();
    
    // Check if .env already exists
    if (fs.existsSync('.env')) {
      const overwrite = await this.question('.env file already exists. Overwrite? (y/n)', 'n');
      if (overwrite.toLowerCase() !== 'y') {
        console.log('💾 Saving configuration to .env.new instead');
        fs.writeFileSync('.env.new', envContent);
        console.log('✅ Configuration saved to .env.new');
        console.log('   Please review and rename to .env when ready');
        return;
      }
    }
    
    fs.writeFileSync('.env', envContent);
    console.log('✅ Environment file created successfully');
    console.log('');
  }

  buildEnvContent() {
    const lines = [
      '# Enhanced Shift Tracker Environment Configuration',
      '# Generated by setup wizard on ' + new Date().toISOString(),
      '',
      '# Server Configuration',
      `NODE_ENV=${this.config.NODE_ENV}`,
      `PORT=${this.config.PORT}`,
      `API_BASE_URL=${this.config.API_BASE_URL}`,
      `FRONTEND_URL=${this.config.FRONTEND_URL}`,
      '',
      '# Database Configuration',
      `DATABASE_URL=${this.config.DATABASE_URL}`,
    ];

    if (this.config.DB_HOST) {
      lines.push(
        `DB_HOST=${this.config.DB_HOST}`,
        `DB_PORT=${this.config.DB_PORT}`,
        `DB_NAME=${this.config.DB_NAME}`,
        `DB_USER=${this.config.DB_USER}`,
        `DB_PASSWORD=${this.config.DB_PASSWORD}`
      );
    }

    lines.push(
      '',
      '# JWT Configuration',
      `JWT_SECRET=${this.config.JWT_SECRET}`,
      'JWT_EXPIRES_IN=24h',
      `JWT_REFRESH_SECRET=${this.config.JWT_REFRESH_SECRET}`,
      'JWT_REFRESH_EXPIRES_IN=7d',
      ''
    );

    // SMS Configuration
    if (this.config.TWILIO_ACCOUNT_SID) {
      lines.push(
        '# Twilio SMS Configuration',
        `TWILIO_ACCOUNT_SID=${this.config.TWILIO_ACCOUNT_SID}`,
        `TWILIO_AUTH_TOKEN=${this.config.TWILIO_AUTH_TOKEN}`,
        `TWILIO_PHONE_NUMBER=${this.config.TWILIO_PHONE_NUMBER}`,
        ''
      );
    }

    if (this.config.AWS_ACCESS_KEY_ID) {
      lines.push(
        '# AWS SNS Configuration',
        `AWS_ACCESS_KEY_ID=${this.config.AWS_ACCESS_KEY_ID}`,
        `AWS_SECRET_ACCESS_KEY=${this.config.AWS_SECRET_ACCESS_KEY}`,
        `AWS_REGION=${this.config.AWS_REGION}`,
      );
      
      if (this.config.AWS_SNS_TOPIC_ARN) {
        lines.push(`AWS_SNS_TOPIC_ARN=${this.config.AWS_SNS_TOPIC_ARN}`);
      }
      
      lines.push('');
    }

    // Security Configuration
    lines.push(
      '# Security Configuration',
      `BCRYPT_ROUNDS=${this.config.BCRYPT_ROUNDS}`,
      'RATE_LIMIT_WINDOW_MS=900000',
      'RATE_LIMIT_MAX_REQUESTS=100',
      `SESSION_SECRET=${this.config.SESSION_SECRET}`,
      `CORS_ORIGIN=${this.config.CORS_ORIGIN}`,
      `HELMET_ENABLED=${this.config.HELMET_ENABLED}`,
      `HTTPS_ONLY=${this.config.HTTPS_ONLY}`,
      `SECURE_COOKIES=${this.config.SECURE_COOKIES}`,
      ''
    );

    // Biometric Configuration
    lines.push(
      '# Biometric Configuration',
      `BIOMETRIC_ENCRYPTION_KEY=${this.config.BIOMETRIC_ENCRYPTION_KEY}`,
      'BIOMETRIC_STORAGE_TTL=2592000',
      'BIOMETRIC_BACKUP_ENABLED=true',
      ''
    );

    // Feature Configuration
    lines.push(
      '# Feature Flags',
      `ENABLE_FACE_VERIFICATION=${this.config.ENABLE_FACE_VERIFICATION}`,
      `ENABLE_OTP_VERIFICATION=${this.config.ENABLE_OTP_VERIFICATION}`,
      `ENABLE_GEOFENCE_TRACKING=${this.config.ENABLE_GEOFENCE_TRACKING}`,
      `ENABLE_OFFLINE_MODE=${this.config.ENABLE_OFFLINE_MODE}`,
      `ENABLE_BIOMETRIC_STORAGE=${this.config.ENABLE_BIOMETRIC_STORAGE}`,
      ''
    );

    if (this.config.FACE_VERIFICATION_THRESHOLD) {
      lines.push(
        '# Face Verification Configuration',
        `FACE_VERIFICATION_THRESHOLD=${this.config.FACE_VERIFICATION_THRESHOLD}`,
        `FACE_LIVENESS_THRESHOLD=${this.config.FACE_LIVENESS_THRESHOLD}`,
        `MAX_FACE_VERIFICATION_ATTEMPTS=${this.config.MAX_FACE_VERIFICATION_ATTEMPTS}`,
        'FACE_VERIFICATION_TIMEOUT=30000',
        ''
      );
    }

    if (this.config.DEFAULT_GEOFENCE_RADIUS) {
      lines.push(
        '# Geofence Configuration',
        `DEFAULT_GEOFENCE_RADIUS=${this.config.DEFAULT_GEOFENCE_RADIUS}`,
        'GEOFENCE_ACCURACY_THRESHOLD=10',
        `MAX_GEOFENCE_ZONES=${this.config.MAX_GEOFENCE_ZONES}`,
        ''
      );
    }

    // Additional configurations
    lines.push(
      '# File Storage Configuration',
      'UPLOAD_DIR=./uploads',
      'MAX_FILE_SIZE=10485760',
      'ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf',
      '',
      '# Redis Configuration (optional)',
      'REDIS_URL=redis://localhost:6379',
      'REDIS_DB=0',
      '',
      '# Email Configuration (optional)',
      'SMTP_HOST=smtp.gmail.com',
      'SMTP_PORT=587',
      'EMAIL_FROM=noreply@yourcompany.com',
      '',
      '# Monitoring Configuration (optional)',
      'LOG_LEVEL=info',
      'ENABLE_REQUEST_LOGGING=true',
      'ENABLE_DEBUG_LOGGING=true',
      '',
      '# Development Configuration',
      'ENABLE_MOCK_SERVICES=false',
      'SKIP_EMAIL_VERIFICATION=false'
    );

    return lines.join('\n');
  }

  async showNextSteps() {
    console.log('🎉 Setup Complete!');
    console.log('==================');
    console.log('');
    console.log('Next steps:');
    console.log('');
    console.log('1. 📦 Install dependencies:');
    console.log('   npm install');
    console.log('');
    console.log('2. 🗄️  Set up your database:');
    console.log('   - Create PostgreSQL database');
    console.log('   - Install PostGIS extension: CREATE EXTENSION postgis;');
    console.log('   - Run migrations: npm run migrate');
    console.log('');
    console.log('3. ✅ Validate your configuration:');
    console.log('   npm run validate-config');
    console.log('');
    console.log('4. 🚀 Start the application:');
    console.log('   Backend: cd backend && npm run dev');
    console.log('   Frontend: npm start');
    console.log('');
    console.log('5. 📱 Configure mobile app:');
    console.log('   - Update API_URL in app configuration');
    console.log('   - Test camera permissions');
    console.log('   - Test location permissions');
    console.log('');
    console.log('📚 Documentation:');
    console.log('   - Check README.md for detailed setup instructions');
    console.log('   - Review .env.example for all configuration options');
    console.log('   - See INTEGRATION_ANALYSIS.md for feature details');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   - Run validation script if you encounter issues');
    console.log('   - Check logs for detailed error messages');
    console.log('   - Ensure all required services are running');
    console.log('');
    console.log('Happy tracking! 🎯');
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new EnhancedShiftTrackerSetup();
  setup.run().catch(console.error);
}

module.exports = EnhancedShiftTrackerSetup;