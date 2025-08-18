import React from 'react';
import { View, Text, Modal, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import ThemeContext from '../context/ThemeContext';
import {
  LoadingSpinner,
  CountdownTimer,
  StepProgress,
  SuccessAnimation,
  FailureAnimation,
  ProgressBar
} from './ProgressIndicators';

const { width, height } = Dimensions.get('window');

interface VerificationProgressOverlayProps {
  visible: boolean;
  step: 'initializing' | 'detecting' | 'liveness' | 'capturing' | 'processing' | 'success' | 'failure' | 'error';
  progress: number; // 0-100
  message: string;
  countdown?: number;
  onCountdownComplete?: () => void;
  onAnimationComplete?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

export const VerificationProgressOverlay: React.FC<VerificationProgressOverlayProps> = ({
  visible,
  step,
  progress,
  message,
  countdown,
  onCountdownComplete,
  onAnimationComplete,
  retryCount = 0,
  maxRetries = 3
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      text: '#374151',
      textSecondary: '#6B7280',
      background: 'rgba(255, 255, 255, 0.95)',
      overlay: 'rgba(0, 0, 0, 0.5)'
    },
    dark: {
      text: '#F3F4F6',
      textSecondary: '#9CA3AF',
      background: 'rgba(17, 24, 39, 0.95)',
      overlay: 'rgba(0, 0, 0, 0.7)'
    }
  };

  const currentColors = colors[theme];

  const steps = [
    'Initialize',
    'Detect Face',
    'Check Liveness',
    'Capture Photo',
    'Process'
  ];

  const getCurrentStepIndex = () => {
    switch (step) {
      case 'initializing': return 0;
      case 'detecting': return 1;
      case 'liveness': return 2;
      case 'capturing': return 3;
      case 'processing': return 4;
      default: return 0;
    }
  };

  const getCompletedSteps = () => {
    const currentIndex = getCurrentStepIndex();
    return Array.from({ length: currentIndex }, (_, i) => i);
  };

  const renderContent = () => {
    switch (step) {
      case 'success':
        return (
          <SuccessAnimation
            visible={true}
            onComplete={onAnimationComplete}
            message="Verification Successful!"
          />
        );

      case 'failure':
        return (
          <FailureAnimation
            visible={true}
            onComplete={onAnimationComplete}
            message={`Verification Failed${retryCount > 0 ? ` (${retryCount}/${maxRetries})` : ''}`}
          />
        );

      case 'liveness':
        return (
          <View className="items-center">
            {countdown !== undefined ? (
              <CountdownTimer
                seconds={countdown}
                onComplete={onCountdownComplete}
                size={120}
                showText={true}
              />
            ) : (
              <LoadingSpinner size="large" text="Checking liveness..." />
            )}
            <Text
              style={{ color: currentColors.text }}
              className="text-lg font-semibold mt-4 text-center"
            >
              {message}
            </Text>
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-sm mt-2 text-center px-8"
            >
              {countdown !== undefined 
                ? "Blink naturally when the timer reaches zero"
                : "Please blink naturally to verify you're a real person"
              }
            </Text>
          </View>
        );

      default:
        return (
          <View className="items-center">
            <LoadingSpinner
              size="large"
              text={message}
            />
            <View className="w-full mt-6">
              <ProgressBar
                progress={progress}
                height={8}
                showPercentage={true}
                animated={true}
              />
            </View>
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-sm mt-4 text-center px-8"
            >
              {getStepDescription(step)}
            </Text>
          </View>
        );
    }
  };

  const getStepDescription = (step: string) => {
    switch (step) {
      case 'initializing':
        return 'Setting up camera and face detection...';
      case 'detecting':
        return 'Looking for your face in the camera view...';
      case 'capturing':
        return 'Taking your photo for verification...';
      case 'processing':
        return 'Comparing with your registered face profile...';
      default:
        return 'Processing verification...';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: currentColors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <BlurView
          intensity={80}
          tint={theme}
          style={{
            width: width * 0.85,
            maxWidth: 400,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: currentColors.background,
              padding: 32,
              alignItems: 'center',
            }}
          >
            {/* Step Progress (only for non-final states) */}
            {step !== 'success' && step !== 'failure' && (
              <View className="w-full mb-8">
                <StepProgress
                  steps={steps}
                  currentStep={getCurrentStepIndex()}
                  completedSteps={getCompletedSteps()}
                />
              </View>
            )}

            {/* Main Content */}
            {renderContent()}

            {/* Retry Information */}
            {retryCount > 0 && step !== 'success' && (
              <View className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Text
                  style={{ color: currentColors.textSecondary }}
                  className="text-xs text-center"
                >
                  Attempt {retryCount} of {maxRetries}
                </Text>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

interface LivenessProgressOverlayProps {
  visible: boolean;
  instruction: string;
  countdown: number;
  onCountdownComplete: () => void;
  blinkDetected: boolean;
  livenessScore: number;
}

export const LivenessProgressOverlay: React.FC<LivenessProgressOverlayProps> = ({
  visible,
  instruction,
  countdown,
  onCountdownComplete,
  blinkDetected,
  livenessScore
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      text: '#374151',
      textSecondary: '#6B7280',
      success: '#10B981',
      background: 'rgba(255, 255, 255, 0.95)',
      overlay: 'rgba(0, 0, 0, 0.5)'
    },
    dark: {
      text: '#F3F4F6',
      textSecondary: '#9CA3AF',
      success: '#34D399',
      background: 'rgba(17, 24, 39, 0.95)',
      overlay: 'rgba(0, 0, 0, 0.7)'
    }
  };

  const currentColors = colors[theme];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: currentColors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <BlurView
          intensity={80}
          tint={theme}
          style={{
            width: width * 0.85,
            maxWidth: 400,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: currentColors.background,
              padding: 32,
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: currentColors.text }}
              className="text-xl font-bold mb-4 text-center"
            >
              Liveness Detection
            </Text>

            <CountdownTimer
              seconds={countdown}
              onComplete={onCountdownComplete}
              size={120}
              color={blinkDetected ? currentColors.success : undefined}
            />

            <Text
              style={{ color: currentColors.text }}
              className="text-lg font-semibold mt-6 text-center"
            >
              {instruction}
            </Text>

            {blinkDetected && (
              <View className="flex-row items-center mt-4">
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: currentColors.success,
                    marginRight: 8,
                  }}
                />
                <Text
                  style={{ color: currentColors.success }}
                  className="text-sm font-medium"
                >
                  Blink detected!
                </Text>
              </View>
            )}

            <View className="w-full mt-6">
              <Text
                style={{ color: currentColors.textSecondary }}
                className="text-sm mb-2"
              >
                Liveness Score: {Math.round(livenessScore * 100)}%
              </Text>
              <ProgressBar
                progress={livenessScore * 100}
                height={6}
                color={currentColors.success}
                animated={true}
              />
            </View>

            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-xs mt-4 text-center px-4"
            >
              Please look directly at the camera and blink naturally when prompted
            </Text>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};