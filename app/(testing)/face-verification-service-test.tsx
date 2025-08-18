/**
 * Face Verification Service Test
 * 
 * Test component to verify the Face Verification Service functionality
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import {
  storeFaceProfile,
  getFaceProfile,
  verifyFace,
  generateFaceEncoding,
  compareFaceEncodings,
  getFaceRegistrationStatus,
  deleteFaceProfile,
  getCachedVerifications,
  getOfflineVerifications,
  clearAllFaceData
} from '../services/FaceVerificationService';
import { FaceDetectionData, CapturedPhoto } from '../types/faceDetection';

export default function FaceVerificationServiceTest() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Mock face detection data
  const mockFaceData: FaceDetectionData = {
    bounds: { x: 100, y: 100, width: 200, height: 200 },
    leftEyeOpenProbability: 0.8,
    rightEyeOpenProbability: 0.9,
    faceId: 'test-face-id',
    rollAngle: 5,
    yawAngle: -2
  };

  // Mock captured photo
  const mockPhoto: CapturedPhoto = {
    uri: 'mock://photo.jpg',
    width: 400,
    height: 400,
    timestamp: Date.now()
  };

  const testUserId = 123;

  const testFaceEncoding = async () => {
    try {
      setIsLoading(true);
      addResult('Testing face encoding generation...');
      
      const encoding = await generateFaceEncoding(mockFaceData, mockPhoto);
      addResult(`✅ Face encoding generated: ${encoding.substring(0, 20)}...`);
      
      // Test encoding comparison
      const encoding2 = await generateFaceEncoding({
        ...mockFaceData,
        rollAngle: 6 // Slightly different
      }, mockPhoto);
      
      const similarity = compareFaceEncodings(encoding, encoding2);
      addResult(`✅ Face encoding comparison: ${(similarity * 100).toFixed(1)}% similarity`);
      
    } catch (error) {
      addResult(`❌ Face encoding test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFaceProfileStorage = async () => {
    try {
      setIsLoading(true);
      addResult('Testing face profile storage...');
      
      // Store face profile
      const encoding = await generateFaceEncoding(mockFaceData, mockPhoto);
      await storeFaceProfile(testUserId, encoding, mockFaceData);
      addResult('✅ Face profile stored successfully');
      
      // Retrieve face profile
      const profile = await getFaceProfile(testUserId);
      if (profile) {
        addResult(`✅ Face profile retrieved: User ${profile.userId}`);
        addResult(`   Registration: ${profile.registrationDate}`);
        addResult(`   Verifications: ${profile.verificationCount}`);
      } else {
        addResult('❌ Face profile not found');
      }
      
    } catch (error) {
      addResult(`❌ Face profile storage test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFaceVerification = async () => {
    try {
      setIsLoading(true);
      addResult('Testing face verification...');
      
      // First ensure we have a stored profile
      const status = await getFaceRegistrationStatus(testUserId);
      if (!status.isRegistered) {
        const encoding = await generateFaceEncoding(mockFaceData, mockPhoto);
        await storeFaceProfile(testUserId, encoding, mockFaceData);
        addResult('✅ Face profile created for verification test');
      }
      
      // Test verification with same face data (should succeed)
      const result1 = await verifyFace(testUserId, mockFaceData, mockPhoto, true);
      addResult(`✅ Same face verification: ${result1.success ? 'SUCCESS' : 'FAILED'}`);
      addResult(`   Confidence: ${(result1.confidence * 100).toFixed(1)}%`);
      addResult(`   Liveness: ${result1.livenessDetected ? 'YES' : 'NO'}`);
      
      // Test verification with different face data (should fail)
      const differentFaceData = {
        ...mockFaceData,
        bounds: { x: 50, y: 50, width: 100, height: 100 }, // Much smaller face
        rollAngle: 45 // Very different angle
      };
      
      const result2 = await verifyFace(testUserId, differentFaceData, mockPhoto, false);
      addResult(`✅ Different face verification: ${result2.success ? 'SUCCESS' : 'FAILED'}`);
      addResult(`   Confidence: ${(result2.confidence * 100).toFixed(1)}%`);
      
    } catch (error) {
      addResult(`❌ Face verification test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testRegistrationStatus = async () => {
    try {
      setIsLoading(true);
      addResult('Testing registration status...');
      
      const status = await getFaceRegistrationStatus(testUserId);
      addResult(`✅ Registration status retrieved:`);
      addResult(`   Registered: ${status.isRegistered ? 'YES' : 'NO'}`);
      addResult(`   Enabled: ${status.isEnabled ? 'YES' : 'NO'}`);
      addResult(`   Verifications: ${status.verificationCount}`);
      
      if (status.registrationDate) {
        addResult(`   Registration Date: ${status.registrationDate.toLocaleDateString()}`);
      }
      
    } catch (error) {
      addResult(`❌ Registration status test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCacheAndOffline = async () => {
    try {
      setIsLoading(true);
      addResult('Testing cache and offline functionality...');
      
      // Get cached verifications
      const cache = await getCachedVerifications(testUserId);
      if (cache) {
        addResult(`✅ Found ${cache.verifications.length} cached verifications`);
      } else {
        addResult('✅ No cached verifications found');
      }
      
      // Get offline verifications
      const offline = await getOfflineVerifications();
      addResult(`✅ Found ${offline.length} offline verifications pending sync`);
      
    } catch (error) {
      addResult(`❌ Cache and offline test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCleanup = async () => {
    try {
      setIsLoading(true);
      addResult('Testing cleanup...');
      
      // Delete face profile
      await deleteFaceProfile(testUserId);
      addResult('✅ Face profile deleted');
      
      // Verify deletion
      const status = await getFaceRegistrationStatus(testUserId);
      addResult(`✅ Registration status after deletion: ${status.isRegistered ? 'STILL REGISTERED' : 'DELETED'}`);
      
      // Clear all cache data
      await clearAllFaceData();
      addResult('✅ All face cache data cleared');
      
    } catch (error) {
      addResult(`❌ Cleanup test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    setResults([]);
    addResult('🚀 Starting Face Verification Service Tests...');
    
    await testFaceEncoding();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testFaceProfileStorage();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testFaceVerification();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testRegistrationStatus();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testCacheAndOffline();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testCleanup();
    
    addResult('🎉 All tests completed!');
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Face Verification Service Test
      </Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            padding: 10,
            borderRadius: 8,
            margin: 5,
            opacity: isLoading ? 0.6 : 1
          }}
          onPress={runAllTests}
          disabled={isLoading}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Run All Tests</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            backgroundColor: '#34C759',
            padding: 10,
            borderRadius: 8,
            margin: 5,
            opacity: isLoading ? 0.6 : 1
          }}
          onPress={testFaceEncoding}
          disabled={isLoading}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Test Encoding</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            backgroundColor: '#FF9500',
            padding: 10,
            borderRadius: 8,
            margin: 5,
            opacity: isLoading ? 0.6 : 1
          }}
          onPress={testFaceVerification}
          disabled={isLoading}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Test Verification</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            backgroundColor: '#FF3B30',
            padding: 10,
            borderRadius: 8,
            margin: 5
          }}
          onPress={clearResults}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Clear Results</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={{ 
          flex: 1, 
          backgroundColor: 'white', 
          borderRadius: 8, 
          padding: 15,
          borderWidth: 1,
          borderColor: '#ddd'
        }}
        showsVerticalScrollIndicator={false}
      >
        {results.length === 0 ? (
          <Text style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 50 }}>
            No test results yet. Run some tests to see results here.
          </Text>
        ) : (
          results.map((result, index) => (
            <Text 
              key={index} 
              style={{ 
                fontSize: 12, 
                marginBottom: 5, 
                fontFamily: 'monospace',
                color: result.includes('❌') ? '#FF3B30' : 
                       result.includes('✅') ? '#34C759' : 
                       result.includes('🚀') || result.includes('🎉') ? '#007AFF' : '#333'
              }}
            >
              {result}
            </Text>
          ))
        )}
      </ScrollView>
      
      {isLoading && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 10,
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Running Tests...</Text>
          </View>
        </View>
      )}
    </View>
  );
}