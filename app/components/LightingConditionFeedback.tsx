import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import { FaceDetectionData, FaceQuality } from "../types/faceDetection";

interface LightingConditionFeedbackProps {
  faceData: FaceDetectionData | null;
  faceQuality: FaceQuality | null;
  isVisible: boolean;
  enableVoiceGuidance?: boolean;
}

interface LightingCondition {
  level: "excellent" | "good" | "fair" | "poor" | "very-poor";
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  suggestions: string[];
  voiceMessage: string;
}

/**
 * Lighting Condition Feedback Component
 *
 * Provides real-time feedback about lighting conditions for optimal face verification.
 * Includes specific suggestions for improving lighting and accessibility features.
 *
 * Requirements addressed:
 * - 1.7: Lighting condition feedback and guidance
 * - 6.3: Real-time feedback indicators
 * - Accessibility features for visually impaired users
 */
export default function LightingConditionFeedback({
  faceData,
  faceQuality,
  isVisible,
  enableVoiceGuidance = true,
}: LightingConditionFeedbackProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const successColor = useThemeColor("#10b981", "#34d399");
  const warningColor = useThemeColor("#f59e0b", "#fbbf24");
  const errorColor = useThemeColor("#ef4444", "#f87171");
  const infoColor = useThemeColor("#3b82f6", "#60a5fa");

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [lightingCondition, setLightingCondition] =
    useState<LightingCondition | null>(null);
  const [lastVoiceMessage, setLastVoiceMessage] = useState<string>("");

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback(
    (message: string) => {
      if (Platform.OS === "ios" && enableVoiceGuidance) {
        // Avoid repeating the same message
        if (message !== lastVoiceMessage) {
          AccessibilityInfo.announceForAccessibility(message);
          setLastVoiceMessage(message);
        }
      }
    },
    [enableVoiceGuidance, lastVoiceMessage],
  );

  /**
   * Analyze lighting conditions based on face detection data
   */
  const analyzeLightingConditions =
    useCallback((): LightingCondition | null => {
      if (!faceData || !faceQuality) {
        return null;
      }

      const lightingScore = faceQuality.lighting;
      const eyeOpenAverage =
        (faceData.leftEyeOpenProbability + faceData.rightEyeOpenProbability) /
        2;

      // Determine lighting level based on multiple factors
      let level: LightingCondition["level"];
      let message: string;
      let icon: keyof typeof Ionicons.glyphMap;
      let color: string;
      let suggestions: string[];
      let voiceMessage: string;

      if (lightingScore >= 0.8 && eyeOpenAverage >= 0.8) {
        level = "excellent";
        message = "Excellent lighting conditions";
        icon = "sunny";
        color = successColor;
        suggestions = ["Perfect! Maintain current lighting"];
        voiceMessage = "Excellent lighting conditions detected";
      } else if (lightingScore >= 0.6 && eyeOpenAverage >= 0.6) {
        level = "good";
        message = "Good lighting conditions";
        icon = "partly-sunny";
        color = successColor;
        suggestions = ["Good lighting, slight improvements possible"];
        voiceMessage = "Good lighting conditions";
      } else if (lightingScore >= 0.4 && eyeOpenAverage >= 0.4) {
        level = "fair";
        message = "Fair lighting - improvements needed";
        icon = "cloudy";
        color = warningColor;
        suggestions = [
          "Move to a brighter area",
          "Turn on additional lights",
          "Face a window or light source",
        ];
        voiceMessage =
          "Fair lighting conditions. Consider moving to a brighter area";
      } else if (lightingScore >= 0.2 && eyeOpenAverage >= 0.2) {
        level = "poor";
        message = "Poor lighting conditions";
        icon = "cloudy-night";
        color = errorColor;
        suggestions = [
          "Move to a well-lit area immediately",
          "Turn on room lights",
          "Use phone flashlight as additional light",
          "Avoid backlighting from windows",
        ];
        voiceMessage =
          "Poor lighting conditions detected. Please move to a brighter area";
      } else {
        level = "very-poor";
        message = "Very poor lighting - verification may fail";
        icon = "moon";
        color = errorColor;
        suggestions = [
          "Find a bright, well-lit location",
          "Turn on all available lights",
          "Use multiple light sources",
          "Avoid shadows on your face",
          "Consider using verification during daylight hours",
        ];
        voiceMessage =
          "Very poor lighting conditions. Verification may fail. Please find better lighting";
      }

      return {
        level,
        message,
        icon,
        color,
        suggestions,
        voiceMessage,
      };
    }, [faceData, faceQuality, successColor, warningColor, errorColor]);

  /**
   * Start pulse animation for poor lighting conditions
   */
  const startPulseAnimation = useCallback(() => {
    if (
      lightingCondition?.level === "poor" ||
      lightingCondition?.level === "very-poor"
    ) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [pulseAnim, lightingCondition]);

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

  // Update lighting condition when face data changes
  useEffect(() => {
    if (!isVisible) return;

    const condition = analyzeLightingConditions();
    setLightingCondition(condition);

    // Announce lighting condition to screen readers
    if (condition?.voiceMessage) {
      announceToScreenReader(condition.voiceMessage);
    }
  }, [
    faceData,
    faceQuality,
    isVisible,
    analyzeLightingConditions,
    announceToScreenReader,
  ]);

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      fadeIn();
    } else {
      fadeOut();
    }
  }, [isVisible, fadeIn, fadeOut]);

  // Start pulse animation for poor lighting
  useEffect(() => {
    startPulseAnimation();
  }, [startPulseAnimation]);

  if (!isVisible || !lightingCondition) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          backgroundColor,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={lightingCondition.voiceMessage}
    >
      {/* Lighting Indicator */}
      <Animated.View
        style={[
          styles.indicatorContainer,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: lightingCondition.color,
            },
          ]}
        >
          <Ionicons name={lightingCondition.icon} size={24} color="#ffffff" />
        </View>
      </Animated.View>

      {/* Lighting Message */}
      <Text
        style={[styles.message, { color: textColor }]}
        accessibilityRole="text"
      >
        {lightingCondition.message}
      </Text>

      {/* Lighting Quality Bar */}
      <View style={styles.qualityBarContainer}>
        <Text style={[styles.qualityLabel, { color: textColor }]}>
          Lighting Quality
        </Text>
        <View
          style={[styles.qualityBar, { backgroundColor: "rgba(0,0,0,0.1)" }]}
        >
          <View
            style={[
              styles.qualityFill,
              {
                width: `${Math.min((faceQuality?.lighting || 0) * 100, 100)}%`,
                backgroundColor: lightingCondition.color,
              },
            ]}
          />
        </View>
        <Text style={[styles.qualityPercentage, { color: textColor }]}>
          {Math.round((faceQuality?.lighting || 0) * 100)}%
        </Text>
      </View>

      {/* Suggestions */}
      {lightingCondition.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsTitle, { color: textColor }]}>
            Suggestions:
          </Text>
          {lightingCondition.suggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestionItem}>
              <Ionicons
                name="bulb"
                size={14}
                color={lightingCondition.color}
                style={styles.suggestionIcon}
              />
              <Text
                style={[styles.suggestionText, { color: textColor }]}
                accessibilityRole="text"
              >
                {suggestion}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Environmental Tips */}
      <View style={styles.tipsContainer}>
        <Text style={[styles.tipsTitle, { color: textColor }]}>
          💡 Lighting Tips:
        </Text>
        <Text style={[styles.tipText, { color: textColor }]}>
          • Face a window or light source
        </Text>
        <Text style={[styles.tipText, { color: textColor }]}>
          • Avoid shadows and backlighting
        </Text>
        <Text style={[styles.tipText, { color: textColor }]}>
          • Use even, diffused lighting
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    margin: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  indicatorContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  indicator: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  message: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  qualityBarContainer: {
    marginBottom: 16,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  qualityBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  qualityFill: {
    height: "100%",
    borderRadius: 4,
  },
  qualityPercentage: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  suggestionsContainer: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  suggestionIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tipsContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    opacity: 0.8,
  },
});
