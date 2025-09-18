/**
 * ShiftTracker Offline Integration Test
 *
 * Tests the integration of offline verification with the ShiftTracker component
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
import { useOfflineVerification } from "../hooks/useOfflineVerification";
import * as FaceVerificationService from "../services/FaceVerificationService";
import { ConnectivityService } from "../services/ConnectivityService";

export default function ShiftTrackerOfflineIntegrationTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);

  const {
    initialize,
    verifyFaceOffline,
    queueVerificationData,
    cacheFaceProfile,
    validateLocationOffline,
    cacheGeofences,
  } = useOfflineVerification();

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      await initialize();
      await FaceVerificationService.initializeOfflineVerification();

      const connectivity = await ConnectivityService.getCurrentState();
      setIsOnline(connectivity.isConnected && connectivity.isInternetReachable);

      addResult("✅ Services initialized successfully");
    } catch (error) {
      addResult(
        "❌ Failed to initialize services: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const simulateShiftStart = async () => {
    try {
      addResult("🚀 Starting shift simulation...");

      // Simulate user data
      const userId = 12345;
      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
      };

      // Step 1: Cache face profile (simulate registration)
      addResult("📝 Caching face profile for offline use...");
      await cacheFaceProfile(userId, "test_hash_123", "encrypted_test_data");

      // Step 2: Cache geofences
      addResult("🗺️ Caching geofences...");
      await cacheGeofences([
        {
          id: "office_main",
          name: "Main Office",
          coordinates: mockLocation,
          radius: 100,
        },
      ]);

      // Step 3: Validate location (offline)
      addResult("📍 Validating location offline...");
      const locationResult = await validateLocationOffline(mockLocation);

      if (locationResult.isValid) {
        addResult(`✅ Location valid: ${locationResult.geofenceName}`);
      } else {
        addResult("❌ Location validation failed");
        return;
      }

      // Step 4: Perform face verification
      const mockFaceEncoding = JSON.stringify(
        Array(128)
          .fill(0)
          .map(() => Math.random()),
      );

      if (simulatedOffline || !isOnline) {
        addResult("🔒 Performing offline face verification...");
        const faceResult = await verifyFaceOffline(userId, mockFaceEncoding);

        if (faceResult.success) {
          addResult(
            `✅ Face verification successful (confidence: ${faceResult.confidence.toFixed(2)})`,
          );

          // Queue verification data for sync
          addResult("📤 Queueing verification data for sync...");
          await queueVerificationData({
            userId,
            faceEncoding: mockFaceEncoding,
            timestamp: new Date(),
            verificationType: "start",
            location: mockLocation,
            confidence: faceResult.confidence,
            livenessDetected: true,
            deviceFingerprint: "test_device_123",
          });

          addResult("✅ Shift started successfully (offline mode)");
        } else {
          addResult("❌ Face verification failed");
        }
      } else {
        addResult("🌐 Online mode - would use normal verification flow");
        addResult("✅ Shift started successfully (online mode)");
      }
    } catch (error) {
      addResult(
        "❌ Shift start failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  const simulateShiftEnd = async () => {
    try {
      addResult("🏁 Ending shift simulation...");

      const userId = 12345;
      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
      };

      // Validate location
      const locationResult = await validateLocationOffline(mockLocation);

      if (!locationResult.isValid) {
        addResult("❌ Location validation failed for shift end");
        return;
      }

      // Perform face verification
      const mockFaceEncoding = JSON.stringify(
        Array(128)
          .fill(0)
          .map(() => Math.random()),
      );

      if (simulatedOffline || !isOnline) {
        const faceResult = await verifyFaceOffline(userId, mockFaceEncoding);

        if (faceResult.success) {
          // Queue verification data
          await queueVerificationData({
            userId,
            faceEncoding: mockFaceEncoding,
            timestamp: new Date(),
            verificationType: "end",
            location: mockLocation,
            confidence: faceResult.confidence,
            livenessDetected: true,
            deviceFingerprint: "test_device_123",
          });

          addResult("✅ Shift ended successfully (offline mode)");
        } else {
          addResult("❌ Face verification failed for shift end");
        }
      } else {
        addResult("✅ Shift ended successfully (online mode)");
      }
    } catch (error) {
      addResult(
        "❌ Shift end failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  const testOfflineCapabilities = async () => {
    try {
      addResult("🧪 Testing offline capabilities...");

      // Test 1: Face verification without cached data
      addResult("Test 1: Face verification without cached data");
      try {
        await verifyFaceOffline(99999, "invalid_encoding");
        addResult("❌ Should have failed without cached data");
      } catch (error) {
        addResult("✅ Correctly failed without cached data");
      }

      // Test 2: Location validation without cached geofences
      addResult("Test 2: Location validation in uncached area");
      const invalidLocation = { latitude: 0, longitude: 0 };
      const locationResult = await validateLocationOffline(invalidLocation);

      if (!locationResult.isValid) {
        addResult("✅ Correctly rejected invalid location");
      } else {
        addResult("❌ Should have rejected invalid location");
      }

      // Test 3: Connectivity status
      addResult("Test 3: Connectivity status");
      const connectivity = await ConnectivityService.getCurrentState();
      addResult(
        `📶 Connection: ${connectivity.type}, Online: ${connectivity.isConnected && connectivity.isInternetReachable}`,
      );

      addResult("🎉 Offline capability tests completed");
    } catch (error) {
      addResult(
        "❌ Offline capability test failed: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  };

  const toggleOfflineMode = () => {
    setSimulatedOffline(!simulatedOffline);
    addResult(
      `🔄 Switched to ${!simulatedOffline ? "OFFLINE" : "ONLINE"} simulation mode`,
    );
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>ShiftTracker Offline Integration Test</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Network Status: {isOnline ? "🟢 Online" : "🔴 Offline"}
        </Text>
        <Text style={styles.statusText}>
          Simulation Mode: {simulatedOffline ? "🔴 Offline" : "🟢 Online"}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={simulateShiftStart}>
          <Text style={styles.buttonText}>Start Shift</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={simulateShiftEnd}>
          <Text style={styles.buttonText}>End Shift</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={testOfflineCapabilities}
        >
          <Text style={styles.buttonText}>Test Offline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            simulatedOffline ? styles.onlineButton : styles.offlineButton,
          ]}
          onPress={toggleOfflineMode}
        >
          <Text style={styles.buttonText}>
            {simulatedOffline ? "Go Online" : "Go Offline"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
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
  },
  statusText: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: "48%",
    alignItems: "center",
  },
  offlineButton: {
    backgroundColor: "#FF5722",
  },
  onlineButton: {
    backgroundColor: "#4CAF50",
  },
  clearButton: {
    backgroundColor: "#757575",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  resultsContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  resultText: {
    fontSize: 12,
    marginBottom: 4,
    color: "#666",
    fontFamily: "monospace",
  },
});
