import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Test component to verify face profile deletion and re-registration flow
 * This test simulates the exact scenario reported by the user
 */
export default function FaceProfileDeletionTest() {
  const { token, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testFaceProfileFlow = async () => {
    if (!token || !user?.id) {
      Alert.alert('Error', 'No authentication token or user ID available');
      return;
    }

    setIsLoading(true);
    clearResults();
    addResult('🧪 Starting face profile deletion and re-registration test...');

    try {
      // Step 1: Check current face profile status
      addResult('📋 Step 1: Checking current face profile status...');
      const statusResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        addResult(`✅ Current status: registered=${statusData.registered}, active=${statusData.active}`);
      } else {
        addResult(`❌ Failed to get status: ${statusResponse.status}`);
        return;
      }

      // Step 2: Delete face profile
      addResult('🗑️ Step 2: Deleting face profile...');
      const deleteResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/profile`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (deleteResponse.ok) {
        const deleteData = await deleteResponse.json();
        addResult(`✅ Face profile deleted: ${deleteData.message}`);
      } else {
        const deleteError = await deleteResponse.json();
        addResult(`❌ Delete failed: ${deleteError.error}`);
        return;
      }

      // Step 3: Verify deletion by checking status again
      addResult('🔍 Step 3: Verifying deletion...');
      const verifyDeleteResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (verifyDeleteResponse.ok) {
        const verifyData = await verifyDeleteResponse.json();
        addResult(`✅ Post-deletion status: registered=${verifyData.registered}, active=${verifyData.active}`);
        
        if (verifyData.registered || verifyData.active) {
          addResult('❌ ERROR: Face profile still shows as registered/active after deletion!');
          return;
        }
      } else {
        addResult(`❌ Failed to verify deletion: ${verifyDeleteResponse.status}`);
        return;
      }

      // Step 4: Attempt to register a new face profile (this should work now)
      addResult('📝 Step 4: Attempting to register new face profile...');
      
      // Create a mock face encoding for testing
      const mockFaceEncoding = 'mock_face_encoding_' + Date.now();
      
      const registerResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/register`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            faceEncoding: mockFaceEncoding,
            qualityScore: 0.95,
            deviceInfo: {
              platform: 'test',
              version: '1.0.0'
            }
          }),
        }
      );

      if (registerResponse.ok) {
        const registerData = await registerResponse.json();
        addResult(`✅ Face profile registration successful: ${registerData.message}`);
      } else {
        const registerError = await registerResponse.json();
        addResult(`❌ Registration failed: ${registerError.error}`);
        
        if (registerError.error?.includes('already exists')) {
          addResult('🚨 CRITICAL: The "face data already exists" error is still occurring!');
        }
        return;
      }

      // Step 5: Final verification
      addResult('🎯 Step 5: Final verification...');
      const finalStatusResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (finalStatusResponse.ok) {
        const finalData = await finalStatusResponse.json();
        addResult(`✅ Final status: registered=${finalData.registered}, active=${finalData.active}`);
        
        if (finalData.registered && finalData.active) {
          addResult('🎉 SUCCESS: Face profile deletion and re-registration flow is working correctly!');
        } else {
          addResult('❌ ERROR: Final verification failed - profile not properly registered');
        }
      } else {
        addResult(`❌ Failed to get final status: ${finalStatusResponse.status}`);
      }

    } catch (error: any) {
      addResult(`❌ Test failed with error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Face Profile Deletion Test</Text>
        <Text style={styles.subtitle}>
          This test verifies that face profile deletion and re-registration works correctly
        </Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={testFaceProfileFlow}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Run Test</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
          disabled={isLoading}
        >
          <Text style={styles.clearButtonText}>Clear Results</Text>
        </TouchableOpacity>

        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results:</Text>
          {testResults.length === 0 ? (
            <Text style={styles.noResults}>No test results yet. Tap "Run Test" to start.</Text>
          ) : (
            testResults.map((result, index) => (
              <Text key={index} style={styles.resultItem}>
                {result}
              </Text>
            ))
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#ef4444',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  noResults: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  resultItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 20,
  },
});
