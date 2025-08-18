# Enhanced ShiftTracker with Face Verification and Embedded Map - Design Document

## Overview

This design document outlines the technical architecture for enhancing the existing ShiftTracker component with face verification, liveness detection, and embedded map functionality. The solution integrates biometric authentication with location-based verification to provide secure and accurate shift tracking.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React Native)                  │
├─────────────────────────────────────────────────────────────┤
│  ShiftTracker.tsx (Enhanced)                               │
│  ├── EmbeddedMap Component                                  │
│  ├── FaceVerificationModal                                 │
│  ├── CameraLiveness Component                              │
│  └── OTPVerification Component                             │
├─────────────────────────────────────────────────────────────┤
│  Custom Hooks                                              │
│  ├── useFaceDetection                                      │
│  ├── useCameraLiveness                                     │
│  ├── useGeofenceDetection                                  │
│  └── useOTPVerification                                    │
├─────────────────────────────────────────────────────────────┤
│  Services                                                  │
│  ├── FaceVerificationService                              │
│  ├── BiometricStorageService                              │
│  └── LocationService                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                │
├─────────────────────────────────────────────────────────────┤
│  API Routes                                                │
│  ├── /api/face-verification/*                             │
│  ├── /api/otp-verification/*                              │
│  ├── /api/geofences/nearby                                │
│  └── /api/shift/verify                                    │
├─────────────────────────────────────────────────────────────┤
│  Services                                                  │
│  ├── FaceVerificationService                              │
│  ├── OTPService                                           │
│  ├── GeofenceDetectionService                             │
│  └── AuditLogService                                       │
├─────────────────────────────────────────────────────────────┤
│  Middleware                                                │
│  ├── faceVerificationRateLimit                            │
│  ├── deviceFingerprinting                                 │
│  └── biometricAuditLogger                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                    │
├─────────────────────────────────────────────────────────────┤
│  New Tables                                                │
│  ├── face_verification_profiles                           │
│  ├── face_verification_logs                               │
│  ├── otp_verifications                                    │
│  ├── biometric_audit_logs                                 │
│  └── device_fingerprints                                  │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Tables                                           │
│  ├── employee_shifts (add verification columns)           │
│  ├── users (add face_registered, face_enabled flags)      │
│  └── company_geofences (enhanced for map display)         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. Enhanced ShiftTracker Component
**File:** `app/(dashboard)/shared/shiftTracker.tsx`

```typescript
interface EnhancedShiftTrackerProps {
  // Existing props remain unchanged
}

interface ShiftVerificationState {
  faceVerificationRequired: boolean;
  locationVerificationRequired: boolean;
  verificationInProgress: boolean;
  verificationResults: {
    face: VerificationResult | null;
    location: LocationResult | null;
  };
}
```

#### 2. EmbeddedMap Component
**File:** `app/components/EmbeddedMap.tsx`

```typescript
interface EmbeddedMapProps {
  currentLocation?: LocationCoordinates;
  geofences: GeofenceArea[];
  size?: { width: number; height: number };
  onLocationUpdate?: (location: LocationCoordinates) => void;
  onGeofenceStatusChange?: (isInside: boolean, geofenceName?: string) => void;
}

interface GeofenceArea {
  id: string;
  name: string;
  coordinates: LocationCoordinates;
  radius: number;
  color?: string;
}
```

#### 3. FaceVerificationModal Component
**File:** `app/components/FaceVerificationModal.tsx`

```typescript
interface FaceVerificationModalProps {
  visible: boolean;
  mode: 'register' | 'verify';
  onSuccess: (verificationData: FaceVerificationResult) => void;
  onError: (error: FaceVerificationError) => void;
  onCancel: () => void;
  retryCount?: number;
  maxRetries?: number;
}

interface FaceVerificationResult {
  success: boolean;
  confidence: number;
  livenessDetected: boolean;
  faceEncoding?: string;
  timestamp: Date;
}
```

#### 4. CameraLiveness Component
**File:** `app/components/CameraLiveness.tsx`

```typescript
interface CameraLivenessProps {
  onFaceDetected: (faceData: FaceDetectionData) => void;
  onBlinkDetected: () => void;
  onPhotoCapture: (photo: CapturedPhoto) => void;
  isActive: boolean;
  performanceMode: 'fast' | 'accurate';
}

interface FaceDetectionData {
  bounds: FaceBounds;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  faceId: string;
  rollAngle: number;
  yawAngle: number;
}
```

### Backend Services

#### 1. FaceVerificationService
**File:** `backend/src/services/FaceVerificationService.ts`

```typescript
class FaceVerificationService {
  static async registerFaceProfile(userId: number, faceEncoding: string): Promise<FaceProfile>;
  static async verifyFace(userId: number, currentEncoding: string): Promise<VerificationResult>;
  static async updateFaceProfile(userId: number, newEncoding: string): Promise<boolean>;
  static async deleteFaceProfile(userId: number): Promise<boolean>;
  static async getFaceRegistrationStatus(userId: number): Promise<FaceRegistrationStatus>;
  
  private static encryptFaceData(data: string): string;
  private static decryptFaceData(encryptedData: string): string;
  private static compareFaceEncodings(stored: string, current: string): number;
  private static generateFaceHash(encoding: string): string;
}
```

#### 2. OTPService
**File:** `backend/src/services/OTPService.ts`

```typescript
class OTPService {
  static async generateOTP(userId: number, phoneNumber: string, purpose: string): Promise<string>;
  static async verifyOTP(userId: number, otp: string, purpose: string): Promise<boolean>;
  static async resendOTP(userId: number, purpose: string): Promise<boolean>;
  static async invalidateOTP(userId: number, purpose: string): Promise<void>;
  
  private static generateSecureOTP(): string;
  private static sendSMS(phoneNumber: string, otp: string): Promise<boolean>;
  private static isOTPExpired(createdAt: Date): boolean;
}
```

#### 3. GeofenceDetectionService
**File:** `backend/src/services/GeofenceDetectionService.ts`

```typescript
class GeofenceDetectionService {
  static async getNearbyGeofences(location: LocationCoordinates, radius: number): Promise<GeofenceArea[]>;
  static async isLocationInGeofence(location: LocationCoordinates, geofenceId: string): Promise<boolean>;
  static async getGeofenceByLocation(location: LocationCoordinates): Promise<GeofenceArea | null>;
  static async validateLocationForShift(userId: number, location: LocationCoordinates): Promise<LocationValidationResult>;
  
  private static calculateDistance(point1: LocationCoordinates, point2: LocationCoordinates): number;
  private static isPointInPolygon(point: LocationCoordinates, polygon: LocationCoordinates[]): boolean;
}
```

### Custom Hooks

#### 1. useFaceDetection Hook
**File:** `app/hooks/useFaceDetection.ts`

```typescript
interface UseFaceDetectionReturn {
  isDetecting: boolean;
  faceDetected: boolean;
  faceData: FaceDetectionData | null;
  startDetection: () => Promise<boolean>;
  stopDetection: () => void;
  capturePhoto: () => Promise<CapturedPhoto>;
  error: string | null;
}

export const useFaceDetection = (options: FaceDetectionOptions): UseFaceDetectionReturn;
```

#### 2. useCameraLiveness Hook
**File:** `app/hooks/useCameraLiveness.ts`

```typescript
interface UseCameraLivenessReturn {
  isLivenessActive: boolean;
  blinkDetected: boolean;
  livenessScore: number;
  startLivenessDetection: () => void;
  stopLivenessDetection: () => void;
  resetLivenessState: () => void;
}

export const useCameraLiveness = (faceData: FaceDetectionData | null): UseCameraLivenessReturn;
```

## Data Models

### Database Schema Changes

#### 1. Face Verification Profiles Table
```sql
CREATE TABLE face_verification_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  face_encoding_hash TEXT NOT NULL,
  encrypted_face_data TEXT NOT NULL,
  registration_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  verification_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. Face Verification Logs Table
```sql
CREATE TABLE face_verification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  shift_id INTEGER REFERENCES employee_shifts(id),
  verification_type VARCHAR(20) CHECK (verification_type IN ('start', 'end', 'registration', 'update')),
  success BOOLEAN NOT NULL,
  confidence_score DECIMAL(5,4),
  liveness_detected BOOLEAN,
  failure_reason TEXT,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. OTP Verifications Table
```sql
CREATE TABLE otp_verifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  phone_number VARCHAR(20) NOT NULL,
  otp_code_hash TEXT NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE
);
```

#### 4. Enhanced Employee Shifts Table
```sql
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS face_verification_start BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS face_verification_end BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS face_verification_start_confidence DECIMAL(5,4);
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS face_verification_end_confidence DECIMAL(5,4);
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS location_verification_start BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS location_verification_end BOOLEAN DEFAULT FALSE;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS verification_override_reason TEXT;
ALTER TABLE employee_shifts ADD COLUMN IF NOT EXISTS verification_override_by INTEGER REFERENCES users(id);
```

#### 5. Enhanced Users Table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_registered BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_registration_required BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_face_verification TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_verification_failures INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_locked_until TIMESTAMP WITH TIME ZONE;
```

## Error Handling

### Face Verification Errors
```typescript
enum FaceVerificationErrorType {
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  POOR_LIGHTING = 'POOR_LIGHTING',
  FACE_TOO_SMALL = 'FACE_TOO_SMALL',
  FACE_TOO_LARGE = 'FACE_TOO_LARGE',
  NO_LIVENESS_DETECTED = 'NO_LIVENESS_DETECTED',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  CAMERA_PERMISSION_DENIED = 'CAMERA_PERMISSION_DENIED',
  CAMERA_NOT_AVAILABLE = 'CAMERA_NOT_AVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

interface FaceVerificationError {
  type: FaceVerificationErrorType;
  message: string;
  retryable: boolean;
  suggestions: string[];
}
```

### Error Recovery Strategies
1. **Camera Issues**: Retry with different camera settings, fallback to manual capture
2. **Face Detection Issues**: Provide user guidance for better positioning
3. **Network Issues**: Queue verification data for offline processing
4. **Storage Issues**: Clear cache and retry, fallback to server storage

## Testing Strategy

### Unit Testing
- Face encoding generation and comparison algorithms
- OTP generation and validation logic
- Geofence detection calculations
- Camera permission handling
- Biometric data encryption/decryption

### Integration Testing
- Face verification API endpoints
- OTP verification workflow
- Shift start/end with verification
- Map component with geofence detection
- Offline verification and sync

### Performance Testing
- Face detection latency under various conditions
- Camera initialization time
- Map rendering performance with multiple geofences
- Memory usage during extended camera sessions
- Battery impact of continuous face detection

### Security Testing
- Biometric data encryption validation
- OTP brute force protection
- Device fingerprinting accuracy
- Audit log completeness
- Data deletion verification

## Security Considerations

### Biometric Data Protection
1. **Local Processing**: Face detection and encoding generation happens on-device
2. **Encryption**: All biometric data encrypted with device-specific keys
3. **No Raw Storage**: Never store actual face images, only mathematical encodings
4. **Secure Transmission**: All API calls use HTTPS with certificate pinning
5. **Data Minimization**: Store only necessary verification metadata

### Authentication Security
1. **OTP Security**: Time-based OTP with secure random generation
2. **Rate Limiting**: Prevent brute force attacks on verification endpoints
3. **Device Fingerprinting**: Track and validate device characteristics
4. **Session Management**: Secure session handling for authenticated operations
5. **Audit Logging**: Comprehensive logging of all security-related events

### Privacy Compliance
1. **Consent Management**: Explicit consent for biometric data collection
2. **Data Retention**: Automatic deletion of old verification logs
3. **User Rights**: Complete data deletion on user request
4. **Transparency**: Clear privacy policy for biometric data usage
5. **Compliance**: GDPR, CCPA, and other privacy regulation compliance

This design provides a comprehensive foundation for implementing secure, performant, and user-friendly face verification with embedded mapping capabilities in the ShiftTracker component.