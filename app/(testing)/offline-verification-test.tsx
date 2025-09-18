/**
 * Offline Verification Test Component
 *
 * Tests offline face verification capabilities including:
 * - Connectivity monitoring
 * - Offline face verification
 * - Data queueing and sync
 * - Cache management
 * - Geofence validation
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useOfflineVerification } from "../hooks/useOfflineVerification";
import { OfflineVerificationService } from "../services/OfflineVerificationService";
import { ConnectivityService } from "../services/ConnectivityService";
import * as FaceVerificationService from "../services/FaceVerificationService";

interface TestResult {
  test: string;
  status: "pending" | "success" | "error";
  message: string;
  duration?: number;
}

export default function OfflineVerificationTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>("");

  const {
    isOnline,
    isInitialized,
    isSyncing,
    queuedItems,
    cachedProfiles,
    lastSync,
    error,
    initialize,
    verifyFaceOffline,
    queueVerificationData,
    syncQueuedVerifications,
    cacheFaceProfile,
    validateLocationOffline,
    cacheGeofences,
    getStorageStats,
    clearOfflineData,
  } = useOfflineVerification();

  useEffect(() => {
    // Initialize offline verification on component mount
    initialize().catch((error) => {
      console.error("Failed to initialize offline verification:", error);
    });
  }, [initialize]);

  const addTestResult = (
    test: string,
    status: "success" | "error",
    message: string,
    duration?: number,
  ) => {
    setTestResults((prev) => [...prev, { test, status, message, duration }]);
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    setCurrentTest(testName);
    const startTime = Date.now();

    try {
      await testFn();
      const duration = Date.now() - startTime;
      addTestResult(testName, "success", "Test passed", duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Test failed";
      addTestResult(testName, "error", message, duration);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setCurrentTest("");

    try {
      // Test 1: Connectivity Service
      await runTest("Connectivity Service Initialization", async () => {
        const state = await ConnectivityService.initialize();
        if (!state)
          throw new Error("Failed to initialize connectivity service");
      });

      // Test 2: Offline Verification Service
      await runTest("Offline Verification Service Initialization", async () => {
        await OfflineVerificationService.initialize();
      });

      // Test 3: Cache Face Profile
      await runTest("Cache Face Profile", async () => {
        const testUserId = 12345;
        const testHash = "test_hash_12345";
        const testData = "encrypted_test_data";

        await cacheFaceProfile(testUserId, testHash, testData);

        // Verify it was cached
        const stats = await getStorageStats();
        if (stats.cachedProfiles === 0) {
          throw new Error("Face profile was not cached");
        }
      });

      // Test 4: Offline Face Verification
      await runTest("Offline Face Verification", async () => {
        const testUserId = 12345;
        const testEncoding = JSON.stringify(
          Array(128)
            .fill(0)
            .map(() => Math.random()),
        );

        const result = await verifyFaceOffline(testUserId, testEncoding);

        if (result.requiresOnlineVerification) {
          throw new Error("Should have used cached data for verification");
        }
      });

      // Test 5: Queue Verification Data
      await runTest("Queue Verification Data", async () => {
        const testData = {
          userId: 12345,
          faceEncoding: JSON.stringify(
            Array(128)
              .fill(0)
              .map(() => Math.random()),
          ),
          timestamp: new Date(),
          verificationType: "start" as const,
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
          },
          confidence: 0.85,
          livenessDetected: true,
          deviceFingerprint: "test_device_123",
        };

        const queueId = await queueVerificationData(testData);
        if (!queueId) throw new Error("Failed to queue verification data");

        // Verify it was queued
        const stats = await getStorageStats();
        if (stats.queuedItems === 0) {
          throw new Error("Verification data was not queued");
        }
      });

      // Test 6: Cache Geofences
      await runTest("Cache Geofences", async () => {
        const testGeofences = [
          {
            id: "geofence_1",
            name: "Test Office",
            coordinates: { latitude: 37.7749, longitude: -122.4194 },
            radius: 100,
          },
          {
            id: "geofence_2",
            name: "Test Warehouse",
            coordinates: { latitude: 37.7849, longitude: -122.4094 },
            radius: 200,
          },
        ];

        await cacheGeofences(testGeofences);
      });

      // Test 7: Offline Location Validation
      await runTest("Offline Location Validation", async () => {
        const testLocation = { latitude: 37.7749, longitude: -122.4194 };

        const result = await validateLocationOffline(testLocation);

        if (!result.isValid) {
          throw new Error("Location should be valid based on cached geofences");
        }

        if (result.geofenceName !== "Test Office") {
          throw new Error("Should have matched Test Office geofence");
        }
      });

      // Test 8: Connectivity Status
      await runTest("Connectivity Status Check", async () => {
        const isOnlineStatus = await ConnectivityService.isOnline();
        const stats = await ConnectivityService.getConnectivityStats();

        if (typeof isOnlineStatus !== "boolean") {
          throw new Error("Invalid connectivity status");
        }

        if (!stats.currentState) {
          throw new Error("No connectivity state available");
        }
      });

      // Test 9: Storage Statistics
      await runTest("Storage Statistics", async () => {
        const stats = await getStorageStats();

        if (
          typeof stats.queuedItems !== "number" ||
          typeof stats.cachedProfiles !== "number" ||
          typeof stats.cachedGeofences !== "number"
        ) {
          throw new Error("Invalid storage statistics");
        }
      });

      // Test 10: Enhanced Face Verification Service Integration
      await runTest("Enhanced Face Verification Service", async () => {
        await FaceVerificationService.initializeOfflineVerification();

        const offlineStats = await FaceVerificationService.getOfflineStats();
        if (typeof offlineStats.isOnline !== "boolean") {
          throw new Error("Invalid offline stats");
        }
      });
    } catch (error) {
      console.error("Test suite failed:", error);
    } finally {
      setIsRunning(false);
      setCurrentTest("");
    }
  };

  const clearTestData = async () => {
    try {
      await clearOfflineData();
      Alert.alert("Success", "All test data cleared");
    } catch (error) {
      Alert.alert("Error", "Failed to clear test data");
    }
  };

  const testSyncFunctionality = async () => {
    if (!isOnline) {
      Alert.alert("Error", "Cannot test sync functionality while offline");
      return;
    }

    try {
      setCurrentTest("Testing Sync Functionality");
      const result = await syncQueuedVerifications();

      Alert.alert(
        "Sync Results",
        `Synced: ${result.synced}\nFailed: ${result.failed}\nErrors: ${result.errors.length}`,
      );
    } catch (error) {
      Alert.alert(
        "Error",
        "Sync test failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setCurrentTest("");
    }
  };

  const getStatusColor = (status: "pending" | "success" | "error") => {
    switch (status) {
      case "success":
        return "#4CAF50";
      case "error":
        return "#F44336";
      default:
        return "#FF9800";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Offline Verification Test Suite</Text>

      {/* Status Information */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status</Text>
        <Text style={styles.statusText}>Online: {isOnline ? "✅" : "❌"}</Text>
        <Text style={styles.statusText}>
          Initialized: {isInitialized ? "✅" : "❌"}
        </Text>
        <Text style={styles.statusText}>
          Syncing: {isSyncing ? "🔄" : "✅"}
        </Text>
        <Text style={styles.statusText}>Queued Items: {queuedItems}</Text>
        <Text style={styles.statusText}>Cached Profiles: {cachedProfiles}</Text>
        <Text style={styles.statusText}>
          Last Sync: {lastSync ? lastSync.toLocaleString() : "Never"}
        </Text>
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
      </View>

      {/* Test Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runAllTests}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Run All Tests</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={testSyncFunctionality}
          disabled={!isOnline || isSyncing}
        >
          <Text style={styles.buttonText}>Test Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearTestData}
        >
          <Text style={styles.buttonText}>Clear Test Data</Text>
        </TouchableOpacity>
      </View>

      {/* Current Test */}
      {currentTest && (
        <View style={styles.currentTestContainer}>
          <Text style={styles.currentTestText}>Running: {currentTest}</Text>
          <ActivityIndicator />
        </View>
      )}

      {/* Test Results */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results</Text>
        {testResults.map((result, index) => (
          <View key={index} style={styles.resultItem}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTest}>{result.test}</Text>
              <Text
                style={[
                  styles.resultStatus,
                  { color: getStatusColor(result.status) },
                ]}
              >
                {result.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.duration && (
              <Text style={styles.resultDuration}>
                Duration: {result.duration}ms
              </Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  statusContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
    color: "#666",
  },
  errorText: {
    fontSize: 14,
    color: "#F44336",
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: "#2196F3",
  },
  secondaryButton: {
    backgroundColor: "#4CAF50",
  },
  dangerButton: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  currentTestContainer: {
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currentTestText: {
    fontSize: 14,
    color: "#E65100",
    flex: 1,
  },
  resultsContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  resultItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resultTest: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: "bold",
  },
  resultMessage: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  resultDuration: {
    fontSize: 10,
    color: "#999",
  },
});
