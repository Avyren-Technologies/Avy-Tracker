import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";
import { useFaceDetection as useMLKitFaceDetection } from "@infinitered/react-native-mlkit-face-detection";
import { Asset } from "expo-asset";

export default function CameraPhotoTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [lastCameraPhoto, setLastCameraPhoto] = useState<string | null>(null);

  const device = useCameraDevice("front");
  const cameraRef = useRef<Camera>(null);
  const mlKitDetector = useMLKitFaceDetection();

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
    console.log(message);
  };

  const testStaticPhoto = async () => {
    try {
      addLog("=== Testing Static Photo ===");

      // Load a known working photo
      const asset = Asset.fromModule(require("../../assets/images/Chetan.jpg"));
      await asset.downloadAsync();
      const photoUri = asset.localUri || asset.uri;

      addLog(`Static photo URI: ${photoUri}`);

      const result = await mlKitDetector.detectFaces(photoUri);
      addLog(
        `Static photo result: ${result?.faces?.length || 0} faces detected`,
      );

      if (result?.faces && result.faces.length > 0) {
        addLog("✅ Static photo works perfectly with ML Kit");
      } else {
        addLog("❌ Static photo failed - unexpected");
      }
    } catch (error: any) {
      addLog(`❌ Static photo error: ${error.message}`);
    }
  };

  const testLiveCameraPhoto = async () => {
    try {
      addLog("=== Testing Live Camera Photo ===");

      if (!cameraRef.current) {
        addLog("❌ Camera not ready");
        return;
      }

      addLog("Taking photo with camera...");

      // Wait a moment for camera to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      const photo = await cameraRef.current.takePhoto({
        flash: "off",
        enableShutterSound: false,
      });

      const photoUri = `file://${photo.path}`;
      setLastCameraPhoto(photoUri);

      addLog(`Live photo captured: ${photoUri}`);
      addLog(`Photo dimensions: ${photo.width}x${photo.height}`);
      addLog(`Photo path: ${photo.path}`);

      // Test the live photo with ML Kit
      addLog("Testing live photo with ML Kit...");
      const result = await mlKitDetector.detectFaces(photoUri);

      addLog(`Live photo result: ${result?.faces?.length || 0} faces detected`);

      if (result?.faces && result.faces.length > 0) {
        addLog("✅ Live camera photo works with ML Kit");
      } else {
        addLog("❌ Live camera photo failed - this is the issue!");
        addLog(
          "ML Kit can detect faces in static photos but not in live camera photos",
        );
        addLog("This suggests a photo quality, format, or processing issue");
      }
    } catch (error: any) {
      addLog(`❌ Live camera photo error: ${error.message}`);
    }
  };

  const comparePhotos = () => {
    addLog("=== Photo Comparison Analysis ===");
    addLog("If static photos work but live photos fail:");
    addLog("1. Photo quality issue (resolution, compression)");
    addLog("2. Photo format issue (JPEG vs other formats)");
    addLog("3. Photo processing issue (camera settings)");
    addLog("4. Timing issue (camera not fully ready)");
    addLog("5. File system issue (photo not properly saved)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Photo Test</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testStaticPhoto}>
          <Text style={styles.buttonText}>Test Static Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testLiveCameraPhoto}>
          <Text style={styles.buttonText}>Test Live Camera Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={comparePhotos}>
          <Text style={styles.buttonText}>Analyze Issue</Text>
        </TouchableOpacity>
      </View>

      {device && (
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={device}
            isActive={true}
            photo={true}
            video={false}
            audio={false}
          />
        </View>
      )}

      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Test Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </View>

      {lastCameraPhoto && (
        <View style={styles.photoInfo}>
          <Text style={styles.photoTitle}>Last Camera Photo:</Text>
          <Text style={styles.photoText}>{lastCameraPhoto}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  cameraContainer: {
    height: 200,
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: "#000",
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  logsTitle: {
    color: "#00FF00",
    fontWeight: "bold",
    marginBottom: 10,
  },
  logText: {
    color: "#00FF00",
    fontSize: 12,
    marginBottom: 2,
  },
  photoInfo: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
  },
  photoTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  photoText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
});
