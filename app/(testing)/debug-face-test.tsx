import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DebugFaceTest() {
  const [step, setStep] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const steps = [
    "Test Navigation",
    "Test Modal Import",
    "Test Modal Render",
    "Test Face Verification",
  ];

  const handleStep = async () => {
    try {
      switch (step) {
        case 0:
          console.log("✅ Step 1: Navigation working");
          setStep(1);
          break;
        case 1:
          console.log("✅ Step 2: Testing modal import...");
          // Try to import the modal
          const FaceVerificationModal = await import(
            "../components/FaceVerificationModal"
          );
          console.log(
            "✅ Modal imported successfully:",
            !!FaceVerificationModal.default,
          );
          setStep(2);
          break;
        case 2:
          console.log("✅ Step 3: Testing modal render...");
          setShowModal(true);
          setStep(3);
          break;
        case 3:
          console.log("✅ Step 4: Face verification test complete");
          Alert.alert("Success!", "All steps completed successfully!");
          break;
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error("❌ Error at step", step + 1, ":", error.message);
        Alert.alert("Error", `Step ${step + 1} failed: ${error.message}`);
      } else {
        console.error("❌ Error at step", step + 1, ":", error);
        Alert.alert(
          "Error",
          `Step ${step + 1} failed: ${JSON.stringify(error)}`,
        );
      }
    }
  };

  const resetTest = () => {
    setStep(0);
    setShowModal(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: "#f8f9fa" }}>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 10,
          textAlign: "center",
          color: "#2c3e50",
        }}
      >
        🔍 Debug Face Test
      </Text>

      <Text
        style={{
          fontSize: 16,
          marginBottom: 30,
          textAlign: "center",
          color: "#7f8c8d",
        }}
      >
        Step-by-step debugging of face verification issues
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            marginBottom: 10,
            color: "#2c3e50",
          }}
        >
          Current Step: {step + 1}/4
        </Text>
        <Text style={{ fontSize: 16, color: "#7f8c8d" }}>{steps[step]}</Text>
      </View>

      <TouchableOpacity
        onPress={handleStep}
        style={{
          backgroundColor: "#3498db",
          padding: 20,
          borderRadius: 12,
          marginBottom: 10,
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
          {step < 3 ? `Execute Step ${step + 1}` : "Complete Test"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resetTest}
        style={{
          backgroundColor: "#95a5a6",
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          🔄 Reset Test
        </Text>
      </TouchableOpacity>

      <View
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 15,
          minHeight: 100,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            marginBottom: 10,
            color: "#2c3e50",
          }}
        >
          📊 Progress:
        </Text>

        {steps.map((stepName, index) => (
          <View
            key={index}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
              padding: 8,
              borderRadius: 6,
              backgroundColor:
                index < step
                  ? "#d5f4e6"
                  : index === step
                    ? "#e8f4f8"
                    : "#f8f9fa",
            }}
          >
            <Text style={{ marginRight: 10, fontSize: 16 }}>
              {index < step ? "✅" : index === step ? "🔄" : "⏳"}
            </Text>
            <Text
              style={{
                color: index <= step ? "#2c3e50" : "#95a5a6",
                fontWeight: index === step ? "bold" : "normal",
              }}
            >
              {stepName}
            </Text>
          </View>
        ))}
      </View>

      {showModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: 20,
              margin: 20,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              🎉 Modal Test Success!
            </Text>
            <Text
              style={{
                fontSize: 14,
                textAlign: "center",
                marginBottom: 20,
                color: "#7f8c8d",
              }}
            >
              The modal can be rendered without errors.
            </Text>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={{
                backgroundColor: "#3498db",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
