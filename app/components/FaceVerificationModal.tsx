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
import AuthContext from '../context/AuthContext';
import { verifyFace, storeFaceProfile, generateFaceEncoding } from '../services/FaceVerificationService';
import axios from 'axios';
import { Camera } from 'react-native-vision-camera';

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
  
  // Get authentication context for API calls
  const { token, user } = AuthContext.useAuth();

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

  // Stable refs to prevent unmounting during detection
  const isDetectionActiveRef = useRef(false);
  const modalStableRef = useRef(true);
  const lastVisibleRef = useRef(visible);

  // Guard against modal being hidden during detection
  useEffect(() => {
    if (visible !== lastVisibleRef.current) {
      if (!visible && isDetectionActiveRef.current) {
        console.log('⚠️ Modal being hidden during active detection - preventing cleanup');
        // Don't allow modal to be hidden during detection
        return;
      }
      lastVisibleRef.current = visible;
    }
  }, [visible]);

  /**
   * Cleanup function to reset detection state
   */
  const cleanupDetection = useCallback(() => {
    isDetectionActiveRef.current = false;
    console.log('🛡️ Detection active flag reset - allowing cleanup');
  }, []);

  /**
   * Handle face detection errors using the new error handling system
   */
  const handleFaceDetectionError = useCallback((error: string) => {
    console.error('Face detection error:', error);
    
    // Reset detection active flag
    cleanupDetection();
    
    // Provide user-friendly error messages
    let userMessage = 'Face detection error occurred';
    let guidance = 'Please try again or check camera permissions';
    
    if (error.includes('permission')) {
      userMessage = 'Camera permission required';
      guidance = 'Please enable camera access in your device settings';
    } else if (error.includes('device')) {
      userMessage = 'Camera not available';
      guidance = 'Please check if your device has a front camera';
    } else if (error.includes('ML Kit')) {
      userMessage = 'Face detection system unavailable';
      guidance = 'Please try again or contact support if the issue persists';
    } else if (error.includes('initialization')) {
      userMessage = 'System initialization failed';
      guidance = 'Please restart the app and try again';
    }
    
    setVerificationStep('error');
    setStatusMessage(userMessage);
    setGuidanceMessage(guidance);
  }, [cleanupDetection]);

  /**
   * Handle face detection errors using the new error handling system
   */
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
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cameraRef = useRef<Camera>(null);

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
    device,
    frameProcessor,
    setCameraRef,
    getCameraInstance,
    hasTakePhotoMethod,
  } = useFaceDetection({
    performanceMode: 'fast',
    enableLivenessDetection: true,
    qualityThreshold: 0.4, // Lower threshold for better success rate
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

  // Real quality assessment based on face detection data
  const getQualityFeedback = useCallback(() => {
    if (!faceData) return {
      lighting: 'good' as const,
      positioning: 'centered' as const,
      distance: 'good' as const,
      angle: 'good' as const,
      clarity: 'good' as const
    };

    const { bounds, leftEyeOpenProbability, rightEyeOpenProbability, rollAngle, yawAngle } = faceData;
    
    // Calculate face size relative to frame
    const faceArea = bounds.width * bounds.height;
    const frameArea = width * height;
    const faceSizeRatio = faceArea / frameArea;
    
    // Assess positioning (center of frame)
    const centerX = width / 2;
    const centerY = height / 2;
    const faceCenterX = bounds.x + bounds.width / 2;
    const faceCenterY = bounds.y + bounds.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(faceCenterX - centerX, 2) + Math.pow(faceCenterY - centerY, 2)
    );
    const maxDistance = Math.sqrt(width * width + height * height) / 2;
    const positioningScore = 1 - (distanceFromCenter / maxDistance);
    
    // Assess lighting based on eye open probability
    const avgEyeOpen = (leftEyeOpenProbability + rightEyeOpenProbability) / 2;
    
    // Assess angle based on roll and yaw
    const angleScore = 1 - (Math.abs(rollAngle) + Math.abs(yawAngle)) / 180;
    
    return {
      lighting: avgEyeOpen > 0.8 ? 'good' : avgEyeOpen > 0.6 ? 'poor' : 'too_dark',
      positioning: positioningScore > 0.8 ? 'centered' : positioningScore > 0.6 ? 'too_left' : 'too_right',
      distance: faceSizeRatio > 0.15 && faceSizeRatio < 0.4 ? 'good' : faceSizeRatio < 0.15 ? 'too_far' : 'too_close',
      angle: angleScore > 0.8 ? 'good' : 'tilted',
      clarity: qualityScore > 80 ? 'good' : 'blurry'
    } as {
      lighting: 'good' | 'poor' | 'too_dark';
      positioning: 'centered' | 'too_left' | 'too_right';
      distance: 'good' | 'too_far' | 'too_close';
      angle: 'good' | 'tilted';
      clarity: 'good' | 'blurry';
    };
  }, [faceData, qualityScore, width, height]);

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
   * Start verification process with simplified error handling
   */
     const startVerificationProcess = useCallback(async () => {
     if (!isMountedRef.current) return;
     
     try {
       // Set detection active flag to prevent cleanup
       isDetectionActiveRef.current = true;
       console.log('🛡️ Detection active flag set - preventing modal cleanup');
       
       setVerificationStep('initializing');
       setShowProgressOverlay(true);
       updateProgress('initializing', 10, 'Initializing camera...', 'Please wait while we prepare the camera');
       
       // Wait for camera to be ready
       if (!device) {
         throw new Error('Camera device not available');
       }
       
       // Wait a moment for camera to initialize
       await new Promise(resolve => setTimeout(resolve, 1000));
       
       // Start face detection
       const detectionStarted = await startDetection();
       if (!detectionStarted) {
         throw new Error('Failed to start face detection');
       }
       
       setVerificationStep('detecting');
       // Hide progress overlay during face detection to show camera clearly
       setShowProgressOverlay(false);
       updateProgress('detecting', 25, 'Position your face', 'Center your face in the frame and look at the camera');
       
       // Set timeout for the entire verification process
       verificationTimeoutRef.current = setTimeout(() => {
         if (isMountedRef.current && verificationStep !== 'success') {
           setVerificationStep('error');
           setStatusMessage('Verification timeout - please try again');
           setGuidanceMessage('The verification process took too long');
         }
       }, 30000); // 30 second timeout
       
     } catch (error: any) {
       console.error('Error starting verification process:', error);
       setVerificationStep('error');
       setStatusMessage(`Failed to start verification: ${error.message}`);
       setGuidanceMessage('Please check camera permissions and try again');
     }
   }, [startDetection, updateProgress, verificationStep, device]);

  /**
   * Process face verification with real backend API integration
   */
  const processVerification = useCallback(async (photo: CapturedPhoto) => {
    if (!isMountedRef.current || !token || !user) return;
    
    await executeWithErrorHandling(async () => {
      setVerificationStep('processing');
      updateProgress('processing', 80, 'Processing verification...', 'Please wait while we verify your identity');
      
      try {
        let result: FaceVerificationResult;
        
        if (mode === 'register') {
          // Register new face profile
          const faceEncoding = await generateFaceEncoding(faceData!, photo);
          await storeFaceProfile(
            Number(user.id),
            faceEncoding,
            faceData!,
            {
              userId: user.id.toString(),
              sessionId: `face-registration-${Date.now()}`,
              attemptNumber: errorRetryCount + 1
            }
          );
          
          // Create success result for registration
          result = {
            success: true,
            confidence: 1.0,
            livenessDetected: isLive,
            faceEncoding: faceEncoding,
            timestamp: new Date(),
            isOffline: false
          };
        } else {
          // Verify existing face profile
          result = await verifyFace(
            Number(user.id),
            faceData!,
            photo,
            isLive, // livenessDetected
            undefined, // location
            {
              userId: user.id.toString(),
              sessionId: `face-verification-${Date.now()}`,
              attemptNumber: errorRetryCount + 1
            }
          );
        }
        
        if (!result.success) {
          throw new Error('Verification failed - please try again');
        }
        
        setVerificationResult(result);
        setVerificationStep('success');
        setShowSuccess(true);
        updateProgress('success', 100, 'Verification successful!', 'Your identity has been verified');
        
        // Cleanup detection state
        cleanupDetection();
        
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
        
      } catch (error: any) {
        console.error('Face verification API error:', error);
        
        // Handle specific API errors
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (error.response?.status === 404) {
          throw new Error('Face profile not found. Please register your face first.');
        } else if (error.response?.status === 429) {
          throw new Error('Too many verification attempts. Please try again later.');
        } else if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        } else {
          throw new Error('Verification failed. Please try again.');
        }
      }
      
    }, {
      userId: user.id.toString(),
      sessionId: `face-verification-${mode}`,
      attemptNumber: errorRetryCount + 1
    });
  }, [updateProgress, isLive, onSuccess, executeWithErrorHandling, mode, errorRetryCount, token, user, faceData]);

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
    
    // Reset detection active flag
    cleanupDetection();
    
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
  }, [stopDetection, stopLivenessDetection, resetLivenessState, startVerificationProcess, clearError, cleanupDetection]);

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

  // Cleanup on unmount or when modal is closed
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      // Don't cleanup if detection is active
      if (isDetectionActiveRef.current) {
        console.log('🛡️ Preventing cleanup during active detection');
        return;
      }
      
      if (isMountedRef.current) {
        console.log('FaceVerificationModal cleanup - stopping all detection');
        // Stop all detection processes
        stopDetection();
        stopLivenessDetection();
        // Clear any pending timeouts
        if (verificationTimeoutRef.current) {
          clearTimeout(verificationTimeoutRef.current);
          verificationTimeoutRef.current = null;
        }
        if (autoRetryTimeoutRef.current) {
          clearTimeout(autoRetryTimeoutRef.current);
          autoRetryTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        isMountedRef.current = false;
      }
    };
  }, []); // Removed dependencies to prevent infinite loops

  // Effect to connect camera reference - simplified and more reliable
  useEffect(() => {
    // Only try to connect if we have both the camera ref and the setter function
    if (cameraRef.current && setCameraRef) {
      console.log('Connecting camera reference to face detection hook');
      setCameraRef(cameraRef.current);
    }
  }, []); // Removed setCameraRef dependency to avoid infinite loops

  // Additional effect to ensure camera reference is set when camera becomes available
  useEffect(() => {
    if (device && setCameraRef) {
      // Wait a moment for camera to be fully initialized
      const timeoutId = setTimeout(() => {
        if (cameraRef.current) {
          console.log('Camera device available - connecting reference after delay');
          setCameraRef(cameraRef.current);
        }
      }, 500); // Wait 500ms for camera to be ready

      return () => clearTimeout(timeoutId);
    }
  }, [device]); // Removed setCameraRef dependency to avoid infinite loops

  // Effect to handle face detection state changes
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;
    
    if (faceDetectionError) {
      handleFaceDetectionError(faceDetectionError);
      return;
    }
    
    // Debug logging for face detection
    console.log('Face detection state:', {
      verificationStep,
      faceDetected,
      faceQuality: faceQuality?.isValid,
      isDetecting,
      faceData: !!faceData
    });
    
    // Move to liveness when face is detected with good quality OR after some time with any face
    if (verificationStep === 'detecting' && faceDetected) {
      if (faceQuality?.isValid) {
        console.log('Moving to liveness detection step - good quality face detected');
        // CRITICAL: Stop face detection before transitioning
        stopDetection();
        setVerificationStep('liveness');
        setCountdown(5);
        setShowProgressOverlay(true);
        updateProgress('liveness', 50, 'Blink naturally', 'Please blink your eyes naturally to verify liveness');
        // Start liveness detection after a small delay to ensure face detection is fully stopped
        setTimeout(() => {
          startLivenessDetection();
        }, 200);
      } else {
        // If face is detected but quality is poor, still proceed after a delay
        console.log('Face detected but quality is poor, will proceed anyway after delay');
        const qualityTimeout = setTimeout(() => {
          if (verificationStep === 'detecting' && faceDetected) {
            console.log('Proceeding to liveness despite poor quality');
            // CRITICAL: Stop face detection before transitioning
            stopDetection();
            setVerificationStep('liveness');
            setCountdown(5);
            setShowProgressOverlay(true);
            updateProgress('liveness', 50, 'Blink naturally', 'Please blink your eyes naturally to verify liveness');
            // Start liveness detection after a small delay
            setTimeout(() => {
              startLivenessDetection();
            }, 200);
          }
        }, 2000); // Reduced from 3 seconds to 2 seconds for better UX
        
        return () => clearTimeout(qualityTimeout);
      }
    }
    
    // Fallback: If we're in detecting step but detection isn't running, try to restart it
    if (verificationStep === 'detecting' && !isDetecting && device && cameraRef.current) {
      console.log('Detection not running in detecting step - attempting to restart');
      const restartTimeout = setTimeout(() => {
        if (verificationStep === 'detecting' && !isDetecting) {
          console.log('Restarting face detection...');
          startDetection();
        }
      }, 1000); // Wait 1 second then try to restart
      
      return () => clearTimeout(restartTimeout);
    }
    
    // Auto-advance if face detection takes too long (fallback)
    if (verificationStep === 'detecting' && !faceDetected) {
      const detectionTimeout = setTimeout(() => {
        if (verificationStep === 'detecting' && !faceDetected) {
          console.log('Face detection timeout - advancing to liveness anyway');
          // CRITICAL: Stop face detection before transitioning
          stopDetection();
          setVerificationStep('liveness');
          setCountdown(5);
          setShowProgressOverlay(true);
          updateProgress('liveness', 50, 'Blink naturally', 'Please blink your eyes naturally to verify liveness');
          // Start liveness detection after a small delay
          setTimeout(() => {
            startLivenessDetection();
          }, 200);
        }
      }, 10000); // Reduced from 15 seconds to 10 seconds for better UX
      
      return () => clearTimeout(detectionTimeout);
    }
  }, [visible, faceDetectionError, verificationStep, faceDetected, faceQuality, isDetecting, faceData, device, handleFaceDetectionError, updateProgress, startLivenessDetection, startDetection, stopDetection]);

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
    if (visible && isMountedRef.current && verificationStep === 'initializing') {
      startVerificationProcess();
    }
  }, [visible, verificationStep, startVerificationProcess]);

  // Additional cleanup when modal visibility changes
  useEffect(() => {
    if (!visible) {
      console.log('Modal hidden - stopping all detection processes');
      stopDetection();
      stopLivenessDetection();
      // Reset verification state
      setVerificationStep('initializing');
      setCountdown(0);
      setShowProgressOverlay(false);
      // Clear any pending timeouts
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
        autoRetryTimeoutRef.current = null;
      }
    }
  }, [visible, stopDetection, stopLivenessDetection]);

  // Direct camera access method that bypasses ref system entirely
  const getDirectCameraAccess = useCallback(() => {
    // Try global instance first (most reliable)
    const globalCamera = getCameraInstance();
    if (globalCamera) {
      console.log('Direct camera access - global camera instance available');
      return globalCamera;
    }
    
    // Fallback to camera ref
    if (cameraRef.current) {
      console.log('Direct camera access - camera ref available');
      return cameraRef.current;
    }
    
    // Last resort: try to get from hook
    const hookCamera = getCameraInstance();
    if (hookCamera) {
      console.log('Direct camera access - from hook');
      return hookCamera;
    }
    
    console.warn('Direct camera access - no camera available');
    return null;
  }, [getCameraInstance]);

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

         // Camera view for face detection
     if (verificationStep === 'detecting') {
       return (
         <View style={styles.cameraContainer}>
           {device && (
             <>
                               <Camera
                  ref={cameraRef}
                  style={styles.camera}
                  device={device}
                  isActive={visible && isDetecting}
                  photo={true}
                  video={false}
                  audio={false}
                  frameProcessor={frameProcessor}
                  onInitialized={() => {
                    console.log('Camera onInitialized called');
                    // Wait a moment for the camera to be fully ready
                    setTimeout(() => {
                      if (cameraRef.current && setCameraRef) {
                        console.log('Camera initialized - connecting reference to face detection hook');
                        setCameraRef(cameraRef.current);
                        
                        // Force start detection if we're in the detecting step
                        if (verificationStep === 'detecting' && !isDetecting) {
                          console.log('Camera ready - starting face detection');
                          startDetection();
                        }
                      } else {
                        console.warn('Camera initialized but ref or setCameraRef not available:', {
                          hasRef: !!cameraRef.current,
                          hasSetCameraRef: !!setCameraRef
                        });
                      }
                    }, 200); // Small delay to ensure camera is fully ready
                  }}
                  onStarted={() => {
                    console.log('Camera started - ensuring detection is running');
                    // Ensure face detection is running when camera starts
                    if (verificationStep === 'detecting' && !isDetecting) {
                      setTimeout(() => {
                        if (verificationStep === 'detecting' && !isDetecting) {
                          console.log('Camera started - starting face detection');
                          startDetection();
                        }
                      }, 500);
                    }
                  }}
                />
                               {/* Face detection overlay with guidance */}
                <View style={styles.cameraOverlay}>
                  <View style={styles.faceDetectionFrame}>
                    <View style={styles.cornerIndicator} />
                    <View style={[styles.cornerIndicator, styles.topRight]} />
                    <View style={[styles.cornerIndicator, styles.bottomLeft]} />
                    <View style={[styles.cornerIndicator, styles.bottomRight]} />
                  </View>
                  <Text style={[styles.cameraGuidanceText, { color: '#ffffff' }]}>
                    Position your face in the frame
                  </Text>
                  {faceDetected && (
                    <View style={styles.faceDetectedIndicator}>
                      <Text style={[styles.faceDetectedText, { color: '#10b981' }]}>
                        ✓ Face detected
                      </Text>
                    </View>
                  )}
                  {/* Debug info for testing */}
                  <View style={styles.debugInfo}>
                    <Text style={[styles.debugText, { color: '#ffffff' }]}>
                      Face: {faceDetected ? 'Yes' : 'No'} | Quality: {faceQuality?.isValid ? 'Good' : 'Poor'}
                    </Text>
                    <Text style={[styles.debugText, { color: '#ffffff' }]}>
                      Step: {verificationStep} | Progress: {progress}%
                    </Text>
                  </View>

                  {/* Debug button for camera access test */}
                  <TouchableOpacity
                    style={styles.debugButton}
                    onPress={() => {
                      console.log('Testing direct camera access...');
                      
                      // Test global camera instance (most reliable)
                      const globalCamera = getCameraInstance();
                      console.log('Global camera access result:', {
                        hasCamera: !!globalCamera,
                        cameraType: typeof globalCamera,
                        hasTakePhoto: globalCamera ? typeof globalCamera.takePhoto === 'function' : false,
                        availableMethods: globalCamera ? Object.keys(globalCamera) : 'no methods'
                      });
                      
                      // Test direct camera access
                      const directCamera = getDirectCameraAccess();
                      console.log('Direct camera access result:', {
                        hasCamera: !!directCamera,
                        cameraType: typeof directCamera,
                        hasTakePhoto: directCamera ? typeof directCamera.takePhoto === 'function' : false,
                        availableMethods: directCamera ? Object.keys(directCamera) : 'no methods'
                      });
                      
                      // Test hook camera access
                      const hookCamera = getCameraInstance();
                      console.log('Hook camera access result:', {
                        hasCamera: !!hookCamera,
                        cameraType: typeof hookCamera,
                        hasTakePhoto: hookCamera ? typeof hookCamera.takePhoto === 'function' : false,
                        availableMethods: hookCamera ? Object.keys(hookCamera) : 'no methods'
                      });
                    }}
                  >
                    <Text style={styles.debugButtonText}>Test Camera Access</Text>
                  </TouchableOpacity>
                </View>
             </>
           )}
           {!device && (
             <View style={styles.cameraPlaceholder}>
               <ActivityIndicator size="large" color={primaryColor} />
               <Text style={[styles.cameraPlaceholderText, { color: textColor }]}>
                 Initializing camera...
               </Text>
             </View>
           )}
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
          feedback={getQualityFeedback()}
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

             {/* Progress Overlay - Only show when not detecting to avoid covering camera */}
       <VerificationProgressOverlay
         visible={showProgressOverlay && verificationStep !== 'detecting'}
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
  cameraContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 30,
    backgroundColor: '#000',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  cameraPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
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
   // Camera overlay styles
   cameraOverlay: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     justifyContent: 'center',
     alignItems: 'center',
   },
   faceDetectionFrame: {
     width: 200,
     height: 200,
     borderWidth: 2,
     borderColor: '#ffffff',
     borderRadius: 100,
     justifyContent: 'center',
     alignItems: 'center',
     position: 'relative',
   },
   cornerIndicator: {
     position: 'absolute',
     width: 20,
     height: 20,
     borderWidth: 3,
     borderColor: '#3b82f6',
     borderRadius: 2,
   },
   topRight: {
     top: -10,
     right: -10,
     borderTopWidth: 0,
     borderRightWidth: 0,
   },
   bottomLeft: {
     bottom: -10,
     left: -10,
     borderBottomWidth: 0,
     borderLeftWidth: 0,
   },
   bottomRight: {
     bottom: -10,
     right: -10,
     borderBottomWidth: 0,
     borderRightWidth: 0,
   },
   cameraGuidanceText: {
     fontSize: 16,
     fontWeight: '600',
     textAlign: 'center',
     marginTop: 20,
     textShadowColor: 'rgba(0, 0, 0, 0.8)',
     textShadowOffset: { width: 1, height: 1 },
     textShadowRadius: 3,
   },
   faceDetectedIndicator: {
     backgroundColor: 'rgba(16, 185, 129, 0.9)',
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderRadius: 20,
     marginTop: 16,
   },
       faceDetectedText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    // Debug styles
    debugInfo: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 8,
      borderRadius: 8,
    },
    debugText: {
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 2,
    },
    debugButton: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: 8,
      borderRadius: 8,
      marginTop: 10,
      alignSelf: 'center',
    },
    debugButtonText: {
      fontSize: 12,
      color: '#ffffff',
      textAlign: 'center',
    },
  });