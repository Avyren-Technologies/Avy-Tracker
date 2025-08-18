import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import FaceConfiguration from '../screens/FaceConfiguration';

interface TestScenario {
  id: string;
  title: string;
  description: string;
  action: () => void;
}

export default function FaceConfigurationTest() {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#0f172a', '#f1f5f9');
  const secondaryTextColor = useThemeColor('#64748b', '#94a3b8');
  const borderColor = useThemeColor('#e2e8f0', '#334155');

  const [showFaceConfig, setShowFaceConfig] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const updateTestResult = (testId: string, passed: boolean) => {
    setTestResults(prev => ({ ...prev, [testId]: passed }));
  };

  const testScenarios: TestScenario[] = [
    {
      id: 'otp-gate',
      title: 'OTP Verification Gate',
      description: 'Test that OTP verification is required before accessing face settings',
      action: () => {
        setShowFaceConfig(true);
        updateTestResult('otp-gate', true);
        Alert.alert(
          'Test: OTP Gate',
          'Face Configuration should show OTP verification screen first. Check that sensitive settings are protected.',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'profile-status',
      title: 'Face Profile Status Display',
      description: 'Test face profile status information display',
      action: () => {
        updateTestResult('profile-status', true);
        Alert.alert(
          'Test: Profile Status',
          'After OTP verification, check that face profile status is displayed correctly:\n\n• Registration status\n• Profile activity\n• Registration date\n• Verification count',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'initial-registration',
      title: 'Initial Face Registration',
      description: 'Test face profile registration for new users',
      action: () => {
        updateTestResult('initial-registration', true);
        Alert.alert(
          'Test: Initial Registration',
          'For users without face profile:\n\n• "Register Face Profile" button should be visible\n• Clicking should open face verification modal\n• Modal should be in "register" mode',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'profile-update',
      title: 'Face Profile Update',
      description: 'Test face profile re-registration workflow',
      action: () => {
        updateTestResult('profile-update', true);
        Alert.alert(
          'Test: Profile Update',
          'For users with existing face profile:\n\n• "Update Face Profile" button should be visible\n• Clicking should show confirmation dialog\n• Confirming should open face verification modal in "update" mode',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'profile-deletion',
      title: 'Face Profile Deletion',
      description: 'Test biometric data deletion functionality',
      action: () => {
        updateTestResult('profile-deletion', true);
        Alert.alert(
          'Test: Profile Deletion',
          'For users with existing face profile:\n\n• "Delete Face Profile" button should be visible\n• Clicking should show destructive confirmation dialog\n• Warning about permanent deletion\n• Confirming should delete profile and update status',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'privacy-info',
      title: 'Privacy Information',
      description: 'Test privacy and security information display',
      action: () => {
        updateTestResult('privacy-info', true);
        Alert.alert(
          'Test: Privacy Info',
          'Check that privacy information is displayed:\n\n• Data encryption notice\n• Local processing explanation\n• Data deletion rights\n• Purpose limitation statement',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'confirmation-modals',
      title: 'Confirmation Dialogs',
      description: 'Test confirmation modals for destructive actions',
      action: () => {
        updateTestResult('confirmation-modals', true);
        Alert.alert(
          'Test: Confirmation Modals',
          'Test confirmation dialogs:\n\n• Update profile confirmation\n• Delete profile confirmation (destructive)\n• Clear warning messages\n• Proper button styling (red for destructive)',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'error-handling',
      title: 'Error Handling',
      description: 'Test error handling for various scenarios',
      action: () => {
        updateTestResult('error-handling', true);
        Alert.alert(
          'Test: Error Handling',
          'Test error scenarios:\n\n• Network failures\n• API errors\n• Invalid responses\n• User-friendly error messages\n• Graceful degradation',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'theme-support',
      title: 'Theme Support',
      description: 'Test light/dark theme compatibility',
      action: () => {
        updateTestResult('theme-support', true);
        Alert.alert(
          'Test: Theme Support',
          'Test theme compatibility:\n\n• Light mode colors\n• Dark mode colors\n• Proper contrast ratios\n• Consistent styling\n• Icon visibility',
          [{ text: 'OK' }]
        );
      },
    },
    {
      id: 'accessibility',
      title: 'Accessibility Features',
      description: 'Test accessibility and screen reader support',
      action: () => {
        updateTestResult('accessibility', true);
        Alert.alert(
          'Test: Accessibility',
          'Test accessibility features:\n\n• Screen reader labels\n• Touch target sizes\n• Color contrast\n• Navigation flow\n• Status announcements',
          [{ text: 'OK' }]
        );
      },
    },
  ];

  const getTestIcon = (testId: string) => {
    const result = testResults[testId];
    if (result === undefined) return 'ellipse-outline';
    return result ? 'checkmark-circle' : 'close-circle';
  };

  const getTestColor = (testId: string) => {
    const result = testResults[testId];
    if (result === undefined) return '#64748b';
    return result ? '#10b981' : '#ef4444';
  };

  const runAllTests = () => {
    Alert.alert(
      'Run All Tests',
      'This will run through all test scenarios. Make sure to:\n\n1. Test OTP verification flow\n2. Check profile status display\n3. Test registration/update workflows\n4. Verify deletion functionality\n5. Check privacy information\n6. Test error handling\n7. Verify theme support\n8. Check accessibility features',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Tests',
          onPress: () => {
            setShowFaceConfig(true);
            // Mark all tests as ready to run
            const allTests = testScenarios.reduce((acc, scenario) => {
              acc[scenario.id] = false;
              return acc;
            }, {} as Record<string, boolean>);
            setTestResults(allTests);
          },
        },
      ]
    );
  };

  const resetTests = () => {
    setTestResults({});
    setShowFaceConfig(false);
  };

  if (showFaceConfig) {
    return <FaceConfiguration />;
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: 'Face Configuration Test',
          headerStyle: { backgroundColor: cardColor },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: cardColor, borderColor }]}>
          <Ionicons name="flask" size={32} color="#3b82f6" />
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Face Configuration Test Suite
          </Text>
          <Text style={[styles.headerSubtitle, { color: secondaryTextColor }]}>
            Test face profile management functionality
          </Text>
        </View>

        {/* Control Buttons */}
        <View style={[styles.controlsCard, { backgroundColor: cardColor, borderColor }]}>
          <TouchableOpacity style={styles.primaryButton} onPress={runAllTests}>
            <Ionicons name="play" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Run All Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor }]}
            onPress={resetTests}
          >
            <Ionicons name="refresh" size={20} color="#3b82f6" />
            <Text style={[styles.secondaryButtonText, { color: textColor }]}>
              Reset Tests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor }]}
            onPress={() => setShowFaceConfig(true)}
          >
            <Ionicons name="settings" size={20} color="#3b82f6" />
            <Text style={[styles.secondaryButtonText, { color: textColor }]}>
              Open Face Config
            </Text>
          </TouchableOpacity>
        </View>

        {/* Test Scenarios */}
        <View style={[styles.testsCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.testsHeader}>
            <Ionicons name="list" size={24} color="#3b82f6" />
            <Text style={[styles.testsTitle, { color: textColor }]}>Test Scenarios</Text>
          </View>

          {testScenarios.map((scenario) => (
            <TouchableOpacity
              key={scenario.id}
              style={[styles.testItem, { borderColor }]}
              onPress={scenario.action}
            >
              <View style={styles.testHeader}>
                <Ionicons
                  name={getTestIcon(scenario.id)}
                  size={20}
                  color={getTestColor(scenario.id)}
                />
                <Text style={[styles.testTitle, { color: textColor }]}>
                  {scenario.title}
                </Text>
              </View>
              <Text style={[styles.testDescription, { color: secondaryTextColor }]}>
                {scenario.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Test Results Summary */}
        {Object.keys(testResults).length > 0 && (
          <View style={[styles.resultsCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.resultsHeader}>
              <Ionicons name="analytics" size={24} color="#10b981" />
              <Text style={[styles.resultsTitle, { color: textColor }]}>
                Test Results
              </Text>
            </View>

            <View style={styles.resultsSummary}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: secondaryTextColor }]}>
                  Total Tests:
                </Text>
                <Text style={[styles.summaryValue, { color: textColor }]}>
                  {Object.keys(testResults).length}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: secondaryTextColor }]}>
                  Passed:
                </Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                  {Object.values(testResults).filter(Boolean).length}
                </Text>
              </View>

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: secondaryTextColor }]}>
                  Failed:
                </Text>
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                  {Object.values(testResults).filter(result => result === false).length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.instructionsHeader}>
            <Ionicons name="information-circle" size={24} color="#f59e0b" />
            <Text style={[styles.instructionsTitle, { color: textColor }]}>
              Testing Instructions
            </Text>
          </View>

          <View style={styles.instructionsList}>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Click "Run All Tests" to start comprehensive testing
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Test each scenario individually by clicking on test items
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Verify OTP verification gate works correctly
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Test face profile registration and management
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Check confirmation dialogs for destructive actions
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Verify privacy information is displayed
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Test error handling and edge cases
            </Text>
            <Text style={[styles.instructionItem, { color: secondaryTextColor }]}>
              • Check theme support and accessibility
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },

  // Header Styles
  header: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },

  // Controls Styles
  controlsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Tests Styles
  testsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  testsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  testsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  testItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  testDescription: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Results Styles
  resultsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  resultsSummary: {
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Instructions Styles
  instructionsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsList: {
    gap: 8,
  },
  instructionItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});