# OTP Verification Component

A comprehensive React Native component for OTP (One-Time Password) verification with enhanced security features, accessibility support, and user experience optimizations.

## Features

### Core Functionality
- ✅ **6-digit OTP input** with auto-focus navigation
- ✅ **Auto-verification** when all digits are entered
- ✅ **Countdown timer** with 5-minute expiry
- ✅ **Resend functionality** with rate limiting
- ✅ **Attempt tracking** with lockout mechanism
- ✅ **Error handling** with user-friendly messages

### Security Features
- ✅ **Rate limiting** protection against abuse
- ✅ **Attempt limiting** (3 attempts by default)
- ✅ **Account lockout** after max attempts exceeded
- ✅ **Secure API integration** with JWT authentication
- ✅ **Input validation** (digits only)

### User Experience
- ✅ **Auto-focus** first input on modal open
- ✅ **Smart navigation** between input fields
- ✅ **Backspace handling** for intuitive editing
- ✅ **Visual feedback** for success/error states
- ✅ **Vibration feedback** for success/error
- ✅ **Loading states** with activity indicators

### Accessibility
- ✅ **Screen reader support** with proper labels
- ✅ **Accessibility announcements** for state changes
- ✅ **Keyboard navigation** support
- ✅ **High contrast** support
- ✅ **Focus management** for assistive technologies

### Theme Support
- ✅ **Dark/Light theme** automatic switching
- ✅ **Dynamic colors** based on theme
- ✅ **Consistent styling** with app theme

## Usage

### Basic Usage

```tsx
import React, { useState } from 'react';
import OTPVerification from '../components/OTPVerification';
import { OTPVerificationResult, OTPError } from '../types/otp';

export default function MyComponent() {
  const [showOTP, setShowOTP] = useState(false);

  const handleSuccess = (data: OTPVerificationResult) => {
    console.log('OTP verified:', data);
    setShowOTP(false);
    // Handle successful verification
  };

  const handleError = (error: OTPError) => {
    console.error('OTP error:', error);
    // Handle verification error
  };

  const handleCancel = () => {
    setShowOTP(false);
    // Handle user cancellation
  };

  return (
    <OTPVerification
      visible={showOTP}
      purpose="face-settings-access"
      onSuccess={handleSuccess}
      onError={handleError}
      onCancel={handleCancel}
    />
  );
}
```

### Advanced Usage

```tsx
<OTPVerification
  visible={showOTP}
  purpose="security-verification"
  phoneNumber="+91 98765 43210"
  onSuccess={handleSuccess}
  onError={handleError}
  onCancel={handleCancel}
  title="Security Verification"
  subtitle="Enter the code sent to your registered phone"
  maxAttempts={5}
  expiryMinutes={10}
/>
```

## Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `visible` | `boolean` | Controls modal visibility |
| `purpose` | `string` | OTP purpose (see OTPPurpose type) |
| `onSuccess` | `(data: OTPVerificationResult) => void` | Success callback |
| `onError` | `(error: OTPError) => void` | Error callback |
| `onCancel` | `() => void` | Cancel callback |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `phoneNumber` | `string` | - | Display phone number (masked) |
| `title` | `string` | "OTP Verification" | Modal title |
| `subtitle` | `string` | "Enter the verification code..." | Modal subtitle |
| `maxAttempts` | `number` | `3` | Maximum verification attempts |
| `expiryMinutes` | `number` | `5` | OTP expiry time in minutes |

## Types

### OTPPurpose
```tsx
type OTPPurpose = 
  | 'face-settings-access'
  | 'profile-update'
  | 'security-verification'
  | 'password-reset'
  | 'account-verification';
```

### OTPVerificationResult
```tsx
interface OTPVerificationResult {
  success: boolean;
  message: string;
  verifiedAt: string;
  purpose: string;
}
```

### OTPError
```tsx
interface OTPError {
  error: string;
  message: string;
  code: string;
  remainingAttempts?: number;
  lockoutUntil?: string;
}
```

## API Integration

The component integrates with the following backend endpoints:

### Generate OTP
```
POST /api/otp/generate
Body: { purpose: string }
```

### Verify OTP
```
POST /api/otp/verify
Body: { otp: string, purpose: string }
```

### Resend OTP
```
POST /api/otp/resend
Body: { purpose: string }
```

## State Management

The component manages internal state for:

- **Loading states** (generating, verifying, resending)
- **OTP input** (6-digit string)
- **Timer countdown** (seconds remaining)
- **Attempt tracking** (current attempts vs max)
- **Error handling** (error messages and codes)
- **Success state** (verification completed)
- **Lockout state** (account temporarily locked)

## Error Handling

### Common Error Scenarios

1. **Invalid OTP**: Wrong code entered
2. **Expired OTP**: Code expired (5 minutes)
3. **Max Attempts**: Too many failed attempts
4. **Rate Limited**: Too many requests
5. **Network Error**: API request failed
6. **Account Locked**: Temporary lockout active

### Error Codes

- `AUTH_REQUIRED`: User not authenticated
- `GENERATION_FAILED`: OTP generation failed
- `VERIFICATION_FAILED`: OTP verification failed
- `ACCOUNT_LOCKED`: Account temporarily locked
- `NETWORK_ERROR`: Network/API error
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Accessibility Features

### Screen Reader Support
- Proper accessibility labels for all inputs
- Role definitions for interactive elements
- Announcements for state changes
- Alert roles for error messages

### Keyboard Navigation
- Tab order management
- Focus management between inputs
- Backspace navigation support

### Visual Accessibility
- High contrast color support
- Clear visual feedback
- Appropriate font sizes
- Color-blind friendly indicators

## Testing

### Test File Location
```
app/(testing)/otp-verification-test.tsx
```

### Test Scenarios
1. **Face Settings Access** - Test OTP for face configuration
2. **Profile Update** - Test OTP for profile changes
3. **Security Verification** - Test general security OTP

### Manual Testing
1. Open test screen
2. Select test scenario
3. Enter OTP (check console for mock code)
4. Test error scenarios with wrong codes
5. Test resend functionality
6. Test accessibility with screen reader

## Security Considerations

### Client-Side Security
- Input validation (digits only)
- No OTP storage in component state after verification
- Automatic cleanup on component unmount
- Rate limiting awareness

### Server-Side Integration
- JWT authentication required
- Rate limiting on API endpoints
- Secure OTP generation and storage
- Audit logging for verification attempts

## Performance Optimizations

### Memory Management
- Automatic cleanup of timers
- Component unmount handling
- Ref cleanup on unmount

### Network Efficiency
- Debounced API calls
- Error retry logic
- Connection state awareness

### Battery Optimization
- Minimal timer usage
- Efficient re-renders
- Conditional effect execution

## Requirements Mapping

This component satisfies the following requirements:

- **Requirement 4.2**: OTP request and validation within 5-minute window
- **Requirement 4.3**: OTP input field with auto-focus and validation
- **Requirement 4.4**: Countdown timer for OTP expiry
- **Requirement 4.5**: Error handling, retry logic, and attempt limiting

## Future Enhancements

### Planned Features
- [ ] Biometric fallback option
- [ ] Custom OTP length support
- [ ] Multiple delivery methods (SMS, Email)
- [ ] Offline OTP support
- [ ] Custom styling props
- [ ] Animation customization

### Performance Improvements
- [ ] Virtualized input rendering
- [ ] Background OTP validation
- [ ] Predictive text handling
- [ ] Enhanced error recovery

## Dependencies

### Required Dependencies
- `react-native`
- `@expo/vector-icons`
- `react-native-reanimated` (for animations)

### Optional Dependencies
- `react-native-haptic-feedback` (enhanced vibration)
- `react-native-keychain` (secure storage)

## Troubleshooting

### Common Issues

1. **OTP not received**: Check backend SMS service configuration
2. **Auto-focus not working**: Ensure proper ref management
3. **Timer not updating**: Check component mount state
4. **Accessibility issues**: Test with screen reader enabled
5. **Theme not applied**: Verify theme context availability

### Debug Mode

Enable debug logging by setting:
```tsx
const DEBUG_OTP = __DEV__ && true;
```

This will log:
- API requests and responses
- State changes
- Timer updates
- Error details