import React, { useRef, useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { useFaceDetection } from "../hooks/useFaceDetection";

export default function CameraTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice("front");

  const {
    isDetecting,
    faceDetected,
    startDetection,
    stopDetection,
    setCameraRef,
    isInitialized,
    error,
  } = useFaceDetection();

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev.slice(-4),
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  // Connect camera reference when camera is ready
  useEffect(() => {
    if (cameraRef.current && setCameraRef) {
      addResult("📷 Connecting camera reference...");
      setCameraRef(cameraRef.current);
      addResult("✅ Camera reference connected");
    }
  }, [setCameraRef]);

  const handleStartDetection = async () => {
    try {
      if (!cameraRef.current) {
        addResult("❌ Camera ref not available");
        return;
      }

      if (!setCameraRef) {
        addResult("❌ setCameraRef not available");
        return;
      }

      // Ensure camera reference is connected
      addResult("🔗 Ensuring camera reference is connected...");
      setCameraRef(cameraRef.current);

      // Wait a moment for connection
      await new Promise((resolve) => setTimeout(resolve, 500));

      addResult("🚀 Starting face detection...");
      const started = await startDetection();

      if (started) {
        addResult("✅ Face detection started successfully");
      } else {
        addResult("❌ Failed to start face detection");
      }
    } catch (error) {
      addResult(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleStopDetection = () => {
    addResult("🛑 Stopping face detection...");
    stopDetection();
    addResult("✅ Face detection stopped");
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          textAlign: "center",
          margin: 20,
        }}
      >
        📷 Camera Reference Test
      </Text>

      {/* Camera View */}
      <View
        style={{
          height: 300,
          margin: 20,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {device ? (
          <Camera
            ref={cameraRef}
            device={device}
            isActive={true}
            style={{ flex: 1 }}
            onInitialized={() => {
              addResult("📷 Camera initialized");
              // Connect reference immediately when camera is ready
              if (setCameraRef) {
                setCameraRef(cameraRef.current);
                addResult("🔗 Camera reference connected on init");
              }
            }}
            onError={(error) => {
              addResult(`❌ Camera error: ${error.message}`);
            }}
          />
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#ddd",
            }}
          >
            <Text>No camera device available</Text>
          </View>
        )}
      </View>

      {/* Status Display */}
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 15,
          margin: 20,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
          📊 Status:
        </Text>

        <Text style={{ color: device ? "#27ae60" : "#e74c3c" }}>
          • Camera Device: {device ? "✅" : "❌"}
        </Text>
        <Text style={{ color: cameraRef.current ? "#27ae60" : "#e74c3c" }}>
          • Camera Ref: {cameraRef.current ? "✅" : "❌"}
        </Text>
        <Text style={{ color: isInitialized ? "#27ae60" : "#e74c3c" }}>
          • Initialized: {isInitialized ? "✅" : "❌"}
        </Text>
        <Text style={{ color: isDetecting ? "#f39c12" : "#95a5a6" }}>
          • Detecting: {isDetecting ? "🔄 Active" : "⏸️ Inactive"}
        </Text>
        <Text style={{ color: faceDetected ? "#27ae60" : "#95a5a6" }}>
          • Face Detected: {faceDetected ? "✅" : "❌"}
        </Text>
        {error && <Text style={{ color: "#e74c3c" }}>• Error: {error}</Text>}
      </View>

      {/* Control Buttons */}
      <View style={{ flexDirection: "row", gap: 10, margin: 20 }}>
        <TouchableOpacity
          onPress={handleStartDetection}
          disabled={isDetecting}
          style={{
            flex: 1,
            backgroundColor: isDetecting ? "#95a5a6" : "#27ae60",
            padding: 15,
            borderRadius: 8,
          }}
        >
          <Text
            style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
          >
            {isDetecting ? "🔄 Detecting..." : "🚀 Start Detection"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleStopDetection}
          disabled={!isDetecting}
          style={{
            flex: 1,
            backgroundColor: !isDetecting ? "#95a5a6" : "#e74c3c",
            padding: 15,
            borderRadius: 8,
          }}
        >
          <Text
            style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
          >
            🛑 Stop Detection
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={clearResults}
        style={{
          backgroundColor: "#95a5a6",
          padding: 12,
          borderRadius: 8,
          margin: 20,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          🗑️ Clear Results
        </Text>
      </TouchableOpacity>

      {/* Results Display */}
      <View
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 15,
          margin: 20,
          flex: 1,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
          📋 Test Results:
        </Text>

        {testResults.length === 0 ? (
          <Text
            style={{
              color: "#95a5a6",
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            No test results yet.
          </Text>
        ) : (
          testResults.map((result, index) => (
            <View
              key={index}
              style={{
                backgroundColor: result.includes("✅")
                  ? "#d5f4e6"
                  : result.includes("❌")
                    ? "#ffeaa7"
                    : "#e8f4f8",
                padding: 8,
                borderRadius: 6,
                marginBottom: 6,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: "monospace" }}>
                {result}
              </Text>
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}
