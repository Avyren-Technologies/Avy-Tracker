import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useCameraLiveness } from '../hooks/useCameraLiveness';
import FaceVerificationModal from '../components/FaceVerificationModal';

export default function SimpleFaceTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [testMode, setTestMode] = useState<'detection' | 'liveness' | 'full'>('detection');

  const {
    isDetecting,
    faceDetected,
    faceData,
    faceQuality,
    startDetection,
    stopDetection,
    error,
    isInitialized,
    device
  } = useFaceDetection({
    performanceMode: 'accurate',
    enableLivenessDetection: true,
    qualityThreshold: 0.4,
  });

  const {
    isLivenessActive,
    blinkDetected,
    livenessScore,
    blinkCount,
    isLive,
    startLivenessDetection,
    stopLivenessDetection
  } = useCameraLiveness(faceData);

  const addResult = (result: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev.slice(-9), `${timestamp}: ${result}`]);
  };

  // Monitor face detection changes
  useEffect(() => {
    if (faceDetected && faceData) {
      addResult(`👤 Face detected! Quality: ${faceQuality?.overall?.toFixed(2) || 'N/A'}`);
    }
  }, [faceDetected, faceData, faceQuality]);

  // Monitor liveness detection changes
  useEffect(() => {
    if (blinkDetected) {
      addResult(`👁️ Blink detected! Count: ${blinkCount}, Score: ${livenessScore.toFixed(2)}`);
    }
  }, [blinkDetected, blinkCount, livenessScore]);

  // Monitor liveness status changes
  useEffect(() => {
    if (isLive) {
      addResult(`✅ Liveness confirmed! Score: ${livenessScore.toFixed(2)}`);
    }
  }, [isLive, livenessScore]);

  const handleStartDetection = async () => {
    try {
      addResult('🚀 Starting face detection...');
      const started = await startDetection();
      if (started) {
        addResult('✅ Face detection started successfully');
      } else {
        addResult('❌ Failed to start face detection');
      }
    } catch (error) {
      if (error instanceof Error) {
        addResult(`❌ Error: ${error.message}`);
      } else {
        addResult(`❌ Error: ${String(error)}`);
      }
    }
  };

  const handleStopDetection = () => {
    try {
      addResult('🛑 Stopping face detection...');
      stopDetection();
      addResult('✅ Face detection stopped');
    } catch (error) {
      if (error instanceof Error) {
        addResult(`❌ Error: ${error.message}`);
      } else {
        addResult(`❌ Error: ${String(error)}`);
      }
    }
  };

  const handleStartLiveness = () => {
    try {
      addResult('👁️ Starting liveness detection...');
      startLivenessDetection();
      addResult('✅ Liveness detection started');
    } catch (error) {
      if (error instanceof Error) {
        addResult(`❌ Liveness Error: ${error.message}`);
      } else {
        addResult(`❌ Liveness Error: ${String(error)}`);
      }
    }
  };

  const handleStopLiveness = () => {
    try {
      addResult('🛑 Stopping liveness detection...');
      stopLivenessDetection();
      addResult('✅ Liveness detection stopped');
    } catch (error) {
      if (error instanceof Error) {
        addResult(`❌ Error: ${error.message}`);
      } else {
        addResult(`❌ Error: ${String(error)}`);
      }
    }
  };

  const handleFullTest = () => {
    setTestMode('full');
    setShowModal(true);
    addResult('🎯 Starting full face verification test...');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#f8f9fa' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#2c3e50' }}>
        🧪 Comprehensive Face Detection Test
      </Text>
      
      <Text style={{ fontSize: 14, marginBottom: 20, textAlign: 'center', color: '#7f8c8d' }}>
        Testing face detection, liveness detection, and full verification flow
      </Text>

      {/* Status Display */}
      <View style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#2c3e50' }}>
          📊 System Status:
        </Text>
        
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Text style={{ color: isInitialized ? '#27ae60' : '#e74c3c', fontSize: 12 }}>
            📱 Init: {isInitialized ? '✅' : '❌'}
          </Text>
          <Text style={{ color: device ? '#27ae60' : '#e74c3c', fontSize: 12 }}>
            📷 Camera: {device ? '✅' : '❌'}
          </Text>
          <Text style={{ color: isDetecting ? '#f39c12' : '#95a5a6', fontSize: 12 }}>
            🔍 Detecting: {isDetecting ? '🔄' : '⏸️'}
          </Text>
          <Text style={{ color: faceDetected ? '#27ae60' : '#95a5a6', fontSize: 12 }}>
            👤 Face: {faceDetected ? '✅' : '❌'}
          </Text>
          <Text style={{ color: isLivenessActive ? '#f39c12' : '#95a5a6', fontSize: 12 }}>
            👁️ Liveness: {isLivenessActive ? '🔄' : '⏸️'}
          </Text>
          <Text style={{ color: isLive ? '#27ae60' : '#95a5a6', fontSize: 12 }}>
            ✨ Live: {isLive ? '✅' : '❌'}
          </Text>
        </View>
        
        {faceData && (
          <View style={{ marginTop: 10, padding: 8, backgroundColor: '#f8f9fa', borderRadius: 6 }}>
            <Text style={{ fontSize: 12, color: '#2c3e50' }}>
              👁️ Eyes: L:{(faceData.leftEyeOpenProbability * 100).toFixed(0)}% R:{(faceData.rightEyeOpenProbability * 100).toFixed(0)}% | 
              🎯 Quality: {faceQuality?.overall?.toFixed(2) || 'N/A'} | 
              👁️ Blinks: {blinkCount} | 
              📊 Score: {livenessScore.toFixed(2)}
            </Text>
          </View>
        )}
        
        {error && (
          <Text style={{ color: '#e74c3c', fontSize: 12, marginTop: 5 }}>
            ❌ Error: {error}
          </Text>
        )}
      </View>

      {/* Control Buttons */}
      <View style={{ marginBottom: 15 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#2c3e50' }}>
          🎮 Face Detection Controls:
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={handleStartDetection}
            disabled={isDetecting}
            style={{
              flex: 1,
              backgroundColor: isDetecting ? '#95a5a6' : '#27ae60',
              padding: 12,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
              {isDetecting ? '🔄 Detecting...' : '🚀 Start'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStopDetection}
            disabled={!isDetecting}
            style={{
              flex: 1,
              backgroundColor: !isDetecting ? '#95a5a6' : '#e74c3c',
              padding: 12,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
              🛑 Stop
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#2c3e50' }}>
          👁️ Liveness Detection Controls:
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={handleStartLiveness}
            disabled={isLivenessActive || !faceDetected}
            style={{
              flex: 1,
              backgroundColor: (isLivenessActive || !faceDetected) ? '#95a5a6' : '#3498db',
              padding: 12,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
              {isLivenessActive ? '👁️ Active...' : '👁️ Start Liveness'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStopLiveness}
            disabled={!isLivenessActive}
            style={{
              flex: 1,
              backgroundColor: !isLivenessActive ? '#95a5a6' : '#e74c3c',
              padding: 12,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
              🛑 Stop Liveness
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#2c3e50' }}>
          🎯 Full Verification Test:
        </Text>
        <TouchableOpacity
          onPress={handleFullTest}
          style={{
            backgroundColor: '#9b59b6',
            padding: 12,
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
            🎯 Test Full Verification Flow
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={clearResults}
        style={{
          backgroundColor: '#95a5a6',
          padding: 10,
          borderRadius: 6,
          marginBottom: 15,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
          🗑️ Clear Results
        </Text>
      </TouchableOpacity>

      {/* Results Display */}
      <View style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        flex: 1,
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#2c3e50' }}>
          📋 Test Results ({testResults.length}):
        </Text>
        
        {testResults.length === 0 ? (
          <Text style={{ color: '#95a5a6', fontStyle: 'italic', textAlign: 'center', marginTop: 50 }}>
            No test results yet. Start detection to see results here.
          </Text>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {testResults.map((result, index) => (
              <View key={index} style={{
                backgroundColor: result.includes('✅') ? '#d5f4e6' : 
                               result.includes('❌') ? '#ffeaa7' : 
                               result.includes('👁️') ? '#e8f4f8' :
                               result.includes('👤') ? '#f0e6ff' : '#f8f9fa',
                padding: 8,
                borderRadius: 6,
                marginBottom: 6,
                borderLeftWidth: 3,
                borderLeftColor: result.includes('✅') ? '#00b894' : 
                                result.includes('❌') ? '#fdcb6e' : 
                                result.includes('👁️') ? '#74b9ff' :
                                result.includes('👤') ? '#a29bfe' : '#ddd',
              }}>
                <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#2d3436' }}>
                  {result}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Full Verification Modal */}
      <FaceVerificationModal
        visible={showModal}
        onCancel={() => {
          setShowModal(false);
          addResult('🎯 Full verification test completed');
        }}
        onSuccess={(result: any) => {
          addResult(`🎉 Verification SUCCESS! Confidence: ${result.confidence}`);
          setShowModal(false);
        }}
        onError={(error: any) => {
          addResult(`❌ Verification FAILED: ${error.message || error}`);
          setShowModal(false);
        }}
        mode="register"
      />
    </SafeAreaView>
  );
}