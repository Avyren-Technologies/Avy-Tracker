/**
 * Progress Indicators Components
 * 
 * Various progress indicators for face verification
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showPercentage?: boolean;
  animated?: boolean;
  color?: string;
}

export function ProgressBar({ 
  progress, 
  height = 6, 
  showPercentage = false, 
  animated = true,
  color = '#3b82f6'
}: ProgressBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(progress);
    }
  }, [progress, animated]);

  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressTrack, { height }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              height,
              backgroundColor: color,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
      {showPercentage && (
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      )}
    </View>
  );
}

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  size?: number;
  showText?: boolean;
}

export function CountdownTimer({ 
  seconds, 
  onComplete, 
  size = 60,
  showText = true 
}: CountdownTimerProps) {
  const animatedValue = useRef(new Animated.Value(seconds)).current;

  useEffect(() => {
    if (seconds === 0 && onComplete) {
      onComplete();
      return;
    }

    Animated.timing(animatedValue, {
      toValue: seconds - 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [seconds]);

  return (
    <View style={[styles.countdownContainer, { width: size, height: size }]}>
      <View style={[styles.countdownCircle, { width: size, height: size }]}>
        <Text style={[styles.countdownText, { fontSize: size * 0.3 }]}>
          {seconds}
        </Text>
      </View>
      {/* {showText && (
        <Text style={styles.countdownLabel}>Blink when ready</Text>
      )} */}
    </View>
  );
}

interface SuccessAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  message?: string;
}

export function SuccessAnimation({ 
  visible, 
  onComplete, 
  message = 'Success!' 
}: SuccessAnimationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1500),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        scaleAnim.setValue(0);
        if (onComplete) onComplete();
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.animationContainer,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={48} color="white" />
      </View>
      <Text style={styles.animationText}>{message}</Text>
    </Animated.View>
  );
}

interface FailureAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  message?: string;
}

export function FailureAnimation({ 
  visible, 
  onComplete, 
  message = 'Failed!' 
}: FailureAnimationProps) {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
        Animated.delay(1000),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onComplete) onComplete();
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.animationContainer,
        {
          transform: [{ translateX: shakeAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.failureIcon}>
        <Ionicons name="close" size={48} color="white" />
      </View>
      <Text style={styles.animationText}>{message}</Text>
    </Animated.View>
  );
}

// Additional progress components for compatibility
export function CircularProgress({ 
  progress, 
  size = 60, 
  color = '#3b82f6',
  strokeWidth,
  showPercentage
}: { 
  progress: number; 
  size?: number; 
  color?: string;
  strokeWidth?: number;
  showPercentage?: boolean;
}) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color, fontSize: size * 0.2, fontWeight: 'bold' }}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
}

export function LoadingSpinner({ 
  size = 'large', 
  color = '#3b82f6',
  text
}: { 
  size?: 'small' | 'large'; 
  color?: string;
  text?: string;
}) {
  return (
    <Animated.View style={{ opacity: 1, alignItems: 'center' }}>
      <Text>Loading...</Text>
      {text && <Text style={{ marginTop: 4, fontSize: 12, color }}>{text}</Text>}
    </Animated.View>
  );
}

export function StepProgress({ 
  steps, 
  currentStep,
  completedSteps
}: { 
  steps: string[]; 
  currentStep: number;
  completedSteps?: number[];
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps?.includes(index) || index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <View key={index} style={{ 
            padding: 8, 
            backgroundColor: isCompleted || isCurrent ? '#3b82f6' : '#e5e7eb',
            borderRadius: 4 
          }}>
            <Text style={{ color: isCompleted || isCurrent ? 'white' : '#6b7280', fontSize: 12 }}>
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  progressTrack: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 3,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    minWidth: 35,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownCircle: {
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 3,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  countdownLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  failureIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  animationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
});