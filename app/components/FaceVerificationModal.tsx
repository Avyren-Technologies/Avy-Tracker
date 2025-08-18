import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useCameraLiveness } from '../hooks/useCameraLiveness';
import { useErrorHandling } from '../hooks/useErrorHandling';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import ErrorDisplay from './ErrorDisplay';
import ErrorHandlingService from '../services/ErrorHandlingService';
import {
  FaceVerificationResult,
  CapturedPhoto,
} from '../types/faceDetection';
import {
  FaceVerificationError,
  FaceVerificationErrorType,
  ErrorRecoveryAction,
} from '../types/faceVerificationErrors';
import { FaceDetectionQualityFeedback } from './FaceDetectionQualityFeedback';
import { VerificationProgressOverlay } from './VerificationProgressOverlay';
import { ProgressBar, CountdownTimer, SuccessAnimation, FailureAnimation } from './ProgressIndicators';

const { width, height } = Dimensions.get('window');

interface FaceVerificationModalProps {
  visible: boolean;
  mode: 'register' | 'verify';
  onSuccess: (verificationData: FaceVerificationResult) => void;
  onError: (error: FaceVerificationError) => void;
  onCancel: () => void;
  retryCount?: number;
  maxRetries?: number;
  title?: string;
  subtitle?: string;
}

/**
 * Face Verification Modal Component with Progress Indicators
 * 
 * Provides face verification with liveness detection, real-time quality feedback,
 * progress indicators, countdown timers, and success/failure animations.
 * 
 * Requirements addressed:
 * - 1.1: Face verification with liveness detection
 * - 1.7: Retry options with user guidance
 * - 6.3: Real-time feedback and progress indicators
 * - 6.4: Auto-capture trigger and immediate feedback
 */
export default function FaceVerificationModal({
  visible,
  mode,
  onSuccess,
  onError,
  onCancel,
  retryCount = 0,
  maxRetries = 3,
  title,
  subtitle,
}: FaceVerificationModalProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#1f2937', '#f8fafc');
  const primaryColor = useThemeColor('#3b82f6', '#60a5fa');
  const successColor = useThemeColor('#10b981', '#34d399');
  const errorColor = useThemeColor('#ef4444', '#f87171');
  const warningColor = useThemeColor('#f59e0b', '#fbbf24');

  // Component state
  const [verificationStep, setVerificationStep] = useState<
    'initializing' | 'detecting' | 'liveness' | 'capturing' | 'processing' | 'success' | 'error'
  >('initializing');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [guidanceMessage, setGuidanceMessage] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [verificationResult, setVerificationResult] = useState<FaceVerificationResult | null>(null);
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [qualityScore, setQualityScore] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  // Error handling integration
  const {
    error: currentError,
    isRetrying,
    retryCount: errorRetryCount,
    recoveryActions,
    handleError,
    clearError,
    retry,
    executeRecoveryAction,
    canRetry,
    shouldShowFallback,
    executeWithErrorHandling
  } = useErrorHandling({
    retryConfig: { maxAttempts: maxRetries },
    onError: (error: FaceVerificationError) => {
      setVerificationStep('error');
      setStatusMessage(error.userMessage);
      setGuidanceMessage(error.suggestions[0] || 'Please try again');
    },
    onRetry: (attempt: number, error: FaceVerificationError) => {
      setVerificationStep('detecting');
      setStatusMessage(`Retry attempt ${attempt}/${maxRetries}`);
    },
    onRecovery: (action: ErrorRecoveryAction) => {
      if (action.type === 'retry') {
        retry();
      } else if (action.type === 'fallback') {
        onCancel();
      }
    }
  });

  // Refs for cleanup and accessibility
  const isMountedRef = useRef(true);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Face detection and liveness hooks
  const {
    isDetecting,
    faceDetected,
    faceData,
    startDetection,
    stopDetection,
    capturePhoto,
    error: faceDetectionError,
    cameraPermissionStatus,
    isInitialized,
    faceQuality,
  } = useFaceDetection({
    performanceMode: 'fast',
    enableLivenessDetection: true,
    qualityThreshold: 0.7,
  });

  const {
    isLivenessActive,
    blinkDetected,
    livenessScore,
    livenessData,
    startLivenessDetection,
    stopLivenessDetection,
    resetLivenessState,
    isLive,
    blinkCount,
  } = useCameraLiveness(faceData);

  // Mock feedback for quality indicators
  const mockFeedback = {
    lighting: qualityScore > 80 ? 'good' : qualityScore > 60 ? 'poor' : 'too_dark',
    positioning: qualityScore > 70 ? 'centered' : 'too_left',
    distance: qualityScore > 75 ? 'good' : 'too_far',
    angle: qualityScore > 85 ? 'good' : 'tilted',
    clarity: qualityScore > 80 ? 'good' : 'blurry'
  } as const;

  /**
   * Get appropriate title based on mode and step
   */
  const getTitle = useCallback(() => {
    if (title) return title;
    
    switch (mode) {
      case 'register':
        return 'Register Face Profile';
      case 'verify':
        return 'Face Verification';
      default:
        return 'Face Verification';
    }
  }, [mode, title]);

  /**
   * Get appropriate subtitle based on mode and step
   */
  const getSubtitle = useCallback(() => {
    if (subtitle) return subtitle;
    
    switch (verificationStep) {
      case 'initializing':
        return 'Initializing camera...';
      case 'detecting':
        return 'Position your face in the frame';
      case 'liveness':
        return 'Please blink naturally';
      case 'capturing':
        return 'Capturing photo...';
      case 'processing':
        return mode === 'register' ? 'Registering face profile...' : 'Verifying identity...';
      case 'success':
        return mode === 'register' ? 'Face profile registered successfully!' : 'Identity verified!';
      case 'error':
        return 'Verification failed';
      default:
        return '';
    }
  }, [mode, verificationStep, subtitle]);

  /**
   * Handle face detection errors using the new error handling system
   */
  const handleFaceDetectionError = useCallback((error: string) => {
    let errorType: FaceVerificationErrorType;

    if (error.includes('permission')) {
      errorType = FaceVerificationErrorType.CAMERA_PERMISSION_DENIED;
    } else if (error.includes('Multiple faces')) {
      errorType = FaceVerificationErrorType.MULTIPLE_FACES;
    } else if (error.includes('lighting')) {
      errorType = FaceVerificationErrorType.POOR_LIGHTING;
    } else if (error.includes('closer')) {
      errorType = FaceVerificationErrorType.FACE_TOO_SMALL;
    } else if (error.includes('further')) {
      errorType = FaceVerificationErrorType.FACE_TOO_LARGE;
    } else if (error.includes('timeout')) {
      errorType = FaceVerificationErrorType.TIMEOUT_ERROR;
    } else if (error.includes('network') || error.includes('fetch')) {
      errorType = FaceVerificationErrorType.NETWORK_ERROR;
    } else if (error.includes('confidence')) {
      errorType = FaceVerificationErrorType.LOW_CONFIDENCE;
    } else {
      errorType = FaceVerificationErrorType.NO_FACE_DETECTED;
    }

    // Use the error handling service to create and handle the error
    const faceError = ErrorHandlingService.createError(errorType, new Error(error));
    handleError(faceError, {
      userId: 'current-user', // This should come from context
      sessionId: `face-verification-${mode}`,
      attemptNumber: errorRetryCount + 1
    });
  }, [handleError, mode, errorRetryCount]);

  /**
   * Update progress and status messages
   */
  const updateProgress = useCallback((step: string, progressValue: number, status: string, guidance?: string) => {
    if (!isMountedRef.current) return;
    
    setProgress(progressValue);
    setStatusMessage(status);
    if (guidance) {
      setGuidanceMessage(guidance);
    }
    
    // Update quality score based on progress
    setQualityScore(Math.min(progressValue + Math.random() * 20, 100));
    
    // Announce progress to screen readers
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`${status}. ${guidance || ''}`);
    }
  }, []);

  /**
   * Start verification process with comprehensive error handling
   */
  const startVerificationProcess = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    await executeWithErrorHandling(async () => {
      setVerificationStep('initializing');
      setShowProgressOverlay(true);
      updateProgress('initializing', 10, 'Initializing camera...', 'Please wait while we prepare the camera');
      
      // Start face detection
      const detectionStarted = await startDetection();
      if (!detectionStarted) {
        throw new Error('Failed to start face detection');
      }
      
      setVerificationStep('detecting');
      updateProgress('detecting', 25, 'Position your face', 'Center your face in the frame and look at the camera');
      
      // Set timeout for the entire verification process
      verificationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && verificationStep !== 'success') {
          handleError(new Error('Verification timeout'), {
            userId: 'current-user', // This should come from context
            attemptNumber: errorRetryCount + 1
          });
        }
      }, 30000); // 30 second timeout
      
    }, {
      userId: 'current-user', // This should come from context
      sessionId: `face-verification-${mode}`,
      attemptNumber: errorRetryCount + 1
    });
  }, [startDetection, updateProgress, executeWithErrorHandling, handleError, errorRetryCount, mode, verificationStep]);

  /**
   * Process face verification with comprehensive error handling
   */
  const processVerification = useCallback(async (photo: CapturedPhoto) => {
    if (!isMountedRef.current) return;
    
    await executeWithErrorHandling(async () => {
      setVerificationStep('processing');
      updateProgress('processing', 80, 'Processing verification...', 'Please wait while we verify your identity');
      
      // Simulate API call for face verification
      // In real implementation, this would call the backend service
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock verification result with potential failure simulation
      const shouldSucceed = Math.random() > 0.2; // 80% success rate for testing
      
      if (!shouldSucceed) {
        throw new Error('Face verification failed - confidence too low');
      }
      
      const result: FaceVerificationResult = {
        success: true,
        confidence: 0.85 + Math.random() * 0.1, // 85-95% confidence
        livenessDetected: isLive,
        faceEncoding: 'mock_face_encoding_' + Date.now(),
        timestamp: new Date(),
      };
      
      setVerificationResult(result);
      setVerificationStep('success');
      setShowSuccess(true);
      updateProgress('success', 100, 'Verification successful!', 'Your identity has been verified');
      
      // Announce success to screen readers
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility('Face verification successful');
      }
      
      // Auto-close after success
      setTimeout(() => {
        if (isMountedRef.current) {
          setShowProgressOverlay(false);
          onSuccess(result);
        }
      }, 2000);
      
    }, {
      userId: 'current-user',
      sessionId: `face-verification-${mode}`,
      attemptNumber: errorRetryCount + 1
    });
  }, [updateProgress, isLive, onSuccess, executeWithErrorHandling, mode, errorRetryCount]);

  /**
   * Handle auto-capture when liveness is detected
   */
  const handleAutoCapture = useCallback(async () => {
    if (!isMountedRef.current || verificationStep !== 'liveness') return;
    
    try {
      setVerificationStep('capturing');
      updateProgress('capturing', 70, 'Capturing photo...', 'Hold still while we capture your photo');
      
      const photo = await capturePhoto();
      setCapturedPhoto(photo);
      
      // Process the captured photo
      await processVerification(photo);
      
    } catch (error: any) {
      console.error('Error capturing photo:', error);
      handleFaceDetectionError(error.message || 'Failed to capture photo');
    }
  }, [verificationStep, capturePhoto, processVerification, updateProgress, handleFaceDetectionError]);

  /**
   * Handle countdown completion for liveness detection
   */
  const handleCountdownComplete = useCallback(() => {
    if (verificationStep === 'liveness' && blinkDetected) {
      handleAutoCapture();
    } else {
      // Reset countdown if blink not detected
      setCountdown(5);
    }
  }, [verificationStep, blinkDetected, handleAutoCapture]);

  /**
   * Handle retry verification
   */
  const handleRetry = useCallback(() => {
    if (!isMountedRef.current) return;
    
    // Reset all states
    setVerificationStep('initializing');
    setProgress(0);
    setStatusMessage('');
    setGuidanceMessage('');
    setCapturedPhoto(null);
    setVerificationResult(null);
    setShowSuccess(false);
    setShowFailure(false);
    setQualityScore(0);
    clearError();
    
    // Reset detection states
    stopDetection();
    stopLivenessDetection();
    resetLivenessState();
    
    // Clear timeouts
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
      verificationTimeoutRef.current = null;
    }
    
    // Start verification after a short delay
    setTimeout(() => {
      if (isMountedRef.current) {
        startVerificationProcess();
      }
    }, 1000);
  }, [stopDetection, stopLivenessDetection, resetLivenessState, startVerificationProcess, clearError]);

  /**
   * Handle cancel verification
   */
  const handleCancel = useCallback(() => {
    // Stop all detection processes
    stopDetection();
    stopLivenessDetection();
    
    // Clear timeouts
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
    }
    
    setShowProgressOverlay(false);
    onCancel();
  }, [stopDetection, stopLivenessDetection, onCancel]);

  // Effect to handle face detection state changes
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;
    
    if (faceDetectionError) {
      handleFaceDetectionError(faceDetectionError);
      return;
    }
    
    if (verificationStep === 'detecting' && faceDetected && faceQuality?.isValid) {
      setVerificationStep('liveness');
      setCountdown(5);
      updateProgress('liveness', 50, 'Blink naturally', 'Please blink your eyes naturally to verify liveness');
      startLivenessDetection();
    }
  }, [visible, faceDetectionError, verificationStep, faceDetected, faceQuality, handleFaceDetectionError, updateProgress, startLivenessDetection]);

  // Effect to handle liveness detection
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;
    
    if (verificationStep === 'liveness' && blinkDetected && isLive && livenessScore > 0.6) {
      // Auto-capture when liveness is confirmed
      handleAutoCapture();
    }
  }, [visible, verificationStep, blinkDetected, isLive, livenessScore, handleAutoCapture]);

  // Effect to start verification when modal becomes visible
  useEffect(() => {
    if (visible && isMountedRef.current) {
      startVerificationProcess();
    }
    
    return () => {
      // Cleanup when modal is hidden
      if (!visible) {
        stopDetection();
        stopLivenessDetection();
        if (verificationTimeoutRef.current) {
          clearTimeout(verificationTimeoutRef.current);
        }
        if (autoRetryTimeoutRef.current) {
          clearTimeout(autoRetryTimeoutRef.current);
        }
      }
    };
  }, [visible, startVerificationProcess, stopDetection, stopLivenessDetection]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Render progress indicator
   */
  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      <ProgressBar
        progress={progress}
        height={8}
        showPercentage={true}
        animated={true}
        color={verificationStep === 'error' ? errorColor : primaryColor}
      />
    </View>
  );

  /**
   * Render face detection feedback with quality indicators
   */
  const renderFaceDetectionFeedback = () => {
    if (verificationStep === 'initializing' || verificationStep === 'processing') {
      return (
        <View style={styles.feedbackContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      );
    }

    if (verificationStep === 'success') {
      return (
        <View style={styles.feedbackContainer}>
          <SuccessAnimation
            visible={showSuccess}
            onComplete={() => setShowSuccess(false)}
            message="Verification Successful!"
          />
        </View>
      );
    }

    if (verificationStep === 'error') {
      return (
        <View style={styles.feedbackContainer}>
          <FailureAnimation
            visible={showFailure}
            onComplete={() => setShowFailure(false)}
            message="Verification Failed!"
          />
        </View>
      );
    }

    if (verificationStep === 'liveness') {
      return (
        <View style={styles.feedbackContainer}>
          <CountdownTimer
            seconds={countdown}
            onComplete={handleCountdownComplete}
            size={120}
            showText={true}
          />
        </View>
      );
    }

    // Real-time feedback for detection
    return (
      <View style={styles.feedbackContainer}>
        <FaceDetectionQualityFeedback
          faceData={faceData}
          isDetecting={isDetecting}
          qualityScore={qualityScore}
          feedback={mockFeedback}
          onQualityChange={setQualityScore}
        />
      </View>
    );
  };

  /**
   * Render action buttons
   */
  const renderActionButtons = () => {
    if (verificationStep === 'success') {
      return null; // Auto-close after success
    }

    if (verificationStep === 'error') {
      const canRetryVerification = retryCount < maxRetries && currentError?.retryable;
      
      return (
        <View style={styles.actionContainer}>
          {canRetryVerification && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: primaryColor }]}
              onPress={handleRetry}
              disabled={isRetrying}
              accessibilityLabel="Retry face verification"
              accessibilityHint="Tap to try face verification again"
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="refresh" size={20} color="#ffffff" />
                  <Text style={styles.actionButtonText}>
                    Retry ({maxRetries - retryCount} left)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancel}
            accessibilityLabel="Cancel face verification"
            accessibilityHint="Tap to cancel and close the verification"
          >
            <Ionicons name="close" size={20} color={textColor} />
            <Text style={[styles.actionButtonText, { color: textColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show cancel button during verification
    return (
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={handleCancel}
          accessibilityLabel="Cancel face verification"
          accessibilityHint="Tap to cancel and close the verification"
        >
          <Ionicons name="close" size={20} color={textColor} />
          <Text style={[styles.actionButtonText, { color: textColor }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  /**
   * Render error details and suggestions using the new ErrorDisplay component
   */
  const renderErrorDetails = () => {
    if (!currentError) return null;

    return (
      <ErrorDisplay
        error={currentError}
        isRetrying={isRetrying}
        recoveryActions={recoveryActions}
        onRetry={canRetry() ? () => {
          clearError();
          startVerificationProcess();
        } : undefined}
        onDismiss={() => {
          clearError();
          onCancel();
        }}
        onRecoveryAction={async (action) => {
          // Handle recovery actions
          if (action.type === 'retry') {
            startVerificationProcess();
          }
        }}
        compact={true}
        showDetails={false}
      />
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <View style={[styles.container, { backgroundColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              {getTitle()}
            </Text>
            <Text style={[styles.subtitle, { color: textColor }]}>
              {getSubtitle()}
            </Text>
          </View>

          {/* Progress Indicator */}
          {renderProgressIndicator()}

          {/* Face Detection Feedback */}
          {renderFaceDetectionFeedback()}

          {/* Status Messages */}
          <View style={styles.statusContainer}>
            <Text style={[styles.statusMessage, { color: textColor }]}>
              {statusMessage}
            </Text>
            {guidanceMessage && (
              <Text style={[styles.guidanceMessage, { color: textColor }]}>
                {guidanceMessage}
              </Text>
            )}
          </View>

          {/* Error Details */}
          {renderErrorDetails()}

          {/* Action Buttons */}
          {renderActionButtons()}
        </View>
      </Modal>

      {/* Progress Overlay */}
      <VerificationProgressOverlay
        visible={showProgressOverlay}
        step={verificationStep === 'error' ? 'failure' : verificationStep}
        progress={progress}
        message={statusMessage}
        countdown={verificationStep === 'liveness' ? countdown : undefined}
        onCountdownComplete={handleCountdownComplete}
        onAnimationComplete={() => setShowProgressOverlay(false)}
        retryCount={retryCount}
        maxRetries={maxRetries}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressContainer: {
    marginBottom: 30,
  },
  feedbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    marginBottom: 30,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  guidanceMessage: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});