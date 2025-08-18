# OTP Verification Component - Usage Examples

## Basic Implementation

### 1. Import the Component

```tsx
import React, { useState } from 'react';
import OTPVerification from '../components/OTPVerification';
import { OTPVerificationResult, OTPError } from '../types/otp';
```

### 2. Basic Usage Example

```tsx
export default function MyScreen() {
  const [showOTP, setShowOTP] = useState(false);

  const handleOTPSuccess = (data: OTPVerificationResult) => {
    console.log('OTP verified successfully:', data);
    setShowOTP(false);
    // Proceed with the action that required OTP verification
    navigateToSecureArea();
  };

 