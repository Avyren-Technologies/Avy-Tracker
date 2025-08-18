import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { FaceDetectionData, FaceQuality } from '../types/faceDetection';

const { width, height } = Dimensions.get('window');

interface FacePositioningGuideProps {
  faceData: FaceDetectionData | null;
  faceQuality: FaceQuality | null;
  isVisible: boolean;
  onPositionCorrect?: () => void;
  enableVoiceGuidance?: boolean;
}

interface PositionGuidance {
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  voiceMessage?: string;
}

/**
 * Face Positioning Guide Component
 * 
 * Provides real-time visual and audio guidance for optimal face positioning
 * during face verification. Includes accessibility features for visually impaired users.
 * 
 * Requirements addressed:
 * - 1.7: User guidance for face positioning
 * - 6.3: Real-time feedback and progress indicators
 * - Accessibility features for visually impaired users
 */
export default function FacePositioningGuide({
  faceData,
  faceQuality,
  isVisible,
  onPositionCorrect,
  enableVoiceGuidance = true,
}: FacePositioningGuideProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#1f2937', '#f8fafc');
  const successColor = useThemeColor('#10b981', '#34d399');
  const warningColor = useThemeColor('#f59e0b', '#fbbf24');
  const errorColor = useThemeColor('#ef4444', '#f87171');
  const infoColor = useThemeColor('#3b82f6', '#60a5fa');

  // Animation values
  const [pulseAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [guidance, setGuidance] = useState<PositionGuidance | null>(null);
  const [lastVoiceMessage, setLastVoiceMessage] = useState<string>('');

  /**
   * Get color for severity level
   */
  const getColorForSeverity = useCallback((severity: string) => {
    switch (severity) {
      case 'success': return successColor;
      case 'warning': return warningColor;
      case 'error': return errorColor;
      case 'info': return infoColor;
      default: return textColor;
    }
  }, [successColor, warningColor, errorColor, infoColor, textColor]);

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (Platform.OS === 'ios' && enableVoiceGuidance) {
      // Avoid repeating the same message
      if (message !== lastVoiceMessage) {
        AccessibilityInfo.announceForAccessibility(message);
        setLastVoiceMessage(message);
      }
    }
  }, [enableVoiceGuidance, lastVoiceMessage]);

  /**
   * Analyze face position and provide guidance
   */
  const analyzeFacePosition = useCallback((): PositionGuidance | null => {
    if (!faceData || !faceQuality) {
      return {
        message: 'Position your face in the frame',
        icon: 'scan-outline',
        color: infoColor,
        severity: 'info',
        voiceMessage: 'Please position your face in the camera frame',
      };
    }

    // Check if face is detected and quality is good
    if (faceQuality.isValid && faceQuality.overall >= 0.8) {
      return {
        message: 'Perfect! Hold this position',
        icon: 'checkmark-circle',
        color: successColor,
        severity: 'success',
        voiceMessage: 'Perfect positioning. Hold this position.',
      };
    }

    // Analyze specific quality issues
    const issues: string[] = [];
    const voiceIssues: string[] = [];

    // Size issues
    if (faceQuality.size < 0.3) {
      issues.push('Move closer to the camera');
      voiceIssues.push('move closer to the camera');
    } else if (faceQuality.size > 0.7) {
      issues.push('Move further from the camera');
      voiceIssues.push('move further from the camera');
    }

    // Lighting issues
    if (faceQuality.lighting < 0.4) {
      issues.push('Improve lighting conditions');
      voiceIssues.push('improve lighting');
    }

    // Angle issues
    if (faceQuality.angle < 0.6) {
      if (Math.abs(faceData.rollAngle) > 15) {
        issues.push('Keep your head straight');
        voiceIssues.push('keep your head straight');
      }
      if (Math.abs(faceData.yawAngle) > 15) {
        issues.push('Look directly at the camera');
        voiceIssues.push('look directly at the camera');
      }
    }

    if (issues.length === 0) {
      return {
        message: 'Good positioning, slight adjustments needed',
        icon: 'thumbs-up',
        color: warningColor,
        severity: 'warning',
        voiceMessage: 'Good positioning, slight adjustments needed',
      };
    }

    // Return the most critical issue
    const primaryIssue = issues[0];
    const severity = faceQuality.overall < 0.3 ? 'error' : 'warning';
    
    return {
      message: primaryIssue,
      icon: severity === 'error' ? 'warning' : 'information-circle',
      color: severity === 'error' ? errorColor : warningColor,
      severity: severity as 'error' | 'warning',
      voiceMessage: `Please ${voiceIssues.join(' and ')}`,
    };
  }, [faceData, faceQuality, infoColor, successColor, warningColor, errorColor]);

  /**
   * Start pulse animation
   */
  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  /**
   * Fade in animation
   */
  const fadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  /**
   * Fade out animation
   */
  const fadeOut = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Update guidance when face data changes
  useEffect(() => {
    if (!isVisible) return;

    const newGuidance = analyzeFacePosition();
    setGuidance(newGuidance);

    // Announce guidance to screen readers
    if (newGuidance?.voiceMessage) {
      announceToScreenReader(newGuidance.voiceMessage);
    }

    // Trigger callback when position is correct
    if (newGuidance?.severity === 'success' && onPositionCorrect) {
      onPositionCorrect();
    }
  }, [faceData, faceQuality, isVisible, analyzeFacePosition, announceToScreenReader, onPositionCorrect]);

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      fadeIn();
      startPulseAnimation();
    } else {
      fadeOut();
    }
  }, [isVisible, fadeIn, fadeOut, startPulseAnimation]);

  if (!isVisible || !guidance) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          backgroundColor: backgroundColor + 'E6', // 90% opacity
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={guidance.voiceMessage || guidance.message}
    >
      {/* Face Frame Overlay */}
      <View style={styles.frameContainer}>
        <Animated.View
          style={[
            styles.faceFrame,
            {
              borderColor: guidance.color,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {/* Corner guides */}
          <View style={[styles.corner, styles.topLeft, { borderColor: guidance.color }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: guidance.color }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: guidance.color }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: guidance.color }]} />
          
          {/* Center indicator */}
          <View style={[styles.centerIndicator, { backgroundColor: guidance.color }]}>
            <Ionicons name={guidance.icon} size={24} color="#ffffff" />
          </View>
        </Animated.View>
      </View>

      {/* Guidance Message */}
      <View style={[styles.messageContainer, { backgroundColor }]}>
        <View style={styles.messageContent}>
          <Ionicons
            name={guidance.icon}
            size={20}
            color={guidance.color}
            style={styles.messageIcon}
          />
          <Text
            style={[
              styles.messageText,
              { color: textColor },
            ]}
            accessibilityRole="text"
          >
            {guidance.message}
          </Text>
        </View>
        
        {/* Quality indicators */}
        {faceQuality && (
          <View style={styles.qualityIndicators}>
            <View style={styles.qualityItem}>
              <Text style={[styles.qualityLabel, { color: textColor }]}>Size</Text>
              <View style={[styles.qualityBar, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                <View
                  style={[
                    styles.qualityFill,
                    {
                      width: `${Math.min(faceQuality.size * 100, 100)}%`,
                      backgroundColor: faceQuality.size > 0.5 ? successColor : warningColor,
                    },
                  ]}
                />
              </View>
            </View>
            
            <View style={styles.qualityItem}>
              <Text style={[styles.qualityLabel, { color: textColor }]}>Light</Text>
              <View style={[styles.qualityBar, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                <View
                  style={[
                    styles.qualityFill,
                    {
                      width: `${Math.min(faceQuality.lighting * 100, 100)}%`,
                      backgroundColor: faceQuality.lighting > 0.5 ? successColor : warningColor,
                    },
                  ]}
                />
              </View>
            </View>
            
            <View style={styles.qualityItem}>
              <Text style={[styles.qualityLabel, { color: textColor }]}>Angle</Text>
              <View style={[styles.qualityBar, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                <View
                  style={[
                    styles.qualityFill,
                    {
                      width: `${Math.min(faceQuality.angle * 100, 100)}%`,
                      backgroundColor: faceQuality.angle > 0.5 ? successColor : warningColor,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: width * 0.7,
    height: width * 0.85,
    borderWidth: 3,
    borderRadius: (width * 0.7) / 2,
    borderStyle: 'dashed',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderWidth: 4,
  },
  topLeft: {
    top: -15,
    left: -15,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 15,
  },
  topRight: {
    top: -15,
    right: -15,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 15,
  },
  bottomLeft: {
    bottom: -15,
    left: -15,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 15,
  },
  bottomRight: {
    bottom: -15,
    right: -15,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 15,
  },
  centerIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  messageContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageIcon: {
    marginRight: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  qualityIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  qualityLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  qualityBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  qualityFill: {
    height: '100%',
    borderRadius: 3,
  },
});