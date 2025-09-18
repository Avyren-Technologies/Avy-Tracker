import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCameraLiveness } from "../hooks/useCameraLiveness";
import { FaceDetectionData } from "../types/faceDetection";
import { SafeAreaView } from "react-native-safe-area-context";

// Mock face data for testing
const createMockFaceData = (
  leftEyeOpen: number,
  rightEyeOpen: number,
): FaceDetectionData => ({
  bounds: { x: 100, y: 100, width: 200, height: 250 },
  leftEyeOpenProbability: leftEyeOpen,
  rightEyeOpenProbability: rightEyeOpen,
  faceId: `face_${Date.now()}`,
  rollAngle: (Math.random() - 0.5) * 10, // Small random angle
  yawAngle: (Math.random() - 0.5) * 10,
});

export default function CameraLivenessTest() {
  const [mockFaceData, setMockFaceData] = useState<FaceDetectionData | null>(
    null,
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);

  // Use the liveness detection hook
  const {
    isLivenessActive,
    blinkDetected,
    livenessScore,
    livenessData,
    isLive,
    blinkCount,
    eyeMovementScore,
    startLivenessDetection,
    stopLivenessDetection,
    resetLivenessState,
  } = useCameraLiveness(mockFaceData);

  // Simulate blink sequence
  const blinkSequence = [
    { left: 0.9, right: 0.9 }, // Eyes open
    { left: 0.8, right: 0.8 }, // Slightly closing
    { left: 0.3, right: 0.2 }, // Eyes closed
    { left: 0.2, right: 0.3 }, // Still closed
    { left: 0.7, right: 0.8 }, // Opening
    { left: 0.9, right: 0.9 }, // Eyes open
  ];

  // Simulate natural eye movement
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      if (simulationStep < blinkSequence.length) {
        const step = blinkSequence[simulationStep];
        setMockFaceData(createMockFaceData(step.left, step.right));
        setSimulationStep((prev) => prev + 1);
      } else {
        // Reset and continue with random variations
        setSimulationStep(0);
        const randomVariation = Math.random() * 0.2 - 0.1; // ±0.1 variation
        setMockFaceData(
          createMockFaceData(0.8 + randomVariation, 0.8 + randomVariation),
        );
      }
    }, 150); // 150ms intervals

    return () => clearInterval(interval);
  }, [isSimulating, simulationStep]);

  const handleStartTest = () => {
    resetLivenessState();
    setIsSimulating(true);
    setSimulationStep(0);
    startLivenessDetection();

    // Generate initial face data
    setMockFaceData(createMockFaceData(0.9, 0.9));
  };

  const handleStopTest = () => {
    setIsSimulating(false);
    stopLivenessDetection();
    setMockFaceData(null);
  };

  const handleReset = () => {
    handleStopTest();
    resetLivenessState();
  };

  const simulateBlink = () => {
    if (!mockFaceData) return;

    // Simulate a quick blink sequence
    const blinkSteps = [
      { left: 0.9, right: 0.9 }, // Open
      { left: 0.2, right: 0.2 }, // Closed
      { left: 0.9, right: 0.9 }, // Open
    ];

    blinkSteps.forEach((step, index) => {
      setTimeout(() => {
        setMockFaceData(createMockFaceData(step.left, step.right));
      }, index * 100);
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "#10b981"; // Green
    if (score >= 0.6) return "#f59e0b"; // Yellow
    return "#ef4444"; // Red
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Camera Liveness Test",
          headerStyle: { backgroundColor: "#1f2937" },
          headerTintColor: "#ffffff",
        }}
      />
      <StatusBar style="light" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detection Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Active</Text>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isLivenessActive ? "#10b981" : "#6b7280" },
                ]}
              />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Live</Text>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isLive ? "#10b981" : "#ef4444" },
                ]}
              />
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Simulating</Text>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isSimulating ? "#3b82f6" : "#6b7280" },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Metrics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liveness Metrics</Text>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Liveness Score:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getScoreColor(livenessScore) },
              ]}
            >
              {(livenessScore * 100).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Eye Movement Score:</Text>
            <Text
              style={[
                styles.metricValue,
                { color: getScoreColor(eyeMovementScore) },
              ]}
            >
              {(eyeMovementScore * 100).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Blink Count:</Text>
            <Text style={styles.metricValue}>{blinkCount}</Text>
          </View>

          {blinkDetected && (
            <View style={styles.blinkAlert}>
              <Text style={styles.blinkText}>👁️ Blink Detected!</Text>
            </View>
          )}
        </View>

        {/* Face Data Section */}
        {mockFaceData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Face Data</Text>
            <View style={styles.faceDataContainer}>
              <Text style={styles.faceDataText}>
                Left Eye:{" "}
                {(mockFaceData.leftEyeOpenProbability * 100).toFixed(1)}%
              </Text>
              <Text style={styles.faceDataText}>
                Right Eye:{" "}
                {(mockFaceData.rightEyeOpenProbability * 100).toFixed(1)}%
              </Text>
              <Text style={styles.faceDataText}>
                Roll Angle: {mockFaceData.rollAngle.toFixed(1)}°
              </Text>
              <Text style={styles.faceDataText}>
                Yaw Angle: {mockFaceData.yawAngle.toFixed(1)}°
              </Text>
            </View>
          </View>
        )}

        {/* Liveness Data Section */}
        {livenessData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Liveness Data</Text>
            <View style={styles.livenessDataContainer}>
              <Text style={styles.dataText}>
                Timestamp:{" "}
                {new Date(livenessData.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.dataText}>
                Blink Detected: {livenessData.blinkDetected ? "Yes" : "No"}
              </Text>
              <Text style={styles.dataText}>
                Total Blinks: {livenessData.blinkCount}
              </Text>
              <Text style={styles.dataText}>
                Eye Movement: {(livenessData.eyeMovementScore * 100).toFixed(1)}
                %
              </Text>
              <Text style={styles.dataText}>
                Is Live: {livenessData.isLive ? "Yes" : "No"}
              </Text>
            </View>
          </View>
        )}

        {/* Controls Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Controls</Text>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleStartTest}
            disabled={isLivenessActive}
          >
            <Text style={styles.buttonText}>Start Liveness Test</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleStopTest}
            disabled={!isLivenessActive}
          >
            <Text style={[styles.buttonText, { color: "#374151" }]}>
              Stop Test
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.warningButton]}
            onPress={simulateBlink}
            disabled={!isLivenessActive}
          >
            <Text style={styles.buttonText}>Simulate Blink</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={handleReset}
          >
            <Text style={styles.buttonText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instructionText}>
            1. Tap "Start Liveness Test" to begin simulation
          </Text>
          <Text style={styles.instructionText}>
            2. Watch the metrics update as the simulation runs
          </Text>
          <Text style={styles.instructionText}>
            3. Use "Simulate Blink" to trigger manual blink events
          </Text>
          <Text style={styles.instructionText}>
            4. A liveness score above 60% indicates successful detection
          </Text>
          <Text style={styles.instructionText}>
            5. The system detects blinks between 100-500ms duration
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#f9fafb",
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statusItem: {
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 14,
    color: "#d1d5db",
    marginBottom: 8,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 16,
    color: "#d1d5db",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  blinkAlert: {
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
  blinkText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  faceDataContainer: {
    backgroundColor: "#374151",
    padding: 12,
    borderRadius: 8,
  },
  faceDataText: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  livenessDataContainer: {
    backgroundColor: "#374151",
    padding: 12,
    borderRadius: 8,
  },
  dataText: {
    fontSize: 14,
    color: "#e5e7eb",
    marginBottom: 4,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
  },
  warningButton: {
    backgroundColor: "#f59e0b",
  },
  dangerButton: {
    backgroundColor: "#ef4444",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  instructionText: {
    fontSize: 14,
    color: "#d1d5db",
    marginBottom: 8,
    lineHeight: 20,
  },
});
