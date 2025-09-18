import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FaceVerificationModal from "../components/FaceVerificationModal";
import {
  FaceVerificationResult,
  FaceVerificationError,
} from "../types/faceDetection";

/**
 * Multi-Angle Registration Test
 *
 * Tests the complete multi-angle registration flow:
 * 1. Front-View verification
 * 2. Slight Left verification
 * 3. Slight Right verification
 * 4. Success with all angles captured
 *
 * This test ensures camera stability between angles and proper state management.
 */
export default function MultiAngleRegistrationTest() {
  const router = useRouter();

  // Test state
  const [currentAngle, setCurrentAngle] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [capturedAngles, setCapturedAngles] = useState<
    FaceVerificationResult[]
  >([]);
  const [testStatus, setTestStatus] = useState<
    "ready" | "running" | "success" | "failed"
  >("ready");
  const [logs, setLogs] = useState<string[]>([]);

  // Component lifecycle management
  const isMountedRef = useRef(true);

  // Multi-angle configuration
  const angles = [
    {
      name: "Front View",
      description: "Look directly at the camera",
      icon: "person",
    },
    {
      name: "Slight Left",
      description: "Turn your head slightly to the left",
      icon: "arrow-back",
    },
    {
      name: "Slight Right",
      description: "Turn your head slightly to the right",
      icon: "arrow-forward",
    },
  ];

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-9), `${timestamp}: ${message}`]);
  };

  // Handle verification success
  const handleVerificationSuccess = async (result: FaceVerificationResult) => {
    if (!isMountedRef.current) return;

    addLog(`✅ ${angles[currentAngle].name} captured successfully`);
    console.log(
      "Face verification successful for angle:",
      currentAngle,
      result,
    );

    // Add to captured angles
    const newCapturedAngles = [...capturedAngles, result];
    setCapturedAngles(newCapturedAngles);

    // Check if we've captured all angles
    if (newCapturedAngles.length < angles.length) {
      // Move to next angle
      const nextAngle = currentAngle + 1;
      setCurrentAngle(nextAngle);

      addLog(`🔄 Moving to next angle: ${angles[nextAngle].name}`);

      // Show success message and continue option
      Alert.alert(
        "Angle Captured Successfully!",
        `${angles[currentAngle].name} captured with ${Math.round((result.confidence || 0) * 100)}% confidence.\n\nNext: ${angles[nextAngle].name}`,
        [
          {
            text: "Continue Later",
            style: "cancel",
            onPress: () => setShowModal(false),
          },
          {
            text: "Continue Now",
            onPress: () => {
              addLog("🚀 Continuing to next angle...");
              // Modal will automatically reset and continue
            },
          },
        ],
      );
    } else {
      // All angles captured
      addLog("🎉 All angles captured successfully!");
      setTestStatus("success");
      setShowModal(false);

      // Show final results
      const avgConfidence =
        newCapturedAngles.reduce(
          (sum, angle) => sum + (angle.confidence || 0),
          0,
        ) / newCapturedAngles.length;

      Alert.alert(
        "Multi-Angle Registration Complete!",
        `All ${angles.length} angles captured successfully!\n\nAverage confidence: ${Math.round(avgConfidence * 100)}%\n\nTest completed successfully!`,
        [
          { text: "View Results", onPress: () => {} },
          { text: "Run Again", onPress: resetTest },
        ],
      );
    }
  };

  // Handle verification error
  const handleVerificationError = (error: FaceVerificationError) => {
    if (!isMountedRef.current) return;

    addLog(`❌ ${angles[currentAngle].name} failed: ${error.message}`);
    console.error("Face verification failed:", error);
    setTestStatus("failed");
    setShowModal(false);

    Alert.alert(
      "Verification Failed",
      `Failed to capture ${angles[currentAngle].name}: ${error.message}\n\nWould you like to try again?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Retry", onPress: () => setShowModal(true) },
        { text: "Start Over", onPress: resetTest },
      ],
    );
  };

  // Reset test
  const resetTest = () => {
    setCurrentAngle(0);
    setCapturedAngles([]);
    setTestStatus("ready");
    setLogs([]);
    addLog("🔄 Test reset - ready to start");
  };

  // Start test
  const startTest = () => {
    setTestStatus("running");
    setCurrentAngle(0);
    setCapturedAngles([]);
    setLogs([]);
    addLog("🚀 Starting multi-angle registration test...");
    addLog(`📸 First angle: ${angles[0].name}`);
    setShowModal(true);
  };

  // Get current angle info
  const currentAngleInfo = angles[currentAngle];
  const progress = capturedAngles.length;
  const total = angles.length;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-1 p-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#6b7280" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Multi-Angle Registration Test
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Test Status */}
        <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Test Status: {testStatus.toUpperCase()}
          </Text>
          <Text className="text-gray-600 dark:text-gray-400">
            Progress: {progress}/{total} angles captured
          </Text>
        </View>

        {/* Current Angle Info */}
        {testStatus === "running" && (
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
            <View className="flex-row items-center mb-2">
              <Ionicons
                name={currentAngleInfo.icon as any}
                size={24}
                color="#3b82f6"
              />
              <Text className="text-lg font-semibold text-blue-800 dark:text-blue-200 ml-2">
                Current: {currentAngleInfo.name}
              </Text>
            </View>
            <Text className="text-blue-700 dark:text-blue-300">
              {currentAngleInfo.description}
            </Text>
          </View>
        )}

        {/* Progress Indicators */}
        <View className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Capture Progress
          </Text>
          {angles.map((angle, index) => (
            <View key={index} className="flex-row items-center mb-2">
              <View
                className={`w-6 h-6 rounded-full items-center justify-center mr-3`}
                style={{
                  backgroundColor:
                    capturedAngles.length > index
                      ? "#10b981" // Success green
                      : currentAngle === index
                        ? "#3b82f6" // Current blue
                        : "#e5e7eb", // Pending gray
                }}
              >
                {capturedAngles.length > index ? (
                  <Ionicons name="checkmark" size={14} color="white" />
                ) : (
                  <Text className="text-gray-600 font-bold text-xs">
                    {index + 1}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text
                  className={`font-medium ${capturedAngles.length > index || currentAngle === index ? "text-gray-800 dark:text-gray-100" : "text-gray-500"}`}
                >
                  {angle.name}
                </Text>
                <Text
                  className={`text-sm ${capturedAngles.length > index || currentAngle === index ? "text-gray-600 dark:text-gray-400" : "text-gray-400"}`}
                >
                  {angle.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View className="space-y-3 mb-6">
          {testStatus === "ready" && (
            <TouchableOpacity
              onPress={startTest}
              className="bg-blue-600 dark:bg-blue-500 py-4 px-6 rounded-lg shadow-sm"
            >
              <Text className="text-white text-center font-semibold text-lg">
                🚀 Start Multi-Angle Test
              </Text>
            </TouchableOpacity>
          )}

          {testStatus === "running" && (
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              className="bg-green-600 dark:bg-green-500 py-4 px-6 rounded-lg shadow-sm"
            >
              <Text className="text-white text-center font-semibold text-lg">
                📸 Capture {currentAngleInfo.name}
              </Text>
            </TouchableOpacity>
          )}

          {testStatus === "success" && (
            <TouchableOpacity
              onPress={resetTest}
              className="bg-purple-600 dark:bg-purple-500 py-4 px-6 rounded-lg shadow-sm"
            >
              <Text className="text-white text-center font-semibold text-lg">
                🔄 Run Test Again
              </Text>
            </TouchableOpacity>
          )}

          {testStatus === "failed" && (
            <TouchableOpacity
              onPress={resetTest}
              className="bg-red-600 dark:bg-red-500 py-4 px-6 rounded-lg shadow-sm"
            >
              <Text className="text-white text-center font-semibold text-lg">
                🔄 Start Over
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-gray-500 dark:bg-gray-600 py-3 px-6 rounded-lg"
          >
            <Text className="text-white text-center font-medium">
              Back to Tests
            </Text>
          </TouchableOpacity>
        </View>

        {/* Test Logs */}
        <View className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm flex-1">
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Test Logs
          </Text>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {logs.length === 0 ? (
              <Text className="text-gray-500 dark:text-gray-400 text-center py-8">
                No logs yet. Start the test to see activity.
              </Text>
            ) : (
              logs.map((log, index) => (
                <Text
                  key={index}
                  className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-mono"
                >
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showModal}
        mode="register"
        onSuccess={handleVerificationSuccess}
        onError={handleVerificationError}
        onCancel={() => setShowModal(false)}
        title={`Register: ${currentAngleInfo?.name || "Face"}`}
        subtitle={`${currentAngleInfo?.description || "Look at the camera"} and blink when prompted`}
        maxRetries={3}
      />
    </SafeAreaView>
  );
}
