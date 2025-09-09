import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVerificationFlow } from '../hooks/useVerificationFlow';
import { VerificationConfig, LocationResult, VerificationFlowSummary } from '../types/verification';
import { FaceVerificationResult, FaceVerificationError } from '../types/faceDetection';
import FaceVerificationModal from './FaceVerificationModal';
import OTPVerification from './OTPVerification';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';

interface VerificationOrchestratorProps {
  visible: boolean;
  userId: number;
  token: string;
  shiftAction: 'start' | 'end';
  config?: Partial<VerificationConfig>;
  onSuccess: (summary: VerificationFlowSummary) => void;
  onCancel: () => void;
  onError: (error: string) => void;
  locationVerificationFn: () => Promise<LocationResult>;
  canOverrideGeofence?: boolean;
}

interface VerificationStepIndicatorProps {
  steps: Array<{ type: string; completed: boolean; current: boolean; failed: boolean }>;
  isDark: boolean;
}

const VerificationStepIndicator: React.FC<VerificationStepIndicatorProps> = ({ steps, isDark }) => {
  return (
    <View style={styles.stepIndicatorContainer}>
      {steps.map((step, index) => (
        <React.Fragment key={step.type}>
          <View style={[
            styles.stepCircle,
            {
              backgroundColor: step.completed 
                ? '#10b981' 
                : step.current 
                  ? '#3b82f6' 
                  : step.failed 
                    ? '#ef4444' 
                    : isDark ? '#374151' : '#e5e7eb'
            }
          ]}>
            {step.completed ? (
              <Ionicons name="checkmark" size={16} color="white" />
            ) : step.failed ? (
              <Ionicons name="close" size={16} color="white" />
            ) : step.current ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={[styles.stepNumber, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {index + 1}
              </Text>
            )}
          </View>
          
          <View style={styles.stepInfo}>
            <Text style={[
              styles.stepTitle,
              { 
                color: step.completed 
                  ? '#10b981' 
                  : step.current 
                    ? '#3b82f6' 
                    : step.failed 
                      ? '#ef4444' 
                      : isDark ? '#9ca3af' : '#6b7280'
              }
            ]}>
              {step.type === 'location' ? 'Location' : 'Face'} Verification
            </Text>
            <Text style={[styles.stepStatus, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {step.completed 
                ? 'Completed' 
                : step.current 
                  ? 'In Progress' 
                  : step.failed 
                    ? 'Failed' 
                    : 'Pending'}
            </Text>
          </View>
          
          {index < steps.length - 1 && (
            <View style={[
              styles.stepConnector,
              { backgroundColor: step.completed ? '#10b981' : isDark ? '#374151' : '#e5e7eb' }
            ]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

export default function VerificationOrchestrator({
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
}: VerificationOrchestratorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = useThemeColor('#ffffff', '#1f2937');
  const textColor = useThemeColor('#111827', '#f9fafb');
  const borderColor = useThemeColor('#e5e7eb', '#374151');

  // State
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');



  // Stable callback references
  const onStepCompletedRef = useRef<(step: string, success: boolean) => void>();
  const onFlowCompletedRef = useRef<(summary: any) => void>();
  const onFlowFailedRef = useRef<(summary: any) => void>();
  const onOverrideRequiredRef = useRef<(summary: any) => void>();
  const onPerformanceMetricsRef = useRef<(metrics: any) => void>();
  const proceedToNextStepRef = useRef<() => void>();

  // Verification flow hook
  const {
    flowState,
    isInitialized,
    isInProgress,
    currentStep,
    canOverride,
    summary,
    startVerificationFlow,
    executeLocationVerification,
    executeFaceVerification,
    applyOverride,
    resetFlow,
    getStepProgress,
    getConfidenceScore,
    canRetryCurrentStep,
  } = useVerificationFlow({
    userId,
    token,
    onStepCompleted: (step, success) => onStepCompletedRef.current?.(step, success),
    onFlowCompleted: (summary) => onFlowCompletedRef.current?.(summary),
    onFlowFailed: (summary) => onFlowFailedRef.current?.(summary),
    onOverrideRequired: (summary) => onOverrideRequiredRef.current?.(summary),
    onPerformanceMetrics: (metrics) => onPerformanceMetricsRef.current?.(metrics),
  });

  // Update refs with current values
  onStepCompletedRef.current = (step, success) => {
    console.log(`Step ${step} ${success ? 'completed' : 'failed'}`);
    if (!success && step === 'location' && canOverrideGeofence) {
      // Show option to continue with face verification only
      Alert.alert(
        'Location Verification Failed',
        'You are not in a designated work area. Would you like to continue with face verification only?',
        [
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          { text: 'Continue', onPress: () => proceedToNextStepRef.current?.() },
        ]
      );
    }
  };

  onFlowCompletedRef.current = (summary) => {
    console.log('Verification flow completed:', summary);
    onSuccess(summary);
  };

  onFlowFailedRef.current = (summary) => {
    console.log('Verification flow failed:', summary);
    if (canOverride) {
      showOverrideOptions();
    } else {
      onError('Verification failed. Please try again.');
    }
  };

  onOverrideRequiredRef.current = (summary) => {
    console.log('Override required:', summary);
    showOverrideOptions();
  };

  onPerformanceMetricsRef.current = (metrics) => {
    // Log performance metrics for monitoring
    if (metrics.totalLatency > 30000) {
      console.warn('Verification taking longer than expected:', metrics);
    }
  };

  // Initialize verification flow when modal becomes visible
  useEffect(() => {
    if (visible && !isInitialized) {
      initializeFlow();
    } else if (!visible && isInitialized) {
      resetFlow();
    }
  }, [visible, isInitialized]);

  // Auto-proceed with verification steps
  useEffect(() => {
    if (isInitialized && currentStep && !isProcessing && summary?.status !== 'completed') {
      // Use a timeout to avoid immediate execution
      const timer = setTimeout(() => {
        if (isInitialized && currentStep && !isProcessing && summary?.status !== 'completed') {
          // Use a ref to avoid dependency issues
          if (proceedToNextStepRef.current) {
            proceedToNextStepRef.current();
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, currentStep, isProcessing, summary?.status]);

  const initializeFlow = useCallback(async () => {
    try {
      setCurrentError(null);
      await startVerificationFlow(shiftAction, config);
    } catch (error) {
      console.error('Error initializing verification flow:', error);
      onError('Failed to initialize verification. Please try again.');
    }
  }, [shiftAction, config, startVerificationFlow, onError]);

  const proceedToNextStep = useCallback(async () => {
    if (!currentStep || isProcessing) return;

    setIsProcessing(true);
    setCurrentError(null);

    try {
      if (currentStep === 'location') {
        await executeLocationVerification(locationVerificationFn);
      } else if (currentStep === 'face') {
        setShowFaceModal(true);
      }
    } catch (error) {
      console.error(`Error in ${currentStep} verification:`, error);
      setCurrentError(`${currentStep} verification failed. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  }, [currentStep, isProcessing, executeLocationVerification, locationVerificationFn]);

  // Store the function in the ref for useEffect access
  proceedToNextStepRef.current = proceedToNextStep;

  const handleFaceVerificationSuccess = useCallback(async (result: FaceVerificationResult) => {
    setShowFaceModal(false);
    
    try {
      await executeFaceVerification(async () => result);
    } catch (error) {
      console.error('Error processing face verification result:', error);
      setCurrentError('Failed to process face verification. Please try again.');
    }
  }, [executeFaceVerification]);

  const handleFaceVerificationError = useCallback((error: FaceVerificationError) => {
    setShowFaceModal(false);
    
    if (canRetryCurrentStep()) {
      Alert.alert(
        'Face Verification Failed',
        `${error.message}\n\nWould you like to try again?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          { text: 'Retry', onPress: () => setShowFaceModal(true) },
        ]
      );
    } else {
      setCurrentError('Face verification failed after maximum attempts.');
    }
  }, [canRetryCurrentStep, onCancel]);

  const showOverrideOptions = useCallback(() => {
    Alert.alert(
      'Verification Failed',
      'Would you like to request manager override?',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { 
          text: 'Request Override', 
          onPress: () => {
            setOverrideReason('Verification failed - manager override requested');
            setShowOTPModal(true);
          }
        },
      ]
    );
  }, [onCancel]);

  const handleOTPSuccess = useCallback(async () => {
    setShowOTPModal(false);
    
    try {
      await applyOverride(overrideReason, userId);
    } catch (error) {
      console.error('Error applying override:', error);
      onError('Failed to apply override. Please try again.');
    }
  }, [applyOverride, overrideReason, userId, onError]);

  const handleRetry = useCallback(() => {
    setCurrentError(null);
    proceedToNextStepRef.current?.();
  }, []);

  // Prepare step indicator data
  const stepIndicatorData = flowState?.steps.map((step, index) => ({
    type: step.type,
    completed: step.completed,
    current: index === flowState.currentStepIndex,
    failed: !step.completed && step.retryCount >= step.maxRetries,
  })) || [];

  const progress = getStepProgress();
  const confidenceScore = Math.round(getConfidenceScore() * 100);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor, borderColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              Shift {shiftAction === 'start' ? 'Start' : 'End'} Verification
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <Text style={[styles.progressText, { color: textColor }]}>
              Progress: {progress.current}/{progress.total} ({progress.percentage}%)
            </Text>
            <View style={[styles.progressBar, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progress.percentage}%`, backgroundColor: '#10b981' }
                ]} 
              />
            </View>
            {confidenceScore > 0 && (
              <Text style={[styles.confidenceText, { color: textColor }]}>
                Confidence: {confidenceScore}%
              </Text>
            )}
          </View>

          {/* Step Indicator */}
          <VerificationStepIndicator steps={stepIndicatorData} isDark={isDark} />

          {/* Current Status */}
          <View style={styles.statusSection}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={[styles.processingText, { color: textColor }]}>
                  {currentStep === 'location' ? 'Verifying location...' : 'Processing...'}
                </Text>
              </View>
            ) : currentError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#ef4444" />
                <Text style={[styles.errorText, { color: '#ef4444' }]}>
                  {currentError}
                </Text>
                {canRetryCurrentStep() && (
                  <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : summary?.status === 'completed' ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                <Text style={[styles.successText, { color: '#10b981' }]}>
                  Verification completed successfully!
                </Text>
              </View>
            ) : (
              <Text style={[styles.statusText, { color: textColor }]}>
                {currentStep ? `Preparing ${currentStep} verification...` : 'Initializing...'}
              </Text>
            )}
          </View>

          {/* Override Option */}
          {canOverride && (
            <View style={styles.overrideSection}>
              <Text style={[styles.overrideText, { color: textColor }]}>
                Having trouble? You can request manager override.
              </Text>
              <TouchableOpacity 
                onPress={showOverrideOptions}
                style={[styles.overrideButton, { borderColor }]}
              >
                <Text style={[styles.overrideButtonText, { color: textColor }]}>
                  Request Override
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        mode="verify"
        onSuccess={handleFaceVerificationSuccess}
        onError={handleFaceVerificationError}
        onCancel={() => setShowFaceModal(false)}
        maxRetries={3}
      />

      {/* OTP Verification Modal */}
      <OTPVerification
        visible={showOTPModal}
        phoneNumber="" // Will be fetched from user profile
        purpose="manager_override"
        onSuccess={handleOTPSuccess}
        onCancel={() => setShowOTPModal(false)}
        onError={(error) => {
          setShowOTPModal(false);
          onError(error.message || error.error || 'OTP verification failed');
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  stepIndicatorContainer: {
    marginBottom: 20,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepInfo: {
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  stepStatus: {
    fontSize: 12,
  },
  stepConnector: {
    width: 2,
    height: 16,
    marginLeft: 15,
    marginBottom: 8,
  },
  statusSection: {
    marginBottom: 20,
    minHeight: 60,
    justifyContent: 'center',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
  },
  successText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  overrideSection: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  overrideText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  overrideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  overrideButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});