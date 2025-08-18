# Face Configuration Screen

## Overview

The Face Configuration screen provides a secure interface for employees to manage their biometric face profiles. It implements OTP-based access control and comprehensive face profile management functionality.

## Features

### 1. OTP Verification Gate
- **Secure Access**: Requires OTP verification before accessing face settings
- **Purpose-based OTP**: Uses 'face_configuration_access' purpose for verification
- **User-friendly Interface**: Clear explanation of why OTP is required

### 2. Face Profile Status Display
- **Registration Status**: Shows whether face profile is registered
- **Profile Activity**: Displays if profile is active/inactive
- **Registration Date**: Shows when profile was first registered
- **Last Verification**: Displays last successful verification timestamp
- **Verification Count**: Shows total number of verifications performed

### 3. Face Profile Management
- **Initial Registration**: Register face profile for first-time users
- **Profile Update**: Re-register face profile with new biometric data
- **Profile Deletion**: Permanently delete face profile and all biometric data
- **Confirmation Dialogs**: Secure confirmation for destructive actions

### 4. Privacy & Security Information
- **Data Encryption**: Information about biometric data security
- **Local Processing**: Explanation of local face processing
- **Data Deletion Rights**: User control over biometric data
- **Purpose Limitation**: Clear statement of data usage

## Usage

```typescript
import FaceConfiguration from '../screens/FaceConfiguration';

// Navigate to face configuration
router.push('/screens/FaceConfiguration');
```

## API Integration

### Face Profile Status
```typescript
GET /api/face-verification/status
Authorization: Bearer <token>

Response:
{
  isRegistered: boolean;
  registrationDate?: string;
  lastVerification?: string;
  verificationCount: number;
  isActive: boolean;
}
```

### Delete Face Profile
```typescript
DELETE /api/face-verification/profile
Authorization: Bearer <token>

Response:
{
  message: "Face profile deleted successfully"
}
```

## Security Features

### 1. OTP Access Control
- Requires OTP verification before accessing sensitive settings
- Session-based access (30-minute timeout)
- Purpose-specific OTP validation

### 2. Confirmation Dialogs
- Destructive actions require explicit confirmation
- Clear warning messages for irreversible operations
- Visual indicators for dangerous actions

### 3. Data Protection
- No raw biometric data display
- Secure API communication
- Proper error handling without data leakage

## Component Structure

### Main Components
- **OTP Gate**: Initial security verification
- **Status Card**: Face profile information display
- **Actions Card**: Profile management controls
- **Privacy Card**: Security and privacy information

### Modals
- **OTP Verification Modal**: Secure identity verification
- **Face Verification Modal**: Face registration/update interface
- **Confirmation Modal**: Action confirmation dialogs

## State Management

### Key State Variables
```typescript
const [isOTPVerified, setIsOTPVerified] = useState(false);
const [faceProfileStatus, setFaceProfileStatus] = useState<FaceProfileStatus | null>(null);
const [showFaceModal, setShowFaceModal] = useState(false);
const [faceModalMode, setFaceModalMode] = useState<'register' | 'update'>('register');
```

### Status Interface
```typescript
interface FaceProfileStatus {
  isRegistered: boolean;
  registrationDate?: string;
  lastVerification?: string;
  verificationCount: number;
  isActive: boolean;
}
```

## Error Handling

### Network Errors
- Graceful handling of API failures
- User-friendly error messages
- Retry mechanisms where appropriate

### Validation Errors
- Input validation feedback
- Clear error descriptions
- Guided error resolution

## Accessibility

### Screen Reader Support
- Semantic labels for all interactive elements
- Status announcements for state changes
- Clear navigation structure

### Visual Accessibility
- High contrast color schemes
- Appropriate font sizes
- Clear visual hierarchy

## Theme Support

### Light/Dark Mode
- Automatic theme detection
- Consistent color schemes
- Proper contrast ratios

### Color Variables
```typescript
const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
const cardColor = useThemeColor('#ffffff', '#1e293b');
const textColor = useThemeColor('#0f172a', '#f1f5f9');
const successColor = useThemeColor('#10b981', '#34d399');
const errorColor = useThemeColor('#ef4444', '#f87171');
```

## Requirements Mapping

### Requirement 2.4 - Face Configuration Settings
✅ OTP verification gate for settings access
✅ Face profile management interface
✅ Status display and controls

### Requirement 2.5 - Profile Management
✅ View face profile status
✅ Update face profile functionality
✅ Profile deletion capability

### Requirement 2.6 - Face Re-registration
✅ Face profile update workflow
✅ Confirmation dialogs for updates
✅ Success/error handling

### Requirement 2.7 - Biometric Data Deletion
✅ Complete profile deletion
✅ Confirmation for destructive actions
✅ Permanent data removal

### Requirement 4.1 - OTP Security Gate
✅ OTP verification before access
✅ Purpose-specific OTP validation
✅ Session-based access control

### Requirement 4.4 - OTP Session Management
✅ 30-minute session timeout
✅ Re-authentication for sensitive operations
✅ Secure session handling

## Testing

### Unit Tests
- Component rendering
- State management
- API integration
- Error handling

### Integration Tests
- OTP verification flow
- Face profile management
- Modal interactions
- Navigation flow

### Security Tests
- Access control validation
- Data protection verification
- Session management testing
- Error boundary testing

## Performance Considerations

### Optimization
- Lazy loading of face status
- Efficient re-renders
- Memory management
- Network request optimization

### User Experience
- Loading states
- Progress indicators
- Smooth animations
- Responsive design

This Face Configuration screen provides a comprehensive and secure interface for biometric profile management while maintaining excellent user experience and security standards.