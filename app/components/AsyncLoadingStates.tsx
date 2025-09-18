import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../context/ThemeContext";
import { LoadingSpinner, ProgressBar } from "./ProgressIndicators";

interface AsyncLoadingStateProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  loadingText?: string;
  errorTitle?: string;
  retryText?: string;
  children: React.ReactNode;
}

export const AsyncLoadingState: React.FC<AsyncLoadingStateProps> = ({
  loading,
  error,
  onRetry,
  loadingText = "Loading...",
  errorTitle = "Something went wrong",
  retryText = "Try Again",
  children,
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      text: "#374151",
      textSecondary: "#6B7280",
      danger: "#EF4444",
      primary: "#3B82F6",
      background: "#F9FAFB",
      border: "#E5E7EB",
    },
    dark: {
      text: "#F3F4F6",
      textSecondary: "#9CA3AF",
      danger: "#F87171",
      primary: "#60A5FA",
      background: "#1F2937",
      border: "#374151",
    },
  };

  const currentColors = colors[theme];

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <LoadingSpinner size="large" text={loadingText} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <View
          style={{
            backgroundColor: currentColors.background,
            borderColor: currentColors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 24,
            alignItems: "center",
            maxWidth: 300,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: currentColors.danger,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="alert-circle" size={30} color="white" />
          </View>

          <Text
            style={{ color: currentColors.text }}
            className="text-lg font-semibold mb-2 text-center"
          >
            {errorTitle}
          </Text>

          <Text
            style={{ color: currentColors.textSecondary }}
            className="text-sm mb-6 text-center"
          >
            {error}
          </Text>

          {onRetry && (
            <TouchableOpacity
              onPress={onRetry}
              style={{
                backgroundColor: currentColors.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text className="text-white font-medium">{retryText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

interface ProgressiveLoadingProps {
  steps: {
    key: string;
    label: string;
    completed: boolean;
    loading: boolean;
    error?: string;
  }[];
  onRetryStep?: (stepKey: string) => void;
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  steps,
  onRetryStep,
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      text: "#374151",
      textSecondary: "#6B7280",
      success: "#10B981",
      danger: "#EF4444",
      primary: "#3B82F6",
      background: "#F9FAFB",
      border: "#E5E7EB",
    },
    dark: {
      text: "#F3F4F6",
      textSecondary: "#9CA3AF",
      success: "#34D399",
      danger: "#F87171",
      primary: "#60A5FA",
      background: "#1F2937",
      border: "#374151",
    },
  };

  const currentColors = colors[theme];

  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const overallProgress = (completedSteps / totalSteps) * 100;

  return (
    <View
      style={{
        backgroundColor: currentColors.background,
        borderColor: currentColors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        margin: 16,
      }}
    >
      <Text
        style={{ color: currentColors.text }}
        className="text-lg font-semibold mb-4"
      >
        Setup Progress
      </Text>

      <View className="mb-6">
        <ProgressBar
          progress={overallProgress}
          height={8}
          showPercentage={true}
          animated={true}
        />
      </View>

      <View className="space-y-3">
        {steps.map((step, index) => (
          <View key={step.key} className="flex-row items-center">
            <View className="flex-row items-center flex-1">
              {step.completed ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: currentColors.success,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              ) : step.loading ? (
                <View className="mr-12">
                  <LoadingSpinner size="small" />
                </View>
              ) : step.error ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: currentColors.danger,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="close" size={16} color="white" />
                </View>
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: currentColors.border,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{ color: currentColors.textSecondary }}
                    className="text-xs font-bold"
                  >
                    {index + 1}
                  </Text>
                </View>
              )}

              <View className="flex-1">
                <Text
                  style={{
                    color: step.completed
                      ? currentColors.success
                      : step.error
                        ? currentColors.danger
                        : currentColors.text,
                  }}
                  className="text-sm font-medium"
                >
                  {step.label}
                </Text>
                {step.error && (
                  <Text
                    style={{ color: currentColors.danger }}
                    className="text-xs mt-1"
                  >
                    {step.error}
                  </Text>
                )}
              </View>
            </View>

            {step.error && onRetryStep && (
              <TouchableOpacity
                onPress={() => onRetryStep(step.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: currentColors.primary,
                }}
              >
                <Text
                  style={{ color: currentColors.primary }}
                  className="text-xs font-medium"
                >
                  Retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

interface DataLoadingSkeletonProps {
  lines?: number;
  showAvatar?: boolean;
  animated?: boolean;
}

export const DataLoadingSkeleton: React.FC<DataLoadingSkeletonProps> = ({
  lines = 3,
  showAvatar = false,
  animated = true,
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      skeleton: "#E5E7EB",
      skeletonHighlight: "#F3F4F6",
    },
    dark: {
      skeleton: "#374151",
      skeletonHighlight: "#4B5563",
    },
  };

  const currentColors = colors[theme];

  return (
    <View className="p-4">
      <View className="flex-row items-start">
        {showAvatar && (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: currentColors.skeleton,
              marginRight: 12,
            }}
          />
        )}

        <View className="flex-1">
          {Array.from({ length: lines }).map((_, index) => (
            <View
              key={index}
              style={{
                height: 16,
                backgroundColor: currentColors.skeleton,
                borderRadius: 8,
                marginBottom: 8,
                width: index === lines - 1 ? "60%" : "100%",
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

interface InlineLoadingProps {
  loading: boolean;
  text?: string;
  size?: "small" | "large";
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  loading,
  text,
  size = "small",
}) => {
  if (!loading) return null;

  return (
    <View className="flex-row items-center justify-center py-2">
      <LoadingSpinner size={size} />
      {text && (
        <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          {text}
        </Text>
      )}
    </View>
  );
};
