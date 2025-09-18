import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {
  FaceVerificationResult,
  FaceVerificationError,
} from "../types/faceDetection";

// Types for verification flow
export interface LocationResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  isInGeofence?: boolean;
  geofenceName?: string;
  error?: string;
  confidence?: number;
}

export interface VerificationStep {
  type: "location" | "face";
  required: boolean;
  completed: boolean;
  result?: LocationResult | FaceVerificationResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
  startTime?: number;
  endTime?: number;
}

export interface VerificationFlowState {
  sessionId: string;
  userId: number;
  shiftAction: "start" | "end";
  steps: VerificationStep[];
  currentStepIndex: number;
  overallStatus:
    | "pending"
    | "in_progress"
    | "completed"
    | "failed"
    | "overridden";
  confidenceScore: number;
  fallbackMode: boolean;
  canOverride: boolean;
  overrideReason?: string;
  startTime: number;
  endTime?: number;
  auditLog: VerificationAuditEntry[];
}

export interface VerificationAuditEntry {
  timestamp: number;
  event: string;
  details: any;
  stepType?: "location" | "face";
  success?: boolean;
  error?: string;
  latency?: number;
}

export interface VerificationConfig {
  requireLocation: boolean;
  requireFace: boolean;
  allowLocationFallback: boolean;
  allowFaceFallback: boolean;
  maxRetries: number;
  timeoutMs: number;
  confidenceThreshold: number;
}

// Default configuration
const DEFAULT_CONFIG: VerificationConfig = {
  requireLocation: true,
  requireFace: true,
  allowLocationFallback: true,
  allowFaceFallback: true,
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds
  confidenceThreshold: 0.7,
};

/**
 * Initialize a new verification flow session
 */
export const initializeVerificationFlow = async (
  userId: number,
  shiftAction: "start" | "end",
  config: Partial<VerificationConfig> = {},
): Promise<VerificationFlowState> => {
  const sessionId = `verification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const steps: VerificationStep[] = [];

  // Add location verification step if required
  if (mergedConfig.requireLocation) {
    steps.push({
      type: "location",
      required: true,
      completed: false,
      retryCount: 0,
      maxRetries: mergedConfig.maxRetries,
    });
  }

  // Add face verification step if required
  if (mergedConfig.requireFace) {
    steps.push({
      type: "face",
      required: true,
      completed: false,
      retryCount: 0,
      maxRetries: mergedConfig.maxRetries,
    });
  }

  const flowState: VerificationFlowState = {
    sessionId,
    userId,
    shiftAction,
    steps,
    currentStepIndex: 0,
    overallStatus: "pending",
    confidenceScore: 0,
    fallbackMode: false,
    canOverride: false,
    startTime: Date.now(),
    auditLog: [
      {
        timestamp: Date.now(),
        event: "verification_flow_initialized",
        details: { sessionId, userId, shiftAction, config: mergedConfig },
      },
    ],
  };

  // Store session in AsyncStorage for persistence
  await AsyncStorage.setItem(
    `verification_session_${sessionId}`,
    JSON.stringify(flowState),
  );

  return flowState;
};

/**
 * Execute the next verification step in the flow
 */
export const executeNextVerificationStep = async (
  flowState: VerificationFlowState,
  locationVerificationFn?: () => Promise<LocationResult>,
  faceVerificationFn?: () => Promise<FaceVerificationResult>,
): Promise<VerificationFlowState> => {
  const startTime = Date.now();

  if (flowState.currentStepIndex >= flowState.steps.length) {
    return await completeVerificationFlow(flowState);
  }

  const currentStep = flowState.steps[flowState.currentStepIndex];
  currentStep.startTime = startTime;

  // Update overall status
  flowState.overallStatus = "in_progress";

  // Add audit log entry
  flowState.auditLog.push({
    timestamp: startTime,
    event: "step_started",
    details: {
      stepType: currentStep.type,
      stepIndex: flowState.currentStepIndex,
    },
    stepType: currentStep.type,
  });

  try {
    let result: LocationResult | FaceVerificationResult;

    if (currentStep.type === "location" && locationVerificationFn) {
      result = await Promise.race([
        locationVerificationFn(),
        new Promise<LocationResult>((_, reject) =>
          setTimeout(
            () => reject(new Error("Location verification timeout")),
            10000,
          ),
        ),
      ]);
    } else if (currentStep.type === "face" && faceVerificationFn) {
      result = await Promise.race([
        faceVerificationFn(),
        new Promise<FaceVerificationResult>((_, reject) =>
          setTimeout(
            () => reject(new Error("Face verification timeout")),
            15000,
          ),
        ),
      ]);
    } else {
      throw new Error(
        `No verification function provided for step type: ${currentStep.type}`,
      );
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    currentStep.endTime = endTime;
    currentStep.result = result;
    currentStep.completed = result.success;

    // Add audit log entry for step completion
    flowState.auditLog.push({
      timestamp: endTime,
      event: "step_completed",
      details: { stepType: currentStep.type, result, latency },
      stepType: currentStep.type,
      success: result.success,
      latency,
    });

    if (result.success) {
      // Move to next step
      flowState.currentStepIndex++;

      // Update confidence score
      const stepConfidence = calculateStepConfidence(currentStep.type, result);
      flowState.confidenceScore = updateOverallConfidence(
        flowState.confidenceScore,
        stepConfidence,
      );
    } else {
      // Handle step failure
      currentStep.retryCount++;
      currentStep.error =
        "error" in result ? result.error : "Verification failed";

      // Check if we can retry
      if (currentStep.retryCount < currentStep.maxRetries) {
        flowState.auditLog.push({
          timestamp: Date.now(),
          event: "step_retry",
          details: {
            stepType: currentStep.type,
            retryCount: currentStep.retryCount,
          },
          stepType: currentStep.type,
        });

        // Don't advance step index, allow retry
        return await updateVerificationSession(flowState);
      } else {
        // Max retries reached, check fallback options
        return await handleStepFailure(flowState, currentStep);
      }
    }
  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;

    currentStep.endTime = endTime;
    currentStep.error =
      error instanceof Error ? error.message : "Unknown error";
    currentStep.retryCount++;

    flowState.auditLog.push({
      timestamp: endTime,
      event: "step_error",
      details: {
        stepType: currentStep.type,
        error: currentStep.error,
        latency,
      },
      stepType: currentStep.type,
      success: false,
      error: currentStep.error,
      latency,
    });

    if (currentStep.retryCount < currentStep.maxRetries) {
      // Allow retry
      return await updateVerificationSession(flowState);
    } else {
      // Max retries reached
      return await handleStepFailure(flowState, currentStep);
    }
  }

  return await updateVerificationSession(flowState);
};

/**
 * Handle step failure with fallback logic
 */
const handleStepFailure = async (
  flowState: VerificationFlowState,
  failedStep: VerificationStep,
): Promise<VerificationFlowState> => {
  const otherSteps = flowState.steps.filter(
    (_, index) => index !== flowState.currentStepIndex,
  );
  const hasCompletedOtherSteps = otherSteps.some((step) => step.completed);

  // Check if we can use fallback mode
  if (hasCompletedOtherSteps && !flowState.fallbackMode) {
    flowState.fallbackMode = true;
    flowState.canOverride = true;

    flowState.auditLog.push({
      timestamp: Date.now(),
      event: "fallback_mode_enabled",
      details: {
        failedStepType: failedStep.type,
        completedSteps: otherSteps
          .filter((s) => s.completed)
          .map((s) => s.type),
      },
    });

    // Skip failed step and continue
    flowState.currentStepIndex++;

    if (flowState.currentStepIndex >= flowState.steps.length) {
      return await completeVerificationFlow(flowState);
    }

    return await updateVerificationSession(flowState);
  }

  // No fallback available, mark as failed but allow override
  flowState.overallStatus = "failed";
  flowState.canOverride = true;

  flowState.auditLog.push({
    timestamp: Date.now(),
    event: "verification_failed",
    details: {
      failedStepType: failedStep.type,
      canOverride: flowState.canOverride,
      fallbackMode: flowState.fallbackMode,
    },
  });

  return await updateVerificationSession(flowState);
};

/**
 * Complete the verification flow
 */
const completeVerificationFlow = async (
  flowState: VerificationFlowState,
): Promise<VerificationFlowState> => {
  flowState.endTime = Date.now();

  // Determine final status
  const allRequiredStepsCompleted = flowState.steps
    .filter((step) => step.required)
    .every((step) => step.completed);

  if (allRequiredStepsCompleted) {
    flowState.overallStatus = "completed";
  } else if (
    flowState.fallbackMode &&
    flowState.steps.some((step) => step.completed)
  ) {
    flowState.overallStatus = "completed";
    flowState.confidenceScore *= 0.8; // Reduce confidence for fallback mode
  } else {
    flowState.overallStatus = "failed";
  }

  // Calculate final confidence score
  const completedSteps = flowState.steps.filter((step) => step.completed);
  if (completedSteps.length > 0) {
    const avgConfidence =
      completedSteps.reduce((sum, step) => {
        const stepConfidence = calculateStepConfidence(step.type, step.result!);
        return sum + stepConfidence;
      }, 0) / completedSteps.length;

    flowState.confidenceScore = Math.max(
      flowState.confidenceScore,
      avgConfidence,
    );
  }

  flowState.auditLog.push({
    timestamp: Date.now(),
    event: "verification_flow_completed",
    details: {
      status: flowState.overallStatus,
      confidenceScore: flowState.confidenceScore,
      totalLatency: flowState.endTime - flowState.startTime,
      completedSteps: completedSteps.length,
      totalSteps: flowState.steps.length,
    },
  });

  return await updateVerificationSession(flowState);
};

/**
 * Apply manager override to the verification flow
 */
export const applyManagerOverride = async (
  flowState: VerificationFlowState,
  reason: string,
  overrideBy: number,
): Promise<VerificationFlowState> => {
  flowState.overallStatus = "overridden";
  flowState.overrideReason = reason;
  flowState.endTime = Date.now();

  // Mark all incomplete required steps as overridden
  flowState.steps.forEach((step) => {
    if (step.required && !step.completed) {
      step.completed = true;
      step.result = {
        success: true,
        confidence: 0,
        overridden: true,
        overrideReason: reason,
      } as any;
    }
  });

  flowState.auditLog.push({
    timestamp: Date.now(),
    event: "manager_override_applied",
    details: { reason, overrideBy, originalStatus: flowState.overallStatus },
  });

  return await updateVerificationSession(flowState);
};

/**
 * Calculate confidence score for a verification step
 */
const calculateStepConfidence = (
  stepType: "location" | "face",
  result: LocationResult | FaceVerificationResult,
): number => {
  if (!result.success) return 0;

  if (stepType === "location") {
    const locationResult = result as LocationResult;
    let confidence = 0.8; // Base confidence for successful location

    // Adjust based on accuracy
    if (locationResult.accuracy) {
      if (locationResult.accuracy <= 10) confidence += 0.2;
      else if (locationResult.accuracy <= 50) confidence += 0.1;
      else if (locationResult.accuracy > 100) confidence -= 0.1;
    }

    // Bonus for being in geofence
    if (locationResult.isInGeofence) confidence += 0.1;

    return Math.min(1.0, Math.max(0, confidence));
  }

  if (stepType === "face") {
    const faceResult = result as FaceVerificationResult;
    let confidence = faceResult.confidence || 0.8;

    // Bonus for liveness detection
    if (faceResult.livenessDetected) confidence += 0.1;

    return Math.min(1.0, Math.max(0, confidence));
  }

  return 0.5; // Default confidence
};

/**
 * Update overall confidence score
 */
const updateOverallConfidence = (
  currentConfidence: number,
  stepConfidence: number,
): number => {
  if (currentConfidence === 0) return stepConfidence;

  // Weighted average with slight bias toward higher confidence
  return (currentConfidence + stepConfidence * 1.1) / 2.1;
};

/**
 * Update verification session in storage
 */
const updateVerificationSession = async (
  flowState: VerificationFlowState,
): Promise<VerificationFlowState> => {
  try {
    await AsyncStorage.setItem(
      `verification_session_${flowState.sessionId}`,
      JSON.stringify(flowState),
    );
  } catch (error) {
    console.error("Error updating verification session:", error);
  }

  return flowState;
};

/**
 * Get verification session from storage
 */
export const getVerificationSession = async (
  sessionId: string,
): Promise<VerificationFlowState | null> => {
  try {
    const data = await AsyncStorage.getItem(
      `verification_session_${sessionId}`,
    );
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting verification session:", error);
    return null;
  }
};

/**
 * Clean up old verification sessions
 */
export const cleanupOldVerificationSessions = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const verificationKeys = keys.filter((key) =>
      key.startsWith("verification_session_"),
    );
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const key of verificationKeys) {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const session: VerificationFlowState = JSON.parse(data);
        if (session.startTime < cutoffTime) {
          await AsyncStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning up verification sessions:", error);
  }
};

/**
 * Send verification audit log to server
 */
export const sendVerificationAuditLog = async (
  flowState: VerificationFlowState,
  token: string,
): Promise<void> => {
  try {
    // Calculate comprehensive audit data
    const totalLatency = flowState.endTime
      ? flowState.endTime - flowState.startTime
      : null;
    const completedSteps = flowState.steps.filter((s) => s.completed);
    const failedSteps = flowState.steps.filter(
      (s) => !s.completed && s.retryCount >= s.maxRetries,
    );

    // Prepare detailed step information
    const stepDetails = flowState.steps.map((step) => ({
      type: step.type,
      required: step.required,
      completed: step.completed,
      retryCount: step.retryCount,
      maxRetries: step.maxRetries,
      latency:
        step.endTime && step.startTime ? step.endTime - step.startTime : null,
      error: step.error,
      result: step.result
        ? {
            success: step.result.success,
            confidence:
              "confidence" in step.result ? step.result.confidence : undefined,
            isInGeofence:
              "isInGeofence" in step.result
                ? step.result.isInGeofence
                : undefined,
            geofenceName:
              "geofenceName" in step.result
                ? step.result.geofenceName
                : undefined,
            livenessDetected:
              "livenessDetected" in step.result
                ? step.result.livenessDetected
                : undefined,
          }
        : null,
    }));

    // Prepare audit log with enhanced metadata
    const auditData = {
      sessionId: flowState.sessionId,
      userId: flowState.userId,
      shiftAction: flowState.shiftAction,
      status: flowState.overallStatus,
      confidenceScore: flowState.confidenceScore,
      fallbackMode: flowState.fallbackMode,
      canOverride: flowState.canOverride,
      overrideReason: flowState.overrideReason,

      // Timing information
      startTime: flowState.startTime,
      endTime: flowState.endTime,
      totalLatency,

      // Step information
      steps: stepDetails,
      totalSteps: flowState.steps.length,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      totalRetries: flowState.steps.reduce((sum, s) => sum + s.retryCount, 0),

      // Detailed audit log
      auditLog: flowState.auditLog.map((entry) => ({
        ...entry,
        timestamp: new Date(entry.timestamp).toISOString(),
      })),

      // Performance metrics
      performanceMetrics: {
        avgStepLatency:
          stepDetails
            .filter((s) => s.latency !== null)
            .reduce((sum, s) => sum + (s.latency || 0), 0) /
          Math.max(1, stepDetails.filter((s) => s.latency !== null).length),
        maxStepLatency: Math.max(...stepDetails.map((s) => s.latency || 0)),
        locationStepLatency:
          stepDetails.find((s) => s.type === "location")?.latency || null,
        faceStepLatency:
          stepDetails.find((s) => s.type === "face")?.latency || null,
      },

      // Client information
      clientInfo: {
        platform: "react-native",
        timestamp: new Date().toISOString(),
        version: "1.0.0", // Could be dynamic
      },
    };

    // Send to server
    const response = await axios.post(
      `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/audit-log`,
      auditData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      },
    );

    if (response.status === 200) {
      console.log(
        "✅ Verification audit log sent successfully:",
        flowState.sessionId,
      );

      // Mark audit log as sent in local storage
      await AsyncStorage.setItem(
        `audit_log_sent_${flowState.sessionId}`,
        JSON.stringify({ sent: true, timestamp: Date.now() }),
      );
    }
  } catch (error) {
    console.error("❌ Error sending verification audit log:", error);

    // Store failed audit log locally for retry
    try {
      const failedAuditLogs = await AsyncStorage.getItem("failed_audit_logs");
      const logs = failedAuditLogs ? JSON.parse(failedAuditLogs) : [];

      logs.push({
        sessionId: flowState.sessionId,
        timestamp: Date.now(),
        flowState,
        token,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Keep only last 10 failed logs to prevent storage bloat
      const recentLogs = logs.slice(-10);
      await AsyncStorage.setItem(
        "failed_audit_logs",
        JSON.stringify(recentLogs),
      );

      console.log("📝 Stored failed audit log for retry:", flowState.sessionId);
    } catch (storageError) {
      console.error("Failed to store failed audit log:", storageError);
    }

    // Don't throw - audit logging shouldn't block the main flow
  }
};

/**
 * Monitor verification performance and log metrics
 */
export const monitorVerificationPerformance = (
  flowState: VerificationFlowState,
): void => {
  const totalLatency = flowState.endTime
    ? flowState.endTime - flowState.startTime
    : Date.now() - flowState.startTime;

  // Calculate detailed performance metrics
  const completedSteps = flowState.steps.filter((s) => s.completed);
  const failedSteps = flowState.steps.filter(
    (s) => !s.completed && s.retryCount >= s.maxRetries,
  );
  const totalRetries = flowState.steps.reduce(
    (sum, s) => sum + s.retryCount,
    0,
  );

  const stepLatencies = flowState.steps
    .filter((s) => s.startTime && s.endTime)
    .map((s) => ({
      type: s.type,
      latency: s.endTime! - s.startTime!,
      retries: s.retryCount,
    }));

  const avgStepLatency =
    stepLatencies.length > 0
      ? stepLatencies.reduce((sum, s) => sum + s.latency, 0) /
        stepLatencies.length
      : 0;

  const maxStepLatency =
    stepLatencies.length > 0
      ? Math.max(...stepLatencies.map((s) => s.latency))
      : 0;

  // Enhanced performance metrics
  const performanceMetrics = {
    sessionId: flowState.sessionId,
    userId: flowState.userId,
    shiftAction: flowState.shiftAction,
    totalLatency,
    stepCount: flowState.steps.length,
    completedSteps: completedSteps.length,
    failedSteps: failedSteps.length,
    totalRetries,
    confidenceScore: flowState.confidenceScore,
    fallbackMode: flowState.fallbackMode,
    overallStatus: flowState.overallStatus,
    avgStepLatency,
    maxStepLatency,
    stepBreakdown: stepLatencies,
    auditLogEntries: flowState.auditLog.length,
    timestamp: Date.now(),
  };

  // Log comprehensive performance metrics
  console.log("Verification Performance Metrics:", performanceMetrics);

  // Performance warnings with detailed context
  if (totalLatency > 30000) {
    console.warn("⚠️ Verification flow exceeded 30 seconds:", {
      sessionId: flowState.sessionId,
      totalLatency,
      slowestStep: stepLatencies.reduce(
        (max, current) => (current.latency > max.latency ? current : max),
        { type: "none", latency: 0, retries: 0 },
      ),
    });
  }

  if (flowState.confidenceScore < 0.5) {
    console.warn("⚠️ Low verification confidence score:", {
      sessionId: flowState.sessionId,
      confidenceScore: flowState.confidenceScore,
      completedSteps: completedSteps.map((s) => s.type),
      fallbackMode: flowState.fallbackMode,
    });
  }

  if (avgStepLatency > 10000) {
    console.warn("⚠️ High average step latency detected:", {
      sessionId: flowState.sessionId,
      avgStepLatency,
      stepBreakdown: stepLatencies,
    });
  }

  if (totalRetries > 5) {
    console.warn("⚠️ High retry count detected:", {
      sessionId: flowState.sessionId,
      totalRetries,
      stepRetries: flowState.steps.map((s) => ({
        type: s.type,
        retries: s.retryCount,
      })),
    });
  }

  // Store performance metrics locally for analytics
  AsyncStorage.setItem(
    `verification_metrics_${flowState.sessionId}`,
    JSON.stringify(performanceMetrics),
  ).catch((error) => {
    console.error("Failed to store performance metrics:", error);
  });
};

/**
 * Retry failed audit logs
 */
export const retryFailedAuditLogs = async (): Promise<void> => {
  try {
    const failedAuditLogs = await AsyncStorage.getItem("failed_audit_logs");
    if (!failedAuditLogs) return;

    const logs = JSON.parse(failedAuditLogs);
    const successfulRetries: string[] = [];

    for (const log of logs) {
      try {
        await sendVerificationAuditLog(log.flowState, log.token);
        successfulRetries.push(log.sessionId);
        console.log("✅ Successfully retried audit log:", log.sessionId);
      } catch (error) {
        console.log("❌ Retry failed for audit log:", log.sessionId);
      }
    }

    // Remove successfully retried logs
    if (successfulRetries.length > 0) {
      const remainingLogs = logs.filter(
        (log: any) => !successfulRetries.includes(log.sessionId),
      );
      await AsyncStorage.setItem(
        "failed_audit_logs",
        JSON.stringify(remainingLogs),
      );
      console.log(
        `📝 Removed ${successfulRetries.length} successfully retried audit logs`,
      );
    }
  } catch (error) {
    console.error("Error retrying failed audit logs:", error);
  }
};

/**
 * Get verification flow status summary
 */
export const getVerificationFlowSummary = (
  flowState: VerificationFlowState,
) => {
  const completedSteps = flowState.steps.filter((s) => s.completed);
  const failedSteps = flowState.steps.filter(
    (s) => !s.completed && s.retryCount >= s.maxRetries,
  );

  return {
    sessionId: flowState.sessionId,
    status: flowState.overallStatus,
    progress: `${completedSteps.length}/${flowState.steps.length}`,
    confidenceScore: Math.round(flowState.confidenceScore * 100),
    totalLatency: flowState.endTime
      ? flowState.endTime - flowState.startTime
      : null,
    canOverride: flowState.canOverride,
    fallbackMode: flowState.fallbackMode,
    completedSteps: completedSteps.map((s) => s.type),
    failedSteps: failedSteps.map((s) => s.type),
    nextStep:
      flowState.currentStepIndex < flowState.steps.length
        ? flowState.steps[flowState.currentStepIndex].type
        : null,
  };
};
