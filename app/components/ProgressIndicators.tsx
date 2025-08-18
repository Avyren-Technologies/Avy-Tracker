import React from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  color,
  backgroundColor,
  showPercentage = false,
  animated = true
}) => {
  const { theme } = ThemeContext.useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  const colors = {
    light: {
      primary: '#3B82F6',
      background: '#E5E7EB',
      text: '#374151'
    },
    dark: {
      primary: '#60A5FA',
      background: '#374151',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(progress);
    }
  }, [progress, animated]);

  return (
    <View className="w-full">
      <View
        style={{
          height,
          backgroundColor: backgroundColor || currentColors.background,
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: color || currentColors.primary,
            borderRadius: height / 2,
            width: animatedValue.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        />
      </View>
      {showPercentage && (
        <Text
          style={{ color: currentColors.text }}
          className="text-sm text-center mt-1"
        >
          {Math.round(progress)}%
        </Text>
      )}
    </View>
  );
};

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color,
  backgroundColor,
  showPercentage = true
}) => {
  const { theme } = ThemeContext.useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  const colors = {
    light: {
      primary: '#3B82F6',
      background: '#E5E7EB',
      text: '#374151'
    },
    dark: {
      primary: '#60A5FA',
      background: '#374151',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View
      style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: backgroundColor || currentColors.background,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color || currentColors.primary,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [
            {
              rotate: animatedValue.interpolate({
                inputRange: [0, 100],
                outputRange: ['0deg', '360deg'],
                extrapolate: 'clamp',
              }),
            },
          ],
        }}
      />
      {showPercentage && (
        <Text
          style={{ color: currentColors.text }}
          className="text-sm font-medium"
        >
          {Math.round(progress)}%
        </Text>
      )}
    </View>
  );
};

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color,
  text
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      primary: '#3B82F6',
      text: '#374151'
    },
    dark: {
      primary: '#60A5FA',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];

  return (
    <View className="items-center justify-center">
      <ActivityIndicator
        size={size}
        color={color || currentColors.primary}
      />
      {text && (
        <Text
          style={{ color: currentColors.text }}
          className="text-sm mt-2 text-center"
        >
          {text}
        </Text>
      )}
    </View>
  );
};

interface CountdownTimerProps {
  seconds: number;
  onComplete?: () => void;
  size?: number;
  color?: string;
  showText?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  seconds,
  onComplete,
  size = 80,
  color,
  showText = true
}) => {
  const { theme } = ThemeContext.useTheme();
  const [timeLeft, setTimeLeft] = React.useState(seconds);
  const animatedValue = React.useRef(new Animated.Value(100)).current;

  const colors = {
    light: {
      primary: '#3B82F6',
      warning: '#F59E0B',
      danger: '#EF4444',
      text: '#374151'
    },
    dark: {
      primary: '#60A5FA',
      warning: '#FBBF24',
      danger: '#F87171',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        const progress = ((seconds - timeLeft + 1) / seconds) * 100;
        Animated.timing(animatedValue, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }, 1000);

      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [timeLeft, seconds, onComplete]);

  const getColor = () => {
    if (color) return color;
    if (timeLeft <= 3) return currentColors.danger;
    if (timeLeft <= 10) return currentColors.warning;
    return currentColors.primary;
  };

  return (
    <View className="items-center justify-center">
      <CircularProgress
        progress={(timeLeft / seconds) * 100}
        size={size}
        color={getColor()}
        showPercentage={false}
      />
      <View
        style={{
          position: 'absolute',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          style={{ color: getColor() }}
          className="text-2xl font-bold"
        >
          {timeLeft}
        </Text>
        {showText && (
          <Text
            style={{ color: currentColors.text }}
            className="text-xs"
          >
            seconds
          </Text>
        )}
      </View>
    </View>
  );
};

interface StepProgressProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  currentStep,
  completedSteps = []
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      primary: '#3B82F6',
      success: '#10B981',
      background: '#E5E7EB',
      text: '#374151',
      textSecondary: '#6B7280'
    },
    dark: {
      primary: '#60A5FA',
      success: '#34D399',
      background: '#374151',
      text: '#F3F4F6',
      textSecondary: '#9CA3AF'
    }
  };

  const currentColors = colors[theme];

  const getStepColor = (index: number) => {
    if (completedSteps.includes(index)) return currentColors.success;
    if (index === currentStep) return currentColors.primary;
    return currentColors.background;
  };

  const getStepIcon = (index: number) => {
    if (completedSteps.includes(index)) return 'checkmark';
    return undefined;
  };

  return (
    <View className="w-full">
      <View className="flex-row items-center justify-between mb-4">
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <View className="items-center flex-1">
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: getStepColor(index),
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                {getStepIcon(index) ? (
                  <Ionicons
                    name={getStepIcon(index) as any}
                    size={16}
                    color="white"
                  />
                ) : (
                  <Text
                    style={{
                      color: index === currentStep || completedSteps.includes(index)
                        ? 'white'
                        : currentColors.textSecondary,
                      fontSize: 14,
                      fontWeight: 'bold',
                    }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  color: index === currentStep
                    ? currentColors.text
                    : currentColors.textSecondary,
                  fontSize: 12,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {step}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: index < currentStep || completedSteps.includes(index)
                    ? currentColors.primary
                    : currentColors.background,
                  marginHorizontal: 8,
                  marginBottom: 24,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

interface SuccessAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  size?: number;
  message?: string;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  visible,
  onComplete,
  size = 80,
  message = 'Success!'
}) => {
  const { theme } = ThemeContext.useTheme();
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  const colors = {
    light: {
      success: '#10B981',
      text: '#374151'
    },
    dark: {
      success: '#34D399',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500);
      });
    } else {
      scaleValue.setValue(0);
      opacityValue.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleValue }],
        opacity: opacityValue,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: currentColors.success,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="checkmark" size={size * 0.5} color="white" />
      </View>
      <Text
        style={{ color: currentColors.text }}
        className="text-lg font-semibold text-center"
      >
        {message}
      </Text>
    </Animated.View>
  );
};

interface FailureAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  size?: number;
  message?: string;
}

export const FailureAnimation: React.FC<FailureAnimationProps> = ({
  visible,
  onComplete,
  size = 80,
  message = 'Failed!'
}) => {
  const { theme } = ThemeContext.useTheme();
  const shakeValue = React.useRef(new Animated.Value(0)).current;
  const opacityValue = React.useRef(new Animated.Value(0)).current;

  const colors = {
    light: {
      danger: '#EF4444',
      text: '#374151'
    },
    dark: {
      danger: '#F87171',
      text: '#F3F4F6'
    }
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(shakeValue, {
              toValue: 10,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(shakeValue, {
              toValue: -10,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(shakeValue, {
              toValue: 10,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(shakeValue, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => {
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1500);
      });
    } else {
      shakeValue.setValue(0);
      opacityValue.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateX: shakeValue }],
        opacity: opacityValue,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: currentColors.danger,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name="close" size={size * 0.5} color="white" />
      </View>
      <Text
        style={{ color: currentColors.text }}
        className="text-lg font-semibold text-center"
      >
        {message}
      </Text>
    </Animated.View>
  );
};