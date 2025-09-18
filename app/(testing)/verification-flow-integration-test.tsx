import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VerificationOrchestrator from "../components/VerificationOrchestrator";
import { LocationResult, VerificationFlowSummary } from "../types/verification";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";

/**
 * Test component for the enhanced verification flow logic
 * This tests the sequential verification steps (location → face) with fallback logic,
 * confidence scoring, audit logging, and performance monitoring.
 */
export default function VerificationFlowIntegrationTest() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1f2937");
  const textColor = useThemeColor("#111827", "#f9fafb");
  const cardColor = useThemeColor("#f8fafc", "#374151");

  const [showVerificationOrchestrator, setShowVerificationOrchestrator] =
    useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [currentTest, setCurrentTest] = useState<string>("");

  // Mock user data for testing
  const mockUserId = 1;
  const mockToken = "test-token-123";

  const addTestResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  // Mock location verification function
  const mockLocationVerification = async (): Promise<LocationResult> => {
    addTestResult("🌍 Starting location verification...");

    // Simulate location verification delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate different scenarios based on current test
    if (currentTest === "location-fail") {
      addTestResult("❌ Location verification failed (simulated)");
      return {
        success: false,
        error: "Not in designated work area",
        confidence: 0,
      };
    }

    if (currentTest === "location-low-accuracy") {
      addTestResult("⚠️ Location verification with low accuracy");
      return {
        success: true,
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 150, // Low accuracy
        isInGeofence: false,
        confidence: 0.6,
      };
    }

    // Default successful location verification
    addTestResult("✅ Location verification successful");
    return {
      success: true,
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 5, // High accuracy
      isInGeofence: true,
      geofenceName: "Test Office",
      confidence: 0.9,
    };
  };

  const handleVerificationSuccess = (summary: VerificationFlowSummary) => {
    addTestResult("🎉 Verification flow completed successfully!");
    addTestResult(`📊 Summary: ${JSON.stringify(summary, null, 2)}`);
    addTestResult(`✅ Confidence Score: ${summary.confidenceScore}%`);
    addTestResult(`⏱️ Total Latency: ${summary.totalLatency}ms`);
    addTestResult(`🔄 Fallback Mode: ${summary.fallbackMode ? "Yes" : "No"}`);
    addTestResult(`📝 Completed Steps: ${summary.completedSteps.join(", ")}`);

    setShowVerificationOrchestrator(false);
    setCurrentTest("");
  };

  const handleVerificationError = (error: string) => {
    addTestResult(`❌ Verification failed: ${error}`);
    setShowVerificationOrchestrator(false);
    setCurrentTest("");
  };

  const handleVerificationCancel = () => {
    addTestResult("🚫 Verification cancelled by user");
    setShowVerificationOrchestrator(false);
    setCurrentTest("");
  };

  const runTest = (testType: string, config: any) => {
    setCurrentTest(testType);
    addTestResult(`🧪 Starting test: ${testType}`);
    addTestResult(`⚙️ Config: ${JSON.stringify(config, null, 2)}`);
    setShowVerificationOrchestrator(true);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testScenarios = [
    {
      name: "Normal Flow (Location + Face)",
      type: "normal",
      config: {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: false,
        allowFaceFallback: false,
        maxRetries: 3,
        confidenceThreshold: 0.7,
      },
    },
    {
      name: "Location Failure with Fallback",
      type: "location-fail",
      config: {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: true,
        allowFaceFallback: false,
        maxRetries: 2,
        confidenceThreshold: 0.6,
      },
    },
    {
      name: "Low Accuracy Location",
      type: "location-low-accuracy",
      config: {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: true,
        allowFaceFallback: true,
        maxRetries: 3,
        confidenceThreshold: 0.5,
      },
    },
    {
      name: "Face Only (No Location)",
      type: "face-only",
      config: {
        requireLocation: false,
        requireFace: true,
        allowLocationFallback: false,
        allowFaceFallback: false,
        maxRetries: 3,
        confidenceThreshold: 0.8,
      },
    },
    {
      name: "High Confidence Threshold",
      type: "high-confidence",
      config: {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: false,
        allowFaceFallback: false,
        maxRetries: 1,
        confidenceThreshold: 0.9,
      },
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: cardColor }]}>
        <Text style={[styles.title, { color: textColor }]}>
          Verification Flow Integration Test
        </Text>
        <Text style={[styles.subtitle, { color: textColor }]}>
          Test sequential verification (location → face) with fallback logic
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Test Scenarios */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Test Scenarios
          </Text>

          {testScenarios.map((scenario, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.testButton, { borderColor: textColor + "20" }]}
              onPress={() => runTest(scenario.type, scenario.config)}
            >
              <View style={styles.testButtonContent}>
                <Text style={[styles.testButtonTitle, { color: textColor }]}>
                  {scenario.name}
                </Text>
                <Text
                  style={[
                    styles.testButtonDescription,
                    { color: textColor + "80" },
                  ]}
                >
                  Retries: {scenario.config.maxRetries}, Confidence:{" "}
                  {scenario.config.confidenceThreshold * 100}%
                </Text>
              </View>
              <Ionicons name="play-circle" size={24} color="#3b82f6" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Test Results */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Test Results ({testResults.length})
            </Text>
            <TouchableOpacity onPress={clearResults} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.resultsContainer} nestedScrollEnabled>
            {testResults.length === 0 ? (
              <Text style={[styles.noResults, { color: textColor + "60" }]}>
                No test results yet. Run a test scenario above.
              </Text>
            ) : (
              testResults.map((result, index) => (
                <View key={index} style={styles.resultItem}>
                  <Text style={[styles.resultText, { color: textColor }]}>
                    {result}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* Performance Metrics Info */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            What This Tests
          </Text>

          <View style={styles.featureList}>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Sequential verification steps (location → face)
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Fallback logic for partial verification failures
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Verification confidence scoring
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Audit logging for verification attempts
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Performance monitoring for verification latency
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Retry logic with configurable limits
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              • Manager override capabilities
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Verification Orchestrator */}
      <VerificationOrchestrator
        visible={showVerificationOrchestrator}
        userId={mockUserId}
        token={mockToken}
        shiftAction="start"
        config={testScenarios.find((s) => s.type === currentTest)?.config}
        onSuccess={handleVerificationSuccess}
        onCancel={handleVerificationCancel}
        onError={handleVerificationError}
        locationVerificationFn={mockLocationVerification}
        canOverrideGeofence={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  testButtonContent: {
    flex: 1,
  },
  testButtonTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  testButtonDescription: {
    fontSize: 14,
  },
  clearButton: {
    padding: 8,
  },
  resultsContainer: {
    maxHeight: 300,
  },
  noResults: {
    textAlign: "center",
    fontStyle: "italic",
    padding: 20,
  },
  resultItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  resultText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  featureList: {
    paddingLeft: 8,
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
});
