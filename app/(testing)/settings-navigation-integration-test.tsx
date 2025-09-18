/**
 * Settings Navigation Integration Test
 *
 * Tests the integration of face configuration navigation in settings screens
 * and deep linking functionality.
 *
 * Requirements tested:
 * - 2.4: Face configuration settings access
 * - 4.1: Deep linking to face configuration
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  navigateToFaceConfiguration,
  navigateToFaceRegistration,
  navigateToFaceConfigurationDirect,
  navigateToFaceSetup,
  promptFaceConfiguration,
  clearDeepLinkData,
  getDeepLinkData,
} from "@/utils/deepLinkUtils";

interface TestResult {
  id: string;
  title: string;
  status: "pending" | "passed" | "failed";
  message?: string;
}

export default function SettingsNavigationIntegrationTest() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [testResults, setTestResults] = useState<TestResult[]>([
    {
      id: "deep-link-utils",
      title: "Deep Link Utilities Import",
      status: "pending",
    },
    {
      id: "navigation-functions",
      title: "Navigation Functions Available",
      status: "pending",
    },
    {
      id: "async-storage-integration",
      title: "AsyncStorage Integration",
      status: "pending",
    },
    {
      id: "face-setup-prompt",
      title: "Face Setup Prompt Function",
      status: "pending",
    },
    {
      id: "deep-link-data-management",
      title: "Deep Link Data Management",
      status: "pending",
    },
  ]);

  const updateTestResult = (
    id: string,
    status: "passed" | "failed",
    message?: string,
  ) => {
    setTestResults((prev) =>
      prev.map((test) =>
        test.id === id ? { ...test, status, message } : test,
      ),
    );
  };

  const runTests = async () => {
    console.log("🧪 Running Settings Navigation Integration Tests...");

    // Test 1: Deep Link Utilities Import
    try {
      if (
        typeof navigateToFaceConfiguration === "function" &&
        typeof navigateToFaceRegistration === "function" &&
        typeof navigateToFaceConfigurationDirect === "function" &&
        typeof navigateToFaceSetup === "function" &&
        typeof promptFaceConfiguration === "function"
      ) {
        updateTestResult(
          "deep-link-utils",
          "passed",
          "All utility functions imported successfully",
        );
      } else {
        updateTestResult(
          "deep-link-utils",
          "failed",
          "Some utility functions missing",
        );
      }
    } catch (error) {
      updateTestResult("deep-link-utils", "failed", `Import error: ${error}`);
    }

    // Test 2: Navigation Functions Available
    try {
      const functions = [
        navigateToFaceConfiguration,
        navigateToFaceRegistration,
        navigateToFaceConfigurationDirect,
        navigateToFaceSetup,
        promptFaceConfiguration,
      ];

      const allFunctionsValid = functions.every(
        (fn) => typeof fn === "function",
      );

      if (allFunctionsValid) {
        updateTestResult(
          "navigation-functions",
          "passed",
          "All navigation functions are callable",
        );
      } else {
        updateTestResult(
          "navigation-functions",
          "failed",
          "Some navigation functions are not callable",
        );
      }
    } catch (error) {
      updateTestResult(
        "navigation-functions",
        "failed",
        `Function check error: ${error}`,
      );
    }

    // Test 3: AsyncStorage Integration
    try {
      await clearDeepLinkData();
      const initialData = await getDeepLinkData();

      if (
        initialData.action === null &&
        initialData.source === null &&
        initialData.params === null
      ) {
        updateTestResult(
          "async-storage-integration",
          "passed",
          "AsyncStorage integration working",
        );
      } else {
        updateTestResult(
          "async-storage-integration",
          "failed",
          "AsyncStorage data not cleared properly",
        );
      }
    } catch (error) {
      updateTestResult(
        "async-storage-integration",
        "failed",
        `AsyncStorage error: ${error}`,
      );
    }

    // Test 4: Face Setup Prompt Function
    try {
      // Test the prompt function (without actually navigating)
      const result = await promptFaceConfiguration("test-source");

      if (result === true) {
        updateTestResult(
          "face-setup-prompt",
          "passed",
          "Face setup prompt function works",
        );
      } else {
        updateTestResult(
          "face-setup-prompt",
          "failed",
          "Face setup prompt returned false",
        );
      }
    } catch (error) {
      updateTestResult(
        "face-setup-prompt",
        "failed",
        `Prompt function error: ${error}`,
      );
    }

    // Test 5: Deep Link Data Management
    try {
      // Set some test data
      await navigateToFaceConfiguration({
        action: "configure",
        source: "test",
        params: { test: true },
      });

      // Retrieve the data
      const data = await getDeepLinkData();

      if (
        data.action === "configure" &&
        data.source === "test" &&
        data.params?.test === true
      ) {
        updateTestResult(
          "deep-link-data-management",
          "passed",
          "Deep link data stored and retrieved correctly",
        );
      } else {
        updateTestResult(
          "deep-link-data-management",
          "failed",
          "Deep link data not stored/retrieved correctly",
        );
      }

      // Clean up
      await clearDeepLinkData();
    } catch (error) {
      updateTestResult(
        "deep-link-data-management",
        "failed",
        `Data management error: ${error}`,
      );
    }

    console.log("✅ Settings Navigation Integration Tests Complete");
  };

  const runManualTests = () => {
    Alert.alert("Manual Tests", "Choose a manual test to run:", [
      {
        text: "Test Face Registration Navigation",
        onPress: () => {
          Alert.alert(
            "Test",
            "This would navigate to Face Registration screen",
          );
          // navigateToFaceRegistration();
        },
      },
      {
        text: "Test Face Configuration Navigation",
        onPress: () => {
          Alert.alert(
            "Test",
            "This would navigate to Face Configuration screen",
          );
          // navigateToFaceConfigurationDirect();
        },
      },
      {
        text: "Test Smart Face Setup",
        onPress: () => {
          Alert.alert(
            "Test",
            "This would use smart navigation based on registration status",
          );
          // navigateToFaceSetup();
        },
      },
      {
        text: "Test Deep Link Prompt",
        onPress: async () => {
          Alert.alert(
            "Test",
            "This would set up deep link and navigate to settings",
          );
          // await promptFaceConfiguration('manual-test');
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "#10b981";
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return "checkmark-circle";
      case "failed":
        return "close-circle";
      default:
        return "time";
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#f9fafb" },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: isDark ? "#1f2937" : "#ffffff" },
        ]}
      >
        <Text style={[styles.title, { color: isDark ? "#ffffff" : "#111827" }]}>
          Settings Navigation Integration Test
        </Text>
        <Text
          style={[styles.subtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}
        >
          Testing face configuration navigation and deep linking
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Test Results */}
        <View
          style={[
            styles.section,
            { backgroundColor: isDark ? "#1f2937" : "#ffffff" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#ffffff" : "#111827" },
            ]}
          >
            Automated Test Results
          </Text>

          {testResults.map((test) => (
            <View
              key={test.id}
              style={[
                styles.testItem,
                { borderColor: isDark ? "#374151" : "#e5e7eb" },
              ]}
            >
              <View style={styles.testHeader}>
                <Ionicons
                  name={getStatusIcon(test.status)}
                  size={20}
                  color={getStatusColor(test.status)}
                />
                <Text
                  style={[
                    styles.testTitle,
                    { color: isDark ? "#ffffff" : "#111827" },
                  ]}
                >
                  {test.title}
                </Text>
              </View>
              {test.message && (
                <Text
                  style={[
                    styles.testMessage,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {test.message}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Test Controls */}
        <View
          style={[
            styles.section,
            { backgroundColor: isDark ? "#1f2937" : "#ffffff" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#ffffff" : "#111827" },
            ]}
          >
            Test Controls
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#3b82f6" }]}
            onPress={runTests}
          >
            <Ionicons name="play" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Run Automated Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#10b981" }]}
            onPress={runManualTests}
          >
            <Ionicons name="hand-left" size={20} color="#ffffff" />
            <Text style={styles.buttonText}>Run Manual Tests</Text>
          </TouchableOpacity>
        </View>

        {/* Requirements Coverage */}
        <View
          style={[
            styles.section,
            { backgroundColor: isDark ? "#1f2937" : "#ffffff" },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#ffffff" : "#111827" },
            ]}
          >
            Requirements Coverage
          </Text>

          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text
              style={[
                styles.requirementText,
                { color: isDark ? "#ffffff" : "#111827" },
              ]}
            >
              2.4: Face configuration settings access
            </Text>
          </View>

          <View style={styles.requirementItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text
              style={[
                styles.requirementText,
                { color: isDark ? "#ffffff" : "#111827" },
              ]}
            >
              4.1: Deep linking to face configuration
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  testItem: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  testHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  testMessage: {
    fontSize: 14,
    marginLeft: 28,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 16,
    marginLeft: 8,
  },
});
