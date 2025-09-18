import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeContext from "../context/ThemeContext";
import {
  ProgressBar,
  CircularProgress,
  LoadingSpinner,
  CountdownTimer,
  StepProgress,
  SuccessAnimation,
  FailureAnimation,
} from "../components/ProgressIndicators";
import { FaceDetectionQualityFeedback } from "../components/FaceDetectionQualityFeedback";
import {
  VerificationProgressOverlay,
  LivenessProgressOverlay,
} from "../components/VerificationProgressOverlay";
import {
  AsyncLoadingState,
  ProgressiveLoading,
  DataLoadingSkeleton,
  InlineLoading,
} from "../components/AsyncLoadingStates";

export default function ProgressIndicatorsTest() {
  const { theme, toggleTheme } = ThemeContext.useTheme();

  // Test states
  const [progress, setProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showLivenessOverlay, setShowLivenessOverlay] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);

  const colors = {
    light: {
      background: "#FFFFFF",
      surface: "#F9FAFB",
      text: "#374151",
      textSecondary: "#6B7280",
      border: "#E5E7EB",
      primary: "#3B82F6",
    },
    dark: {
      background: "#111827",
      surface: "#1F2937",
      text: "#F3F4F6",
      textSecondary: "#9CA3AF",
      border: "#374151",
      primary: "#60A5FA",
    },
  };

  const currentColors = colors[theme];

  // Mock face detection data
  const mockFaceData = {
    bounds: { x: 100, y: 100, width: 200, height: 200 },
    leftEyeOpenProbability: 0.9,
    rightEyeOpenProbability: 0.8,
    faceId: "test-face-id-12345",
    rollAngle: 5,
    yawAngle: -2,
  };

  const mockFeedback = {
    lighting:
      qualityScore > 80 ? "good" : qualityScore > 60 ? "poor" : "too_dark",
    positioning: qualityScore > 70 ? "centered" : "too_left",
    distance: qualityScore > 75 ? "good" : "too_far",
    angle: qualityScore > 85 ? "good" : "tilted",
    clarity: qualityScore > 80 ? "good" : "blurry",
  } as const;

  const steps = [
    "Initialize",
    "Detect Face",
    "Check Liveness",
    "Capture Photo",
    "Process",
  ];
  const completedSteps = Array.from({ length: currentStep }, (_, i) => i);

  const progressiveSteps = [
    {
      key: "camera",
      label: "Initialize Camera",
      completed: true,
      loading: false,
    },
    {
      key: "face",
      label: "Load Face Model",
      completed: false,
      loading: isLoading,
      error: hasError ? "Network error" : undefined,
    },
    { key: "profile", label: "Load Profile", completed: false, loading: false },
    { key: "setup", label: "Setup Complete", completed: false, loading: false },
  ];

  // Auto-increment progress for demo
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 5));
      setQualityScore((prev) => (prev >= 100 ? 0 : prev + 3));
      setLivenessScore((prev) => (prev >= 1 ? 0 : prev + 0.05));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleCountdownComplete = () => {
    console.log("Countdown completed!");
    setCountdown(10);
  };

  const handleStepNext = () => {
    setCurrentStep((prev) => (prev >= steps.length - 1 ? 0 : prev + 1));
  };

  const handleShowSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleShowFailure = () => {
    setShowFailure(true);
    setTimeout(() => setShowFailure(false), 3000);
  };

  const handleAsyncOperation = async () => {
    setIsLoading(true);
    setHasError(false);

    // Simulate async operation
    setTimeout(() => {
      setIsLoading(false);
      if (Math.random() > 0.7) {
        setHasError(true);
      }
    }, 2000);
  };

  const handleRetryStep = (stepKey: string) => {
    console.log("Retrying step:", stepKey);
    setHasError(false);
    handleAsyncOperation();
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: currentColors.background,
      }}
    >
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text
            style={{ color: currentColors.text }}
            className="text-2xl font-bold"
          >
            Progress Indicators Test
          </Text>
          <View className="flex-row items-center">
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-sm mr-2"
            >
              {theme}
            </Text>
            <Switch
              value={theme === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ false: "#E5E7EB", true: "#374151" }}
              thumbColor={theme === "dark" ? "#60A5FA" : "#3B82F6"}
            />
          </View>
        </View>

        {/* Basic Progress Indicators */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Basic Progress Indicators
          </Text>

          <Text
            style={{ color: currentColors.textSecondary }}
            className="text-sm mb-2"
          >
            Progress Bar ({progress}%)
          </Text>
          <ProgressBar
            progress={progress}
            height={8}
            showPercentage={true}
            animated={true}
          />

          <Text
            style={{ color: currentColors.textSecondary }}
            className="text-sm mb-2 mt-4"
          >
            Circular Progress
          </Text>
          <View className="flex-row justify-around items-center mt-2">
            <CircularProgress
              progress={progress}
              size={60}
              strokeWidth={6}
              showPercentage={true}
            />
            <CircularProgress
              progress={qualityScore}
              size={80}
              strokeWidth={8}
              color="#10B981"
              showPercentage={true}
            />
          </View>

          <Text
            style={{ color: currentColors.textSecondary }}
            className="text-sm mb-2 mt-4"
          >
            Loading Spinners
          </Text>
          <View className="flex-row justify-around items-center mt-2">
            <LoadingSpinner size="small" text="Small" />
            <LoadingSpinner size="large" text="Large" />
          </View>
        </View>

        {/* Countdown Timer */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Countdown Timer
          </Text>
          <View className="items-center">
            <CountdownTimer
              seconds={countdown}
              onComplete={handleCountdownComplete}
              size={100}
              showText={true}
            />
          </View>
        </View>

        {/* Step Progress */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Step Progress
          </Text>
          <StepProgress
            steps={steps}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
          <TouchableOpacity
            onPress={handleStepNext}
            style={{
              backgroundColor: currentColors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              alignSelf: "center",
              marginTop: 16,
            }}
          >
            <Text className="text-white font-medium">Next Step</Text>
          </TouchableOpacity>
        </View>

        {/* Success/Failure Animations */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Success/Failure Animations
          </Text>
          <View className="flex-row justify-around">
            <TouchableOpacity
              onPress={handleShowSuccess}
              style={{
                backgroundColor: "#10B981",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text className="text-white font-medium">Show Success</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShowFailure}
              style={{
                backgroundColor: "#EF4444",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text className="text-white font-medium">Show Failure</Text>
            </TouchableOpacity>
          </View>
          <View className="items-center mt-4 h-32">
            <SuccessAnimation
              visible={showSuccess}
              onComplete={() => setShowSuccess(false)}
              message="Verification Successful!"
            />
            <FailureAnimation
              visible={showFailure}
              onComplete={() => setShowFailure(false)}
              message="Verification Failed!"
            />
          </View>
        </View>

        {/* Face Detection Quality Feedback */}
        <FaceDetectionQualityFeedback
          faceData={mockFaceData}
          isDetecting={true}
          qualityScore={qualityScore}
          feedback={mockFeedback}
          onQualityChange={(score) => console.log("Quality changed:", score)}
        />

        {/* Progressive Loading */}
        <ProgressiveLoading
          steps={progressiveSteps}
          onRetryStep={handleRetryStep}
        />

        {/* Async Loading State */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Async Loading State
          </Text>
          <TouchableOpacity
            onPress={handleAsyncOperation}
            style={{
              backgroundColor: currentColors.primary,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              alignSelf: "center",
              marginBottom: 16,
            }}
          >
            <Text className="text-white font-medium">
              Start Async Operation
            </Text>
          </TouchableOpacity>

          <AsyncLoadingState
            loading={isLoading}
            error={hasError ? "Something went wrong with the operation" : null}
            onRetry={handleAsyncOperation}
            loadingText="Processing async operation..."
          >
            <Text style={{ color: currentColors.text }} className="text-center">
              Operation completed successfully!
            </Text>
          </AsyncLoadingState>
        </View>

        {/* Data Loading Skeleton */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold p-4 pb-0"
          >
            Data Loading Skeleton
          </Text>
          <DataLoadingSkeleton lines={3} showAvatar={true} animated={true} />
        </View>

        {/* Inline Loading */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Inline Loading
          </Text>
          <InlineLoading
            loading={isLoading}
            text="Submitting data..."
            size="small"
          />
          {!isLoading && (
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-center text-sm"
            >
              No loading state active
            </Text>
          )}
        </View>

        {/* Overlay Controls */}
        <View
          style={{
            backgroundColor: currentColors.surface,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-4"
          >
            Overlay Controls
          </Text>
          <View className="flex-row justify-around">
            <TouchableOpacity
              onPress={() => setShowOverlay(true)}
              style={{
                backgroundColor: currentColors.primary,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text className="text-white font-medium">
                Verification Overlay
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowLivenessOverlay(true)}
              style={{
                backgroundColor: "#10B981",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text className="text-white font-medium">Liveness Overlay</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Overlays */}
      <VerificationProgressOverlay
        visible={showOverlay}
        step="liveness"
        progress={progress}
        statusMessage="Please blink naturally when the timer reaches zero"
        message="Please blink naturally when the timer reaches zero"
        countdown={5}
        onCountdownComplete={() => console.log("Countdown complete")}
        onAnimationComplete={() => setShowOverlay(false)}
        retryCount={1}
        maxRetries={3}
      />

      <LivenessProgressOverlay
        visible={showLivenessOverlay}
        progress={livenessScore}
        statusMessage="Blink when timer reaches zero"
        guidanceMessage="Please blink naturally"
      />
    </SafeAreaView>
  );
}
