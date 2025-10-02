import { useState, useCallback, useEffect, useRef } from "react";
import {
  VerificationFlowState,
  VerificationConfig,
  LocationResult,
  VerificationFlowSummary,
  VerificationPerformanceMetrics,
} from "../types/verification";
import { FaceVerificationResult } from "../types/faceDetection";
import {
  initializeVerificationFlow,
  executeNextVerificationStep,
  applyManagerOverride,
  getVerificationSession,
  sendVerificationAuditLog,
  monitorVerificationPerformance,
  getVerificationFlowSummary,
  cleanupOldVerificationSessions,
} from "../services/VerificationFlowService";

interface UseVerificationFlowProps {
  userId: number;
  token: string;
  onStepCompleted?: (step: string, success: boolean) => void;
  onFlowCompleted?: (summary: VerificationFlowSummary) => void;
  onFlowFailed?: (summary: VerificationFlowSummary) => void;
  onOverrideRequired?: (summary: VerificationFlowSummary) => void;
  onPerformanceMetrics?: (metrics: VerificationPerformanceMetrics) => void;
}

interface UseVerificationFlowReturn {
  // State
  flowState: VerificationFlowState | null;
  isInitialized: boolean;
  isInProgress: boolean;
  currentStep: string | null;
  canOverride: boolean;
  summary: VerificationFlowSummary | null;

  // Actions
  startVerificationFlow: (
    shiftAction: "start" | "end",
    config?: Partial<VerificationConfig>,
  ) => Promise<void>;
  executeLocationVerification: (
    locationVerificationFn: () => Promise<LocationResult>,
  ) => Promise<void>;
  executeFaceVerification: (
    faceVerificationFn: () => Promise<FaceVerificationResult>,
  ) => Promise<void>;
  executeNextStep: (
    locationVerificationFn?: () => Promise<LocationResult>,
    faceVerificationFn?: () => Promise<FaceVerificationResult>,
  ) => Promise<void>;
  applyOverride: (reason: string, overrideBy: number) => Promise<void>;
  resetFlow: () => void;

  // Utilities
  getStepProgress: () => { current: number; total: number; percentage: number };
  getConfidenceScore: () => number;
  getPerformanceMetrics: () => VerificationPerformanceMetrics | null;
  canRetryCurrentStep: () => boolean;
}

export const useVerificationFlow = ({
  userId,
  token,
  onStepCompleted,
  onFlowCompleted,
  onFlowFailed,
  onOverrideRequired,
  onPerformanceMetrics,
}: UseVerificationFlowProps): UseVerificationFlowReturn => {
  const [flowState, setFlowState] = useState<VerificationFlowState | null>(
    null,
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [summary, setSummary] = useState<VerificationFlowSummary | null>(null);

  const performanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStepIndexRef = useRef(-1);

  // Cleanup old sessions on mount
  useEffect(() => {
    cleanupOldVerificationSessions();
  }, []);

  // Monitor performance and trigger callbacks
  useEffect(() => {
    if (!flowState) return;

    // Update summary
    const newSummary = getVerificationFlowSummary(flowState);
    setSummary(newSummary);

    // Check if step completed
    if (flowState.currentStepIndex !== lastStepIndexRef.current) {
      const completedStepIndex = lastStepIndexRef.current;
      if (
        completedStepIndex >= 0 &&
        completedStepIndex < flowState.steps.length
      ) {
        const completedStep = flowState.steps[completedStepIndex];
        onStepCompleted?.(completedStep.type, completedStep.completed);
      }
      lastStepIndexRef.current = flowState.currentStepIndex;
    }

    // Check flow completion
    if (flowState.overallStatus === "completed") {
      onFlowCompleted?.(newSummary);

      // Send audit log to server
      sendVerificationAuditLog(flowState, token).catch((error) => {
        console.error("Failed to send audit log:", error);
      });

      // Monitor performance
      monitorVerificationPerformance(flowState);
      const metrics = getPerformanceMetrics();
      if (metrics) {
        onPerformanceMetrics?.(metrics);
      }

      // Don't continue processing if flow is completed
      return;
    } else if (flowState.overallStatus === "failed") {
      onFlowFailed?.(newSummary);

      if (flowState.canOverride) {
        onOverrideRequired?.(newSummary);
      }

      // Don't continue processing if flow has failed
      return;
    }

    // Set up performance monitoring timer
    if (
      flowState.overallStatus === "in_progress" &&
      !performanceTimerRef.current
    ) {
      performanceTimerRef.current = setInterval(() => {
        const metrics = getPerformanceMetrics();
        if (metrics) {
          onPerformanceMetrics?.(metrics);
        }
      }, 5000); // Monitor every 5 seconds
    } else if (
      flowState.overallStatus !== "in_progress" &&
      performanceTimerRef.current
    ) {
      clearInterval(performanceTimerRef.current);
      performanceTimerRef.current = null;
    }

    return () => {
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
        performanceTimerRef.current = null;
      }
    };
  }, [
    flowState,
    token,
    onStepCompleted,
    onFlowCompleted,
    onFlowFailed,
    onOverrideRequired,
    onPerformanceMetrics,
  ]);

  const startVerificationFlow = useCallback(
    async (
      shiftAction: "start" | "end",
      config?: Partial<VerificationConfig>,
    ) => {
      try {
        const newFlowState = await initializeVerificationFlow(
          userId,
          shiftAction,
          config,
        );
        setFlowState(newFlowState);
        setIsInitialized(true);
        lastStepIndexRef.current = -1;
      } catch (error) {
        console.error("Error starting verification flow:", error);
        throw error;
      }
    },
    [userId],
  );

  const executeLocationVerification = useCallback(
    async (locationVerificationFn: () => Promise<LocationResult>) => {
      if (!flowState) {
        throw new Error("Verification flow not initialized");
      }

      const currentStep = flowState.steps[flowState.currentStepIndex];
      if (currentStep?.type !== "location") {
        throw new Error("Current step is not location verification");
      }

      try {
        const updatedFlowState = await executeNextVerificationStep(
          flowState,
          locationVerificationFn,
          undefined,
        );
        setFlowState(updatedFlowState);
      } catch (error) {
        console.error("Error executing location verification:", error);
        throw error;
      }
    },
    [flowState],
  );

  const executeFaceVerification = useCallback(
    async (faceVerificationFn: () => Promise<FaceVerificationResult>) => {
      if (!flowState) {
        throw new Error("Verification flow not initialized");
      }

      const currentStep = flowState.steps[flowState.currentStepIndex];
      if (currentStep?.type !== "face") {
        throw new Error("Current step is not face verification");
      }

      try {
        const updatedFlowState = await executeNextVerificationStep(
          flowState,
          undefined,
          faceVerificationFn,
        );
        setFlowState(updatedFlowState);
      } catch (error) {
        console.error("Error executing face verification:", error);
        throw error;
      }
    },
    [flowState],
  );

  const executeNextStep = useCallback(
    async (
      locationVerificationFn?: () => Promise<LocationResult>,
      faceVerificationFn?: () => Promise<FaceVerificationResult>,
    ) => {
      if (!flowState) {
        throw new Error("Verification flow not initialized");
      }

      try {
        const updatedFlowState = await executeNextVerificationStep(
          flowState,
          locationVerificationFn,
          faceVerificationFn,
        );
        setFlowState(updatedFlowState);
      } catch (error) {
        console.error("Error executing next verification step:", error);
        throw error;
      }
    },
    [flowState],
  );

  const applyOverride = useCallback(
    async (reason: string, overrideBy: number) => {
      if (!flowState) {
        throw new Error("Verification flow not initialized");
      }

      try {
        const updatedFlowState = await applyManagerOverride(
          flowState,
          reason,
          overrideBy,
        );
        setFlowState(updatedFlowState);
      } catch (error) {
        console.error("Error applying manager override:", error);
        throw error;
      }
    },
    [flowState],
  );

  const resetFlow = useCallback(() => {
    setFlowState(null);
    setIsInitialized(false);
    setSummary(null);
    lastStepIndexRef.current = -1;

    if (performanceTimerRef.current) {
      clearInterval(performanceTimerRef.current);
      performanceTimerRef.current = null;
    }
  }, []);

  const getStepProgress = useCallback(() => {
    if (!flowState) {
      return { current: 0, total: 0, percentage: 0 };
    }

    const completedSteps = flowState.steps.filter(
      (step) => step.completed,
    ).length;
    const totalSteps = flowState.steps.length;
    const percentage =
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      current: completedSteps,
      total: totalSteps,
      percentage,
    };
  }, [flowState]);

  const getConfidenceScore = useCallback(() => {
    return flowState?.confidenceScore || 0;
  }, [flowState]);

  const getPerformanceMetrics =
    useCallback((): VerificationPerformanceMetrics | null => {
      if (!flowState) return null;

      const totalLatency = flowState.endTime
        ? flowState.endTime - flowState.startTime
        : Date.now() - flowState.startTime;

      const completedSteps = flowState.steps.filter((s) => s.completed).length;
      const retryCount = flowState.steps.reduce(
        (sum, s) => sum + s.retryCount,
        0,
      );

      const stepsWithLatency = flowState.steps.filter(
        (s) => s.startTime && s.endTime,
      );
      const avgStepLatency =
        stepsWithLatency.length > 0
          ? stepsWithLatency.reduce(
              (sum, s) => sum + (s.endTime! - s.startTime!),
              0,
            ) / stepsWithLatency.length
          : undefined;

      return {
        sessionId: flowState.sessionId,
        userId: flowState.userId,
        shiftAction: flowState.shiftAction,
        totalLatency,
        stepCount: flowState.steps.length,
        completedSteps,
        failedSteps: flowState.steps.filter(
          (s) => !s.completed && s.retryCount >= s.maxRetries,
        ).length,
        retryCount,
        confidenceScore: flowState.confidenceScore,
        fallbackMode: flowState.fallbackMode,
        overallStatus: flowState.overallStatus,
        avgStepLatency: avgStepLatency || 0,
        maxStepLatency:
          stepsWithLatency.length > 0
            ? Math.max(
                ...stepsWithLatency.map((s) => s.endTime! - s.startTime!),
              )
            : 0,
        stepBreakdown: stepsWithLatency.map((s) => ({
          type: s.type,
          latency: s.endTime! - s.startTime!,
          retries: s.retryCount,
        })),
        auditLogEntries: flowState.auditLog.length,
        timestamp: Date.now(),
      };
    }, [flowState]);

  const canRetryCurrentStep = useCallback(() => {
    if (!flowState || flowState.currentStepIndex >= flowState.steps.length) {
      return false;
    }

    const currentStep = flowState.steps[flowState.currentStepIndex];
    return currentStep.retryCount < currentStep.maxRetries;
  }, [flowState]);

  // Computed values
  const isInProgress =
    flowState?.overallStatus === "in_progress" ||
    flowState?.overallStatus === "pending";
  const currentStep =
    flowState && flowState.currentStepIndex < flowState.steps.length
      ? flowState.steps[flowState.currentStepIndex].type
      : null;
  const canOverride = flowState?.canOverride || false;

  return {
    // State
    flowState,
    isInitialized,
    isInProgress,
    currentStep,
    canOverride,
    summary,

    // Actions
    startVerificationFlow,
    executeLocationVerification,
    executeFaceVerification,
    executeNextStep,
    applyOverride,
    resetFlow,

    // Utilities
    getStepProgress,
    getConfidenceScore,
    getPerformanceMetrics,
    canRetryCurrentStep,
  };
};
