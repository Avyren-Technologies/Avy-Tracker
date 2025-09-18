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
import { StatusBar } from "expo-status-bar";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import OTPVerification from "../components/OTPVerification";
import { OTPVerificationResult, OTPError } from "../types/otp";

export default function OTPVerificationTest() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#f8fafc", "#0f172a");
  const textColor = useThemeColor("#334155", "#e2e8f0");
  const cardColor = useThemeColor("#ffffff", "#1e293b");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");

  const [showOTP, setShowOTP] = useState(false);
  const [testPurpose, setTestPurpose] = useState<string>(
    "face-settings-access",
  );
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const handleOTPSuccess = (data: OTPVerificationResult) => {
    addTestResult(`✅ OTP Success: ${data.message}`);
    setShowOTP(false);
    Alert.alert(
      "Success",
      `OTP verified successfully!\n\nPurpose: ${data.purpose}\nVerified at: ${data.verifiedAt}`,
    );
  };

  const handleOTPError = (error: OTPError) => {
    addTestResult(`❌ OTP Error: ${error.message} (Code: ${error.code})`);
    if (error.remainingAttempts !== undefined) {
      addTestResult(`   Remaining attempts: ${error.remainingAttempts}`);
    }
    if (error.lockoutUntil) {
      addTestResult(`   Locked until: ${error.lockoutUntil}`);
    }
  };

  const handleOTPCancel = () => {
    addTestResult("🚫 OTP Cancelled by user");
    setShowOTP(false);
  };

  const testScenarios = [
    {
      title: "Face Settings Access",
      purpose: "face-settings-access",
      description: "Test OTP for accessing face configuration settings",
    },
    {
      title: "Profile Update",
      purpose: "profile-update",
      description: "Test OTP for updating user profile",
    },
    {
      title: "Security Verification",
      purpose: "security-verification",
      description: "Test OTP for security verification",
    },
  ];

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: "OTP Verification Test",
          headerStyle: { backgroundColor: cardColor },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: cardColor }]}>
          <Text style={[styles.title, { color: textColor }]}>
            OTP Verification Component Test
          </Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            Test the OTP verification functionality with different scenarios
          </Text>
        </View>

        {/* Test Scenarios */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Test Scenarios
          </Text>

          {testScenarios.map((scenario, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.scenarioButton, { borderColor: primaryColor }]}
              onPress={() => {
                setTestPurpose(scenario.purpose);
                addTestResult(`🧪 Starting test: ${scenario.title}`);
                setShowOTP(true);
              }}
            >
              <Text style={[styles.scenarioTitle, { color: primaryColor }]}>
                {scenario.title}
              </Text>
              <Text style={[styles.scenarioDescription, { color: textColor }]}>
                {scenario.description}
              </Text>
              <Text style={[styles.scenarioPurpose, { color: textColor }]}>
                Purpose: {scenario.purpose}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Test Results */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <View style={styles.resultsHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Test Results
            </Text>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: primaryColor }]}
              onPress={clearResults}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {testResults.length === 0 ? (
            <Text style={[styles.noResults, { color: textColor }]}>
              No test results yet. Run a test scenario above.
            </Text>
          ) : (
            <View style={styles.resultsList}>
              {testResults.map((result, index) => (
                <Text
                  key={index}
                  style={[styles.resultItem, { color: textColor }]}
                >
                  {result}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Component Features */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Component Features
          </Text>

          <View style={styles.featuresList}>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Auto-focus OTP input fields
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Countdown timer with expiry (5 minutes)
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Resend OTP functionality
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Error handling with retry logic
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Accessibility support (screen readers)
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Attempt tracking and lockout
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Vibration feedback
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Auto-verification on complete input
            </Text>
            <Text style={[styles.featureItem, { color: textColor }]}>
              ✅ Dark/Light theme support
            </Text>
          </View>
        </View>

        {/* Usage Instructions */}
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Usage Instructions
          </Text>

          <Text style={[styles.instruction, { color: textColor }]}>
            1. Select a test scenario above to open the OTP verification modal
          </Text>
          <Text style={[styles.instruction, { color: textColor }]}>
            2. The component will automatically request an OTP from the backend
          </Text>
          <Text style={[styles.instruction, { color: textColor }]}>
            3. Enter the 6-digit OTP code (check console logs for mock OTP)
          </Text>
          <Text style={[styles.instruction, { color: textColor }]}>
            4. The component will auto-verify when all digits are entered
          </Text>
          <Text style={[styles.instruction, { color: textColor }]}>
            5. Test error scenarios by entering incorrect codes
          </Text>
          <Text style={[styles.instruction, { color: textColor }]}>
            6. Test resend functionality when timer expires
          </Text>
        </View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <OTPVerification
        visible={showOTP}
        purpose={testPurpose}
        phoneNumber="+91 98765 43210" // Mock phone number for testing
        onSuccess={handleOTPSuccess}
        onError={handleOTPError}
        onCancel={handleOTPCancel}
        title="Verify Your Identity"
        subtitle="Enter the 6-digit code sent to your registered phone number"
        maxAttempts={3}
        expiryMinutes={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    opacity: 0.8,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  scenarioButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  scenarioDescription: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  scenarioPurpose: {
    fontSize: 12,
    fontFamily: "monospace",
    opacity: 0.6,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  noResults: {
    fontStyle: "italic",
    opacity: 0.6,
    textAlign: "center",
    paddingVertical: 20,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 4,
    paddingVertical: 2,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  instruction: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
});
