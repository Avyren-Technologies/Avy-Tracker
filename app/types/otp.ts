// OTP Verification Types

export interface OTPVerificationProps {
  visible: boolean;
  purpose: string;
  phoneNumber?: string;
  onSuccess: (data: OTPVerificationResult) => void;
  onError: (error: OTPError) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  maxAttempts?: number;
  expiryMinutes?: number;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  verifiedAt: string;
  purpose: string;
}

export interface OTPError {
  error: string;
  message: string;
  code: string;
  remainingAttempts?: number;
  lockoutUntil?: string;
}

export interface OTPGenerationResponse {
  success: boolean;
  message: string;
  code?: string;
  error?: string;
  expiresAt?: string;
  phoneNumber?: string;
  purpose: string;
  processingTime?: number;
  otpId?: string;
}

export interface OTPVerificationResponse {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  lockoutUntil?: string;
  purpose: string;
  verifiedAt?: string;
  processingTime?: number;
}

export interface OTPResendResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
  purpose: string;
  resentAt: string;
  processingTime?: number;
  otpId?: string;
}

export interface OTPState {
  isLoading: boolean;
  isVerifying: boolean;
  isResending: boolean;
  otp: string;
  timeRemaining: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  success: boolean;
  canResend: boolean;
  isLocked: boolean;
  lockoutUntil: Date | null;
}

export type OTPPurpose = 
  | 'face-settings-access'
  | 'profile-update'
  | 'security-verification'
  | 'password-reset'
  | 'account-verification';