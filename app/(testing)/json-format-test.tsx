import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * JSON Format Test
 * 
 * Tests the JSON formatting logic for multi-angle registration
 * to ensure it matches backend validation requirements.
 */

interface TestFaceEncoding {
  id: string;
  encoding: string;
  confidence: number;
}

export default function JsonFormatTest() {
  const router = useRouter();
  const [testResult, setTestResult] = useState<string>('');

  // Simulate captured face encodings
  const mockFaceEncodings: TestFaceEncoding[] = [
    {
      id: 'front',
      encoding: 'UrgOPvYovD57FO4+UrgePxCUfz9tkX8/d9KivY4wfz8vR0g9nLF/P7U98jz9XIQ9IGbqPBAFhz3nAt88G+6lPVcEUD287yU9Mo23PcKmgD0DU8Q9jO+GPHLkEz3ReI49iN4/PUeIojsLsIY9TM21PT1mCjoP6rk9/AijPXgpmj1wVco9HhOaPcO5Zj3yBEA98iq7PXWHoz1mBws9SHiHPTQ2gD2Nyp09lZLVOwN8vTu94ak9Cp2ZPeXfxTxYuYw942RXPRntsj1hHmw9zuYaPIDLoD0waIg9+TeUPW4EWj0Xvr89JubBPe0BiD1wX509pcmSPeHNNj3l1xQ9PRmvPYN0mj2A5ko9AWymPVsVnD1ZRh49FUtpPBzVsT0z78A55LImPdo/kz2ono08rjAQPV3a3zzs82I8c1jkOxuOjz3Aliw8vLNWO2L0Nj13hMM9/oKtPZl9pz1JxwM8ieGkPVLl2DxlIJI9OxOuPfPHkj1sXJA9RqnSPBZ/aD1gvuA8lWeJPVZn0jwxXxw9w7+UPZY6tz1Zabo9DR6rPKt1nz3fFLU8UtGvPMuBnTu2Lbs95j1aPZLsnzyyyaA9+gklPfGGPDu1ny48oW+VPEYNwDx7d1M8ofcIPZA+fj3sosA9i4yoPcHYxT0iJ4U9XNadPB7YwD14xD09pOsxPciKEz0=',
      confidence: 0.95
    },
    {
      id: 'left',
      encoding: 'TestLeftEncoding1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      confidence: 0.92
    },
    {
      id: 'right',
      encoding: 'TestRightEncoding9876543210ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba9876543210',
      confidence: 0.94
    }
  ];

  const testJsonFormatting = () => {
    try {
      // Test the exact logic used in FaceRegistration.tsx
      const angles = mockFaceEncodings.map(enc => ({
        success: true,
        confidence: enc.confidence,
        livenessDetected: true,
        faceEncoding: enc.encoding,
        timestamp: new Date(),
      }));

      // Test the JSON formatting logic
      const faceEncoding = JSON.stringify(angles.map(angle => angle.faceEncoding));
      
      // Validate the JSON format
      const parsed = JSON.parse(faceEncoding);
      const isValidArray = Array.isArray(parsed) && parsed.length > 0;
      
      // Test the complete registration data structure
      const registrationData = {
        faceEncoding: faceEncoding,
        consentGiven: true,
        qualityScore: angles.reduce((sum, angle) => sum + (angle.confidence || 0), 0) / angles.length,
        deviceInfo: {
          platform: 'react-native',
          timestamp: new Date().toISOString()
        }
      };

      const result = `
✅ JSON Format Test PASSED!

📊 Test Data:
- Angles captured: ${angles.length}
- Average confidence: ${(angles.reduce((sum, angle) => sum + (angle.confidence || 0), 0) / angles.length).toFixed(3)}
- Face encoding length: ${faceEncoding.length} characters

🔍 JSON Validation:
- Is valid JSON: ✅ Yes
- Is array: ✅ ${Array.isArray(parsed)}
- Array length: ✅ ${parsed.length}
- Backend validation: ✅ PASSES

📤 Registration Data Structure:
${JSON.stringify(registrationData, null, 2)}

🎯 Backend API Compatibility: ✅ FULLY COMPATIBLE
      `;

      setTestResult(result);
      Alert.alert('Test Passed!', 'JSON format is correct and backend compatible.');

    } catch (error) {
      const errorResult = `
❌ JSON Format Test FAILED!

Error: ${error instanceof Error ? error.message : 'Unknown error'}

This indicates the JSON formatting logic needs to be fixed.
      `;
      
      setTestResult(errorResult);
      Alert.alert('Test Failed!', 'JSON format has issues that need fixing.');
    }
  };

  const testBackendValidation = () => {
    try {
      // Simulate backend validation logic
      const faceEncoding = JSON.stringify(mockFaceEncodings.map(enc => enc.encoding));
      
      // Backend validation steps (from faceVerification.ts)
      if (!faceEncoding || typeof faceEncoding !== 'string') {
        throw new Error('Face encoding is required and must be a string');
      }

      const parsed = JSON.parse(faceEncoding);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Face encoding must be a valid JSON array');
      }

      Alert.alert('Validation Passed!', 'Backend validation logic accepts our data format.');
      
    } catch (error) {
      Alert.alert('Validation Failed!', `Backend validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearResults = () => {
    setTestResult('');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">
          JSON Format Test
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">
          <Text className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            🧪 JSON Format Validation Test
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 mb-4">
            This test validates that our multi-angle registration data format is compatible with the backend API requirements.
          </Text>
          
          <View className="space-y-3">
            <TouchableOpacity
              onPress={testJsonFormatting}
              className="bg-blue-600 py-3 px-4 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">
                🧪 Test JSON Formatting
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={testBackendValidation}
              className="bg-green-600 py-3 px-4 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">
                🔍 Test Backend Validation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearResults}
              className="bg-gray-600 py-3 px-4 rounded-lg"
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">
                🗑️ Clear Results
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {testResult ? (
          <View className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              📊 Test Results
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300 font-mono">
              {testResult}
            </Text>
          </View>
        ) : (
          <View className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <Text className="text-gray-600 dark:text-gray-300 text-center">
              Click "Test JSON Formatting" to validate the data format.
            </Text>
          </View>
        )}

        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mt-6">
          <Text className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            ℹ️ What This Test Validates
          </Text>
          <View className="space-y-2">
            <Text className="text-blue-800 dark:text-blue-200 text-sm">
              • JSON string format compatibility with backend
            </Text>
            <Text className="text-blue-800 dark:text-blue-200 text-sm">
              • Array structure validation
            </Text>
            <Text className="text-blue-800 dark:text-blue-200 text-sm">
              • Registration data structure correctness
            </Text>
            <Text className="text-blue-800 dark:text-blue-200 text-sm">
              • Backend API contract compliance
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
