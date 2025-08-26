/**
 * Face Verification Error Types and Handling
 * Comprehensive error definitions with user-friendly messages and recovery suggestions
 */

export enum FaceVerificationErrorType {
  // Camera and Hardware Errors
  CAMERA_PERMISSION_DENIED = 'CAMERA_PERMISSION_DENIED',
  CAMERA_NOT_AVAILABLE = 'CAMERA_NOT_AVAILABLE',
  CAMERA_INITIALIZATION_FAILED = 'CAMERA_INITIALIZATION_FAILED',
  CAMERA_HARDWARE_ERROR = 'CAMERA_HARDWARE_ERROR',
  
  // Face Detection Errors
  NO_FACE_DETECTED = 'NO_FACE_DETECTED',
  MULTIPLE_FACES = 'MULTIPLE_FACES',
  FACE_TOO_SMALL = 'FACE_TOO_SMALL',
  FACE_TOO_LARGE = 'FACE_TOO_LARGE',
  FACE_NOT_CENTERED = 'FACE_NOT_CENTERED',
  FACE_ANGLE_INVALID = 'FACE_ANGLE_INVALID',
  
  // Lighting and Quality Errors
  POOR_LIGHTING = 'POOR_LIGHTING',
  TOO_BRIGHT = 'TOO_BRIGHT',
  TOO_DARK = 'TOO_DARK',
  BLURRY_IMAGE = 'BLURRY_IMAGE',
  LOW_IMAGE_QUALITY = 'LOW_IMAGE_QUALITY',
  
  // Liveness Detection Errors
  NO_LIVENESS_DETECTED = 'NO_LIVENESS_DETECTED',
  LIVENESS_TIMEOUT = 'LIVENESS_TIMEOUT',
  INSUFFICIENT_MOVEMENT = 'INSUFFICIENT_MOVEMENT',
  FAKE_FACE_DETECTED = 'FAKE_FACE_DETECTED',
  
  // Verification Errors
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  FACE_NOT_REGISTERED = 'FACE_NOT_REGISTERED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  ENCODING_GENERATION_FAILED = 'ENCODING_GENERATION_FAILED',
  
  // Network and Storage Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  SYNC_ERROR = 'SYNC_ERROR',
  
  // Security and Rate Limiting
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  
  // System Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR'
}

export interface FaceVerificationError {
  type: FaceVerificationErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  code: string;
  details?: any;
  timestamp: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: FaceVerificationErrorType[];
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'manual' | 'skip';
  label: string;
  description?: string;
  action: () => Promise<void> | void;
  priority: number;
}

export interface ErrorHandlingConfig {
  retryConfig?: {
    maxAttempts: number;
    backoffMultiplier?: number;
    initialDelay?: number;
  };
  sessionId?: string;
  onError?: (error: FaceVerificationError) => void;
  onRetry?: (attempt: number, error: FaceVerificationError) => void;
  onRecovery?: (action: ErrorRecoveryAction) => void;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  attemptNumber?: number;
  deviceInfo?: any;
  networkStatus?: 'online' | 'offline';
  batteryLevel?: number;
  timestamp: Date;
}

// Error message templates with user-friendly guidance
export const ERROR_MESSAGES: Record<FaceVerificationErrorType, {
  message: string;
  userMessage: string;
  suggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = {
  [FaceVerificationErrorType.CAMERA_PERMISSION_DENIED]: {
    message: 'Camera permission denied by user',
    userMessage: 'Camera access is required for face verification',
    suggestions: [
      'Go to Settings > Privacy > Camera and enable access for this app',
      'Restart the app after granting permission',
      'Contact your administrator if you cannot grant permission'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.CAMERA_NOT_AVAILABLE]: {
    message: 'Camera hardware not available',
    userMessage: 'Camera is not available on this device',
    suggestions: [
      'Check if another app is using the camera',
      'Restart your device',
      'Try using a different device with a working camera'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.NO_FACE_DETECTED]: {
    message: 'No face detected in camera view',
    userMessage: 'Please position your face in the camera frame',
    suggestions: [
      'Make sure your face is clearly visible',
      'Remove any obstructions like masks or sunglasses',
      'Ensure adequate lighting on your face',
      'Move closer to the camera if you appear too small'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.MULTIPLE_FACES]: {
    message: 'Multiple faces detected in camera view',
    userMessage: 'Only one person should be visible during verification',
    suggestions: [
      'Make sure you are alone in the camera frame',
      'Ask others to step out of view',
      'Cover any photos or screens showing faces'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.POOR_LIGHTING]: {
    message: 'Insufficient lighting for face detection',
    userMessage: 'Better lighting is needed for verification',
    suggestions: [
      'Move to a well-lit area',
      'Face a window or light source',
      'Turn on room lights',
      'Avoid backlighting (light behind you)'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.NO_LIVENESS_DETECTED]: {
    message: 'Liveness detection failed - no eye blink detected',
    userMessage: 'Please blink naturally during verification',
    suggestions: [
      'Look directly at the camera',
      'Blink your eyes naturally',
      'Keep your eyes open and visible',
      'Remove glasses if they cause glare'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.VERIFICATION_FAILED]: {
    message: 'Face verification failed - face does not match registered profile',
    userMessage: 'Face verification unsuccessful',
    suggestions: [
      'Ensure you are the registered user',
      'Try again with better lighting',
      'Make sure your face is clearly visible',
      'Contact support if you continue having issues'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.NETWORK_ERROR]: {
    message: 'Network connection error during verification',
    userMessage: 'Connection problem - please try again',
    suggestions: [
      'Check your internet connection',
      'Try switching between WiFi and mobile data',
      'Move to an area with better signal',
      'The verification will retry automatically'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.TOO_MANY_ATTEMPTS]: {
    message: 'Maximum verification attempts exceeded',
    userMessage: 'Too many failed attempts - please wait before trying again',
    suggestions: [
      'Wait 15 minutes before trying again',
      'Contact your supervisor for manual override',
      'Ensure you follow the verification guidelines',
      'Check if your face profile needs updating'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.FACE_TOO_SMALL]: {
    message: 'Face appears too small in camera view',
    userMessage: 'Please move closer to the camera',
    suggestions: [
      'Move your device closer to your face',
      'Hold the device at arm\'s length',
      'Make sure your face fills about 70% of the frame'
    ],
    severity: 'low'
  },
  
  [FaceVerificationErrorType.FACE_TOO_LARGE]: {
    message: 'Face appears too large in camera view',
    userMessage: 'Please move further from the camera',
    suggestions: [
      'Hold your device further away',
      'Make sure your entire face is visible',
      'Leave some space around your face in the frame'
    ],
    severity: 'low'
  },
  
  [FaceVerificationErrorType.BLURRY_IMAGE]: {
    message: 'Image is too blurry for verification',
    userMessage: 'Please hold the device steady',
    suggestions: [
      'Keep your device and head still',
      'Wait for the camera to focus',
      'Clean your camera lens',
      'Ensure good lighting'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.CAMERA_INITIALIZATION_FAILED]: {
    message: 'Failed to initialize camera',
    userMessage: 'Camera setup failed - please try again',
    suggestions: [
      'Close and reopen the app',
      'Restart your device',
      'Check if other apps are using the camera',
      'Update the app if available'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.STORAGE_ERROR]: {
    message: 'Failed to access secure storage',
    userMessage: 'Storage access error - please try again',
    suggestions: [
      'Restart the app',
      'Check available storage space',
      'Contact support if the problem persists'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.TIMEOUT_ERROR]: {
    message: 'Verification process timed out',
    userMessage: 'Verification took too long - please try again',
    suggestions: [
      'Try again with better lighting',
      'Ensure your face is clearly visible',
      'Check your internet connection',
      'Make sure you blink during verification'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.SERVER_ERROR]: {
    message: 'Server error during verification',
    userMessage: 'Server temporarily unavailable',
    suggestions: [
      'Please try again in a few moments',
      'Check your internet connection',
      'Contact support if the problem persists'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.FACE_NOT_REGISTERED]: {
    message: 'No face profile found for user',
    userMessage: 'Face profile not found - registration required',
    suggestions: [
      'Complete face registration first',
      'Contact your administrator',
      'Ensure you are using the correct account'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.LOW_CONFIDENCE]: {
    message: 'Face verification confidence too low',
    userMessage: 'Verification confidence low - please try again',
    suggestions: [
      'Ensure good lighting on your face',
      'Look directly at the camera',
      'Remove any obstructions',
      'Try again with a clearer view'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.LIVENESS_TIMEOUT]: {
    message: 'Liveness detection timed out',
    userMessage: 'Please blink within the time limit',
    suggestions: [
      'Look at the camera and blink naturally',
      'Don\'t wait too long to blink',
      'Keep your eyes visible and unobstructed'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.FACE_NOT_CENTERED]: {
    message: 'Face is not properly centered in frame',
    userMessage: 'Please center your face in the camera',
    suggestions: [
      'Position your face in the center of the frame',
      'Keep your head straight',
      'Make sure the entire face is visible'
    ],
    severity: 'low'
  },
  
  [FaceVerificationErrorType.FACE_ANGLE_INVALID]: {
    message: 'Face angle is not suitable for verification',
    userMessage: 'Please look straight at the camera',
    suggestions: [
      'Keep your head straight and level',
      'Look directly at the camera',
      'Don\'t tilt your head too much'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.TOO_BRIGHT]: {
    message: 'Image is overexposed due to bright lighting',
    userMessage: 'Lighting is too bright',
    suggestions: [
      'Move away from direct light sources',
      'Adjust room lighting',
      'Avoid direct sunlight on your face'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.TOO_DARK]: {
    message: 'Image is underexposed due to poor lighting',
    userMessage: 'More lighting is needed',
    suggestions: [
      'Move to a brighter area',
      'Turn on additional lights',
      'Face toward a light source'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.INSUFFICIENT_MOVEMENT]: {
    message: 'Insufficient movement detected for liveness',
    userMessage: 'Please blink or move slightly',
    suggestions: [
      'Blink your eyes naturally',
      'Make small head movements',
      'Don\'t stay completely still'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.FAKE_FACE_DETECTED]: {
    message: 'Potential fake face or photo detected',
    userMessage: 'Live person verification required',
    suggestions: [
      'Ensure you are physically present',
      'Don\'t use photos or videos',
      'Blink naturally during verification'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.ENCODING_GENERATION_FAILED]: {
    message: 'Failed to generate face encoding',
    userMessage: 'Face processing failed - please try again',
    suggestions: [
      'Try again with better lighting',
      'Ensure your face is clearly visible',
      'Contact support if the problem persists'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.SYNC_ERROR]: {
    message: 'Failed to sync verification data',
    userMessage: 'Sync failed - will retry automatically',
    suggestions: [
      'Check your internet connection',
      'Data will sync when connection improves',
      'Contact support if sync continues to fail'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.ACCOUNT_LOCKED]: {
    message: 'Account locked due to security policy',
    userMessage: 'Account temporarily locked',
    suggestions: [
      'Wait for the lockout period to expire',
      'Contact your administrator',
      'Follow security guidelines for verification'
    ],
    severity: 'critical'
  },
  
  [FaceVerificationErrorType.SECURITY_VIOLATION]: {
    message: 'Security policy violation detected',
    userMessage: 'Security violation detected',
    suggestions: [
      'Follow proper verification procedures',
      'Contact your administrator',
      'Ensure you are the authorized user'
    ],
    severity: 'critical'
  },
  
  [FaceVerificationErrorType.CAMERA_HARDWARE_ERROR]: {
    message: 'Camera hardware malfunction',
    userMessage: 'Camera hardware issue detected',
    suggestions: [
      'Restart your device',
      'Try using a different device',
      'Contact technical support'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.LOW_IMAGE_QUALITY]: {
    message: 'Image quality insufficient for verification',
    userMessage: 'Image quality too low',
    suggestions: [
      'Clean your camera lens',
      'Ensure good lighting',
      'Hold the device steady',
      'Move to better lighting conditions'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.MEMORY_ERROR]: {
    message: 'Insufficient memory for face processing',
    userMessage: 'Device memory low',
    suggestions: [
      'Close other apps to free memory',
      'Restart the app',
      'Restart your device if needed'
    ],
    severity: 'high'
  },
  
  [FaceVerificationErrorType.PROCESSING_ERROR]: {
    message: 'Error during face processing',
    userMessage: 'Processing error - please try again',
    suggestions: [
      'Try again in a moment',
      'Ensure good lighting and clear face visibility',
      'Contact support if the problem persists'
    ],
    severity: 'medium'
  },
  
  [FaceVerificationErrorType.UNKNOWN_ERROR]: {
    message: 'Unknown error occurred',
    userMessage: 'An unexpected error occurred',
    suggestions: [
      'Try again in a moment',
      'Restart the app if needed',
      'Contact support if the problem persists'
    ],
    severity: 'medium'
  }
};

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    FaceVerificationErrorType.NETWORK_ERROR,
    FaceVerificationErrorType.SERVER_ERROR,
    FaceVerificationErrorType.TIMEOUT_ERROR,
    FaceVerificationErrorType.CAMERA_INITIALIZATION_FAILED,
    FaceVerificationErrorType.PROCESSING_ERROR,
    FaceVerificationErrorType.SYNC_ERROR,
    FaceVerificationErrorType.STORAGE_ERROR
  ]
};