/**
 * Face Detection Quality Feedback Component
 *
 * Provides real-time feedback on face detection quality
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface QualityFeedback {
  lighting: "good" | "poor" | "too_dark";
  positioning: "centered" | "too_left" | "too_right";
  distance: "good" | "too_far" | "too_close";
  angle: "good" | "tilted";
  clarity: "good" | "blurry";
}

interface FaceDetectionQualityFeedbackProps {
  feedback: QualityFeedback;
  visible?: boolean;
  faceData?: any;
  isDetecting?: boolean;
  qualityScore?: number;
  onQualityChange?: (score: number) => void;
}

export function FaceDetectionQualityFeedback({
  feedback,
  visible = true,
  faceData,
  isDetecting,
  qualityScore,
  onQualityChange,
}: FaceDetectionQualityFeedbackProps) {
  if (!visible) return null;

  const getFeedbackItem = (
    key: keyof QualityFeedback,
    label: string,
    goodIcon: string,
    badIcon: string,
  ) => {
    const isGood = feedback[key] === "good";
    const icon = isGood ? goodIcon : badIcon;
    const color = isGood ? "#10b981" : "#ef4444";

    let message = label;
    if (!isGood) {
      switch (key) {
        case "lighting":
          message = feedback[key] === "poor" ? "Improve lighting" : "Too dark";
          break;
        case "positioning":
          message = feedback[key] === "too_left" ? "Move right" : "Move left";
          break;
        case "distance":
          message = feedback[key] === "too_far" ? "Move closer" : "Move back";
          break;
        case "angle":
          message = "Look straight";
          break;
        case "clarity":
          message = "Hold steady";
          break;
      }
    }

    return (
      <View key={key} style={styles.feedbackItem}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={[styles.feedbackText, { color }]}>{message}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {getFeedbackItem("lighting", "Good lighting", "sunny", "sunny-outline")}
      {getFeedbackItem(
        "positioning",
        "Centered",
        "checkmark-circle",
        "arrow-forward",
      )}
      {getFeedbackItem(
        "distance",
        "Good distance",
        "checkmark-circle",
        "resize",
      )}
      {getFeedbackItem("angle", "Good angle", "checkmark-circle", "refresh")}
      {getFeedbackItem("clarity", "Clear image", "checkmark-circle", "eye-off")}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  feedbackItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  feedbackText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "500",
  },
});
