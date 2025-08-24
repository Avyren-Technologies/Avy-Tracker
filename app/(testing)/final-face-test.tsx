import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FaceVerificationModal from '../components/FaceVerificationModal';
import { FaceVerificationResult } from '../types/faceDetection';
import { FaceVerificationError } from '../types/faceVerificationErrors';

export default function FinalFaceTest() {
  const [showModal, setShowModal] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const handleSuccess = (result: FaceVerificationResult) => {
    console.log('✅ Face verification success:', result);
    addResult(`✅ SUCCESS - Confidence: ${Math.round(result.confidence * 100)}%`);
    setShowModal(false);
    Alert.alert('Success!', `Face verification completed successfully!`);
  };

  const handleError = (error: FaceVerificationError) => {
    console.log('❌ Face verification error:', error);
    addResult(`❌ ERROR - ${error.message}`);
    setShowModal(false);
    Alert.alert('Error', error.message);
  };

  const handleCancel = () => {
    addResult('⏹️ CANCELLED - User cancelled verification');
    setShowModal(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: '#f8f9fa' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#2c3e50' }}>
        🎯 Final Face Test
      </Text>
      
      <Text style={{ fontSize: 16, marginBottom: 30, textAlign: 'center', color: '#7f8c8d' }}>
        Testing the fixed face verification system
      </Text>

      <TouchableOpacity
        onPress={() => setShowModal(true)}
        style={{
          backgroundColor: '#3498db',
          padding: 20,
          borderRadius: 12,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
          🚀 Start Face Verification Test
        </Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={clearResults}
          style={{
            flex: 1,
            backgroundColor: '#95a5a6',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            🗑️ Clear Results
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        minHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#2c3e50' }}>
          📊 Test Results:
        </Text>
        
        {testResults.length === 0 ? (
          <Text style={{ color: '#95a5a6', fontStyle: 'italic', textAlign: 'center', marginTop: 50 }}>
            No test results yet. Run a test to see results here.
          </Text>
        ) : (
          testResults.map((result, index) => (
            <View key={index} style={{
              backgroundColor: result.includes('SUCCESS') ? '#d5f4e6' : 
                             result.includes('ERROR') ? '#ffeaa7' : '#e8f4f8',
              padding: 10,
              borderRadius: 8,
              marginBottom: 8,
              borderLeftWidth: 4,
              borderLeftColor: result.includes('SUCCESS') ? '#00b894' : 
                              result.includes('ERROR') ? '#fdcb6e' : '#74b9ff',
            }}>
              <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#2d3436' }}>
                {result}
              </Text>
            </View>
          ))
        )}
      </View>

      <FaceVerificationModal
        visible={showModal}
        mode="register"
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
        maxRetries={2}
        title="🎯 Final Test - Face Registration"
        subtitle="Testing the improved face verification system with proper cleanup"
      />
    </SafeAreaView>
  );
}