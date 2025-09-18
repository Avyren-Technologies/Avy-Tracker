/**
 * Verification Progress Overlay Component
 *
 * Shows progress overlay during face verification
 */

import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { ProgressBar } from "./ProgressIndicators";

interface VerificationProgressOverlayProps {
  visible: boolean;
  progress: number;
  statusMessage: string;
  guidanceMessage?: string;
  step?: string;
  message?: string;
  countdown?: number;
  onCountdownComplete?: () => void;
  onAnimationComplete?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

export function VerificationProgressOverlay({
  visible,
  progress,
  statusMessage,
  guidanceMessage,
  step,
  message,
  countdown,
  onCountdownComplete,
  onAnimationComplete,
  retryCount,
  maxRetries,
}: VerificationProgressOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#3b82f6"
          style={styles.spinner}
        />

        <Text style={styles.statusText}>{statusMessage}</Text>

        {guidanceMessage && (
          <Text style={styles.guidanceText}>{guidanceMessage}</Text>
        )}

        <View style={styles.progressContainer}>
          <ProgressBar
            progress={progress}
            showPercentage={true}
            animated={true}
            color="#3b82f6"
          />
        </View>
      </View>
    </View>
  );
}

// Additional overlay for liveness detection
export function LivenessProgressOverlay({
  visible,
  progress,
  statusMessage,
  guidanceMessage,
}: {
  visible: boolean;
  progress: number;
  statusMessage: string;
  guidanceMessage?: string;
}) {
  return (
    <VerificationProgressOverlay
      visible={visible}
      progress={progress}
      statusMessage={statusMessage}
      guidanceMessage={guidanceMessage}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    alignItems: "center",
  },
  spinner: {
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginBottom: 8,
  },
  guidanceText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  progressContainer: {
    width: "100%",
  },
});
