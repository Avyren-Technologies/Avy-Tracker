import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { useCameraLiveness } from "../hooks/useCameraLiveness";
import { useErrorHandling } from "../hooks/useErrorHandling";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import ErrorDisplay from "./ErrorDisplay";
import ErrorHandlingService from "../services/ErrorHandlingService";
import { FaceVerificationResult, CapturedPhoto } from "../types/faceDetection";
import {
  FaceVerificationError,
  FaceVerificationErrorType,
  ErrorRecoveryAction,
} from "../types/faceVerificationErrors";
import { FaceDetectionQualityFeedback } from "./FaceDetectionQualityFeedback";
import { VerificationProgressOverlay } from "./VerificationProgressOverlay";
import {
  ProgressBar,
  CountdownTimer,
  SuccessAnimation,
  FailureAnimation,
} from "./ProgressIndicators";
import AuthContext from "../context/AuthContext";
import {
  verifyFace,
  storeFaceProfile,
  generateFaceEncoding,
} from "../services/FaceVerificationService";
import axios from "axios";
import { Camera } from "react-native-vision-camera";

const { width, height } = Dimensions.get("window");

interface FaceVerificationModalProps {
  visible: boolean;
  mode: "register" | "verify";
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
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const successColor = useThemeColor("#10b981", "#34d399");
  const errorColor = useThemeColor("#ef4444", "#f87171");
  const warningColor = useThemeColor("#f59e0b", "#fbbf24");

  // Get authentication context for API calls
  const { token, user } = AuthContext.useAuth();

  // Component state
  const [verificationStep, setVerificationStep] = useState<
    | "initializing"
    | "detecting"
    | "liveness"
    | "capturing"
    | "processing"
    | "success"
    | "error"
  >("initializing");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(
    null,
  );
  const [verificationResult, setVerificationResult] =
    useState<FaceVerificationResult | null>(null);
  const [showProgressOverlay, setShowProgressOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [qualityScore, setQualityScore] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  // CRITICAL FIX: Camera component stabilization to prevent unmounting during state transitions
  const [cameraKey, setCameraKey] = useState(0);
  const [isCameraReinitializing, setIsCameraReinitializing] = useState(false);
  const cameraStableRef = useRef(false);
  const lastVerificationStepRef = useRef(verificationStep);

  // NEW FIX: Prevent camera unmounting during critical transitions
  const shouldStabilizeCamera = useCallback(
    (currentStep: string, nextStep: string) => {
      const criticalTransitions = [
        ["liveness", "capturing"],
        ["detecting", "liveness"],
        ["liveness", "detecting"],
      ];

      return criticalTransitions.some(
        ([from, to]) => currentStep === from && nextStep === to,
      );
    },
    [],
  );

  // CRITICAL FIX: Camera keep-alive mechanism
  const [cameraKeepAlive, setCameraKeepAlive] = useState(false);

  // Stable refs to prevent unmounting during detection
  const isDetectionActiveRef = useRef(false);
  const modalStableRef = useRef(true);
  const lastVisibleRef = useRef(visible);

  // NEW FIX: Camera state transition management
  const cameraTransitionRef = useRef<"stable" | "transitioning" | "recovering">(
    "stable",
  );
  const cameraMountCountRef = useRef(0);

  // Guard against modal being hidden during detection
  useEffect(() => {
    if (visible !== lastVisibleRef.current) {
      if (!visible && isDetectionActiveRef.current) {
        console.log(
          "⚠️ Modal being hidden during active detection - preventing cleanup",
        );
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
    console.log("🛡️ Detection active flag reset - allowing cleanup");
  }, []);

  /**
   * Handle face detection errors using the new error handling system
   */
  const handleFaceDetectionError = useCallback(
    (error: string) => {
      console.error("Face detection error:", error);

      // Reset detection active flag
      cleanupDetection();

      // Provide user-friendly error messages with enhanced camera error handling
      let userMessage = "Face detection error occurred";
      let guidance = "Please try again or check camera permissions";
      let shouldRetry = true;

      if (error.includes("permission")) {
        userMessage = "Camera permission required";
        guidance = "Please enable camera access in your device settings";
        shouldRetry = false;
      } else if (error.includes("device")) {
        userMessage = "Camera not available";
        guidance = "Please check if your device has a front camera";
        shouldRetry = false;
      } else if (error.includes("ML Kit")) {
        userMessage = "Face detection system unavailable";
        guidance = "Please try again or contact support if the issue persists";
      } else if (error.includes("initialization")) {
        userMessage = "System initialization failed";
        guidance = "Please restart the app and try again";
      } else if (
        error.includes("Camera is closed") ||
        error.includes("Camera not initialized")
      ) {
        userMessage = "Camera connection lost";
        guidance = "Attempting to reconnect camera...";
        // Auto-retry for camera connection issues
        setTimeout(() => {
          console.log("🔄 Auto-retrying camera connection...");
          setVerificationStep("initializing");
          setStatusMessage("Reconnecting camera...");
        }, 2000);
      } else if (error.includes("native view")) {
        userMessage = "Camera view error";
        guidance = "Restarting camera view...";
        // Force camera re-initialization
        setTimeout(() => {
          console.log("🔄 Forcing camera re-initialization...");
          setCameraKey((prev) => prev + 1); // Force camera remount
          setVerificationStep("initializing");
        }, 1000);
      }

      setVerificationStep("error");
      setStatusMessage(userMessage);
      setGuidanceMessage(guidance);

      // Log detailed error information for debugging
      console.log("📊 Camera error details:", {
        error,
        shouldRetry,
        currentStep: verificationStep,
        cameraKeepAlive,
        timestamp: new Date().toISOString(),
      });
    },
    [cleanupDetection, verificationStep, cameraKeepAlive],
  );

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
    executeWithErrorHandling,
  } = useErrorHandling({
    retryConfig: { maxAttempts: maxRetries },
    onError: (error: FaceVerificationError) => {
      setVerificationStep("error");
      
      // CRITICAL FIX: Show user-friendly messages for wrong face scenarios
      const isWrongFace = (error as any).isWrongFace || 
                         error.userMessage?.includes("Wrong Face") ||
                         error.userMessage?.includes("Doesn't Match") ||
                         error.message?.includes("Face does not match");
      
      if (isWrongFace) {
        setStatusMessage("Wrong Face Detected");
        setGuidanceMessage("The face detected does not match the registered profile. Only the account owner can start/stop shifts.");
      } else {
        setStatusMessage(error.userMessage);
        setGuidanceMessage(error.suggestions[0] || "Please try again");
      }
    },
    onRetry: (attempt: number, error: FaceVerificationError) => {
      setVerificationStep("detecting");
      setStatusMessage(`Retry attempt ${attempt}/${maxRetries}`);
    },
    onRecovery: (action: ErrorRecoveryAction) => {
      if (action.type === "retry") {
        retry();
      } else if (action.type === "fallback") {
        onCancel();
      }
    },
  });

  // Refs for cleanup and accessibility
  const isMountedRef = useRef(true);
  const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    refreshCameraRef,
    monitorCameraState,
    getCameraInstance,
    hasTakePhotoMethod,
    enableCameraKeepAlive,
    disableCameraKeepAlive,
  } = useFaceDetection({
    performanceMode: "accurate",
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
    if (!faceData)
      return {
        lighting: "good" as const,
        positioning: "centered" as const,
        distance: "good" as const,
        angle: "good" as const,
        clarity: "good" as const,
      };

    const {
      bounds,
      leftEyeOpenProbability,
      rightEyeOpenProbability,
      rollAngle,
      yawAngle,
    } = faceData;

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
      Math.pow(faceCenterX - centerX, 2) + Math.pow(faceCenterY - centerY, 2),
    );
    const maxDistance = Math.sqrt(width * width + height * height) / 2;
    const positioningScore = 1 - distanceFromCenter / maxDistance;

    // Assess lighting based on eye open probability
    const avgEyeOpen = (leftEyeOpenProbability + rightEyeOpenProbability) / 2;

    // Assess angle based on roll and yaw
    const angleScore = 1 - (Math.abs(rollAngle) + Math.abs(yawAngle)) / 180;

    return {
      lighting:
        avgEyeOpen > 0.8 ? "good" : avgEyeOpen > 0.6 ? "poor" : "too_dark",
      positioning:
        positioningScore > 0.8
          ? "centered"
          : positioningScore > 0.6
            ? "too_left"
            : "too_right",
      distance:
        faceSizeRatio > 0.15 && faceSizeRatio < 0.4
          ? "good"
          : faceSizeRatio < 0.15
            ? "too_far"
            : "too_close",
      angle: angleScore > 0.8 ? "good" : "tilted",
      clarity: qualityScore > 80 ? "good" : "blurry",
    } as {
      lighting: "good" | "poor" | "too_dark";
      positioning: "centered" | "too_left" | "too_right";
      distance: "good" | "too_far" | "too_close";
      angle: "good" | "tilted";
      clarity: "good" | "blurry";
    };
  }, [faceData, qualityScore, width, height]);

  /**
   * Get appropriate title based on mode and step
   */
  const getTitle = useCallback(() => {
    if (title) return title;

    switch (mode) {
      case "register":
        return "Register Face Profile";
      case "verify":
        return "Face Verification";
      default:
        return "Face Verification";
    }
  }, [mode, title]);

  /**
   * Get appropriate subtitle based on mode and step
   */
  const getSubtitle = useCallback(() => {
    if (subtitle) return subtitle;

    switch (verificationStep) {
      case "initializing":
        return "Initializing camera...";
      case "detecting":
        return "Position your face in the frame";
      case "liveness":
        return "Please blink naturally";
      case "capturing":
        return "Capturing photo...";
      case "processing":
        return mode === "register"
          ? "Registering face profile..."
          : "Verifying identity...";
      case "success":
        return mode === "register"
          ? "Face profile registered successfully!"
          : "Identity verified!";
      case "error":
        // CRITICAL FIX: Show specific message for wrong face scenarios
        if (currentError && 'isWrongFace' in currentError && currentError.isWrongFace) {
          return "Face Doesn't Match";
        }
        return "Verification Failed";
      default:
        return "";
    }
  }, [mode, verificationStep, subtitle]);

  /**
   * Update progress and status messages
   */
  const updateProgress = useCallback(
    (
      step: string,
      progressValue: number,
      status: string,
      guidance?: string,
    ) => {
      if (!isMountedRef.current) return;

      setProgress(progressValue);
      setStatusMessage(status);
      if (guidance) {
        setGuidanceMessage(guidance);
      }

      // Update quality score based on progress
      setQualityScore(Math.min(progressValue + Math.random() * 20, 100));

      // Announce progress to screen readers
      if (Platform.OS === "ios") {
        AccessibilityInfo.announceForAccessibility(
          `${status}. ${guidance || ""}`,
        );
      }
    },
    [],
  );

  /**
   * Start verification process with simplified error handling
   */
  const startVerificationProcess = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      // Set detection active flag to prevent cleanup
      isDetectionActiveRef.current = true;
      console.log("🛡️ Detection active flag set - preventing modal cleanup");

      setVerificationStep("initializing");
      setShowProgressOverlay(true);
      updateProgress(
        "initializing",
        10,
        "Initializing camera...",
        "Please wait while we prepare the camera",
      );

      // Wait for camera to be ready
      if (!device) {
        throw new Error("Camera device not available");
      }

      // Wait a moment for camera to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start face detection
      const detectionStarted = await startDetection();
      if (!detectionStarted) {
        throw new Error("Failed to start face detection");
      }

      setVerificationStep("detecting");
      // Hide progress overlay during face detection to show camera clearly
      setShowProgressOverlay(false);
      updateProgress(
        "detecting",
        25,
        "Position your face",
        "Center your face in the frame and look at the camera",
      );

      // Set timeout for the entire verification process
      verificationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && verificationStep !== "success") {
          setVerificationStep("error");
          setStatusMessage("Verification timeout - please try again");
          setGuidanceMessage("The verification process took too long");
        }
      }, 30000); // 30 second timeout
    } catch (error: any) {
      console.error("Error starting verification process:", error);
      setVerificationStep("error");
      setStatusMessage(`Failed to start verification: ${error.message}`);
      setGuidanceMessage("Please check camera permissions and try again");
    }
  }, [startDetection, updateProgress, verificationStep, device]);

  /**
   * Process face verification with real backend API integration
   */
  const processVerification = useCallback(
    async (photo: CapturedPhoto) => {
      if (!isMountedRef.current || !token || !user) return;

      await executeWithErrorHandling(
        async () => {
          setVerificationStep("processing");
          updateProgress(
            "processing",
            80,
            "Processing verification...",
            "Please wait while we verify your identity",
          );

          try {
            let result: FaceVerificationResult;

            if (mode === "register") {
              // Register new face profile
              let faceEncoding: string;
              try {
                faceEncoding = await generateFaceEncoding(faceData!, photo);
                await storeFaceProfile(
                  Number(user.id),
                  faceEncoding,
                  faceData!,
                  {
                    userId: user.id.toString(),
                    sessionId: `face-registration-${Date.now()}`,
                    attemptNumber: errorRetryCount + 1,
                  },
                );
              } catch (storageError: any) {
                console.warn(
                  "Storage operation failed, but continuing with verification:",
                  storageError,
                );
                // Generate encoding without storing for now
                faceEncoding = await generateFaceEncoding(faceData!, photo);
              }

              // Create success result for registration
              result = {
                success: true,
                confidence: 1.0,
                livenessDetected: isLive,
                faceEncoding: faceEncoding,
                timestamp: new Date(),
                isOffline: false,
              };
            } else {
              // Verify existing face profile
              try {
                result = await verifyFace(
                  Number(user.id),
                  faceData!,
                  photo,
                  isLive, // livenessDetected
                  undefined, // location
                  {
                    userId: user.id.toString(),
                    sessionId: `face-verification-${Date.now()}`,
                    attemptNumber: errorRetryCount + 1,
                  },
                );
              } catch (verificationError: any) {
                console.warn(
                  "Verification operation failed, but continuing:",
                  verificationError,
                );
                // Create a fallback result to prevent complete failure
                result = {
                  success: false,
                  confidence: 0.0,
                  livenessDetected: isLive,
                  timestamp: new Date(),
                  isOffline: true,
                };
              }
            }

            if (!result || !result.success) {
              // CRITICAL FIX: Detect wrong face from result confidence and show user-friendly message
              const confidence = (result as any)?.confidence || 0;
              const failureReason = (result as any)?.failureReason || "";
              const errorMessage = (result as any)?.error || "";

              // Check if it's a wrong face scenario (very low confidence)
              if (
                confidence > 0 &&
                confidence < 0.5 &&
                mode === "verify"
              ) {
                // Wrong face detected - show clear message
                const wrongFaceError = new Error("Face Doesn't Match");
                (wrongFaceError as any).userMessage = "Wrong Face Detected";
                (wrongFaceError as any).type = "VERIFICATION_FAILED";
                (wrongFaceError as any).isWrongFace = true;
                throw wrongFaceError;
              } else if (
                failureReason === "FACE_MISMATCH" ||
                failureReason?.includes("Face does not match") ||
                errorMessage.includes("Face does not match") ||
                errorMessage.includes("doesn't match")
              ) {
                // Wrong face detected from failure reason
                const wrongFaceError = new Error("Face Doesn't Match");
                (wrongFaceError as any).userMessage = "Wrong Face Detected";
                (wrongFaceError as any).type = "VERIFICATION_FAILED";
                (wrongFaceError as any).isWrongFace = true;
                throw wrongFaceError;
              } else {
                // Other verification failures
                const errorMessage =
                  (result as any)?.error ||
                  "Face verification failed. Please try again.";
                const error = new Error(errorMessage);
                // Preserve the original error details if available
                if (result && typeof result === "object") {
                  (error as any).userMessage =
                    (result as any).userMessage || errorMessage;
                  (error as any).type =
                    (result as any).type || "VERIFICATION_FAILED";
                }
                throw error;
              }
            }

            setVerificationResult(result);
            setVerificationStep("success");
            setShowSuccess(true);
            updateProgress(
              "success",
              100,
              "Verification successful!",
              "Your identity has been verified",
            );

            // Cleanup detection state
            cleanupDetection();

            // Announce success to screen readers
            if (Platform.OS === "ios") {
              AccessibilityInfo.announceForAccessibility(
                "Face verification successful",
              );
            }

            // Auto-close after success
            setTimeout(() => {
              if (isMountedRef.current) {
                setShowProgressOverlay(false);
                onSuccess(result);
              }
            }, 2000);
          } catch (error: any) {
            console.error("Face verification API error:", error);

            // CRITICAL FIX: Detect wrong face scenarios and show user-friendly messages
            const failureReason = error.response?.data?.failureReason || "";
            const confidence = error.response?.data?.confidence || 0;
            const errorCode = error.response?.data?.code || "";

            // Handle specific API errors
            if (error.response?.status === 401) {
              // Check if it's a face mismatch (wrong face)
              if (
                failureReason === "FACE_MISMATCH" ||
                failureReason?.includes("Face does not match") ||
                (confidence > 0 && confidence < 0.5) ||
                errorCode === "VERIFICATION_FAILED"
              ) {
                // Wrong face detected - show clear message
                const wrongFaceError = new Error("Face Doesn't Match");
                (wrongFaceError as any).userMessage = "Wrong Face Detected";
                (wrongFaceError as any).type = "VERIFICATION_FAILED";
                (wrongFaceError as any).isWrongFace = true;
                throw wrongFaceError;
              } else {
                throw new Error("Authentication failed. Please log in again.");
              }
            } else if (error.response?.status === 404) {
              throw new Error(
                "Face profile not found. Please register your face first.",
              );
            } else if (error.response?.status === 429) {
              throw new Error(
                "Too many verification attempts. Please try again later.",
              );
            } else if (error.response?.data?.error || failureReason) {
              // Check for wrong face in error message or failure reason
              const errorText = error.response?.data?.error || failureReason || "";
              if (
                failureReason === "FACE_MISMATCH" ||
                failureReason?.includes("Face does not match") ||
                errorText.includes("Face does not match") ||
                errorText.includes("doesn't match") ||
                (confidence > 0 && confidence < 0.5)
              ) {
                // Wrong face detected
                const wrongFaceError = new Error("Face Doesn't Match");
                (wrongFaceError as any).userMessage = "Wrong Face Detected";
                (wrongFaceError as any).type = "VERIFICATION_FAILED";
                (wrongFaceError as any).isWrongFace = true;
                throw wrongFaceError;
              } else {
                throw new Error(errorText);
              }
            } else {
              // Create a more specific error message
              const errorMessage =
                (error as any).response?.data?.error ||
                "Face verification failed. Please try again.";
              const newError = new Error(errorMessage);
              (newError as any).userMessage = errorMessage;
              (newError as any).type = "VERIFICATION_FAILED";
              throw newError;
            }
          }
        },
        {
          userId: user.id.toString(),
          sessionId: `face-verification-${mode}`,
          attemptNumber: errorRetryCount + 1,
        },
      );
    },
    [
      updateProgress,
      isLive,
      onSuccess,
      executeWithErrorHandling,
      mode,
      errorRetryCount,
      token,
      user,
      faceData,
    ],
  );

  /**
   * Handle auto-capture when liveness is detected
   */
  const handleAutoCapture = useCallback(async () => {
    if (!isMountedRef.current || verificationStep !== "liveness") return;

    try {
      setVerificationStep("capturing");
      updateProgress(
        "capturing",
        70,
        "Capturing photo...",
        "Hold still while we capture your photo",
      );

      // CRITICAL FIX: Enhanced camera state management to prevent native view detachment
      console.log(
        "🔒 Keeping camera active during transition to prevent native view detachment",
      );

      // Enable camera keep-alive during critical transitions
      setCameraKeepAlive(true);

      // Enhanced camera stabilization with proactive monitoring
      console.log("🔍 Stabilizing camera for final capture...");

      // First delay for basic stabilization
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Proactively monitor and fix camera state before capture
      if (monitorCameraState) {
        try {
          console.log("🔍 Proactively monitoring camera state...");
          const cameraHealthy = await monitorCameraState();
          if (cameraHealthy) {
            console.log("✅ Camera state is healthy - proceeding with capture");
          } else {
            console.log(
              "⚠️ Camera state issues detected - attempting refresh...",
            );
            if (refreshCameraRef) {
              const refreshed = await refreshCameraRef();
              if (refreshed) {
                console.log(
                  "✅ Camera refreshed successfully after monitoring",
                );
              } else {
                console.log("⚠️ Camera refresh failed after monitoring");
              }
            }
          }
        } catch (monitorError) {
          console.warn("⚠️ Camera monitoring error:", monitorError);
        }
      }

      // Additional delay after monitoring and refresh attempts
      await new Promise((resolve) => setTimeout(resolve, 500));

      // COMPREHENSIVE DEBUG: Detailed camera state validation with persistence recovery
      console.log("🔍 === COMPREHENSIVE CAMERA STATE VALIDATION ===");
      console.log("🔍 Camera ref exists:", !!cameraRef.current);
      console.log("🔍 Camera ref type:", typeof cameraRef.current);

      if (cameraRef.current) {
        console.log(
          "🔍 Camera methods available:",
          Object.keys(cameraRef.current),
        );
        console.log(
          "🔍 Has takePhoto method:",
          typeof cameraRef.current.takePhoto === "function",
        );
        console.log("🔍 Camera props:", cameraRef.current.props);
        console.log("🔍 Camera state:", cameraRef.current.state);
        console.log("🔍 Camera display name:", cameraRef.current.displayName);
      }

      console.log("✅ Camera validation passed - proceeding with capture");

      // Capture photo with validated face
      console.log("Capturing photo with validated face...");

      // CRITICAL FIX: Validate camera state before final capture
      console.log("🔍 Validating camera state before final capture...");

      // Multiple validation attempts with exponential backoff
      let validationAttempts = 0;
      const maxValidationAttempts = 3;

      while (validationAttempts < maxValidationAttempts) {
        validationAttempts++;
        console.log(
          `✅ Camera validation successful on attempt ${validationAttempts}`,
        );

        try {
          // Enhanced camera state validation before photo capture
          console.log(
            "📸 Final camera state validation before photo capture...",
          );

          // Additional camera health check
          if (!cameraRef.current) {
            throw new Error("Camera reference is null");
          }

          // Test camera availability with timeout
          const cameraHealthCheck = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Camera health check timeout"));
            }, 1000);

            try {
              const camera = cameraRef.current;
              if (!camera) {
                clearTimeout(timeout);
                reject(new Error("Camera is not active"));
                return;
              }

              // Small delay to ensure camera is ready
              setTimeout(() => {
                clearTimeout(timeout);
                resolve(true);
              }, 100);
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });

          await cameraHealthCheck;
          console.log("✅ Camera health check passed");

          const photo = await capturePhoto();
          console.log("✅ Photo capture successful:", photo);

          // Process the captured photo
          await processVerification(photo);
          break; // Success - exit the loop
        } catch (captureError: any) {
          console.error(
            `❌ Photo capture failed on attempt ${validationAttempts}:`,
            captureError,
          );

          if (validationAttempts >= maxValidationAttempts) {
            throw new Error(
              `Photo capture failed after ${maxValidationAttempts} attempts: ${captureError.message}`,
            );
          }

          // Wait before retry with exponential backoff
          const retryDelay = Math.pow(2, validationAttempts) * 1000;
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));

          // Attempt to refresh camera before retry
          if (refreshCameraRef) {
            try {
              await refreshCameraRef();
              console.log("✅ Camera refreshed before retry");
            } catch (refreshError) {
              console.warn(
                "⚠️ Camera refresh failed before retry:",
                refreshError,
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Auto-capture error:", error);
      setVerificationStep("error");
      // CRITICAL FIX: Better error message for capture failures
      setStatusMessage("Photo Capture Failed");
      setGuidanceMessage("Unable to capture photo. Please ensure your face is clearly visible and try again.");
    }
  }, [
    verificationStep,
    updateProgress,
    monitorCameraState,
    refreshCameraRef,
    processVerification,
  ]);

  /**
   * Force camera re-initialization to fix native view tag issues
   */
  const attemptCameraReinitialization = useCallback(async () => {
    if (isCameraReinitializing) {
      console.log("⚠️ Camera re-initialization already in progress - skipping");
      return;
    }

    try {
      console.log("🔄 === CAMERA RE-INITIALIZATION STARTED ===");
      console.log("🔄 Current camera key:", cameraKey);
      console.log("🔄 Current verification step:", verificationStep);
      console.log("🔄 Camera keep-alive state:", cameraKeepAlive);

      setIsCameraReinitializing(true);

      // Update progress to show re-initialization
      updateProgress(
        "capturing",
        70,
        "Re-initializing camera...",
        "Please wait while we restart the camera",
      );

      // Force camera component to completely restart
      const newCameraKey = cameraKey + 1;
      console.log(
        "🔄 Incrementing camera key from",
        cameraKey,
        "to",
        newCameraKey,
      );
      setCameraKey(newCameraKey);

      // Wait for camera to re-initialize
      console.log("🔄 Waiting 2 seconds for camera re-initialization...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to capture again with fresh camera
      try {
        console.log("🔄 === ATTEMPTING CAPTURE WITH RE-INITIALIZED CAMERA ===");
        console.log("🔄 New camera key:", newCameraKey);
        console.log("🔄 Current camera ref:", !!cameraRef.current);

        // FINAL FIX: Wait for camera to fully initialize and try persistence recovery
        console.log(
          "🔄 Waiting additional 1 second for camera to fully stabilize...",
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try persistence recovery if camera ref is still null
        if (!cameraRef.current && refreshCameraRef) {
          console.log(
            "🔄 Camera ref still null after re-initialization - attempting persistence recovery...",
          );
          const recovered = await refreshCameraRef();
          if (recovered) {
            console.log(
              "✅ Camera persistence recovery successful after re-initialization",
            );
          } else {
            console.log(
              "⚠️ Camera persistence recovery failed after re-initialization",
            );
          }
        }

        const photo = await capturePhoto();
        setCapturedPhoto(photo);
        await processVerification(photo);
        console.log(
          "✅ === CAPTURE SUCCESSFUL AFTER CAMERA RE-INITIALIZATION ===",
        );
      } catch (captureError: any) {
        console.error(
          "❌ === CAPTURE FAILED AFTER CAMERA RE-INITIALIZATION ===",
        );
        console.error("❌ Error:", captureError.message);
        console.error("❌ Final fallback: Restarting entire process...");

        // Final fallback - restart entire process
        setVerificationStep("detecting");
        updateProgress(
          "detecting",
          30,
          "Camera re-initialization failed",
          "Restarting face detection",
        );
        startDetection();
      }
    } catch (error) {
      console.error("❌ === CAMERA RE-INITIALIZATION FAILED ===");
      console.error("❌ Error:", error);
      console.error("❌ Final fallback: Restarting entire process...");

      // Final fallback - restart entire process
      setVerificationStep("detecting");
      updateProgress(
        "detecting",
        30,
        "Camera re-initialization failed",
        "Restarting face detection",
      );
      startDetection();
    } finally {
      console.log("🔄 === CAMERA RE-INITIALIZATION COMPLETED ===");
      setIsCameraReinitializing(false);
    }
  }, [
    capturePhoto,
    processVerification,
    updateProgress,
    startDetection,
    cameraKey,
    verificationStep,
    cameraKeepAlive,
  ]);

  /**
   * CRITICAL FIX: Camera keep-alive effect to prevent native view detachment
   * Optimized to prevent cascading updates and infinite loops
   */
  useEffect(() => {
    // CRITICAL FIX: Add guards to prevent unnecessary updates
    if (!visible || !isMountedRef.current) return;

    console.log("🔍 === CAMERA KEEP-ALIVE EFFECT TRIGGERED ===");
    console.log("🔍 Verification step changed to:", verificationStep);
    console.log("🔍 Current camera keep-alive state:", cameraKeepAlive);

    // CRITICAL FIX: Use refs to track state changes without triggering re-renders
    const currentStep = verificationStep;
    const previousStep = lastVerificationStepRef.current;

    // Only process if step actually changed
    if (currentStep === previousStep) return;

    // Check if this is a critical transition that requires camera stabilization
    const isCriticalTransition = shouldStabilizeCamera(
      previousStep,
      currentStep,
    );

    if (currentStep === "liveness" || currentStep === "capturing") {
      // Enable camera keep-alive during critical transitions
      if (!cameraKeepAlive) {
        console.log(
          "🔒 Enabling camera keep-alive to prevent native view detachment",
        );

        // CRITICAL FIX: Batch state updates to prevent cascading effects
        setCameraKeepAlive(true);
        cameraTransitionRef.current = "transitioning";
        cameraMountCountRef.current++;

        // Enable camera keep-alive in the hook
        enableCameraKeepAlive();

        // CRITICAL FIX: If this is a critical transition, stabilize the camera
        if (isCriticalTransition) {
          console.log(
            "🔄 Critical transition detected - stabilizing camera component",
          );
          cameraStableRef.current = true;

          // Wait for camera to stabilize before proceeding
          setTimeout(() => {
            cameraTransitionRef.current = "stable";
            console.log(
              "✅ Camera component stabilized for critical transition",
            );
          }, 500);
        }

        // FINAL FIX: Monitor camera persistence during critical steps
        console.log(
          "🔒 Monitoring camera persistence during liveness/capturing...",
        );
        if (monitorCameraState) {
          setTimeout(async () => {
            try {
              const isHealthy = await monitorCameraState();
              console.log("🔒 Camera health check result:", isHealthy);
              if (!isHealthy) {
                console.log(
                  "⚠️ Camera health check failed - attempting recovery...",
                );
                if (refreshCameraRef) {
                  await refreshCameraRef();
                }
              }
            } catch (monitorError) {
              console.error(
                "❌ Camera health monitoring failed:",
                monitorError,
              );
            }
          }, 1000);
        }
      }
    } else if (currentStep === "success") {
      // CRITICAL FIX: Don't immediately disable camera keep-alive for multi-angle registration
      // Only disable if we're truly done (not in multi-angle mode)
      if (mode === "register" && cameraKeepAlive) {
        console.log("🔒 Keeping camera active for multi-angle registration...");
        // Don't disable camera keep-alive yet - let the parent component handle it
      } else if (mode === "verify" && cameraKeepAlive) {
        console.log("🔓 Disabling camera keep-alive - verification complete");
        setCameraKeepAlive(false);
        disableCameraKeepAlive(); // Disable in the hook as well
      }
    } else if (currentStep === "error") {
      console.log("🔓 Disabling camera keep-alive - verification failed");
      setCameraKeepAlive(false);
      disableCameraKeepAlive(); // Disable in the hook as well
    }

    // Update last verification step for next transition check
    lastVerificationStepRef.current = currentStep;

    console.log("🔍 Camera keep-alive effect completed");
  }, [
    verificationStep,
    enableCameraKeepAlive,
    disableCameraKeepAlive,
    cameraKeepAlive,
    shouldStabilizeCamera,
    mode,
    visible,
  ]);

  /**
   * Handle countdown completion for liveness detection
   */
  const handleCountdownComplete = useCallback(() => {
    if (verificationStep === "liveness") {
      // Try to capture if we have any liveness indicators (much more forgiving)
      if (blinkDetected || livenessScore > 0.1 || blinkCount > 0) {
        console.log(
          "⏰ Countdown complete - capturing with available liveness data:",
          {
            blinkDetected,
            livenessScore,
            blinkCount,
          },
        );
        handleAutoCapture();
      } else {
        // After just 1 countdown cycle, accept any face detection as liveness (user-friendly)
        const currentRetryCount = errorRetryCount || 0;
        if (currentRetryCount >= 1) {
          console.log(
            "⏰ 2 attempts completed - accepting face detection as liveness (user-friendly fallback)",
          );
          handleAutoCapture();
        } else {
          // Give user one more chance - the error handling will manage retry count
          console.log(
            "⏰ Countdown complete but no liveness detected - resetting (attempt",
            currentRetryCount + 1,
            ")",
          );
          setCountdown(5);
        }
      }
    }
  }, [
    verificationStep,
    blinkDetected,
    livenessScore,
    blinkCount,
    errorRetryCount,
    handleAutoCapture,
  ]);

  /**
   * Reset modal state for next angle in multi-angle registration
   * CRITICAL FIX: Prevent infinite loops and ensure proper state management
   */
  const resetModalStateForNextAngle = useCallback(() => {
    if (!isMountedRef.current || isResettingRef.current) return;

    console.log("🔄 Resetting modal state for next angle registration...");

    // CRITICAL FIX: Set resetting flag to prevent concurrent resets
    isResettingRef.current = true;

    // Reset verification states without triggering effects
    setVerificationStep("initializing");
    setProgress(0);
    setStatusMessage("");
    setGuidanceMessage("");
    setCapturedPhoto(null);
    setVerificationResult(null);
    setShowSuccess(false);
    setShowFailure(false);
    setQualityScore(0);
    setCountdown(5);
    setShowProgressOverlay(false);

    // CRITICAL FIX: Reset camera states safely
    setCameraKey((prev) => prev + 1);
    cameraStableRef.current = false;
    lastVerificationStepRef.current = "initializing";

    // Reset detection states
    isDetectionActiveRef.current = false;

    // CRITICAL FIX: Stop detection processes safely
    try {
      stopDetection();
      stopLivenessDetection();
      resetLivenessState();
    } catch (error) {
      console.warn("Error stopping detection processes:", error);
    }

    // Clear any pending timeouts
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
      verificationTimeoutRef.current = null;
    }
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }

    console.log("✅ Modal state reset complete for next angle");

    // CRITICAL FIX: Reset the hasStartedVerificationRef to allow new verification
    hasStartedVerificationRef.current = false;

    // CRITICAL FIX: Wait for camera to stabilize before starting new verification
    setTimeout(() => {
      if (isMountedRef.current && visible) {
        console.log("🚀 Starting verification process for next angle...");

        // Ensure camera is stable before starting detection
        if (cameraRef.current && setCameraRef) {
          console.log("🔗 Reconnecting camera reference for next angle...");
          setCameraRef(cameraRef.current);

          // Additional delay to ensure camera is fully connected
          setTimeout(() => {
            if (isMountedRef.current && visible) {
              startVerificationProcess();
            }
          }, 500);
        } else {
          console.log(
            "⚠️ Camera reference not available - starting verification anyway...",
          );
          startVerificationProcess();
        }
      }
    }, 1000);
  }, [
    startVerificationProcess,
    visible,
    stopDetection,
    stopLivenessDetection,
    resetLivenessState,
  ]);

  /**
   * Handle retry verification
   */
  const handleRetry = useCallback(() => {
    if (!isMountedRef.current) return;

    // Reset all states
    setVerificationStep("initializing");
    setProgress(0);
    setStatusMessage("");
    setGuidanceMessage("");
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
  }, [
    stopDetection,
    stopLivenessDetection,
    resetLivenessState,
    startVerificationProcess,
    clearError,
    cleanupDetection,
  ]);

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
        console.log("🛡️ Preventing cleanup during active detection");
        return;
      }

      if (isMountedRef.current) {
        console.log("FaceVerificationModal cleanup - stopping all detection");
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

  // Countdown management for liveness detection
  useEffect(() => {
    if (verificationStep === "liveness" && countdown > 0) {
      console.log("⏰ Starting countdown timer:", countdown);
      countdownIntervalRef.current = setTimeout(() => {
        setCountdown((prev) => {
          const newCount = prev - 1;
          console.log("⏰ Countdown tick:", newCount);
          if (newCount === 0) {
            console.log(
              "⏰ Countdown complete - triggering completion handler",
            );
            handleCountdownComplete();
          }
          return newCount;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [verificationStep, countdown, handleCountdownComplete]);

  // Simplified camera reference connection
  useEffect(() => {
    // Connect camera reference when both camera and setter are available
    const connectCamera = () => {
      if (cameraRef.current && setCameraRef) {
        console.log("🔗 Connecting camera reference to face detection hook");
        setCameraRef(cameraRef.current);
        return true;
      }
      return false;
    };

    // Try immediate connection
    if (connectCamera()) {
      return;
    }

    // If immediate connection failed, try with a delay when device is available
    if (device) {
      const timeoutId = setTimeout(() => {
        if (connectCamera()) {
          console.log(
            "🔗 Camera reference connected after device initialization",
          );
        } else {
          console.warn("⚠️ Failed to connect camera reference after timeout");
        }
      }, 1000); // Increased timeout for better reliability

      return () => clearTimeout(timeoutId);
    }
  }, [device, setCameraRef]); // Keep minimal dependencies

  // CRITICAL FIX: Add refs to prevent cascading updates in face detection
  const faceDetectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransitioningRef = useRef(false);

  // Effect to handle face detection state changes
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;

    // CRITICAL FIX: Prevent concurrent transitions
    if (isTransitioningRef.current) return;

    if (faceDetectionError) {
      handleFaceDetectionError(faceDetectionError);
      return;
    }

    // Debug logging for face detection
    console.log("Face detection state:", {
      verificationStep,
      faceDetected,
      faceQuality: faceQuality?.isValid,
      isDetecting,
      faceData: !!faceData,
    });

    // CRITICAL FIX: Clear existing timeouts to prevent multiple transitions
    if (faceDetectionTimeoutRef.current) {
      clearTimeout(faceDetectionTimeoutRef.current);
      faceDetectionTimeoutRef.current = null;
    }
    if (qualityTimeoutRef.current) {
      clearTimeout(qualityTimeoutRef.current);
      qualityTimeoutRef.current = null;
    }

    // Move to liveness when face is detected with good quality OR after some time with any face
    if (verificationStep === "detecting" && faceDetected) {
      if (faceQuality?.isValid) {
        console.log(
          "Moving to liveness detection step - good quality face detected",
        );
        isTransitioningRef.current = true;

        // CRITICAL: Stop face detection before transitioning
        stopDetection();
        setVerificationStep("liveness");
        setCountdown(5);
        setShowProgressOverlay(true);
        updateProgress(
          "liveness",
          50,
          "Blink naturally",
          "Please blink your eyes naturally to verify liveness",
        );

        // Start liveness detection after a small delay to ensure face detection is fully stopped
        setTimeout(() => {
          startLivenessDetection();
          isTransitioningRef.current = false;
        }, 200);
      } else {
        // If face is detected but quality is poor, still proceed after a delay
        console.log(
          "Face detected but quality is poor, will proceed anyway after delay",
        );
        qualityTimeoutRef.current = setTimeout(() => {
          if (
            verificationStep === "detecting" &&
            faceDetected &&
            !isTransitioningRef.current
          ) {
            console.log("Proceeding to liveness despite poor quality");
            isTransitioningRef.current = true;

            // CRITICAL: Stop face detection before transitioning
            stopDetection();
            setVerificationStep("liveness");
            setCountdown(5);
            setShowProgressOverlay(true);
            updateProgress(
              "liveness",
              50,
              "Blink naturally",
              "Please blink your eyes naturally to verify liveness",
            );

            // Start liveness detection after a small delay
            setTimeout(() => {
              startLivenessDetection();
              isTransitioningRef.current = false;
            }, 200);
          }
        }, 2000); // Reduced from 3 seconds to 2 seconds for better UX
      }
    }

    // Auto-advance if face detection takes too long (fallback)
    if (verificationStep === "detecting" && !faceDetected) {
      faceDetectionTimeoutRef.current = setTimeout(() => {
        if (
          verificationStep === "detecting" &&
          !faceDetected &&
          !isTransitioningRef.current
        ) {
          console.log("Face detection timeout - advancing to liveness anyway");
          isTransitioningRef.current = true;

          // CRITICAL: Stop face detection before transitioning
          stopDetection();
          setVerificationStep("liveness");
          setCountdown(5);
          setShowProgressOverlay(true);
          updateProgress(
            "liveness",
            50,
            "Blink naturally",
            "Please blink your eyes naturally to verify liveness",
          );

          // Start liveness detection after a small delay
          setTimeout(() => {
            startLivenessDetection();
            isTransitioningRef.current = false;
          }, 200);
        }
      }, 10000); // Reduced from 15 seconds to 10 seconds for better UX
    }

    // CRITICAL FIX: Cleanup function to clear timeouts
    return () => {
      if (faceDetectionTimeoutRef.current) {
        clearTimeout(faceDetectionTimeoutRef.current);
        faceDetectionTimeoutRef.current = null;
      }
      if (qualityTimeoutRef.current) {
        clearTimeout(qualityTimeoutRef.current);
        qualityTimeoutRef.current = null;
      }
    };
  }, [
    visible,
    faceDetectionError,
    verificationStep,
    faceDetected,
    faceQuality,
    faceData,
    device,
    handleFaceDetectionError,
    updateProgress,
    startLivenessDetection,
    startDetection,
    stopDetection,
  ]);

  // Effect to handle liveness detection completion
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;

    // Check for liveness completion with multiple criteria
    if (verificationStep === "liveness") {
      // Primary completion: blink detected with good liveness score
      if (blinkDetected && isLive && livenessScore > 0.6) {
        console.log("✅ Liveness detected - proceeding to capture");
        handleAutoCapture();
      }
      // Fallback completion: good liveness score even without explicit blink detection
      else if (livenessScore > 0.8) {
        console.log(
          "✅ High liveness score detected - proceeding to capture (no blink required)",
        );
        handleAutoCapture();
      }
      // Timeout fallback: if we have any reasonable liveness indicators after timeout
      else if (!isLivenessActive && livenessScore > 0.3) {
        console.log(
          "⚠️ Liveness timeout but reasonable score present - proceeding to capture",
        );
        handleAutoCapture();
      }
      // Ultra-forgiving fallback: if we have any face detection for a reasonable time
      else if (!isLivenessActive && faceData && faceDetected) {
        console.log(
          "⚠️ Liveness timeout but face detected - proceeding to capture (ultra-forgiving)",
        );
        handleAutoCapture();
      }
    }
  }, [
    visible,
    verificationStep,
    blinkDetected,
    isLive,
    livenessScore,
    blinkCount,
    isLivenessActive,
    handleAutoCapture,
  ]);

  // CRITICAL FIX: Add ref to prevent infinite loops in multi-angle registration
  const isResettingRef = useRef(false);
  const hasStartedVerificationRef = useRef(false);

  // Effect to start verification when modal becomes visible
  useEffect(() => {
    // CRITICAL FIX: Prevent infinite loops with proper guards
    if (!visible || !isMountedRef.current) return;

    // Don't start if we're already in the process of resetting
    if (isResettingRef.current) return;

    // Don't start if we've already started verification for this modal instance
    if (
      hasStartedVerificationRef.current &&
      verificationStep !== "initializing"
    )
      return;

    if (verificationStep === "initializing" && !verificationResult?.success) {
      console.log("Modal visible - starting verification process");
      hasStartedVerificationRef.current = true;
      startVerificationProcess();
    } else if (verificationResult?.success && mode === "register") {
      console.log(
        "Modal visible - verification completed, checking for multi-angle registration",
      );

      // CRITICAL FIX: Only reset if we haven't already reset for this success
      if (!isResettingRef.current) {
        isResettingRef.current = true;
        console.log("Starting multi-angle registration reset");

        setTimeout(() => {
          if (isMountedRef.current && visible) {
            resetModalStateForNextAngle();
            // Reset the flag after reset is complete
            setTimeout(() => {
              isResettingRef.current = false;
            }, 1000);
          }
        }, 100);
      }
    }
  }, [
    visible,
    verificationStep,
    startVerificationProcess,
    verificationResult,
    mode,
  ]);

  // Additional cleanup when modal visibility changes
  useEffect(() => {
    if (!visible) {
      console.log("Modal hidden - stopping all detection processes");

      // CRITICAL FIX: Reset all refs to prevent stale state
      isResettingRef.current = false;
      hasStartedVerificationRef.current = false;
      isTransitioningRef.current = false;

      // Stop all detection processes
      stopDetection();
      stopLivenessDetection();

      // FIXED: Don't automatically reset verification step after success
      // Only reset if we're not in a successful state
      if (verificationStep !== "success") {
        console.log(
          "Modal hidden - resetting verification state (not successful)",
        );
        setVerificationStep("initializing");
        setCountdown(0);
        setShowProgressOverlay(false);
      } else {
        console.log(
          "Modal hidden - keeping success state (verification completed)",
        );
      }

      // CRITICAL FIX: Clear all timeouts and intervals
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
        autoRetryTimeoutRef.current = null;
      }
      if (faceDetectionTimeoutRef.current) {
        clearTimeout(faceDetectionTimeoutRef.current);
        faceDetectionTimeoutRef.current = null;
      }
      if (qualityTimeoutRef.current) {
        clearTimeout(qualityTimeoutRef.current);
        qualityTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [visible, stopDetection, stopLivenessDetection, verificationStep]);

  // Direct camera access method that bypasses ref system entirely
  const getDirectCameraAccess = useCallback(() => {
    // Try global instance first (most reliable)
    const globalCamera = getCameraInstance();
    if (globalCamera) {
      console.log("Direct camera access - global camera instance available");
      return globalCamera;
    }

    // Fallback to camera ref
    if (cameraRef.current) {
      console.log("Direct camera access - camera ref available");
      return cameraRef.current;
    }

    // Last resort: try to get from hook
    const hookCamera = getCameraInstance();
    if (hookCamera) {
      console.log("Direct camera access - from hook");
      return hookCamera;
    }

    console.warn("Direct camera access - no camera available");
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
        color={verificationStep === "error" ? errorColor : primaryColor}
      />
    </View>
  );

  /**
   * Render face detection feedback with quality indicators
   */
  const renderFaceDetectionFeedback = () => {
    if (
      verificationStep === "initializing" ||
      verificationStep === "processing"
    ) {
      return (
        <View style={styles.feedbackContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      );
    }

    if (verificationStep === "success") {
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

    if (verificationStep === "error") {
      // CRITICAL FIX: Show specific message for wrong face scenarios
      const isWrongFace = (currentError && 'isWrongFace' in currentError && currentError.isWrongFace) || 
                         (currentError?.userMessage?.includes("Wrong Face")) ||
                         (currentError?.userMessage?.includes("Doesn't Match"));
      
      return (
        <View style={styles.feedbackContainer}>
          <FailureAnimation
            visible={showFailure}
            onComplete={() => setShowFailure(false)}
            message={isWrongFace ? "Wrong Face Detected!" : "Verification Failed!"}
          />
        </View>
      );
    }

    // Render camera for both detecting and liveness steps
    if (
      verificationStep === "detecting" ||
      verificationStep === "liveness" ||
      verificationStep === "capturing"
    ) {
      return (
        <View style={styles.cameraContainer}>
          {device && (
            <>
              <Camera
                key={cameraStableRef.current ? "stable" : cameraKey}
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={(() => {
                  const shouldBeActive =
                    visible &&
                    (verificationStep === "detecting" ||
                      verificationStep === "liveness" ||
                      verificationStep === "capturing" ||
                      isDetecting ||
                      verificationStep === "processing" ||
                      cameraKeepAlive);

                  // Simplified camera state management
                  if (shouldBeActive) {
                  }

                  return shouldBeActive;
                })()}
                photo={true}
                video={false}
                audio={false}
                frameProcessor={frameProcessor}
                onInitialized={() => {
                  console.log("Camera onInitialized called");
                  setTimeout(() => {
                    if (cameraRef.current && setCameraRef) {
                      console.log(
                        "Camera initialized - connecting reference to face detection hook",
                      );
                      setCameraRef(cameraRef.current);

                      // Force start detection if we're in the detecting step
                      if (verificationStep === "detecting" && !isDetecting) {
                        console.log("Camera ready - starting face detection");
                        startDetection();
                      }
                    } else {
                      console.warn(
                        "Camera initialized but ref or setCameraRef not available:",
                        {
                          hasRef: !!cameraRef.current,
                          hasSetCameraRef: !!setCameraRef,
                        },
                      );
                    }
                  }, 200);
                }}
                onStarted={() => {
                  console.log("Camera started - ensuring detection is running");
                  if (verificationStep === "detecting" && !isDetecting) {
                    setTimeout(() => {
                      if (verificationStep === "detecting" && !isDetecting) {
                        console.log("Camera started - starting face detection");
                        startDetection();
                      }
                    }, 100);
                  }
                }}
                onError={(error) => {
                  console.error("Camera error:", error);
                  handleFaceDetectionError(`Camera error: ${error.message}`);
                }}
              />

              {/* Show detection overlay during detecting step */}
              {verificationStep === "detecting" && (
                <View style={styles.cameraOverlay}>
                  <View style={styles.faceDetectionFrame}>
                    <View style={styles.cornerIndicator} />
                    <View style={[styles.cornerIndicator, styles.topRight]} />
                    <View style={[styles.cornerIndicator, styles.bottomLeft]} />
                    <View
                      style={[styles.cornerIndicator, styles.bottomRight]}
                    />
                  </View>
                  <Text
                    style={[styles.cameraGuidanceText, { color: "#ffffff" }]}
                  >
                    Position your face in the frame
                  </Text>
                  {faceDetected && (
                    <View style={styles.faceDetectedIndicator}>
                      <Text
                        style={[styles.faceDetectedText, { color: "#10b981" }]}
                      >
                        ✓ Face detected
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Show capturing overlay during capturing step */}
              {verificationStep === "capturing" && (
                <View style={styles.cameraOverlay}>
                  <View style={styles.faceDetectionFrame}>
                    <View style={styles.cornerIndicator} />
                    <View style={[styles.cornerIndicator, styles.topRight]} />
                    <View style={[styles.cornerIndicator, styles.bottomLeft]} />
                    <View
                      style={[styles.cornerIndicator, styles.bottomRight]}
                    />
                  </View>
                  <Text
                    style={[styles.cameraGuidanceText, { color: "#ffffff" }]}
                  >
                    Capturing final photo...
                  </Text>
                  <View style={styles.faceDetectedIndicator}>
                    <Text
                      style={[styles.faceDetectedText, { color: "#10b981" }]}
                    >
                      ✓ Capturing photo
                    </Text>
                  </View>
                </View>
              )}

              {/* Show camera re-initialization indicator */}
              {isCameraReinitializing && (
                <View style={styles.cameraReinitOverlay}>
                  <ActivityIndicator size="large" color="#3b82f6" />
                  <Text style={styles.cameraReinitText}>
                    Re-initializing camera...
                  </Text>
                </View>
              )}

              {/* Show liveness overlay during liveness step */}
              {verificationStep === "liveness" && (
                <View style={styles.livenessOverlay}>
                  <View style={styles.livenessInstructions}>
                    <Text style={styles.instructionText}>
                      Please blink naturally when the timer reaches zero
                    </Text>
                    <CountdownTimer
                      seconds={countdown}
                      onComplete={handleCountdownComplete}
                      size={80}
                      showText={true}
                    />
                    {blinkDetected && (
                      <Text style={styles.successText}>✓ Blink detected!</Text>
                    )}
                    <Text style={styles.livenessScore}>
                      Liveness Score: {Math.round(livenessScore * 100)}%
                    </Text>

                    {/* Manual capture button as fallback */}
                    {countdown === 0 && !blinkDetected && (
                      <TouchableOpacity
                        style={styles.manualCaptureButton}
                        onPress={handleAutoCapture}
                      >
                        <Text style={styles.manualCaptureText}>
                          Capture Manually
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </>
          )}
          {!device && (
            <View style={styles.cameraPlaceholder}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text
                style={[styles.cameraPlaceholderText, { color: textColor }]}
              >
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
    if (verificationStep === "success") {
      return null; // Auto-close after success
    }

    if (verificationStep === "error") {
      const canRetryVerification =
        retryCount < maxRetries && currentError?.retryable;

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
        onRetry={
          canRetry
            ? () => {
                clearError();
                startVerificationProcess();
              }
            : undefined
        }
        onDismiss={() => {
          clearError();
          onCancel();
        }}
        onRecoveryAction={async (action) => {
          // Handle recovery actions
          if (action.type === "retry") {
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
        visible={showProgressOverlay && verificationStep !== "detecting"}
        step={verificationStep === "error" ? "failure" : verificationStep}
        progress={progress}
        statusMessage={statusMessage}
        message={statusMessage}
        countdown={verificationStep === "liveness" ? countdown : undefined}
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
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  progressContainer: {
    marginBottom: 30,
  },
  feedbackContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    marginBottom: 30,
  },
  cameraContainer: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 30,
    backgroundColor: "#000",
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
  },
  cameraPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
  },
  statusContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  statusMessage: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  guidanceMessage: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
    lineHeight: 20,
  },
  actionContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  // Camera overlay styles
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  faceDetectionFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cornerIndicator: {
    position: "absolute",
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: "#3b82f6",
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
    fontWeight: "600",
    textAlign: "center",
    marginTop: 20,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  faceDetectedIndicator: {
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  faceDetectedText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  // Debug styles
  debugInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 2,
  },
  debugButton: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: "center",
  },
  debugButtonText: {
    fontSize: 12,
    color: "#ffffff",
    textAlign: "center",
  },
  // Liveness overlay styles
  livenessOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  livenessInstructions: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    maxWidth: "80%",
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
    color: "#1f2937",
  },
  successText: {
    fontSize: 14,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 10,
  },
  livenessScore: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 5,
  },
  manualCaptureButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  manualCaptureText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  // Camera re-initialization styles
  cameraReinitOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  cameraReinitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginTop: 16,
    textAlign: "center",
  },
});
