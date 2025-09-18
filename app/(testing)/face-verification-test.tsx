import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FaceVerificationModal from "../components/FaceVerificationModal";
import { FaceVerificationResult } from "../types/faceDetection";
import { FaceVerificationError } from "../types/faceVerificationErrors";

export default function FaceVerificationTest() {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"register" | "verify">("register");
  const [lastResult, setLastResult] = useState<string>("");

  const handleSuccess = (result: FaceVerificationResult) => {
    console.log("Face verification success:", result);
    setLastResult(
      `Success: ${result.confidence.toFixed(2)} confidence, Liveness: ${result.livenessDetected}`,
    );
    setShowModal(false);
    Alert.alert(
      "Success!",
      `Verification completed with ${Math.round(result.confidence * 100)}% confidence`,
    );
  };

  const handleError = (error: FaceVerificationError) => {
    console.log("Face verification error:", error);
    setLastResult(`Error: ${error.message}`);
    setShowModal(false);
    Alert.alert("Error", error.message);
  };

  const handleCancel = () => {
    setLastResult("Cancelled by user");
    setShowModal(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: "#f5f5f5" }}>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        Face Verification Test
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, marginBottom: 10 }}>Select Mode:</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setMode("register")}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 8,
              backgroundColor: mode === "register" ? "#007AFF" : "#E5E5EA",
            }}
          >
            <Text
              style={{
                color: mode === "register" ? "white" : "#333",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              Register
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("verify")}
            style={{
              flex: 1,
              padding: 15,
              borderRadius: 8,
              backgroundColor: mode === "verify" ? "#007AFF" : "#E5E5EA",
            }}
          >
            <Text
              style={{
                color: mode === "verify" ? "white" : "#333",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              Verify
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => setShowModal(true)}
        style={{
          backgroundColor: "#34C759",
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 18,
            fontWeight: "bold",
          }}
        >
          Start {mode === "register" ? "Registration" : "Verification"}
        </Text>
      </TouchableOpacity>

      {lastResult && (
        <View
          style={{
            backgroundColor: "white",
            padding: 15,
            borderRadius: 8,
            borderLeftWidth: 4,
            borderLeftColor: lastResult.startsWith("Success")
              ? "#34C759"
              : "#FF3B30",
          }}
        >
          <Text style={{ fontSize: 14, fontFamily: "monospace" }}>
            Last Result: {lastResult}
          </Text>
        </View>
      )}

      <FaceVerificationModal
        visible={showModal}
        mode={mode}
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
        maxRetries={3}
        title={`Face ${mode === "register" ? "Registration" : "Verification"} Test`}
        subtitle="Testing the face verification system with improved quality detection"
      />
    </SafeAreaView>
  );
}
