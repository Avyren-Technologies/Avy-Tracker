// Face detection type definitions for Enhanced ShiftTracker

export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceDetectionData {
  bounds: FaceBounds;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  faceId: string;
  rollAngle: number;
  yawAngle: number;
  timestamp?: number;
}

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  timestamp: number;
}

export interface FaceDetectionOptions {
  performanceMode?: 'fast' | 'accurate';
  enableLivenessDetection?: boolean;
  minFaceSize?: number;
  maxFaceSize?: number;
  qualityThreshold?: number;
  lightingThreshold?: number;
  angleThreshold?: number;
}

export interface FaceQuality {
  lighting: number;
  size: number;
  angle: number;
  overall: number;
  isValid: boolean;
}

export interface UseFaceDetectionReturn {
  isDetecting: boolean;
  faceDetected: boolean;
  faceData: FaceDetectionData | null;
  startDetection: () => Promise<boolean>;
  stopDetection: () => void;
  capturePhoto: () => Promise<CapturedPhoto>;
  error: string | null;
  cameraPermissionStatus: CameraPermissionStatus | null;
  isInitialized: boolean;
  faceQuality: FaceQuality | null;
}

export interface FaceVerificationResult {
  success: boolean;
  confidence: number;
  livenessDetected: boolean;
  faceEncoding?: string;
  timestamp: Date;
  isOffline?: boolean;
  cached?: boolean;
  queuedForSync?: boolean;
}

export interface FaceVerificationError {
  type: FaceVerificationErrorType;
  message: string;
  retryable: boolean;
  suggestions: string[];
}

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

// Camera permission status types
export type CameraPermissionStatus = 'authorized' | 'denied' | 'restricted' | 'not-determined';

// Performance mode for face detection
export type PerformanceMode = 'fast' | 'accurate';

// Face registration status
export interface FaceRegistrationStatus {
  isRegistered: boolean;
  registrationDate?: Date;
  lastVerification?: Date;
  verificationCount: number;
  isEnabled: boolean;
}

// Face profile data structure
export interface FaceProfile {
  id: number;
  userId: number;
  faceEncodingHash: string;
  encryptedFaceData: string;
  registrationDate: Date;
  lastUpdated: Date;
  isActive: boolean;
  verificationCount: number;
}

// Camera liveness detection types
export interface LivenessDetectionData {
  blinkDetected: boolean;
  blinkCount: number;
  eyeMovementScore: number;
  livenessScore: number;
  isLive: boolean;
  timestamp: number;
}

export interface LivenessThresholds {
  minBlinkDuration: number; // milliseconds
  maxBlinkDuration: number; // milliseconds
  eyeClosedThreshold: number; // probability threshold for closed eye
  eyeOpenThreshold: number; // probability threshold for open eye
  minLivenessScore: number; // minimum score to consider live
  blinkTimeoutMs: number; // timeout for blink detection
}

export interface UseCameraLivenessReturn {
  isLivenessActive: boolean;
  blinkDetected: boolean;
  livenessScore: number;
  livenessData: LivenessDetectionData | null;
  startLivenessDetection: () => void;
  stopLivenessDetection: () => void;
  resetLivenessState: () => void;
  isLive: boolean;
  blinkCount: number;
  eyeMovementScore: number;
}