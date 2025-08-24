import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useFaceDetection as useMLKitFaceDetection } from '@infinitered/react-native-mlkit-face-detection';

export default function FaceDetectionDebug() {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [cameraPermission, setCameraPermission] = useState<string>('unknown');
  
  const device = useCameraDevice('front');
  const mlKitDetector = useMLKitFaceDetection();
  
  const {
    isDetecting,
    faceDetected,
    faceData,
    startDetection,
    stopDetection,
    error,
    cameraPermissionStatus,
    isInitialized,
    faceQuality,
    setCameraRef,
  } = useFaceDetection();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const testStep = async (stepNumber: number) => {
    setStep(stepNumber);
    addLog(`=== Testing Step ${stepNumber} ===`);
    
    try {
      switch (stepNumber) {
        case 1:
          addLog('Step 1: Checking camera permissions...');
          const permission = await Camera.requestCameraPermission();
          setCameraPermission(permission);
          addLog(`Camera permission: ${permission}`);
          break;
          
        case 2:
          addLog('Step 2: Checking camera device...');
          addLog(`Front camera available: ${!!device}`);
          if (device) {
            addLog(`Device ID: ${device.id}`);
            addLog(`Device name: ${device.name}`);
          }
          break;
          
        case 3:
          addLog('Step 3: Checking ML Kit detector...');
          addLog(`ML Kit detector available: ${!!mlKitDetector}`);
          if (mlKitDetector) {
            addLog(`Detector methods: ${Object.keys(mlKitDetector).join(', ')}`);
          }
          break;
          
        case 4:
          addLog('Step 4: Testing face detection initialization...');
          const started = await startDetection();
          addLog(`Face detection started: ${started}`);
          break;
          
        case 5:
          addLog('Step 5: Checking face detection state...');
          addLog(`Is detecting: ${isDetecting}`);
          addLog(`Face detected: ${faceDetected}`);
          addLog(`Face data: ${faceData ? 'Yes' : 'No'}`);
          addLog(`Face quality: ${faceQuality ? JSON.stringify(faceQuality) : 'None'}`);
          addLog(`Error: ${error || 'None'}`);
          break;
          
        case 6:
          addLog('Step 6: Stopping face detection...');
          stopDetection();
          addLog('Face detection stopped');
          break;
          
        default:
          addLog('Unknown step');
      }
    } catch (error: any) {
      addLog(`Error in step ${stepNumber}: ${error.message}`);
    }
  };

  const runAllTests = async () => {
    for (let i = 1; i <= 6; i++) {
      await testStep(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Face Detection Debug</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => testStep(1)}>
          <Text style={styles.buttonText}>Test Camera Permissions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => testStep(2)}>
          <Text style={styles.buttonText}>Test Camera Device</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => testStep(3)}>
          <Text style={styles.buttonText}>Test ML Kit Detector</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => testStep(4)}>
          <Text style={styles.buttonText}>Test Face Detection Start</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => testStep(5)}>
          <Text style={styles.buttonText}>Check Detection State</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => testStep(6)}>
          <Text style={styles.buttonText}>Stop Detection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={runAllTests}>
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.logsContainer}>
        <Text style={styles.logsTitle}>Debug Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status:</Text>
        <Text>Step: {step}</Text>
        <Text>Camera Permission: {cameraPermission}</Text>
        <Text>Device Available: {device ? 'Yes' : 'No'}</Text>
        <Text>ML Kit Available: {mlKitDetector ? 'Yes' : 'No'}</Text>
        <Text>Is Detecting: {isDetecting ? 'Yes' : 'No'}</Text>
        <Text>Face Detected: {faceDetected ? 'Yes' : 'No'}</Text>
        <Text>Error: {error || 'None'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  logsTitle: {
    color: '#00FF00',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    color: '#00FF00',
    fontSize: 12,
    marginBottom: 2,
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
  },
  statusTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
});