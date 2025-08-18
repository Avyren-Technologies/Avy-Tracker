import React from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemeContext from '../context/ThemeContext';
import { FaceDetectionData } from '../types/faceDetection';
import { ProgressBar, CircularProgress } from './ProgressIndicators';

interface FaceDetectionQualityFeedbackProps {
  faceData: FaceDetectionData | null;
  isDetecting: boolean;
  qualityScore: number; // 0-100
  feedback: {
    lighting: 'good' | 'poor' | 'too_bright' | 'too_dark';
    positioning: 'centered' | 'too_left' | 'too_right' | 'too_high' | 'too_low';
    distance: 'good' | 'too_close' | 'too_far';
    angle: 'good' | 'tilted';
    clarity: 'good' | 'blurry';
  };
  onQualityChange?: (score: number) => void;
}

export const FaceDetectionQualityFeedback: React.FC<FaceDetectionQualityFeedbackProps> = ({
  faceData,
  isDetecting,
  qualityScore,
  feedback,
  onQualityChange
}) => {
  const { theme } = ThemeContext.useTheme();
  const pulseValue = React.useRef(new Animated.Value(1)).current;

  const colors = {
    light: {
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      text: '#374151',
      textSecondary: '#6B7280',
      background: '#F9FAFB',
      border: '#E5E7EB'
    },
    dark: {
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      text: '#F3F4F6',
      textSecondary: '#9CA3AF',
      background: '#1F2937',
      border: '#374151'
    }
  };

  const currentColors = colors[theme];

  React.useEffect(() => {
    if (isDetecting) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isDetecting]);

  React.useEffect(() => {
    if (onQualityChange) {
      onQualityChange(qualityScore);
    }
  }, [qualityScore, onQualityChange]);

  const getQualityColor = (score: number) => {
    if (score >= 80) return currentColors.success;
    if (score >= 60) return currentColors.warning;
    return currentColors.danger;
  };

  const getQualityText = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const getFeedbackMessage = () => {
    const messages: string[] = [];

    if (feedback.lighting !== 'good') {
      switch (feedback.lighting) {
        case 'too_dark':
          messages.push('Move to better lighting');
          break;
        case 'too_bright':
          messages.push('Reduce bright lighting');
          break;
        case 'poor':
          messages.push('Improve lighting conditions');
          break;
      }
    }

    if (feedback.positioning !== 'centered') {
      switch (feedback.positioning) {
        case 'too_left':
          messages.push('Move face to the right');
          break;
        case 'too_right':
          messages.push('Move face to the left');
          break;
        case 'too_high':
          messages.push('Lower your face');
          break;
        case 'too_low':
          messages.push('Raise your face');
          break;
      }
    }

    if (feedback.distance !== 'good') {
      switch (feedback.distance) {
        case 'too_close':
          messages.push('Move camera further away');
          break;
        case 'too_far':
          messages.push('Move camera closer');
          break;
      }
    }

    if (feedback.angle !== 'good') {
      messages.push('Keep your head straight');
    }

    if (feedback.clarity !== 'good') {
      messages.push('Hold camera steady');
    }

    if (messages.length === 0) {
      return 'Perfect! Hold steady for capture';
    }

    return messages[0]; // Show the most important message
  };

  const getFeedbackIcon = () => {
    if (qualityScore >= 80) return 'checkmark-circle';
    if (qualityScore >= 60) return 'warning';
    return 'alert-circle';
  };

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
      {/* Quality Score Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text
          style={{ color: currentColors.text }}
          className="text-lg font-semibold"
        >
          Face Detection Quality
        </Text>
        <View className="flex-row items-center">
          <CircularProgress
            progress={qualityScore}
            size={40}
            strokeWidth={4}
            color={getQualityColor(qualityScore)}
            showPercentage={false}
          />
          <Text
            style={{ color: getQualityColor(qualityScore) }}
            className="text-sm font-medium ml-2"
          >
            {getQualityText(qualityScore)}
          </Text>
        </View>
      </View>

      {/* Overall Progress Bar */}
      <View className="mb-4">
        <ProgressBar
          progress={qualityScore}
          height={8}
          color={getQualityColor(qualityScore)}
          showPercentage={false}
          animated={true}
        />
      </View>

      {/* Feedback Message */}
      <Animated.View
        style={{
          transform: [{ scale: pulseValue }],
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons
          name={getFeedbackIcon()}
          size={20}
          color={getQualityColor(qualityScore)}
          style={{ marginRight: 8 }}
        />
        <Text
          style={{ color: currentColors.text }}
          className="text-sm flex-1"
        >
          {getFeedbackMessage()}
        </Text>
      </Animated.View>

      {/* Detailed Quality Metrics */}
      <View className="space-y-2">
        <QualityMetric
          label="Lighting"
          status={feedback.lighting}
          icon="sunny"
          colors={currentColors}
        />
        <QualityMetric
          label="Position"
          status={feedback.positioning}
          icon="locate"
          colors={currentColors}
        />
        <QualityMetric
          label="Distance"
          status={feedback.distance}
          icon="resize"
          colors={currentColors}
        />
        <QualityMetric
          label="Angle"
          status={feedback.angle}
          icon="compass"
          colors={currentColors}
        />
        <QualityMetric
          label="Clarity"
          status={feedback.clarity}
          icon="eye"
          colors={currentColors}
        />
      </View>

      {/* Face Detection Status */}
      {faceData && (
        <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <Text
            style={{ color: currentColors.textSecondary }}
            className="text-xs mb-2"
          >
            Detection Details:
          </Text>
          <View className="flex-row justify-between">
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-xs"
            >
              Eyes Open: {Math.round((faceData.leftEyeOpenProbability + faceData.rightEyeOpenProbability) * 50)}%
            </Text>
            <Text
              style={{ color: currentColors.textSecondary }}
              className="text-xs"
            >
              Face ID: {faceData.faceId.substring(0, 8)}...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

interface QualityMetricProps {
  label: string;
  status: string;
  icon: string;
  colors: any;
}

const QualityMetric: React.FC<QualityMetricProps> = ({
  label,
  status,
  icon,
  colors
}) => {
  const getStatusColor = (status: string) => {
    if (status === 'good' || status === 'centered') return colors.success;
    return colors.warning;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'good' || status === 'centered') return 'checkmark-circle';
    return 'warning';
  };

  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-row items-center flex-1">
        <Ionicons
          name={icon as any}
          size={16}
          color={colors.textSecondary}
          style={{ marginRight: 8 }}
        />
        <Text
          style={{ color: colors.textSecondary }}
          className="text-sm"
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Ionicons
          name={getStatusIcon(status)}
          size={16}
          color={getStatusColor(status)}
          style={{ marginRight: 4 }}
        />
        <Text
          style={{ color: getStatusColor(status) }}
          className="text-xs capitalize"
        >
          {status.replace('_', ' ')}
        </Text>
      </View>
    </View>
  );
};