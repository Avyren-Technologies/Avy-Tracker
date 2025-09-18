import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FaceVerificationModal from "./FaceVerificationModal";
import {
  FaceVerificationResult,
  FaceVerificationError,
} from "../types/faceDetection";
import ThemeContext from "../context/ThemeContext";

const { height } = Dimensions.get("window");

interface VerificationOrchestratorProps {
  visible: boolean;
  userId: number;
  token: string;
  shiftAction: "start" | "end";
  config: any;
  onSuccess: (result: any) => void;
  onCancel: () => void;
  onError: (error: string) => void;
  locationVerificationFn: () => Promise<boolean>;
  canOverrideGeofence?: boolean;
}

const VerificationOrchestrator: React.FC<VerificationOrchestratorProps> = ({
  visible,
  userId,
  token,
  shiftAction,
  config,
  onSuccess,
  onCancel,
  onError,
  locationVerificationFn,
  canOverrideGeofence = false,
}) => {
  const { theme } = ThemeContext.useTheme();
  // Core state - keep it simple and stable
  const [currentStep, setCurrentStep] = useState<"location" | "face" | null>(
    null,
  );
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 2,
    percentage: 0,
  });
  const [confidenceScore, setConfidenceScore] = useState(0);

  // Detailed status tracking
  const [locationStatus, setLocationStatus] = useState<{
    status: "pending" | "checking" | "success" | "failed";
    message: string;
    details?: string;
  }>({ status: "pending", message: "Waiting to start..." });

  const [faceStatus, setFaceStatus] = useState<{
    status:
      | "pending"
      | "preparing"
      | "detecting"
      | "processing"
      | "success"
      | "failed";
    message: string;
    details?: string;
  }>({ status: "pending", message: "Waiting for location verification..." });

  // Refs for stable references
  const isInitializedRef = useRef(false);
  const processingRef = useRef(false);
  const completedRef = useRef(false);
  const stepTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize flow when modal becomes visible - SIMPLE AND STABLE
  useEffect(() => {
    if (visible && !isInitializedRef.current) {
      console.log("Initializing verification flow...");
      isInitializedRef.current = true;
      completedRef.current = false;
      processingRef.current = false;
      startTimeRef.current = Date.now();
      setCurrentError(null);
      setIsCompleted(false);
      setCurrentStep("location");
      setProgress({ current: 1, total: 2, percentage: 50 });

      // Reset detailed status
      setLocationStatus({
        status: "checking",
        message: "Verifying your location...",
        details: "Checking GPS coordinates and geofence status",
      });
      setFaceStatus({
        status: "pending",
        message: "Waiting for location verification...",
      });
    } else if (!visible && isInitializedRef.current) {
      console.log("Resetting verification flow...");
      isInitializedRef.current = false;
      completedRef.current = false;
      processingRef.current = false;
      setCurrentStep(null);
      setShowFaceModal(false);
      setCurrentError(null);
      setIsCompleted(false);
      setProgress({ current: 0, total: 2, percentage: 0 });
      setConfidenceScore(0);

      // Reset detailed status
      setLocationStatus({ status: "pending", message: "Waiting to start..." });
      setFaceStatus({
        status: "pending",
        message: "Waiting for location verification...",
      });

      // Clear any pending timeouts
      if (stepTimeoutRef.current) {
        clearTimeout(stepTimeoutRef.current);
        stepTimeoutRef.current = null;
      }
    }
  }, [visible]);

  // Process current step - SIMPLE AND STABLE
  const processCurrentStep = useCallback(async () => {
    if (!currentStep || processingRef.current || completedRef.current) {
      return;
    }

    console.log("Processing step:", currentStep);
    processingRef.current = true;
    setCurrentError(null);

    try {
      if (currentStep === "location") {
        console.log("Executing location verification...");
        setLocationStatus({
          status: "checking",
          message: "Verifying your location...",
          details: "Checking GPS coordinates and geofence status",
        });

        const locationSuccess = await locationVerificationFn();

        if (locationSuccess) {
          console.log(
            "Location verification successful, moving to face verification",
          );
          setLocationStatus({
            status: "success",
            message: "Location verified successfully!",
            details: "You are within the required geofence area",
          });
          setFaceStatus({
            status: "preparing",
            message: "Preparing face verification...",
            details: "Initializing camera and face detection",
          });
          setCurrentStep("face");
          setProgress({ current: 2, total: 2, percentage: 100 });
        } else {
          throw new Error("Location verification failed");
        }
      } else if (currentStep === "face") {
        console.log("Showing face verification modal...");
        setFaceStatus({
          status: "detecting",
          message: "Starting face verification...",
          details: "Please look at the camera and follow the instructions",
        });
        setShowFaceModal(true);
      }
    } catch (error) {
      console.error(`Error in ${currentStep} verification:`, error);
      const errorMessage = `${currentStep} verification failed. Please try again.`;
      setCurrentError(errorMessage);
      onError(errorMessage);

      // Update status based on which step failed
      if (currentStep === "location") {
        setLocationStatus({
          status: "failed",
          message: "Location verification failed",
          details:
            "Unable to verify your location. Please check your GPS settings.",
        });
      } else if (currentStep === "face") {
        setFaceStatus({
          status: "failed",
          message: "Face verification failed",
          details: "Unable to complete face verification. Please try again.",
        });
      }
    } finally {
      processingRef.current = false;
    }
  }, [currentStep, locationVerificationFn, onError]);

  // Auto-process steps with timeout - SIMPLE AND STABLE
  useEffect(() => {
    if (
      !visible ||
      !currentStep ||
      processingRef.current ||
      completedRef.current
    ) {
      return;
    }

    // Clear any existing timeout
    if (stepTimeoutRef.current) {
      clearTimeout(stepTimeoutRef.current);
    }

    // Set new timeout to process step
    stepTimeoutRef.current = setTimeout(() => {
      processCurrentStep();
    }, 500);

    return () => {
      if (stepTimeoutRef.current) {
        clearTimeout(stepTimeoutRef.current);
        stepTimeoutRef.current = null;
      }
    };
  }, [visible, currentStep, processCurrentStep]);

  // Handle face verification success - SIMPLE AND STABLE
  const handleFaceVerificationSuccess = useCallback(
    async (result: FaceVerificationResult) => {
      console.log("Face verification successful:", result);

      // Close face modal
      setShowFaceModal(false);

      // Update face status
      setFaceStatus({
        status: "success",
        message: "Face verification completed!",
        details: `Confidence: ${Math.round((result.confidence || 0) * 100)}%`,
      });

      // Mark as completed
      completedRef.current = true;
      setIsCompleted(true);
      setConfidenceScore(Math.round((result.confidence || 0) * 100));

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess({
          status: "completed",
          completedSteps: ["location", "face"],
          sessionId: `session_${Date.now()}`,
          confidenceScore: Math.round((result.confidence || 0) * 100),
          fallbackMode: false,
          totalLatency: Date.now() - startTimeRef.current,
          steps: {
            location: { status: "completed" },
            face: { status: "completed", result },
          },
        });
      }, 300);
    },
    [onSuccess],
  );

  // Handle face verification error
  const handleFaceVerificationError = useCallback(
    (error: FaceVerificationError) => {
      console.error("Face verification error:", error);
      setShowFaceModal(false);
      // Use user-friendly message instead of technical error message
      const userMessage = (error as any).userMessage || error.message;
      setCurrentError(userMessage);
      setFaceStatus({
        status: "failed",
        message: "Face verification failed",
        details: userMessage,
      });
      onError(userMessage);
    },
    [onError],
  );

  // Get theme-aware styles
  const getThemeStyles = () => {
    const isDark = theme === "dark";
    return {
      modalOverlay: {
        flex: 1,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.5)",
        justifyContent: "center" as const,
        alignItems: "center" as const,
        padding: 20,
      },
      modalContainer: {
        backgroundColor: isDark ? "#1f2937" : "#ffffff",
        borderRadius: 16,
        width: "100%" as const,
        maxWidth: 400,
        maxHeight: height * 0.8,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
      },
      headerTitle: {
        fontSize: 24,
        fontWeight: "700" as const,
        color: isDark ? "#f9fafb" : "#1f2937",
        marginBottom: 4,
      },
      headerSubtitle: {
        fontSize: 16,
        color: isDark ? "#d1d5db" : "#6b7280",
        textAlign: "center" as const,
      },
      progressText: {
        fontSize: 14,
        fontWeight: "600" as const,
        color: isDark ? "#e5e7eb" : "#374151",
      },
      progressPercentage: {
        fontSize: 14,
        fontWeight: "600" as const,
        color: "#3b82f6",
      },
      progressBar: {
        height: 6,
        backgroundColor: isDark ? "#374151" : "#e5e7eb",
        borderRadius: 3,
        overflow: "hidden" as const,
      },
      stepCard: {
        backgroundColor: isDark ? "#374151" : "#f8fafc",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? "#4b5563" : "#e2e8f0",
      },
      stepCardSuccess: {
        backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
        borderColor: isDark ? "#065f46" : "#bbf7d0",
      },
      stepCardFailed: {
        backgroundColor: isDark ? "#7f1d1d" : "#fef2f2",
        borderColor: isDark ? "#991b1b" : "#fecaca",
      },
      stepIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: isDark ? "#4b5563" : "#e5e7eb",
        justifyContent: "center" as const,
        alignItems: "center" as const,
        marginRight: 12,
      },
      stepIconActive: {
        backgroundColor: "#3b82f6",
      },
      stepIconSuccess: {
        backgroundColor: "#10b981",
      },
      stepIconFailed: {
        backgroundColor: "#ef4444",
      },
      stepTitle: {
        fontSize: 16,
        fontWeight: "600" as const,
        color: isDark ? "#f9fafb" : "#1f2937",
        marginBottom: 4,
      },
      stepMessage: {
        fontSize: 14,
        color: isDark ? "#e5e7eb" : "#374151",
        marginBottom: 2,
      },
      stepDetails: {
        fontSize: 12,
        color: isDark ? "#9ca3af" : "#6b7280",
        fontStyle: "italic" as const,
      },
      successContainer: {
        alignItems: "center" as const,
        padding: 24,
        backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#065f46" : "#bbf7d0",
        marginBottom: 24,
      },
      successTitle: {
        fontSize: 20,
        fontWeight: "700" as const,
        color: "#10b981",
        marginTop: 12,
        marginBottom: 8,
      },
      successMessage: {
        fontSize: 16,
        color: isDark ? "#e5e7eb" : "#374151",
        textAlign: "center" as const,
        marginBottom: 8,
      },
      confidenceText: {
        fontSize: 14,
        fontWeight: "600" as const,
        color: "#10b981",
      },
      errorContainer: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        padding: 16,
        backgroundColor: isDark ? "#7f1d1d" : "#fef2f2",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? "#991b1b" : "#fecaca",
        marginBottom: 24,
      },
      errorText: {
        marginLeft: 12,
        fontSize: 14,
        fontWeight: "500" as const,
        color: "#ef4444",
        flex: 1,
      },
      retryButton: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#3b82f6",
        borderRadius: 6,
        alignSelf: "center" as const,
      },
      retryButtonText: {
        fontSize: 14,
        fontWeight: "500" as const,
        color: "#ffffff",
      },
      actionButtons: {
        alignItems: "center" as const,
      },
      cancelButton: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: isDark ? "#4b5563" : "#f3f4f6",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDark ? "#6b7280" : "#d1d5db",
      },
      cancelButtonText: {
        fontSize: 16,
        fontWeight: "500" as const,
        color: isDark ? "#e5e7eb" : "#6b7280",
        textAlign: "center" as const,
      },
    };
  };

  const themeStyles = getThemeStyles();

  // Don't render anything if not visible
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View style={themeStyles.modalOverlay}>
        <View style={themeStyles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={themeStyles.headerTitle}>Shift Verification</Text>
            <Text style={themeStyles.headerSubtitle}>
              {shiftAction === "start"
                ? "Starting your shift"
                : "Ending your shift"}
            </Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={themeStyles.progressText}>
                Step {progress.current} of {progress.total}
              </Text>
              <Text style={themeStyles.progressPercentage}>
                {progress.percentage}%
              </Text>
            </View>
            <View style={themeStyles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.percentage}%` },
                ]}
              />
            </View>
          </View>

          {/* Verification Steps */}
          <View style={styles.stepsContainer}>
            {/* Location Verification Step */}
            <View
              style={[
                themeStyles.stepCard,
                locationStatus.status === "success" &&
                  themeStyles.stepCardSuccess,
                locationStatus.status === "failed" &&
                  themeStyles.stepCardFailed,
              ]}
            >
              <View style={styles.stepHeader}>
                <View
                  style={[
                    themeStyles.stepIcon,
                    locationStatus.status === "success" &&
                      themeStyles.stepIconSuccess,
                    locationStatus.status === "failed" &&
                      themeStyles.stepIconFailed,
                    locationStatus.status === "checking" &&
                      themeStyles.stepIconActive,
                  ]}
                >
                  {locationStatus.status === "success" ? (
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                  ) : locationStatus.status === "failed" ? (
                    <Ionicons name="close" size={20} color="#ffffff" />
                  ) : locationStatus.status === "checking" ? (
                    <Ionicons name="location" size={20} color="#ffffff" />
                  ) : (
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={theme === "dark" ? "#9ca3af" : "#6b7280"}
                    />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={themeStyles.stepTitle}>
                    Location Verification
                  </Text>
                  <Text style={themeStyles.stepMessage}>
                    {locationStatus.message}
                  </Text>
                  {locationStatus.details && (
                    <Text style={themeStyles.stepDetails}>
                      {locationStatus.details}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Face Verification Step */}
            <View
              style={[
                themeStyles.stepCard,
                faceStatus.status === "success" && themeStyles.stepCardSuccess,
                faceStatus.status === "failed" && themeStyles.stepCardFailed,
              ]}
            >
              <View style={styles.stepHeader}>
                <View
                  style={[
                    themeStyles.stepIcon,
                    faceStatus.status === "success" &&
                      themeStyles.stepIconSuccess,
                    faceStatus.status === "failed" &&
                      themeStyles.stepIconFailed,
                    (faceStatus.status === "preparing" ||
                      faceStatus.status === "detecting" ||
                      faceStatus.status === "processing") &&
                      themeStyles.stepIconActive,
                  ]}
                >
                  {faceStatus.status === "success" ? (
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                  ) : faceStatus.status === "failed" ? (
                    <Ionicons name="close" size={20} color="#ffffff" />
                  ) : faceStatus.status === "preparing" ||
                    faceStatus.status === "detecting" ||
                    faceStatus.status === "processing" ? (
                    <Ionicons name="camera" size={20} color="#ffffff" />
                  ) : (
                    <Ionicons
                      name="camera-outline"
                      size={20}
                      color={theme === "dark" ? "#9ca3af" : "#6b7280"}
                    />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={themeStyles.stepTitle}>Face Verification</Text>
                  <Text style={themeStyles.stepMessage}>
                    {faceStatus.message}
                  </Text>
                  {faceStatus.details && (
                    <Text style={themeStyles.stepDetails}>
                      {faceStatus.details}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Success State */}
          {isCompleted && (
            <View style={themeStyles.successContainer}>
              <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              <Text style={themeStyles.successTitle}>
                Verification Complete!
              </Text>
              <Text style={themeStyles.successMessage}>
                Your shift has been{" "}
                {shiftAction === "start" ? "started" : "ended"} successfully.
              </Text>
              {confidenceScore > 0 && (
                <Text style={themeStyles.confidenceText}>
                  Face Confidence: {confidenceScore}%
                </Text>
              )}
            </View>
          )}

          {/* Error State */}
          {currentError && (
            <View style={themeStyles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={themeStyles.errorText}>{currentError}</Text>
              <TouchableOpacity
                style={themeStyles.retryButton}
                onPress={() => processCurrentStep()}
              >
                <Text style={themeStyles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          <View style={themeStyles.actionButtons}>
            {!isCompleted && (
              <TouchableOpacity
                style={themeStyles.cancelButton}
                onPress={onCancel}
              >
                <Text style={themeStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        mode="verify"
        onSuccess={handleFaceVerificationSuccess}
        onError={handleFaceVerificationError}
        onCancel={() => {
          setShowFaceModal(false);
          setCurrentError("Face verification was cancelled");
          onCancel();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: height * 0.8,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 3,
  },
  stepsContainer: {
    marginBottom: 24,
  },
  stepCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  stepCardSuccess: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  stepCardFailed: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepIconActive: {
    backgroundColor: "#3b82f6",
  },
  stepIconSuccess: {
    backgroundColor: "#10b981",
  },
  stepIconFailed: {
    backgroundColor: "#ef4444",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  stepMessage: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 2,
  },
  stepDetails: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  successContainer: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10b981",
    marginTop: 12,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10b981",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    marginBottom: 24,
  },
  errorText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "500",
    color: "#ef4444",
    flex: 1,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 6,
    alignSelf: "center",
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },
  actionButtons: {
    alignItems: "center",
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#6b7280",
    textAlign: "center",
  },
});

export default VerificationOrchestrator;
