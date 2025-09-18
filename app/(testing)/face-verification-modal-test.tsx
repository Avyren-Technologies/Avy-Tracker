import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import FaceVerificationModal from "../components/FaceVerificationModal";
import {
  FaceVerificationResult,
  FaceVerificationError,
} from "../types/faceDetection";

/**
 * Face Verification Modal Test Screen
 *
 * Test screen to verify the FaceVerificationModal component functionality
 */
export default function FaceVerificationModalTest() {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"register" | "verify">("verify");
  const [retryCount, setRetryCount] = useState(0);
  const [lastResult, setLastResult] = useState<string>("");

  const handleSuccess = (result: FaceVerificationResult) => {
    console.log("Face verification success:", result);
    setLastResult(
      `Success: ${result.confidence.toFixed(2)} confidence, liveness: ${result.livenessDetected}`,
    );
    setShowModal(false);
    setRetryCount(0);
  };

  const handleError = (error: FaceVerificationError) => {
    console.log("Face verification error:", error);
    setLastResult(`Error: ${error.type} - ${error.message}`);
    setShowModal(false);
  };

  const handleCancel = () => {
    console.log("Face verification cancelled");
    setLastResult("Cancelled by user");
    setShowModal(false);
    setRetryCount(0);
  };

  const startVerification = (mode: "register" | "verify") => {
    setModalMode(mode);
    setRetryCount(0);
    setLastResult("");
    setShowModal(true);
  };

  const startRetryTest = () => {
    setModalMode("verify");
    setRetryCount(2); // Start with 2 retries already used
    setLastResult("");
    setShowModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Face Verification Modal Test",
          headerStyle: { backgroundColor: "#f8fafc" },
          headerTintColor: "#1f2937",
        }}
      />
      <StatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Face Verification Modal Test</Text>
        <Text style={styles.description}>
          Test the Face Verification Modal component with different modes and
          scenarios.
        </Text>

        {/* Test Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => startVerification("verify")}
          >
            <Text style={styles.buttonText}>Test Verification Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => startVerification("register")}
          >
            <Text style={[styles.buttonText, { color: "#1f2937" }]}>
              Test Registration Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.warningButton]}
            onPress={startRetryTest}
          >
            <Text style={styles.buttonText}>Test Retry Scenario</Text>
          </TouchableOpacity>
        </View>

        {/* Last Result */}
        {lastResult && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Last Result:</Text>
            <Text style={styles.resultText}>{lastResult}</Text>
          </View>
        )}

        {/* Component Features */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Component Features:</Text>
          <Text style={styles.featureItem}>
            ✓ Camera liveness detection integration
          </Text>
          <Text style={styles.featureItem}>
            ✓ Real-time face detection feedback
          </Text>
          <Text style={styles.featureItem}>
            ✓ Verification progress indicators
          </Text>
          <Text style={styles.featureItem}>
            ✓ Retry logic with user guidance
          </Text>
          <Text style={styles.featureItem}>
            ✓ Success/failure state handling
          </Text>
          <Text style={styles.featureItem}>
            ✓ Accessibility support for screen readers
          </Text>
          <Text style={styles.featureItem}>
            ✓ Auto-capture on blink detection
          </Text>
          <Text style={styles.featureItem}>
            ✓ Error handling with suggestions
          </Text>
        </View>

        {/* Requirements Mapping */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Requirements Addressed:</Text>
          <Text style={styles.requirementItem}>
            • 1.1: Face verification with liveness detection
          </Text>
          <Text style={styles.requirementItem}>
            • 1.7: Retry options with user guidance
          </Text>
          <Text style={styles.requirementItem}>
            • 6.3: Real-time feedback and progress indicators
          </Text>
          <Text style={styles.requirementItem}>
            • 6.4: Auto-capture trigger and immediate feedback
          </Text>
        </View>
      </ScrollView>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showModal}
        mode={modalMode}
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
        retryCount={retryCount}
        maxRetries={3}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 30,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  warningButton: {
    backgroundColor: "#f59e0b",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  resultContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  featuresContainer: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    color: "#059669",
    marginBottom: 6,
    lineHeight: 20,
  },
  requirementsContainer: {
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0c4a6e",
    marginBottom: 12,
  },
  requirementItem: {
    fontSize: 14,
    color: "#0369a1",
    marginBottom: 6,
    lineHeight: 20,
  },
});
