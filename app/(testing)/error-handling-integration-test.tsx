/**
 * Error Handling Integration Test
 * Tests comprehensive error handling across the face verification system
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ErrorHandlingService from '../services/ErrorHandlingService';
import { useErrorHandling } from '../hooks/useErrorHandling';
import ErrorDisplay from '../components/ErrorDisplay';
import {
  FaceVerificationErrorType,
  ErrorContext
} from '../types/faceVerificationErrors';
import ThemeContext from '../context/ThemeContext';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const ErrorHandlingIntegrationTest: React.FC = () => {
  const { theme } = ThemeContext.useTheme();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const {
    error,
    isRetrying,
    retryCount,
    recoveryActions,
    handleError,
    clearError,
    retry,
    executeRecoveryAction,
    formatErrorForDisplay,
    canRetry,
    shouldShowFallback,
    executeWithErrorHandling
  } = useErrorHandling({
    sessionId: 'error-test-session',
    onError: (error) => {
      console.log('Test error handled:', error.type);
    },
    onRetry: (attempt, error) => {
      console.log(`Test retry attempt ${attempt} for error:`, error.type);
    }
  });

  const colors = {
    light: {
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      success: '#059669',
      error: '#DC2626',
      warning: '#D97706',
      border: '#E2E8F0'
    },
    dark: {
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      border: '#334155'
    }
  };

  const currentColors = colors[theme];

  const runTest = async (testName: string, testFn: () => Promise<void>): Promise<TestResult> => {
    const startTime = Date.now();
    setCurrentTest(testName);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      return { testName, passed: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  };

  const testErrorCreation = async () => {
    // Test creating different types of errors
    const cameraError = ErrorHandlingService.createError(
      FaceVerificationErrorType.CAMERA_PERMISSION_DENIED,
      new Error('Camera access denied')
    );

    if ((cameraError as any).type !== FaceVerificationErrorType.CAMERA_PERMISSION_DENIED) {
      throw new Error('Error type not set correctly');
    }

    if (!(cameraError as any).userMessage || !(cameraError as any).suggestions.length) {
      throw new Error('Error message or suggestions not populated');
    }

    if ((cameraError as any).retryable !== false) {
      throw new Error('Camera permission error should not be retryable');
    }
  };

  const testErrorMapping = async () => {
    // Test mapping generic errors to face verification errors
    const networkError = new Error('fetch failed');
    const mappedError = ErrorHandlingService.mapErrorToFaceVerificationError(networkError);

    if (mappedError.type !== FaceVerificationErrorType.NETWORK_ERROR) {
      throw new Error('Network error not mapped correctly');
    }

    const timeoutError = new Error('request timed out');
    const mappedTimeout = ErrorHandlingService.mapErrorToFaceVerificationError(timeoutError);

    if (mappedTimeout.type !== FaceVerificationErrorType.TIMEOUT_ERROR) {
      throw new Error('Timeout error not mapped correctly');
    }
  };

  const testRetryLogic = async () => {
    let attemptCount = 0;
    const maxAttempts = 3;

    try {
      await executeWithErrorHandling(async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw new Error('Simulated network failure');
        }
        return 'success';
      });
    } catch (error) {
      // Should succeed after retries
      throw new Error('Retry logic failed - operation should have succeeded');
    }

    if (attemptCount !== maxAttempts) {
      throw new Error(`Expected ${maxAttempts} attempts, got ${attemptCount}`);
    }
  };

  const testRecoveryActions = async () => {
    const error = ErrorHandlingService.createError(
      FaceVerificationErrorType.NO_FACE_DETECTED,
      new Error('No face detected')
    );

    const actions = ErrorHandlingService.getRecoveryActions(error);

    if (actions.length === 0) {
      throw new Error('No recovery actions generated for retryable error');
    }

    const retryAction = actions.find(action => action.type === 'retry');
    if (!retryAction) {
      throw new Error('Retry action not found for retryable error');
    }
  };

  const testErrorReporting = async () => {
    const error = ErrorHandlingService.createError(
      FaceVerificationErrorType.PROCESSING_ERROR,
      new Error('Test processing error')
    );

    const context: ErrorContext = {
      userId: 'test-user',
      sessionId: 'test-session',
      timestamp: new Date()
    };

    // This should not throw
    await ErrorHandlingService.reportError(error, context);

    // Check if error was added to statistics
    const stats = ErrorHandlingService.getErrorStatistics();
    if (stats.totalErrors === 0) {
      throw new Error('Error not added to statistics');
    }
  };

  const testHookIntegration = async () => {
    // Test that the hook properly handles errors
    const testError = new Error('Hook integration test error');
    
    handleError(testError);

    if (!error) {
      throw new Error('Hook did not capture error');
    }

    if (error.type !== FaceVerificationErrorType.UNKNOWN_ERROR) {
      throw new Error('Hook did not map error correctly');
    }

    // Test clearing error
    clearError();

    if (error !== null) {
      throw new Error('Hook did not clear error');
    }
  };

  const testFallbackMechanism = async () => {
    const criticalError = ErrorHandlingService.createError(
      FaceVerificationErrorType.CAMERA_NOT_AVAILABLE,
      new Error('Camera hardware failure')
    );

    const shouldFallback = ErrorHandlingService.shouldUseFallback(criticalError, 1);
    if (!shouldFallback) {
      throw new Error('Should use fallback for critical camera error');
    }

    const retryableError = ErrorHandlingService.createError(
      FaceVerificationErrorType.POOR_LIGHTING,
      new Error('Poor lighting conditions')
    );

    const shouldNotFallback = ErrorHandlingService.shouldUseFallback(retryableError, 1);
    if (shouldNotFallback) {
      throw new Error('Should not use fallback for lighting error on first attempt');
    }
  };

  const testErrorFormatting = async () => {
    const error = ErrorHandlingService.createError(
      FaceVerificationErrorType.CAMERA_PERMISSION_DENIED,
      new Error('Camera permission denied')
    );
    
    const formatted = ErrorHandlingService.formatErrorForUser(error);

    // Check if formatted is an object (detailed format) or string (simple format)
    if (typeof formatted === 'string') {
      if (!formatted) {
        throw new Error('Error not formatted properly for user display');
      }
    } else {
      // Object format
      if (!formatted.title || !formatted.message || !formatted.suggestions.length) {
        throw new Error('Error not formatted properly for user display');
      }

      if (!formatted.actions.length) {
        throw new Error('No recovery actions in formatted error');
      }
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    clearError();

    const tests = [
      { name: 'Error Creation', fn: testErrorCreation },
      { name: 'Error Mapping', fn: testErrorMapping },
      { name: 'Retry Logic', fn: testRetryLogic },
      { name: 'Recovery Actions', fn: testRecoveryActions },
      { name: 'Error Reporting', fn: testErrorReporting },
      { name: 'Hook Integration', fn: testHookIntegration },
      { name: 'Fallback Mechanism', fn: testFallbackMechanism },
      { name: 'Error Formatting', fn: testErrorFormatting }
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await runTest(test.name, test.fn);
      results.push(result);
      setTestResults([...results]);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setCurrentTest('');
    setIsRunning(false);

    // Show summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    Alert.alert(
      'Test Results',
      `${passed}/${total} tests passed\n\nTotal duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`,
      [{ text: 'OK' }]
    );
  };

  const testSpecificError = (errorType: FaceVerificationErrorType) => {
    const error = ErrorHandlingService.createError(errorType, new Error(`Test ${errorType}`));
    handleError(error);
  };

  const renderTestResult = (result: TestResult, index: number) => (
    <View
      key={index}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: currentColors.surface,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: result.passed ? currentColors.success : currentColors.error
      }}
    >
      <Ionicons
        name={result.passed ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={result.passed ? currentColors.success : currentColors.error}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{
          color: currentColors.text,
          fontSize: 14,
          fontWeight: '600'
        }}>
          {result.testName}
        </Text>
        <Text style={{
          color: currentColors.text,
          fontSize: 12,
          opacity: 0.7
        }}>
          {result.duration}ms
        </Text>
        {result.error && (
          <Text style={{
            color: currentColors.error,
            fontSize: 12,
            marginTop: 4
          }}>
            {result.error}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView style={{
      flex: 1,
      backgroundColor: currentColors.background,
      padding: 16
    }}>
      <Text style={{
        fontSize: 24,
        fontWeight: 'bold',
        color: currentColors.text,
        marginBottom: 16,
        textAlign: 'center'
      }}>
        Error Handling Integration Test
      </Text>

      {/* Test Controls */}
      <View style={{
        backgroundColor: currentColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16
      }}>
        <TouchableOpacity
          onPress={runAllTests}
          disabled={isRunning}
          style={{
            backgroundColor: currentColors.success,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            alignItems: 'center',
            marginBottom: 12,
            opacity: isRunning ? 0.6 : 1
          }}
        >
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: '600'
          }}>
            {isRunning ? `Running: ${currentTest}` : 'Run All Tests'}
          </Text>
        </TouchableOpacity>

        <Text style={{
          color: currentColors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8
        }}>
          Test Specific Errors:
        </Text>

        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8
        }}>
          {[
            FaceVerificationErrorType.CAMERA_PERMISSION_DENIED,
            FaceVerificationErrorType.NO_FACE_DETECTED,
            FaceVerificationErrorType.POOR_LIGHTING,
            FaceVerificationErrorType.NETWORK_ERROR,
            FaceVerificationErrorType.VERIFICATION_FAILED
          ].map((errorType) => (
            <TouchableOpacity
              key={errorType}
              onPress={() => testSpecificError(errorType)}
              style={{
                backgroundColor: currentColors.warning,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 6
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 12,
                fontWeight: '500'
              }}>
                {errorType.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          isRetrying={isRetrying}
          recoveryActions={recoveryActions}
          onRetry={canRetry() ? retry : undefined}
          onDismiss={clearError}
          onRecoveryAction={executeRecoveryAction}
          showDetails={true}
        />
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={{
          backgroundColor: currentColors.surface,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16
        }}>
          <Text style={{
            color: currentColors.text,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 12
          }}>
            Test Results ({testResults.filter(r => r.passed).length}/{testResults.length} passed)
          </Text>

          {testResults.map(renderTestResult)}
        </View>
      )}

      {/* Error Statistics */}
      <TouchableOpacity
        onPress={() => {
          const stats = ErrorHandlingService.getErrorStatistics();
          Alert.alert(
            'Error Statistics',
            `Total Errors: ${stats.totalErrors}\n\nBy Type:\n${Object.entries(stats.errorsByType).map(([type, count]) => `${type}: ${count}`).join('\n')}\n\nBy Severity:\n${Object.entries(stats.errorsBySeverity).map(([severity, count]) => `${severity}: ${count}`).join('\n')}`,
            [
              { text: 'Clear History', onPress: () => ErrorHandlingService.clearErrorHistory() },
              { text: 'OK' }
            ]
          );
        }}
        style={{
          backgroundColor: currentColors.surface,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center'
        }}
      >
        <Text style={{
          color: currentColors.text,
          fontSize: 16,
          fontWeight: '600'
        }}>
          View Error Statistics
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default ErrorHandlingIntegrationTest;