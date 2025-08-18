# Enhanced Shift Tracker - Complete Setup Guide

This guide will walk you through setting up the Enhanced Shift Tracker with all production-ready features including face verification, OTP authentication, and geofencing.

## 🚀 Quick Start

### 1. Automated Setup (Recommended)

Run the interactive setup wizard:

```bash
npm run setup
```

This will guide you through:
- Environment configuration
- Database setup
- SMS provider configuration
- Security settings
- Feature flags

### 2. Manual Setup

If you prefer manual configuration, follow the detailed steps below.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **PostgreSQL**: 12.0 or higher with PostGIS extension
- **Redis**: 6.0 or higher (optional, for caching)

### Mobile Development
- **Expo CLI**: Latest version
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)

### External Services (Optional)
- **Twilio Account** (for SMS/OTP)
- **AWS Account** (alternative SMS provider)
- **Google AI API Key** (for chat features)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd enhanced-shift-tracker

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 2. Database Setup

#### Create PostgreSQL Database

```bash
# Create database
createdb shift_tracker_db

# Enable PostGIS extension
psql -d shift_tracker_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Create database user (optional)
psql -d shift_tracker_db -c "CREATE USER shift_tracker_user WITH PASSWORD 'your_password';"
psql -d shift_tracker_db -c "GRANT ALL PRIVILEGES ON DATABASE shift_tracker_db TO shift_tracker_user;"
```

#### Run Database Migrations

```bash
# Run migrations
npm run migrate
```

### 3. Environment Configuration

#### Copy Environment Template

```bash
cp .env.example .env
```

#### Configure Environment Variables

Edit the `.env` file with your specific configuration:

```bash
# Required Configuration
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/shift_tracker_db

# Generate secure secrets (use the setup wizard or generate manually)
JWT_SECRET=your-64-character-jwt-secret-here
JWT_REFRESH_SECRET=your-64-character-refresh-secret-here
SESSION_SECRET=your-32-character-session-secret-here
BIOMETRIC_ENCRYPTION_KEY=your-32-character-encryption-key-here

# SMS Configuration (choose one)
# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# OR AWS SNS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# Feature Flags
ENABLE_FACE_VERIFICATION=true
ENABLE_OTP_VERIFICATION=true
ENABLE_GEOFENCE_TRACKING=true
ENABLE_OFFLINE_MODE=true
ENABLE_BIOMETRIC_STORAGE=true
```

### 4. Validate Configuration

```bash
npm run validate-config
```

This will check:
- Database connectivity
- SMS provider configuration
- Security settings
- Feature dependencies

## 🎯 Feature Configuration

### Face Verification Setup

#### 1. Camera Permissions
The app will request camera permissions automatically. Ensure your device/emulator has camera access.

#### 2. Face Detection Configuration
```bash
# In .env file
FACE_VERIFICATION_THRESHOLD=0.85
FACE_LIVENESS_THRESHOLD=0.7
MAX_FACE_VERIFICATION_ATTEMPTS=3
FACE_VERIFICATION_TIMEOUT=30000
```

#### 3. Biometric Storage
```bash
# Secure encryption for biometric data
BIOMETRIC_ENCRYPTION_KEY=your-32-character-key-here
BIOMETRIC_STORAGE_TTL=2592000  # 30 days
BIOMETRIC_BACKUP_ENABLED=true
```

### SMS/OTP Configuration

#### Twilio Setup
1. Create a Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token
3. Purchase a phone number
4. Add credentials to `.env`

#### AWS SNS Setup
1. Create AWS account and IAM user
2. Attach SNS permissions
3. Configure credentials in `.env`

### Geofencing Setup

#### 1. PostGIS Extension
Ensure PostGIS is installed in your PostgreSQL database:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### 2. Geofence Configuration
```bash
DEFAULT_GEOFENCE_RADIUS=100
GEOFENCE_ACCURACY_THRESHOLD=10
MAX_GEOFENCE_ZONES=50
```

## 🚀 Running the Application

### Development Mode

#### Start Backend Server
```bash
npm run backend:dev
```

#### Start Frontend (Mobile App)
```bash
npm start
```

#### Run on Device/Emulator
```bash
# Android
npm run android

# iOS
npm run ios

# Web (limited functionality)
npm run web
```

### Production Deployment

#### 1. Build Backend
```bash
cd backend
npm run build
npm start
```

#### 2. Build Mobile App
```bash
# Build for production
expo build:android
expo build:ios
```

## 🧪 Testing

### Run Tests
```bash
# Frontend tests
npm test

# Backend tests
cd backend
npm test

# Integration tests
npm run test:integration
```

### Test Face Verification
1. Open the app
2. Navigate to Settings > Face Verification
3. Follow the setup process
4. Test verification during shift start/end

### Test OTP System
1. Configure SMS provider
2. Start a shift
3. Verify OTP is sent and received
4. Complete verification process

### Test Geofencing
1. Create geofence zones in admin panel
2. Move in/out of zones
3. Verify entry/exit events are logged

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check connection string
psql "postgresql://username:password@localhost:5432/shift_tracker_db"
```

#### SMS Not Sending
```bash
# Validate SMS configuration
npm run validate-config

# Check provider status
curl -X GET http://localhost:3000/api/admin/sms-status
```

#### Face Detection Not Working
- Ensure camera permissions are granted
- Check device has front-facing camera
- Verify good lighting conditions
- Update camera dependencies if needed

#### Geofencing Issues
- Verify PostGIS extension is installed
- Check location permissions
- Ensure GPS is enabled on device

### Debug Mode

Enable debug logging:
```bash
ENABLE_DEBUG_LOGGING=true
LOG_LEVEL=debug
```

### Configuration Validation

Run the validation script to check your setup:
```bash
npm run validate-config
```

## 📱 Mobile App Configuration

### Update API Configuration

Edit `app/config/api.ts`:
```typescript
export const API_CONFIG = {
  BASE_URL: 'http://your-server-ip:3000', // Update with your server IP
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3
};
```

### Camera Configuration

The app uses Expo Camera with the following features:
- Face detection using ML Kit
- Real-time face quality assessment
- Liveness detection
- Secure biometric storage

### Location Configuration

Location tracking includes:
- Background location tracking
- Geofence monitoring
- Battery optimization
- Offline location storage

## 🔐 Security Considerations

### Production Security Checklist

- [ ] Change all default secrets
- [ ] Enable HTTPS in production
- [ ] Configure secure CORS origins
- [ ] Enable security headers (Helmet)
- [ ] Use secure cookies
- [ ] Implement rate limiting
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities

### Data Protection

- Biometric data is encrypted at rest
- Location data has retention policies
- User consent is required for tracking
- GDPR compliance features included

## 📊 Monitoring and Analytics

### Application Monitoring
- Error tracking with Sentry (optional)
- Performance monitoring
- User analytics
- System health checks

### Database Monitoring
- Query performance
- Connection pooling
- Backup procedures
- Data retention policies

## 🆘 Support

### Documentation
- [API Documentation](./API_DOCS.md)
- [Integration Analysis](./INTEGRATION_ANALYSIS.md)
- [Feature Specifications](./.kiro/specs/enhanced-shift-tracker/)

### Getting Help
1. Check this setup guide
2. Run configuration validation
3. Check application logs
4. Review error messages
5. Contact support team

## 🎉 Success!

If you've followed this guide successfully, you should have:

✅ A fully configured Enhanced Shift Tracker  
✅ Face verification working  
✅ OTP authentication functional  
✅ Geofencing operational  
✅ Offline capabilities enabled  
✅ Production-ready security  

Your enhanced shift tracking system is now ready for use!

---

**Next Steps:**
- Create your first company and users
- Set up geofence zones
- Test all features thoroughly
- Deploy to production environment
- Train users on new features

Happy tracking! 🎯