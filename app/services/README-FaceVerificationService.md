# Face Verification Service

A comprehensive client-side face verification service that provides secure face recognition capabilities with offline support and data synchronization.

## Features

### Core Functionality
- **Face Encoding Generation**: Creates mathematical representations of faces from detection data
- **Secure Storage**: Uses Expo SecureStore for encrypted face profile storage
- **Offline Verification**: Performs face verification without network connectivity
- **Verification Caching**: Caches recent verification results for performance
- **Sync Functionality**: Synchronizes offline verifications with server when online

### Security Features
- **Device-Specific Encryption**: Face data encrypted with device-unique keys
- **Hash-Based Comparison**: Uses SHA-256 hashing for face encoding comparison
- **Secure Key Management**: Device keys stored in secure hardware when available
- **Data Minimization**: Only stores necessary face encoding data, not raw images

## API Reference

### Face Profile Management

#### `storeFaceProfile(userId, faceEncoding, faceData)`
Stores a face profile securely for a user.

```typescript
await storeFaceProfile(123, faceEncoding, faceDetectionData);
```

#### `getFaceProfile(userId)`
Retrieves stored face profile for a user.

```typescript
const profile = await getFaceProfile(123);
```

#### `deleteFaceProfile(userId)`
Completely removes face profile and associated data.

```typescript
await deleteFaceProfile(123);
```

### Face Verification

#### `verifyFace(userId, currentFaceData, currentPhoto, livenessDetected)`
Verifies current face against stored profile.

```typescript
const result = await verifyFace(
  123, 
  faceDetectionData, 
  capturedPhoto, 
  true
);

if (result.success) {
  console.log(`Verification successful with ${result.confidence} confidence`);
}
```

#### `generateFaceEncoding(faceData, photo)`
Generates face encoding from detection data and photo.

```typescript
const encoding = await generateFaceEncoding(faceData, photo);
```

#### `compareFaceEncodings(encoding1, encoding2)`
Compares two face encodings and returns similarity score (0-1).

```typescript
const similarity = compareFaceEncodings(storedEncoding, currentEncoding);
```

### Offline & Caching

#### `getCachedVerifications(userId)`
Retrieves cached verification results for a user.

```typescript
const cache = await getCachedVerifications(123);
```

#### `getOfflineVerifications()`
Gets offline verifications that need to be synced.

```typescript
const offlineVerifications = await getOfflineVerifications();
```

#### `syncOfflineVerifications(apiEndpoint, authToken)`
Syncs offline verifications with server.

```typescript
await syncOfflineVerifications('https://api.example.com', 'auth-token');
```

### Utility Functions

#### `getFaceRegistrationStatus(userId)`
Checks if user has face profile registered.

```typescript
const status = await getFaceRegistrationStatus(123);
console.log(`Registered: ${status.isRegistered}`);
```

#### `updateFaceProfile(userId, newFaceEncoding, newFaceData)`
Updates existing face profile with new data.

```typescript
await updateFaceProfile(123, newEncoding, newFaceData);
```

## Data Structures

### FaceVerificationResult
```typescript
interface FaceVerificationResult {
  success: boolean;
  confidence: number;
  livenessDetected: boolean;
  faceEncoding?: string;
  timestamp: Date;
}
```

### FaceRegistrationStatus
```typescript
interface FaceRegistrationStatus {
  isRegistered: boolean;
  registrationDate?: Date;
  lastVerification?: Date;
  verificationCount: number;
  isEnabled: boolean;
}
```

### StoredFaceProfile
```typescript
interface StoredFaceProfile {
  userId: number;
  faceEncodingHash: string;
  encryptedFaceData: string;
  registrationDate: string;
  lastUpdated: string;
  isActive: boolean;
  verificationCount: number;
}
```

## Configuration

### Constants
- `VERIFICATION_CONFIDENCE_THRESHOLD`: 0.7 (minimum confidence for successful verification)
- `FACE_ENCODING_DIMENSIONS`: 128 (dimensions of face encoding vector)
- `MAX_CACHED_VERIFICATIONS`: 100 (maximum cached verification results)
- `CACHE_EXPIRY_HOURS`: 24 (cache expiration time)

### Storage Keys
- `face_profile_`: Secure storage key for face profiles
- `face_encoding_`: Secure storage key for face encodings
- `verification_cache_`: AsyncStorage key for verification cache
- `offline_verifications`: AsyncStorage key for offline verifications

## Security Considerations

### Encryption
- Face data is encrypted using device-specific keys
- Keys are generated using Crypto.randomUUID() and stored in SecureStore
- XOR encryption is used (should be replaced with AES in production)

### Privacy
- No raw face images are stored, only mathematical encodings
- Face encodings are hashed for additional security
- Device fingerprinting for verification tracking
- Data can be completely deleted on user request

### Offline Security
- Offline verifications include device fingerprints
- Verification results are cached with expiration
- Sync process validates data integrity

## Usage Examples

### Basic Face Registration
```typescript
import { storeFaceProfile, generateFaceEncoding } from '../services/FaceVerificationService';

// After capturing face data and photo
const faceEncoding = await generateFaceEncoding(faceData, photo);
await storeFaceProfile(userId, faceEncoding, faceData);
```

### Face Verification Flow
```typescript
import { verifyFace, getFaceRegistrationStatus } from '../services/FaceVerificationService';

// Check if user has face registered
const status = await getFaceRegistrationStatus(userId);
if (!status.isRegistered) {
  // Redirect to registration
  return;
}

// Perform verification
try {
  const result = await verifyFace(userId, faceData, photo, livenessDetected);
  
  if (result.success) {
    // Verification successful
    console.log(`Verified with ${(result.confidence * 100).toFixed(1)}% confidence`);
  } else {
    // Verification failed
    console.log('Face verification failed');
  }
} catch (error) {
  // Handle verification error
  console.error('Verification error:', error);
}
```

### Sync Offline Data
```typescript
import { syncOfflineVerifications, getOfflineVerifications } from '../services/FaceVerificationService';

// Check for offline verifications
const offlineCount = (await getOfflineVerifications()).length;
console.log(`${offlineCount} offline verifications pending sync`);

// Sync when online
if (isOnline) {
  await syncOfflineVerifications(API_ENDPOINT, authToken);
}
```

## Error Handling

The service throws `FaceVerificationError` objects with the following structure:

```typescript
interface FaceVerificationError {
  type: FaceVerificationErrorType;
  message: string;
  retryable: boolean;
  suggestions: string[];
}
```

Common error types:
- `NO_FACE_DETECTED`: No face found in image
- `POOR_LIGHTING`: Insufficient lighting for verification
- `LOW_CONFIDENCE`: Face match confidence below threshold
- `STORAGE_ERROR`: Error accessing secure storage
- `NETWORK_ERROR`: Network connectivity issues

## Performance Considerations

### Memory Management
- Face encodings are stored as compressed base64 strings
- Verification cache is limited to prevent memory bloat
- Offline verifications are pruned to maintain reasonable storage

### Battery Optimization
- Minimal processing for face encoding generation
- Cached results reduce repeated computations
- Offline capability reduces network usage

### Storage Efficiency
- Face encodings are compressed using Float32Array
- Expired cache entries are automatically cleaned
- Device fingerprints prevent duplicate storage

## Integration with Other Components

This service is designed to work with:
- `useFaceDetection` hook for face detection
- `useCameraLiveness` hook for liveness detection
- `FaceVerificationModal` component for UI
- `VerificationOrchestrator` for workflow management

## Future Enhancements

- Replace XOR encryption with AES-256
- Implement proper face recognition algorithms
- Add biometric template protection
- Support for multiple face profiles per user
- Advanced liveness detection integration
- Biometric authentication standards compliance