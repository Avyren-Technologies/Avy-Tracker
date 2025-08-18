# OTP Verification API Documentation

## Overview

The OTP Verification API provides secure one-time password functionality for user authentication and verification purposes. This API is designed to work with the Enhanced ShiftTracker face verification system.

## Base URL

```
/api/otp
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

- **Generate/Resend**: 3 requests per 15 minutes per user
- **Verify**: 10 requests per 15 minutes per user
- **Invalidate**: No rate limiting

## Endpoints

### 1. Generate OTP

**POST** `/api/otp/generate`

Generates and sends an OTP to the user's registered phone number.

#### Request Body

```json
{
  "purpose": "face-settings-access"
}
```

#### Allowed Purposes

- `face-settings-access` - Access face configuration settings
- `profile-update` - Update user profile
- `security-verification` - General security verification
- `password-reset` - Password reset verification
- `account-verification` - Account verification

#### Response

**Success (200)**
```json
{
  "success": true,
  "message": "OTP sent successfully to your registered phone number.",
  "expiresAt": "2024-12-01T12:05:00.000Z",
  "phoneNumber": "123****890",
  "purpose": "face-settings-access",
  "processingTime": 1250
}
```

**Error (400)**
```json
{
  "success": false,
  "message": "Too many OTP requests. Please wait 15 minutes before trying again.",
  "error": "OTP generation failed",
  "code": "GENERATION_FAILED"
}
```

**Rate Limited (429)**
```json
{
  "error": "Too many OTP requests",
  "message": "Maximum 3 requests allowed per 15 minutes",
  "retryAfter": 847,
  "code": "RATE_LIMIT_EXCEEDED"
}
```

### 2. Verify OTP

**POST** `/api/otp/verify`

Verifies the provided OTP code against the stored hash.

#### Request Body

```json
{
  "otp": "123456",
  "purpose": "face-settings-access"
}
```

#### Response

**Success (200)**
```json
{
  "success": true,
  "message": "OTP verified successfully.",
  "purpose": "face-settings-access",
  "verifiedAt": "2024-12-01T12:04:30.000Z",
  "processingTime": 890
}
```

**Verification Failed (400)**
```json
{
  "success": false,
  "message": "Invalid OTP. 2 attempts remaining.",
  "remainingAttempts": 2,
  "purpose": "face-settings-access",
  "error": "OTP verification failed",
  "code": "VERIFICATION_FAILED"
}
```

**Account Locked (423)**
```json
{
  "success": false,
  "message": "Maximum verification attempts exceeded. Please request a new OTP.",
  "lockoutUntil": "2024-12-01T12:19:30.000Z",
  "purpose": "face-settings-access",
  "error": "OTP verification failed",
  "code": "ACCOUNT_LOCKED"
}
```

### 3. Resend OTP

**POST** `/api/otp/resend`

Resends OTP to the user's registered phone number.

#### Request Body

```json
{
  "purpose": "face-settings-access"
}
```

#### Response

**Success (200)**
```json
{
  "success": true,
  "message": "OTP resent successfully",
  "expiresAt": "2024-12-01T12:05:00.000Z",
  "purpose": "face-settings-access",
  "resentAt": "2024-12-01T12:00:00.000Z",
  "processingTime": 1100
}
```

**Error (400)**
```json
{
  "success": false,
  "message": "No previous OTP request found. Please request a new OTP.",
  "error": "OTP resend failed",
  "code": "RESEND_FAILED"
}
```

### 4. Invalidate OTP

**DELETE** `/api/otp/invalidate`

Invalidates all pending OTPs for a specific purpose.

#### Request Body

```json
{
  "purpose": "face-settings-access"
}
```

#### Response

**Success (200)**
```json
{
  "success": true,
  "message": "OTP invalidated successfully",
  "purpose": "face-settings-access",
  "invalidatedAt": "2024-12-01T12:00:00.000Z",
  "processingTime": 450
}
```

### 5. Health Check

**GET** `/api/otp/health`

Returns the health status of the OTP service.

#### Response

**Success (200)**
```json
{
  "status": "healthy",
  "service": "OTP Verification API",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 6. Status (Development Only)

**GET** `/api/otp/status?purpose=face-settings-access`

Returns OTP status for debugging purposes. Only available in development environment.

#### Query Parameters

- `purpose` (required) - The OTP purpose to check

#### Response

**Success (200)**
```json
{
  "userId": 1,
  "purpose": "face-settings-access",
  "records": [
    {
      "id": 123,
      "purpose": "face-settings-access",
      "expires_at": "2024-12-01T12:05:00.000Z",
      "verified": true,
      "attempts": 1,
      "max_attempts": 3,
      "created_at": "2024-12-01T12:00:00.000Z",
      "verified_at": "2024-12-01T12:01:00.000Z",
      "invalidated_at": null
    }
  ],
  "processingTime": 120
}
```

**Production (404)**
```json
{
  "error": "Endpoint not available in production",
  "code": "NOT_AVAILABLE"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_PURPOSE` | Purpose parameter is required |
| `INVALID_PURPOSE` | Purpose is not in allowed list |
| `MISSING_OTP` | OTP code is required |
| `INVALID_OTP_FORMAT` | OTP must be 6 digits |
| `USER_NOT_FOUND` | User account not found |
| `PHONE_NOT_FOUND` | No phone number registered |
| `GENERATION_FAILED` | OTP generation failed |
| `VERIFICATION_FAILED` | OTP verification failed |
| `ACCOUNT_LOCKED` | Account locked due to failed attempts |
| `RESEND_FAILED` | OTP resend failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |

## Security Features

### Rate Limiting
- Prevents brute force attacks
- User-specific and IP-based limiting
- Configurable limits per endpoint

### OTP Security
- 6-digit cryptographically secure random codes
- 5-minute expiry time
- Maximum 3 verification attempts
- Secure bcrypt hashing for storage
- Automatic cleanup of expired OTPs

### Device Fingerprinting
- Tracks device information for security
- IP address and User-Agent logging
- Audit trail for all operations

### Data Protection
- No plain-text OTP storage
- Encrypted device fingerprints
- Comprehensive audit logging
- GDPR compliant data handling

## Integration with Face Verification

The OTP system is designed to work seamlessly with the face verification system:

1. **Settings Access**: Users must verify OTP before accessing face configuration settings
2. **Profile Updates**: OTP verification required for face profile updates
3. **Security Verification**: Additional security layer for sensitive operations
4. **Session Management**: 30-minute authenticated session after successful OTP verification

## Usage Examples

### JavaScript/TypeScript

```typescript
// Generate OTP
const generateResponse = await fetch('/api/otp/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    purpose: 'face-settings-access'
  })
});

// Verify OTP
const verifyResponse = await fetch('/api/otp/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    otp: '123456',
    purpose: 'face-settings-access'
  })
});
```

### React Native

```typescript
import axios from 'axios';

const otpService = {
  async generateOTP(purpose: string) {
    const response = await axios.post('/api/otp/generate', 
      { purpose },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  async verifyOTP(otp: string, purpose: string) {
    const response = await axios.post('/api/otp/verify',
      { otp, purpose },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }
};
```

## Testing

The API includes comprehensive error handling and validation:

- Input validation for all parameters
- Proper HTTP status codes
- Detailed error messages
- Rate limiting enforcement
- Security audit logging

## Monitoring

All operations are logged with:
- Request/response details
- Processing times
- Error conditions
- Security events
- Performance metrics

This enables comprehensive monitoring and debugging of the OTP verification system.