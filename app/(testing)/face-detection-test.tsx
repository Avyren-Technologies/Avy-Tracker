import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { FaceDetectionOptions } from "../types/faceDetection";

export default function FaceDetectionTest() {
  const [options, setOptions] = useState<FaceDetectionOptions>({
    performanceMode: "accurate",
    enableLivenessDetection: true,
    qualityThreshold: 0.7,
  });

  const {
    isDetecting,
    faceDetected,
    faceData,
    startDetection,
    stopDetection,
    capturePhoto,
    error,
    cameraPermissionStatus,
    isInitialized,
    faceQuality,
  } = useFaceDetection(options);

  const handleStartDetection = async () => {
    try {
      const success = await startDetection();
      if (success) {
        Alert.alert("Success", "Face detection started successfully");
      } else {
        Alert.alert("Error", "Failed to start face detection");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Unknown error occurred");
    }
  };

  const handleStopDetection = () => {
    stopDetection();
    Alert.alert("Info", "Face detection stopped");
  };

  const handleCapturePhoto = async () => {
    try {
      const photo = await capturePhoto();
      Alert.alert(
        "Photo Captured",
        `Photo captured successfully!\nURI: ${photo.uri}\nSize: ${photo.width}x${photo.height}`,
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to capture photo");
    }
  };

  const togglePerformanceMode = () => {
    setOptions((prev) => ({
      ...prev,
      performanceMode:
        prev.performanceMode === "accurate" ? "fast" : "accurate",
    }));
  };

  const getStatusColor = (status: boolean | null) => {
    if (status === null) return "#6b7280";
    return status ? "#10b981" : "#ef4444";
  };

  const formatQuality = (quality: number) => {
    return `${Math.round(quality * 100)}%`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Face Detection Test",
          headerStyle: { backgroundColor: "#f8fafc" },
          headerTintColor: "#1f2937",
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Initialized:</Text>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(isInitialized) },
              ]}
            />
            <Text style={styles.statusText}>
              {isInitialized ? "Yes" : "No"}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Camera Permission:</Text>
            <Text style={styles.statusText}>
              {cameraPermissionStatus || "Not requested"}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Detecting:</Text>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(isDetecting) },
              ]}
            />
            <Text style={styles.statusText}>
              {isDetecting ? "Active" : "Inactive"}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Face Detected:</Text>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getStatusColor(faceDetected) },
              ]}
            />
            <Text style={styles.statusText}>{faceDetected ? "Yes" : "No"}</Text>
          </View>
        </View>

        {/* Face Data Section */}
        {faceData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Face Data</Text>

            <Text style={styles.dataText}>Face ID: {faceData.faceId}</Text>
            <Text style={styles.dataText}>
              Bounds: {Math.round(faceData.bounds.x)},{" "}
              {Math.round(faceData.bounds.y)},
              {Math.round(faceData.bounds.width)}x
              {Math.round(faceData.bounds.height)}
            </Text>
            <Text style={styles.dataText}>
              Left Eye Open: {formatQuality(faceData.leftEyeOpenProbability)}
            </Text>
            <Text style={styles.dataText}>
              Right Eye Open: {formatQuality(faceData.rightEyeOpenProbability)}
            </Text>
            <Text style={styles.dataText}>
              Roll Angle: {Math.round(faceData.rollAngle)}°
            </Text>
            <Text style={styles.dataText}>
              Yaw Angle: {Math.round(faceData.yawAngle)}°
            </Text>
          </View>
        )}

        {/* Face Quality Section */}
        {faceQuality && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Face Quality</Text>

            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>Lighting:</Text>
              <Text style={styles.qualityValue}>
                {formatQuality(faceQuality.lighting)}
              </Text>
            </View>

            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>Size:</Text>
              <Text style={styles.qualityValue}>
                {formatQuality(faceQuality.size)}
              </Text>
            </View>

            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>Angle:</Text>
              <Text style={styles.qualityValue}>
                {formatQuality(faceQuality.angle)}
              </Text>
            </View>

            <View style={styles.qualityRow}>
              <Text style={styles.qualityLabel}>Overall:</Text>
              <Text
                style={[
                  styles.qualityValue,
                  { color: faceQuality.overall >= 0.7 ? "#10b981" : "#ef4444" },
                ]}
              >
                {formatQuality(faceQuality.overall)}
              </Text>
            </View>
          </View>
        )}

        {/* Error Section */}
        {error && (
          <View style={styles.errorSection}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={togglePerformanceMode}
          >
            <Text style={styles.settingButtonText}>
              Performance Mode: {options.performanceMode}
            </Text>
          </TouchableOpacity>

          <Text style={styles.settingText}>
            Liveness Detection:{" "}
            {options.enableLivenessDetection ? "Enabled" : "Disabled"}
          </Text>

          <Text style={styles.settingText}>
            Quality Threshold: {formatQuality(options.qualityThreshold || 0.7)}
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStartDetection}
            disabled={isDetecting}
          >
            <Text style={styles.buttonText}>Start Detection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStopDetection}
            disabled={!isDetecting}
          >
            <Text style={styles.buttonText}>Stop Detection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.captureButton]}
            onPress={handleCapturePhoto}
            disabled={
              !faceDetected || !faceQuality || faceQuality.overall < 0.7
            }
          >
            <Text style={styles.buttonText}>Capture Photo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#6b7280",
    width: 120,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  dataText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },
  qualityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  qualityValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  errorSection: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#dc2626",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
  },
  settingButton: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  settingButtonText: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  settingText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  buttonContainer: {
    marginTop: 16,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: "#10b981",
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
  captureButton: {
    backgroundColor: "#3b82f6",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
