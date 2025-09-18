/**
 * Camera Liveness Detection Hook
 *
 * Provides liveness detection capabilities using eye blink detection
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  FaceDetectionData,
  LivenessDetectionData,
  LivenessThresholds,
  UseCameraLivenessReturn,
} from "../types/faceDetection";

// Default liveness detection thresholds (very forgiving for better UX)
const DEFAULT_THRESHOLDS: LivenessThresholds = {
  minBlinkDuration: 20, // milliseconds (ultra-fast blinks)
  maxBlinkDuration: 2000, // milliseconds (very slow blinks)
  eyeClosedThreshold: 0.98, // probability threshold for closed eye (ultra-forgiving)
  eyeOpenThreshold: 0.995, // probability threshold for open eye (ultra-forgiving)
  minLivenessScore: 0.1, // minimum score to consider live (ultra-forgiving)
  blinkTimeoutMs: 60000, // timeout for blink detection (60 seconds)
};

export function useCameraLiveness(
  faceData: FaceDetectionData | null,
  thresholds: Partial<LivenessThresholds> = {},
): UseCameraLivenessReturn {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // State management
  const [isLivenessActive, setIsLivenessActive] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [livenessData, setLivenessData] =
    useState<LivenessDetectionData | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [eyeMovementScore, setEyeMovementScore] = useState(0);

  // Refs for tracking state
  const isMountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const livenessIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blinkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eyeStateHistoryRef = useRef<
    { left: number; right: number; timestamp: number }[]
  >([]);
  const lastBlinkTimeRef = useRef<number>(0);

  // App state handling
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        "Liveness detection app state changed:",
        appStateRef.current,
        "->",
        nextAppState,
      );

      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground
        if (isLivenessActive) {
          console.log("App came to foreground, resuming liveness detection");
        }
      } else if (
        appStateRef.current === "active" &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background
        console.log("App went to background, pausing liveness detection");
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, [isLivenessActive]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (livenessIntervalRef.current) {
        clearInterval(livenessIntervalRef.current);
        livenessIntervalRef.current = null;
      }
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = null;
      }
    };
  }, []);

  // Process liveness detection with specific face data
  const processLivenessDetection = useCallback(
    (currentFaceData: FaceDetectionData) => {
      if (!isMountedRef.current || !currentFaceData || !isLivenessActive) {
        console.log("👁️ Skipping liveness processing:", {
          isMounted: isMountedRef.current,
          hasFaceData: !!currentFaceData,
          isActive: isLivenessActive,
        });
        return;
      }

      const now = currentFaceData.timestamp || Date.now();
      const leftEyeOpen = currentFaceData.leftEyeOpenProbability;
      const rightEyeOpen = currentFaceData.rightEyeOpenProbability;
      const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;

      console.log("👁️ Processing liveness data:", {
        leftEye: leftEyeOpen.toFixed(3),
        rightEye: rightEyeOpen.toFixed(3),
        average: avgEyeOpen.toFixed(3),
        eyeClosedThreshold: config.eyeClosedThreshold,
        eyeOpenThreshold: config.eyeOpenThreshold,
        historyLength: eyeStateHistoryRef.current.length,
      });

      // Add to eye state history (this was moved to processFaceData)
      // Keep only recent history (last 2 seconds)
      eyeStateHistoryRef.current = eyeStateHistoryRef.current.filter(
        (entry) => now - entry.timestamp < 2000,
      );

      // Detect blink pattern in recent history
      const recentHistory = eyeStateHistoryRef.current.slice(-15); // Last 15 readings for better pattern detection
      let blinkDetectedInHistory = false;

      console.log("👁️ Analyzing blink pattern in history:", {
        historyLength: recentHistory.length,
        minRequired: 5,
      });

      if (recentHistory.length >= 5) {
        // Look for open -> closed -> open pattern
        for (let i = 2; i < recentHistory.length - 2; i++) {
          const prev =
            (recentHistory[i - 1].left + recentHistory[i - 1].right) / 2;
          const curr = (recentHistory[i].left + recentHistory[i].right) / 2;
          const next =
            (recentHistory[i + 1].left + recentHistory[i + 1].right) / 2;

          console.log("👁️ Checking blink pattern at index", i, ":", {
            prev: prev.toFixed(3),
            curr: curr.toFixed(3),
            next: next.toFixed(3),
            prevOpen: prev > config.eyeOpenThreshold,
            currClosed: curr < config.eyeClosedThreshold,
            nextOpen: next > config.eyeOpenThreshold,
          });

          // Primary blink detection: open -> closed -> open
          if (
            prev > config.eyeOpenThreshold &&
            curr < config.eyeClosedThreshold &&
            next > config.eyeOpenThreshold
          ) {
            const blinkDuration =
              recentHistory[i + 1].timestamp - recentHistory[i - 1].timestamp;
            const timeSinceLastBlink = now - lastBlinkTimeRef.current;

            console.log("👁️ Potential blink found:", {
              duration: blinkDuration,
              minDuration: config.minBlinkDuration,
              maxDuration: config.maxBlinkDuration,
              timeSinceLastBlink,
              minTimeBetweenBlinks: 500,
            });

            if (
              blinkDuration >= config.minBlinkDuration &&
              blinkDuration <= config.maxBlinkDuration &&
              timeSinceLastBlink > 500
            ) {
              // Prevent duplicate detection

              blinkDetectedInHistory = true;
              lastBlinkTimeRef.current = now;
              setBlinkCount((prev) => {
                const newCount = prev + 1;
                console.log(
                  "👁️ ✅ BLINK DETECTED! Count:",
                  newCount,
                  "Duration:",
                  blinkDuration,
                  "ms",
                );
                return newCount;
              });
              break;
            }
          }

          // Fallback 1: Micro-movement detection (very sensitive)
          if (
            !blinkDetectedInHistory &&
            i >= 2 &&
            i < recentHistory.length - 1
          ) {
            const prev =
              (recentHistory[i - 1].left + recentHistory[i - 1].right) / 2;
            const curr = (recentHistory[i].left + recentHistory[i].right) / 2;
            const next =
              (recentHistory[i + 1].left + recentHistory[i + 1].right) / 2;
            // Look for ANY dip in eye openness (micro-movements)
            const dipAmount = Math.max(prev - curr, next - curr);
            const avgBaseline = (prev + next) / 2;
            console.log("👁️ Micro-movement analysis:", {
              prev: prev.toFixed(4),
              curr: curr.toFixed(4),
              next: next.toFixed(4),
              dipAmount: dipAmount.toFixed(4),
              avgBaseline: avgBaseline.toFixed(4),
            });
            if (
              dipAmount > 0.001 && // Any detectable movement
              avgBaseline > 0.99 && // High baseline (eyes open)
              now - lastBlinkTimeRef.current > 500
            ) {
              // Prevent spam
              console.log("👁️ ✅ MICRO-MOVEMENT DETECTED!", {
                dipAmount: dipAmount.toFixed(4),
                threshold: "0.001",
              });
              blinkDetectedInHistory = true;
              lastBlinkTimeRef.current = now;
              setBlinkCount((prev) => {
                const newCount = prev + 1;
                console.log("👁️ ✅ MICRO-MOVEMENT BLINK! Count:", newCount);
                return newCount;
              });
              break;
            }
          }
          // Fallback 2: Eye variance detection (detect any variation)
          if (
            !blinkDetectedInHistory &&
            i >= 4 &&
            i < recentHistory.length - 1
          ) {
            const last5 = recentHistory.slice(i - 4, i + 1);
            const eyeValues = last5.map((h) => (h.left + h.right) / 2);
            const mean =
              eyeValues.reduce((a, b) => a + b, 0) / eyeValues.length;
            const variance =
              eyeValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
              eyeValues.length;
            const stdDev = Math.sqrt(variance);
            console.log("👁️ Eye variance analysis:", {
              mean: mean.toFixed(4),
              variance: variance.toFixed(6),
              stdDev: stdDev.toFixed(6),
              values: eyeValues.map((v) => v.toFixed(4)),
            });
            if (
              stdDev > 0.0005 && // Any variation in eye openness
              mean > 0.99 && // High average (eyes generally open)
              now - lastBlinkTimeRef.current > 800
            ) {
              // Prevent spam
              console.log("👁️ ✅ EYE VARIANCE DETECTED!", {
                stdDev: stdDev.toFixed(6),
                threshold: "0.0005",
              });
              blinkDetectedInHistory = true;
              lastBlinkTimeRef.current = now;
              setBlinkCount((prev) => {
                const newCount = prev + 1;
                console.log("👁️ ✅ VARIANCE BLINK! Count:", newCount);
                return newCount;
              });
              break;
            }
          }
          // Fallback 3: Traditional fallback (larger movements)
          if (
            !blinkDetectedInHistory &&
            i >= 3 &&
            i < recentHistory.length - 1
          ) {
            const baseline =
              (recentHistory[i - 2].left + recentHistory[i - 2].right) / 2;
            const dip = (recentHistory[i].left + recentHistory[i].right) / 2;
            const recovery =
              (recentHistory[i + 1].left + recentHistory[i + 1].right) / 2;
            // Look for a significant dip in eye openness (even if not fully closed)
            const dipAmount = baseline - dip;
            const recoveryAmount = recovery - dip;
            if (
              dipAmount > 0.01 &&
              recoveryAmount > 0.005 && // Much more sensitive
              baseline > 0.98 &&
              recovery > 0.98 && // Started and ended with eyes open
              now - lastBlinkTimeRef.current > 1200
            ) {
              // Longer gap for fallback detection
              console.log("👁️ Traditional fallback detection:", {
                baseline: baseline.toFixed(4),
                dip: dip.toFixed(4),
                recovery: recovery.toFixed(4),
                dipAmount: dipAmount.toFixed(4),
                recoveryAmount: recoveryAmount.toFixed(4),
              });
              blinkDetectedInHistory = true;
              lastBlinkTimeRef.current = now;
              setBlinkCount((prev) => {
                const newCount = prev + 1;
                console.log(
                  "👁️ ✅ TRADITIONAL FALLBACK BLINK! Count:",
                  newCount,
                );
                return newCount;
              });
              break;
            }
          }
        }
      }

      // Update blink detection state
      if (blinkDetectedInHistory && !blinkDetected) {
        console.log("👁️ Setting blinkDetected to true");
        setBlinkDetected(true);
      }

      // Calculate eye movement score based on variance in eye positions
      const eyeMovementVariance = calculateEyeMovementVariance(
        eyeStateHistoryRef.current,
      );
      setEyeMovementScore(eyeMovementVariance);

      // Calculate overall liveness score
      const currentBlinkCount = blinkDetectedInHistory
        ? blinkCount + 1
        : blinkCount;
      const blinkScore = currentBlinkCount > 0 ? 1.0 : 0.0;
      const movementScore = Math.min(eyeMovementVariance * 2, 1.0); // Scale movement score
      // Time-based score: give points for sustained face detection
      const timeScore = Math.min(eyeStateHistoryRef.current.length / 10, 0.5); // Up to 0.5 for time
      const overallScore =
        blinkScore * 0.5 + movementScore * 0.3 + timeScore * 0.2;

      console.log("👁️ Liveness score calculation:", {
        blinkCount: currentBlinkCount,
        blinkScore,
        movementScore: movementScore.toFixed(3),
        timeScore: timeScore.toFixed(3),
        overallScore: overallScore.toFixed(3),
        minRequired: config.minLivenessScore,
        historyLength: eyeStateHistoryRef.current.length,
      });

      setLivenessScore(overallScore);

      // Update liveness data
      const newLivenessData: LivenessDetectionData = {
        blinkDetected: blinkDetected,
        blinkCount: blinkCount,
        eyeMovementScore: eyeMovementVariance,
        livenessScore: overallScore,
        isLive: overallScore >= config.minLivenessScore,
        timestamp: now,
      };

      setLivenessData(newLivenessData);
    },
    [faceData, isLivenessActive, blinkDetected, blinkCount, config],
  );

  // Calculate eye movement variance
  const calculateEyeMovementVariance = (
    history: { left: number; right: number; timestamp: number }[],
  ): number => {
    if (history.length < 3) return 0;

    const leftValues = history.map((h) => h.left);
    const rightValues = history.map((h) => h.right);

    const leftVariance = calculateVariance(leftValues);
    const rightVariance = calculateVariance(rightValues);

    return (leftVariance + rightVariance) / 2;
  };

  // Calculate variance of an array
  const calculateVariance = (values: number[]): number => {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  };

  // Start liveness detection
  const startLivenessDetection = useCallback(() => {
    if (isLivenessActive) {
      console.log("👁️ Liveness detection already active");
      return;
    }

    console.log("👁️ Starting liveness detection...");
    setIsLivenessActive(true);
    setBlinkDetected(false);
    setBlinkCount(0);
    setLivenessScore(0);
    setEyeMovementScore(0);
    eyeStateHistoryRef.current = [];

    // Note: We process liveness detection directly when face data arrives
    // No need for interval-based processing

    // Set much longer timeout for liveness detection (60 seconds)
    blinkTimeoutRef.current = setTimeout(() => {
      console.log("👁️ Liveness detection timeout after 60 seconds");
      stopLivenessDetection();
    }, 60000); // 60 seconds instead of 15 seconds

    console.log("👁️ Liveness detection started successfully");
  }, [config.blinkTimeoutMs]);

  // Stop liveness detection
  const stopLivenessDetection = useCallback(() => {
    console.log("👁️ Stopping liveness detection...");

    setIsLivenessActive(false);

    if (livenessIntervalRef.current) {
      clearInterval(livenessIntervalRef.current);
      livenessIntervalRef.current = null;
    }

    if (blinkTimeoutRef.current) {
      clearTimeout(blinkTimeoutRef.current);
      blinkTimeoutRef.current = null;
    }

    console.log("👁️ Liveness detection stopped");
  }, []);

  // Reset liveness state
  const resetLivenessState = useCallback(() => {
    console.log("👁️ Resetting liveness state...");

    setBlinkDetected(false);
    setBlinkCount(0);
    setLivenessScore(0);
    setEyeMovementScore(0);
    setLivenessData(null);
    eyeStateHistoryRef.current = [];
    lastBlinkTimeRef.current = 0;
  }, []);

  /**
   * Process face data for liveness detection
   * @param faceData - Current face detection data
   */
  const processFaceData = useCallback(
    (faceData: FaceDetectionData) => {
      console.log("👁️ processFaceData called:", {
        isLivenessActive,
        hasFaceData: !!faceData,
        faceDataDetails: faceData
          ? {
              leftEye: faceData.leftEyeOpenProbability,
              rightEye: faceData.rightEyeOpenProbability,
              timestamp: faceData.timestamp,
            }
          : null,
      });

      if (!isLivenessActive || !faceData) {
        console.log("👁️ Skipping face data processing:", {
          isLivenessActive,
          hasFaceData: !!faceData,
        });
        return;
      }

      const { leftEyeOpenProbability, rightEyeOpenProbability, timestamp } =
        faceData;

      // Ensure timestamp is available
      const currentTimestamp = timestamp || Date.now();

      // Add current eye state to history
      eyeStateHistoryRef.current.push({
        left: leftEyeOpenProbability,
        right: rightEyeOpenProbability,
        timestamp: currentTimestamp,
      });

      // Keep only recent history (last 2 seconds)
      const cutoffTime = currentTimestamp - 2000;
      eyeStateHistoryRef.current = eyeStateHistoryRef.current.filter(
        (state) => state.timestamp > cutoffTime,
      );

      // Process the current data
      processLivenessDetection(faceData);
    },
    [isLivenessActive],
  );

  // Process face data when it changes
  useEffect(() => {
    console.log("👁️ Face data effect triggered:", {
      hasFaceData: !!faceData,
      isLivenessActive,
      faceDataTimestamp: faceData?.timestamp,
    });

    if (faceData && isLivenessActive) {
      console.log("👁️ Processing face data for liveness detection");
      processFaceData(faceData);
    } else {
      console.log("👁️ Not processing face data:", {
        reason: !faceData ? "No face data" : "Liveness not active",
      });
    }
  }, [faceData, isLivenessActive, processFaceData]);

  // Computed values
  const isLive = livenessScore >= config.minLivenessScore && blinkDetected;

  return {
    isLivenessActive,
    blinkDetected,
    livenessScore,
    livenessData,
    startLivenessDetection,
    stopLivenessDetection,
    resetLivenessState,
    isLive,
    blinkCount,
    eyeMovementScore,
  };
}
