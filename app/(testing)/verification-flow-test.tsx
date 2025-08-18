import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { useVerificationFlow } from '../hooks/useVerificationFlow';
import { LocationResult, VerificationFlowSummary } from '../types/verification';
import { FaceVerificationResult } from '../types/faceDetection';
import VerificationOrchestrator from '../components/VerificationOrchestrator';

export default function VerificationFlowTest() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const textColor = useThemeColor('#334155', '#e2e8f0');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const borderColor = useThemeColor('#e2e8f0', '#334155');

  // State
  const [showOrchestrator, setShowOrchestrator] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Mock user data
  const mockUserId = 123;
  const mockToken = 'test-token';

  // Verification flow hook for direct testing
  const {
    flowState,
    isInitialized,
    isInProgress,
    currentStep,
    canOverride,
    summary,
    startVerificationFlow,
    executeLocationVerification,
    executeFaceVerification,
    executeNextStep,
    applyOverride,
    resetFlow,
    getStepProgress,
    getConfidenceScore,
    getPerformanceMetrics,
    canRetryCurrentStep,
  } = useVerificationFlow({
    userId: mockUserId,
    token: mockToken,
    onStepCompleted: (step, success) => {
      addTestResult(`Step ${step} ${success ? 'completed' : 'failed'}`);
    },
    onFlowCompleted: (summary) => {
      addTestResult(`Flow completed: ${summary.status} (${summary.confidenceScore}% confidence)`);
    },
    onFlowFailed: (summary) => {
      addTestResult(`Flow failed: ${summary.status} (${summary.failedSteps.join(', ')} failed)`);
    },
    onOverrideRequired: (summary) => {
      addTestResult(`Override required: ${summary.status}`);
    },
    onPerformanceMetrics: (metrics) => {
      addTestResult(`Performance: ${metrics.totalLatency}ms total, ${metrics.completedSteps}/${metrics.stepCount} steps`);
    },
  });

  const addTestResult = useCallback((result: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `[${timestamp}] ${result}`]);
  }, []);

  const clearTestResults = useCallback(() => {
    setTestResults([]);
  }, []);

  // Mock verification functions
  const mockLocationVerification = useCallback(async (shouldSucceed = true): Promise<LocationResult> => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    
    if (shouldSucceed) {
      return {
        success: true,
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        isInGeofence: true,
        geofenceName: 'Test Office',
        confidence: 0.9,
      };
    } else {
      return {
        success: false,
        error: 'Location verification failed - not in geofence',
        confidence: 0.2,
      };
    }
  }, []);

  const mockFaceVerification = useCallback(async (shouldSucceed = true): Promise<FaceVerificationResult> => {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay
    
    if (shouldSucceed) {
      return {
        success: true,
        confidence: 0.85,
        livenessDetected: true,
        faceEncoding: 'mock-face-encoding',
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        confidence: 0.3,
        livenessDetected: false,
        faceEncoding: '',
        timestamp: new Date(),
      };
    }
  }, []);

  // Test functions
  const testSuccessfulFlow = useCallback(async () => {
    try {
      addTestResult('Starting successful verification flow test');
      await startVerificationFlow('start', {
        requireLocation: true,
        requireFace: true,
        maxRetries: 2,
      });
      
      // Execute steps with successful mocks
      await executeNextStep(
        () => mockLocationVerification(true),
        () => mockFaceVerification(true)
      );
      
    } catch (error) {
      addTestResult(`Error in successful flow test: ${error}`);
    }
  }, [startVerificationFlow, executeNextStep, mockLocationVerification, mockFaceVerification]);

  const testFailureWithFallback = useCallback(async () => {
    try {
      addTestResult('Starting failure with fallback test');
      await startVerificationFlow('start', {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: true,
        maxRetries: 1,
      });
      
      // Execute with location failure, face success
      await executeNextStep(
        () => mockLocationVerification(false),
        () => mockFaceVerification(true)
      );
      
    } catch (error) {
      addTestResult(`Error in fallback test: ${error}`);
    }
  }, [startVerificationFlow, executeNextStep, mockLocationVerification, mockFaceVerification]);

  const testCompleteFailure = useCallback(async () => {
    try {
      addTestResult('Starting complete failure test');
      await startVerificationFlow('start', {
        requireLocation: true,
        requireFace: true,
        allowLocationFallback: false,
        allowFaceFallback: false,
        maxRetries: 1,
      });
      
      // Execute with both failures
      await executeNextStep(
        () => mockLocationVerification(false),
        () => mockFaceVerification(false)
      );
      
    } catch (error) {
      addTestResult(`Error in complete failure test: ${error}`);
    }
  }, [startVerificationFlow, executeNextStep, mockLocationVerification, mockFaceVerification]);

  const testManagerOverride = useCallback(async () => {
    try {
      addTestResult('Testing manager override');
      if (flowState && canOverride) {
        await applyOverride('Testing manager override functionality', mockUserId);
      } else {
        addTestResult('Cannot test override - flow not in override state');
      }
    } catch (error) {
      addTestResult(`Error in override test: ${error}`);
    }
  }, [flowState, canOverride, applyOverride]);

  const runAllTests = useCallback(async () => {
    setIsRunningTests(true);
    clearTestResults();
    
    try {
      // Test 1: Successful flow
      await testSuccessfulFlow();
      await new Promise(resolve => setTimeout(resolve, 1000));
      resetFlow();
      
      // Test 2: Failure with fallback
      await testFailureWithFallback();
      await new Promise(resolve => setTimeout(resolve, 1000));
      resetFlow();
      
      // Test 3: Complete failure
      await testCompleteFailure();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test 4: Manager override (if applicable)
      if (canOverride) {
        await testManagerOverride();
      }
      
      addTestResult('All tests completed');
      
    } catch (error) {
      addTestResult(`Error running tests: ${error}`);
    } finally {
      setIsRunningTests(false);
      resetFlow();
    }
  }, [testSuccessfulFlow, testFailureWithFallback, testCompleteFailure, testManagerOverride, resetFlow, canOverride]);

  const handleOrchestratorSuccess = useCallback((summary: VerificationFlowSummary) => {
    setShowOrchestrator(false);
    Alert.alert(
      'Verification Successful',
      `Status: ${summary.status}\nConfidence: ${summary.confidenceScore}%\nCompleted: ${summary.completedSteps.join(', ')}`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleOrchestratorCancel = useCallback(() => {
    setShowOrchestrator(false);
  }, []);

  const handleOrchestratorError = useCallback((error: string) => {
    setShowOrchestrator(false);
    Alert.alert('Verification Error', error, [{ text: 'OK' }]);
  }, []);

  const progress = getStepProgress();
  const confidenceScore = Math.round(getConfidenceScore() * 100);
  const performanceMetrics = getPerformanceMetrics();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: 'Verification Flow Test',
          headerStyle: { backgroundColor: cardColor },
          headerTintColor: textColor,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Flow Status */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Flow Status</Text>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Initialized:</Text>
            <Text style={[styles.value, { color: isInitialized ? '#10b981' : '#ef4444' }]}>
              {isInitialized ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>In Progress:</Text>
            <Text style={[styles.value, { color: isInProgress ? '#f59e0b' : textColor }]}>
              {isInProgress ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Current Step:</Text>
            <Text style={[styles.value, { color: textColor }]}>
              {currentStep || 'None'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Can Override:</Text>
            <Text style={[styles.value, { color: canOverride ? '#f59e0b' : textColor }]}>
              {canOverride ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Progress:</Text>
            <Text style={[styles.value, { color: textColor }]}>
              {progress.current}/{progress.total} ({progress.percentage}%)
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.label, { color: textColor }]}>Confidence:</Text>
            <Text style={[styles.value, { color: textColor }]}>
              {confidenceScore}%
            </Text>
          </View>
        </View>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.cardTitle, { color: textColor }]}>Performance Metrics</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: textColor }]}>Total Latency:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {performanceMetrics.totalLatency}ms
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: textColor }]}>Avg Step Latency:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {performanceMetrics.avgStepLatency ? `${Math.round(performanceMetrics.avgStepLatency)}ms` : 'N/A'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: textColor }]}>Retry Count:</Text>
              <Text style={[styles.value, { color: textColor }]}>
                {performanceMetrics.retryCount}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.label, { color: textColor }]}>Fallback Mode:</Text>
              <Text style={[styles.value, { color: performanceMetrics.fallbackMode ? '#f59e0b' : textColor }]}>
                {performanceMetrics.fallbackMode ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>
        )}

        {/* Test Controls */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Test Controls</Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#3b82f6' }]}
            onPress={runAllTests}
            disabled={isRunningTests}
          >
            <Ionicons name="play" size={20} color="white" />
            <Text style={styles.buttonText}>
              {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#10b981' }]}
            onPress={testSuccessfulFlow}
            disabled={isRunningTests}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.buttonText}>Test Successful Flow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#f59e0b' }]}
            onPress={testFailureWithFallback}
            disabled={isRunningTests}
          >
            <Ionicons name="warning" size={20} color="white" />
            <Text style={styles.buttonText}>Test Fallback Logic</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#ef4444' }]}
            onPress={testCompleteFailure}
            disabled={isRunningTests}
          >
            <Ionicons name="close-circle" size={20} color="white" />
            <Text style={styles.buttonText}>Test Complete Failure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#8b5cf6' }]}
            onPress={() => setShowOrchestrator(true)}
          >
            <Ionicons name="construct" size={20} color="white" />
            <Text style={styles.buttonText}>Test Orchestrator UI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#6b7280' }]}
            onPress={clearTestResults}
          >
            <Ionicons name="trash" size={20} color="white" />
            <Text style={styles.buttonText}>Clear Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#6b7280' }]}
            onPress={resetFlow}
          >
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.buttonText}>Reset Flow</Text>
          </TouchableOpacity>
        </View>

        {/* Test Results */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.cardTitle, { color: textColor }]}>Test Results</Text>
          <ScrollView style={styles.resultsContainer} nestedScrollEnabled>
            {testResults.length === 0 ? (
              <Text style={[styles.noResults, { color: textColor }]}>
                No test results yet. Run some tests to see results here.
              </Text>
            ) : (
              testResults.map((result, index) => (
                <Text key={index} style={[styles.resultText, { color: textColor }]}>
                  {result}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Verification Orchestrator Modal */}
      <VerificationOrchestrator
        visible={showOrchestrator}
        userId={mockUserId}
        token={mockToken}
        shiftAction="start"
        config={{
          requireLocation: true,
          requireFace: true,
          allowLocationFallback: true,
          allowFaceFallback: true,
          maxRetries: 3,
        }}
        onSuccess={handleOrchestratorSuccess}
        onCancel={handleOrchestratorCancel}
        onError={handleOrchestratorError}
        locationVerificationFn={() => mockLocationVerification(true)}
        canOverrideGeofence={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  resultsContainer: {
    maxHeight: 200,
    borderRadius: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  noResults: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  resultText: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});