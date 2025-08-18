import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  FaceDetectionData,
  LivenessDetectionData,
  LivenessThresholds,
  UseCameraLivenessReturn,
} from '../types/faceDetection';

// Default liveness detection thresholds
const DEFAULT_THRESHOLDS: LivenessThresholds = {
  minBlinkDuration: 100, // 100ms minimum blink duration
  maxBlinkDuration: 500, // 500ms maximum blink duration
  eyeClosedThreshold: 0.3, // Eye considered closed below 30% open probability
  eyeOpenThreshold: 0.7, // Eye considered open above 70% open probability
  minLivenessScore: 0.6, // Minimum 60% liveness score
  blinkTimeoutMs: 5000, // 5 second timeout for blink detection
};

// Eye state tracking
interface EyeState {
  isOpen: boolean;
  openProbability: number;
  timestamp: number;
}

interface BlinkEvent {
  startTime: number;
  endTime: number;
  duration: number;
  isValid: boolean;
}

/**
 * Camera Liveness Detection Hook
 * 
 * Implements eye blink detection algorithm for liveness verification.
 * Provides real-time liveness scoring and auto-capture triggers.
 * 
 * Requirements addressed:
 * - 1.3: Eye blink detection for liveness verification
 * - 1.4: Liveness scoring based on eye movement
 * - 6.1: Performance optimization for real-time processing
 * - 6.4: Auto-capture trigger on blink detection
 */
export function useCameraLiveness(
  faceData: FaceDetectionData | null,
  thresholds: Partial<LivenessThresholds> = {}
): UseCameraLivenessReturn {
  // Merge custom thresholds with defaults
  const livenessThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // State management
  const [isLivenessActive, setIsLivenessActive] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [livenessData, setLivenessData] = useState<LivenessDetectionData | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [eyeMovementScore, setEyeMovementScore] = useState(0);

  // Refs for tracking state and performance optimization
  const isMountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const detectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Eye state tracking
  const leftEyeStateRef = useRef<EyeState>({ isOpen: true, openProbability: 1, timestamp: Date.now() });
  const rightEyeStateRef = useRef<EyeState>({ isOpen: true, openProbability: 1, timestamp: Date.now() });
  
  // Blink tracking
  const blinkEventsRef = useRef<BlinkEvent[]>([]);
  const lastBlinkTimeRef = useRef<number>(0);
  const blinkStartTimeRef = useRef<number | null>(null);
  
  // Performance optimization - frame rate control
  const lastProcessTimeRef = useRef<number>(0);
  const PROCESSING_INTERVAL = 50; // Process every 50ms for real-time performance

  /**
   * Determine if an eye is considered open or closed based on probability
   */
  const determineEyeState = useCallback((openProbability: number): boolean => {
    // Use hysteresis to prevent flickering
    const currentTime = Date.now();
    
    if (openProbability <= livenessThresholds.eyeClosedThreshold) {
      return false; // Eye is closed
    } else if (openProbability >= livenessThresholds.eyeOpenThreshold) {
      return true; // Eye is open
    }
    
    // In between thresholds - maintain previous state to reduce noise
    return openProbability > 0.5;
  }, [livenessThresholds.eyeClosedThreshold, livenessThresholds.eyeOpenThreshold]);

  /**
   * Detect blink events based on eye state changes
   */
  const detectBlink = useCallback((
    leftEyeOpen: boolean,
    rightEyeOpen: boolean,
    timestamp: number
  ): boolean => {
    const bothEyesClosed = !leftEyeOpen && !rightEyeOpen;
    const bothEyesOpen = leftEyeOpen && rightEyeOpen;
    
    // Start of blink - both eyes closed
    if (bothEyesClosed && blinkStartTimeRef.current === null) {
      blinkStartTimeRef.current = timestamp;
      return false;
    }
    
    // End of blink - both eyes open after being closed
    if (bothEyesOpen && blinkStartTimeRef.current !== null) {
      const blinkDuration = timestamp - blinkStartTimeRef.current;
      blinkStartTimeRef.current = null;
      
      // Validate blink duration
      const isValidBlink = blinkDuration >= livenessThresholds.minBlinkDuration &&
                          blinkDuration <= livenessThresholds.maxBlinkDuration;
      
      if (isValidBlink) {
        // Record blink event
        const blinkEvent: BlinkEvent = {
          startTime: timestamp - blinkDuration,
          endTime: timestamp,
          duration: blinkDuration,
          isValid: true,
        };
        
        blinkEventsRef.current.push(blinkEvent);
        
        // Keep only recent blinks (last 10 seconds)
        const tenSecondsAgo = timestamp - 10000;
        blinkEventsRef.current = blinkEventsRef.current.filter(
          event => event.endTime > tenSecondsAgo
        );
        
        lastBlinkTimeRef.current = timestamp;
        return true;
      }
    }
    
    return false;
  }, [livenessThresholds.minBlinkDuration, livenessThresholds.maxBlinkDuration]);

  /**
   * Calculate eye movement score based on eye probability variations
   */
  const calculateEyeMovementScore = useCallback((
    leftEyeProbability: number,
    rightEyeProbability: number,
    timestamp: number
  ): number => {
    const currentTime = timestamp;
    const timeDiff = currentTime - lastProcessTimeRef.current;
    
    if (timeDiff < PROCESSING_INTERVAL) {
      return eyeMovementScore; // Return cached score for performance
    }
    
    // Calculate variation in eye open probabilities
    const leftVariation = Math.abs(leftEyeProbability - leftEyeStateRef.current.openProbability);
    const rightVariation = Math.abs(rightEyeProbability - rightEyeStateRef.current.openProbability);
    
    // Average variation indicates natural eye movement
    const averageVariation = (leftVariation + rightVariation) / 2;
    
    // Score based on natural eye movement patterns
    // Higher variation indicates more natural movement
    const movementScore = Math.min(averageVariation * 2, 1); // Cap at 1.0
    
    return movementScore;
  }, [eyeMovementScore]);

  /**
   * Calculate overall liveness score
   */
  const calculateLivenessScore = useCallback((
    blinkCount: number,
    eyeMovementScore: number,
    timeSinceLastBlink: number
  ): number => {
    // Blink score (40% weight)
    const blinkScore = Math.min(blinkCount / 3, 1); // Optimal at 3+ blinks
    
    // Eye movement score (30% weight)
    const movementScore = eyeMovementScore;
    
    // Recency score (30% weight) - recent blinks are better
    const maxRecencyTime = 5000; // 5 seconds
    const recencyScore = Math.max(0, 1 - (timeSinceLastBlink / maxRecencyTime));
    
    // Weighted average
    const overallScore = (blinkScore * 0.4) + (movementScore * 0.3) + (recencyScore * 0.3);
    
    return Math.min(overallScore, 1);
  }, []);

  /**
   * Process face data for liveness detection
   */
  const processLivenessDetection = useCallback((face: FaceDetectionData) => {
    if (!isLivenessActive || !isMountedRef.current) return;
    
    const currentTime = Date.now();
    
    // Performance optimization - limit processing frequency
    if (currentTime - lastProcessTimeRef.current < PROCESSING_INTERVAL) {
      return;
    }
    lastProcessTimeRef.current = currentTime;
    
    try {
      // Determine eye states
      const leftEyeOpen = determineEyeState(face.leftEyeOpenProbability);
      const rightEyeOpen = determineEyeState(face.rightEyeOpenProbability);
      
      // Update eye state tracking
      leftEyeStateRef.current = {
        isOpen: leftEyeOpen,
        openProbability: face.leftEyeOpenProbability,
        timestamp: currentTime,
      };
      
      rightEyeStateRef.current = {
        isOpen: rightEyeOpen,
        openProbability: face.rightEyeOpenProbability,
        timestamp: currentTime,
      };
      
      // Detect blinks
      const blinkDetectedNow = detectBlink(leftEyeOpen, rightEyeOpen, currentTime);
      
      if (blinkDetectedNow) {
        setBlinkDetected(true);
        setBlinkCount(prev => prev + 1);
        
        // Reset blink detected flag after short delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setBlinkDetected(false);
          }
        }, 200);
      }
      
      // Calculate eye movement score
      const movementScore = calculateEyeMovementScore(
        face.leftEyeOpenProbability,
        face.rightEyeOpenProbability,
        currentTime
      );
      setEyeMovementScore(movementScore);
      
      // Calculate overall liveness score
      const timeSinceLastBlink = currentTime - lastBlinkTimeRef.current;
      const currentBlinkCount = blinkEventsRef.current.length;
      const currentLivenessScore = calculateLivenessScore(
        currentBlinkCount,
        movementScore,
        timeSinceLastBlink
      );
      
      setLivenessScore(currentLivenessScore);
      setIsLive(currentLivenessScore >= livenessThresholds.minLivenessScore);
      
      // Update liveness data
      const newLivenessData: LivenessDetectionData = {
        blinkDetected: blinkDetectedNow,
        blinkCount: currentBlinkCount,
        eyeMovementScore: movementScore,
        livenessScore: currentLivenessScore,
        isLive: currentLivenessScore >= livenessThresholds.minLivenessScore,
        timestamp: currentTime,
      };
      
      setLivenessData(newLivenessData);
      
    } catch (error) {
      console.error('Error in liveness detection processing:', error);
    }
  }, [
    isLivenessActive,
    determineEyeState,
    detectBlink,
    calculateEyeMovementScore,
    calculateLivenessScore,
    livenessThresholds.minLivenessScore,
  ]);

  /**
   * Start liveness detection
   */
  const startLivenessDetection = useCallback(() => {
    if (!isMountedRef.current) return;
    
    console.log('Starting liveness detection with thresholds:', livenessThresholds);
    
    setIsLivenessActive(true);
    
    // Set timeout for liveness detection
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    
    detectionTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        console.log('Liveness detection timeout reached');
        stopLivenessDetection();
      }
    }, livenessThresholds.blinkTimeoutMs);
    
  }, [livenessThresholds]);

  /**
   * Stop liveness detection
   */
  const stopLivenessDetection = useCallback(() => {
    setIsLivenessActive(false);
    
    // Clear timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }
    
    console.log('Liveness detection stopped');
  }, []);

  /**
   * Reset liveness state
   */
  const resetLivenessState = useCallback(() => {
    setBlinkDetected(false);
    setLivenessScore(0);
    setLivenessData(null);
    setIsLive(false);
    setBlinkCount(0);
    setEyeMovementScore(0);
    
    // Reset refs
    blinkEventsRef.current = [];
    lastBlinkTimeRef.current = 0;
    blinkStartTimeRef.current = null;
    lastProcessTimeRef.current = 0;
    
    // Reset eye states
    leftEyeStateRef.current = { isOpen: true, openProbability: 1, timestamp: Date.now() };
    rightEyeStateRef.current = { isOpen: true, openProbability: 1, timestamp: Date.now() };
    
    console.log('Liveness state reset');
  }, []);

  // Process face data when it changes
  useEffect(() => {
    if (faceData && isLivenessActive) {
      processLivenessDetection(faceData);
    }
  }, [faceData, isLivenessActive, processLivenessDetection]);

  // Handle app state changes for performance optimization
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!isMountedRef.current) return;

      console.log(`Liveness detection app state changed: ${appStateRef.current} -> ${nextAppState}`);

      // App going to background - pause liveness detection
      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        if (isLivenessActive) {
          console.log('App backgrounded - pausing liveness detection');
          stopLivenessDetection();
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isLivenessActive, stopLivenessDetection]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      // Clear timeout
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
      
      console.log('Liveness detection hook cleanup completed');
    };
  }, []);

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