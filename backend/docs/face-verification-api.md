# Face Verification API Documentation

## Overview

The Face Verification API provides secure biometric authentication endpoints for the Enhanced ShiftTracker system. All endpoints require user authentication and implement comprehensive security measures including rate limiting, account locking, and audit logging.

## Base URL

```
/api/face-verification
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Register Face Profile

**POST** `/register`

Register a new face profile for the authenticated user.

#### Request Body

```json
{
  "faceEncoding": "[0.1, 0.2, 0.3, ...]",  // JSON array of face encoding values
  "consentGiven": true,                     // Required: User consent for biometric data
  "qualityScore": 0.85,                     // Optional: Face image quality (0-1)
  "deviceInfo": {                           // Optional: Device information
    "userAgent": "string",
    "platform": "string",
    "screenResolution": "string",
    "timezone": "string",
    "language": "string",
    "deviceModel": "string"
  }
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Face profile registered successfully",
  "profileId": 123,
  "registrationDate": "2024-01-01T00:00:00.000Z",
  "qualityScore": 0.85,
  "processingTime": 150
}
```

#### Error Responses

- **400 Bad Request**: Invalid face encoding, missing consent, or invalid quality score
- **409 Conflict**: Face profile already exists for user
- **423 Locked**: Account temporarily locked due to security concerns
- **500 Internal Server Error**: Registration failed

### 2. Verify Face

**POST** `/verify`

Verify face against stored profile for shift operations.

#### Request Body

```json
{
  "faceEncoding": "[0.1, 0.2, 0.3, ...]",  // JSON array of face encoding values
  "verificationType": "start",              // Required: "start", "end", or "test"
  "livenessDetected": true,                 // Optional: Liveness detection result
  "livenessScore": 0.88,                    // Optional: Liveness confidence (0-1)
  "shiftId": 456,                           // Optional: Associated shift ID
  "deviceInfo": {},                         // Optional: Device information
  "locationData": {                         // Optional: GPS coordinates
    "latitude": 40.7128,
    "longitude": -74.0060,
    "accuracy": 10
  },
  "qualityScore": 0.90,                     // Optional: Face image quality (0-1)
  "lightingConditions": "good"              // Optional: "poor", "fair", "good", "excellent"
}
```

#### Response (200 OK - Success)

```json
{
  "success": true,
  "confidence": 0.92,
  "livenessDetected": true,
  "livenessScore": 0.88,
  "verificationId": 789,
  "processingTime": 120,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Response (401 Unauthorized - Failed)

```json
{
  "success": false,
  "confidence": 0.45,
  "livenessDetected": false,
  "verificationId": 790,
  "failureReason": "Face does not match registered profile",
  "error": "Face verification failed",
  "code": "VERIFICATION_FAILED",
  "processingTime": 110,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Error Responses

- **400 Bad Request**: Invalid face encoding or verification type
- **404 Not Found**: No face profile found for user
- **423 Locked**: Account temporarily locked due to failed attempts
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Verification failed

### 3. Get Face Verification Status

**GET** `/status`

Get face registration status and verification statistics for the authenticated user.

#### Query Parameters

None required.

#### Response (200 OK)

```json
{
  "registered": true,
  "active": true,
  "registrationDate": "2024-01-01T00:00:00.000Z",
  "verificationCount": 25,
  "lastVerification": "2024-01-02T00:00:00.000Z",
  "qualityScore": 0.85,
  "isLocked": false,
  "statistics": {
    "totalAttempts": 30,
    "successfulAttempts": 25,
    "failedAttempts": 5,
    "averageConfidence": 0.87,
    "averageSuccessConfidence": 0.91,
    "livenessDetectedCount": 22
  },
  "processingTime": 45
}
```

#### Error Responses

- **404 Not Found**: User not found
- **500 Internal Server Error**: Failed to get status

### 4. Delete Face Profile

**DELETE** `/profile`

Delete the face profile for the authenticated user.

#### Request Body

None required.

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Face profile deleted successfully",
  "deletedAt": "2024-01-01T00:00:00.000Z",
  "processingTime": 80
}
```

#### Error Responses

- **404 Not Found**: No face profile found for user
- **500 Internal Server Error**: Deletion failed

### 5. Update Face Profile

**PUT** `/update`

Update existing face profile with new face encoding.

#### Request Body

```json
{
  "faceEncoding": "[0.1, 0.2, 0.3, ...]",  // JSON array of face encoding values
  "qualityScore": 0.90,                     // Optional: Face image quality (0-1)
  "updateReason": "Better quality image",   // Optional: Reason for update
  "deviceInfo": {}                          // Optional: Device information
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Face profile updated successfully",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "qualityScore": 0.90,
  "updateReason": "Better quality image",
  "processingTime": 130
}
```

#### Error Responses

- **400 Bad Request**: Invalid face encoding or quality score
- **404 Not Found**: No active face profile found
- **423 Locked**: Account temporarily locked
- **500 Internal Server Error**: Update failed

### 6. Get Security Report

**GET** `/security-report`

Get comprehensive security report for the authenticated user.

#### Query Parameters

- `days` (optional): Number of days to include in report (1-365, default: 30)

#### Response (200 OK)

```json
{
  "verificationStats": {
    "total_attempts": 50,
    "successful_attempts": 45,
    "failed_attempts": 5,
    "avg_confidence": 0.89,
    "avg_success_confidence": 0.92,
    "liveness_detected_count": 42
  },
  "devices": [
    {
      "fingerprint_hash": "abc123...",
      "device_info": {},
      "is_trusted": true,
      "risk_score": 10,
      "first_seen": "2024-01-01T00:00:00.000Z",
      "last_seen": "2024-01-02T00:00:00.000Z"
    }
  ],
  "securityEvents": [
    {
      "action_type": "profile_created",
      "action_details": {},
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "userStatus": {
    "face_registered": true,
    "face_enabled": true,
    "face_verification_failures": 0,
    "face_locked_until": null,
    "last_face_verification": "2024-01-02T00:00:00.000Z"
  },
  "reportGeneratedAt": "2024-01-02T00:00:00.000Z",
  "processingTime": 200
}
```

#### Error Responses

- **400 Bad Request**: Invalid days parameter
- **500 Internal Server Error**: Report generation failed

### 7. Unlock User Account (Admin Only)

**POST** `/unlock/:userId`

Unlock a user account that has been locked due to failed verification attempts.

**Permissions Required**: Management or Super Admin role

#### Path Parameters

- `userId`: ID of the user to unlock

#### Request Body

None required.

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User unlocked successfully",
  "targetUserId": 123,
  "performedBy": 456,
  "unlockedAt": "2024-01-01T00:00:00.000Z",
  "processingTime": 90
}
```

#### Error Responses

- **400 Bad Request**: Invalid user ID
- **403 Forbidden**: Insufficient permissions or cross-company access denied
- **404 Not Found**: Target user not found
- **500 Internal Server Error**: Unlock failed

## Error Codes

| Code | Description |
|------|-------------|
| `CONSENT_REQUIRED` | Biometric consent is required for face registration |
| `INVALID_FACE_ENCODING` | Face encoding is required and must be a string |
| `INVALID_FACE_ENCODING_FORMAT` | Face encoding must be a valid JSON array |
| `INVALID_FACE_ENCODING_JSON` | Face encoding must be valid JSON |
| `INVALID_QUALITY_SCORE` | Quality score must be between 0 and 1 |
| `INVALID_VERIFICATION_TYPE` | Verification type must be start, end, or test |
| `INVALID_LIVENESS_SCORE` | Liveness score must be between 0 and 1 |
| `ACCOUNT_LOCKED` | Account temporarily locked due to security concerns |
| `PROFILE_EXISTS` | Face profile already exists for this user |
| `VERIFICATION_FAILED` | Face verification failed |
| `PROFILE_NOT_FOUND` | No face profile found for user |
| `RATE_LIMIT_EXCEEDED` | Too many verification attempts |
| `USER_NOT_FOUND` | User not found |
| `INSUFFICIENT_PERMISSIONS` | Management or Super Admin role required |
| `CROSS_COMPANY_ACCESS_DENIED` | Cannot access users from different companies |
| `INVALID_USER_ID` | Invalid user ID |
| `INVALID_DAYS_PARAMETER` | Days parameter must be between 1 and 365 |

## Security Features

### Rate Limiting
- Maximum 10 verification requests per minute per user
- Automatic lockout after 3 failed verification attempts
- 15-minute lockout duration for security breaches

### Audit Logging
- All verification attempts are logged with detailed metadata
- Security events are tracked for compliance
- Device fingerprinting for fraud detection
- IP address and user agent logging

### Data Protection
- Face encodings are encrypted using AES-256-CBC
- Device-specific encryption keys
- Secure deletion of biometric data
- No storage of actual face images

### Access Control
- JWT-based authentication required for all endpoints
- Role-based access for administrative functions
- Company-based data isolation
- User consent tracking for biometric data

## Integration Examples

### JavaScript/TypeScript

```javascript
// Register face profile
const registerFace = async (faceEncoding, deviceInfo) => {
  const response = await fetch('/api/face-verification/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      faceEncoding: JSON.stringify(faceEncoding),
      consentGiven: true,
      deviceInfo
    })
  });
  
  return await response.json();
};

// Verify face for shift start
const verifyFaceForShift = async (faceEncoding, shiftId) => {
  const response = await fetch('/api/face-verification/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      faceEncoding: JSON.stringify(faceEncoding),
      verificationType: 'start',
      shiftId,
      livenessDetected: true
    })
  });
  
  return await response.json();
};
```

### React Native

```javascript
import { SecureStore } from 'expo-secure-store';

const FaceVerificationService = {
  async registerFace(faceEncoding, deviceInfo) {
    const token = await SecureStore.getItemAsync('authToken');
    
    const response = await fetch(`${API_URL}/api/face-verification/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        faceEncoding: JSON.stringify(faceEncoding),
        consentGiven: true,
        deviceInfo
      })
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${response.status}`);
    }
    
    return await response.json();
  },
  
  async verifyFace(faceEncoding, verificationType, shiftId) {
    const token = await SecureStore.getItemAsync('authToken');
    
    const response = await fetch(`${API_URL}/api/face-verification/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        faceEncoding: JSON.stringify(faceEncoding),
        verificationType,
        shiftId,
        livenessDetected: true
      })
    });
    
    return await response.json();
  }
};
```

## Testing

The API includes comprehensive error handling and validation. Test with various scenarios:

1. **Valid Registration**: Test with proper face encoding and consent
2. **Invalid Data**: Test with malformed face encodings
3. **Rate Limiting**: Test with rapid successive requests
4. **Account Locking**: Test with multiple failed verifications
5. **Permissions**: Test admin endpoints with different user roles

## Monitoring

All endpoints include:
- Processing time tracking
- Comprehensive request/response logging
- Error tracking with stack traces
- Security event monitoring
- Performance metrics

Monitor logs for:
- High failure rates
- Unusual verification patterns
- Security events
- Performance degradation
- Rate limit violations