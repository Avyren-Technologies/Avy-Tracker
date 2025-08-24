import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { useAuth } from '../context/AuthContext';
import FaceVerificationModal from '../components/FaceVerificationModal';
import { FaceVerificationResult, FaceVerificationError } from '../types/faceDetection';
import { useFaceDetection } from '../hooks/useFaceDetection';
import axios from 'axios';
import Constants from 'expo-constants';



interface RegistrationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

/**
 * Face Registration Screen
 * 
 * Provides a comprehensive face registration workflow for new employees.
 * Includes consent capture, multi-step registration process, and success handling.
 * 
 * Requirements addressed:
 * - 2.1: Face registration requirement for new employees
 * - 2.2: Multi-angle face capture workflow
 * - 2.3: Secure storage of encrypted face encodings
 * - 8.5: Consent capture for biometric data
 */
export default function FaceRegistration() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { token } = useAuth();

  // Face detection hook
  // const { device } = useFaceDetection({
  //   performanceMode: 'fast',
  //   enableLivenessDetection: true,
  //   qualityThreshold: 0.7,
  // });

  // Theme colors
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#1f2937', '#f8fafc');
  const primaryColor = useThemeColor('#3b82f6', '#60a5fa');
  const successColor = useThemeColor('#10b981', '#34d399');
  const borderColor = useThemeColor('#e5e7eb', '#374151');
  const cardColor = useThemeColor('#ffffff', '#1e293b');

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [registrationData, setRegistrationData] = useState<FaceVerificationResult | null>(null);
  const [captureStep, setCaptureStep] = useState(0);
  const [capturedAngles, setCapturedAngles] = useState<FaceVerificationResult[]>([]);

  // Multi-angle capture configuration
  const captureAngles = [
    { name: 'Front View', description: 'Look directly at the camera', icon: 'person' },
    { name: 'Slight Left', description: 'Turn your head slightly to the left', icon: 'arrow-back' },
    { name: 'Slight Right', description: 'Turn your head slightly to the right', icon: 'arrow-forward' },
  ];

  // Registration steps
  const registrationSteps: RegistrationStep[] = [
    {
      id: 0,
      title: 'Privacy Consent',
      description: 'Review and accept biometric data usage terms',
      completed: consentGiven,
    },
    {
      id: 1,
      title: 'Face Registration',
      description: 'Capture your face profile for verification',
      completed: capturedAngles.length === captureAngles.length,
    },
    {
      id: 2,
      title: 'Verification Test',
      description: 'Test your face verification setup',
      completed: registrationComplete,
    },
  ];

  // Check if user already has face registration
  useEffect(() => {
    checkExistingRegistration();
  }, []);

  const checkExistingRegistration = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.isRegistered) {
        // User already registered, redirect to dashboard
        Alert.alert(
          'Already Registered',
          'You have already completed face registration. Redirecting to dashboard.',
          [{ text: 'OK', onPress: () => router.replace('/(dashboard)' as any) }]
        );
      }
    } catch (error) {
      console.error('Error checking registration status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setCurrentStep(1);
  };

  const handleFaceRegistrationTest = () => {
    router.push('/(testing)/face-registration-test');
  }

  const handlecameraLivenessTest = () => {
    router.push('/(testing)/camera-liveness-test');
  }

  const checkFaceDetectionBug = () => {
    router.push('/(testing)/face-detection-debug');
  }

  const checkFaceVerificationTest = () => {
    router.push('/(testing)/face-verification-test');
  }

  const checkFinalTest = () => {
    router.push('/(testing)/final-face-test');
  }


  const handleFaceRegistrationSuccess = async (result: FaceVerificationResult) => {
    console.log('Face registration successful for angle:', captureStep, result);

    // Add this capture to our collection
    const newCapturedAngles = [...capturedAngles, result];
    setCapturedAngles(newCapturedAngles);
    setShowFaceModal(false);

    // Check if we've captured all required angles
    if (newCapturedAngles.length < captureAngles.length) {
      // Move to next angle
      const nextStep = captureStep + 1;
      setCaptureStep(nextStep);

      Alert.alert(
        'Capture Complete',
        `${captureAngles[captureStep].name} captured successfully!\n\nNext: ${captureAngles[nextStep].name}`,
        [{ text: 'Continue', onPress: () => setShowFaceModal(true) }]
      );
    } else {
      // All angles captured, process registration
      await processMultiAngleRegistration(newCapturedAngles);
    }
  };

  const processMultiAngleRegistration = async (angles: FaceVerificationResult[]) => {
    try {
      setIsLoading(true);

      // Combine all face encodings for better accuracy
      const combinedResult: FaceVerificationResult = {
        success: true,
        confidence: angles.reduce((sum, angle) => sum + (angle.confidence || 0), 0) / angles.length,
        livenessDetected: angles.every(angle => angle.livenessDetected),
        faceEncoding: angles.map(angle => angle.faceEncoding).join('|'), // Combine encodings
        timestamp: new Date(),
      };

      // Send to backend for registration
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/register`,
        {
          faceEncodings: angles.map(angle => angle.faceEncoding),
          confidence: combinedResult.confidence,
          captureAngles: captureAngles.length,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRegistrationData(combinedResult);
      setCurrentStep(2);

      Alert.alert(
        'Registration Complete!',
        `All ${captureAngles.length} face angles captured successfully with ${Math.round((combinedResult.confidence || 0) * 100)}% average confidence.\n\nLet's test the verification.`,
        [{ text: 'Test Verification', onPress: () => testVerification() }]
      );
    } catch (error) {
      console.error('Error processing multi-angle registration:', error);
      Alert.alert(
        'Registration Error',
        'Failed to complete face registration. Please try again.',
        [
          {
            text: 'Retry', onPress: () => {
              setCapturedAngles([]);
              setCaptureStep(0);
              setCurrentStep(1);
            }
          },
          { text: 'Cancel', onPress: () => router.back() }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceRegistrationError = (error: FaceVerificationError) => {
    console.error('Face registration failed:', error);
    setShowFaceModal(false);

    const currentAngle = captureAngles[captureStep];
    Alert.alert(
      'Capture Failed',
      `Failed to capture ${currentAngle?.name}: ${error.message}\n\nWould you like to try again?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
        { text: 'Retry', onPress: () => setShowFaceModal(true) },
        { text: 'Start Over', onPress: resetRegistration },
      ]
    );
  };

  const resetRegistration = () => {
    setCapturedAngles([]);
    setCaptureStep(0);
    setRegistrationData(null);
    setRegistrationComplete(false);
    setCurrentStep(1);
  };

  const testVerification = () => {
    // Start verification test
    setShowFaceModal(true);
  };

  const handleVerificationTestSuccess = (result: FaceVerificationResult) => {
    console.log('Verification test successful:', result);
    setShowFaceModal(false);
    setRegistrationComplete(true);

    Alert.alert(
      'Setup Complete!',
      'Face verification has been set up successfully. You can now use face verification for shift operations.',
      [{ text: 'Get Started', onPress: () => router.replace('/(dashboard)' as any) }]
    );
  };

  const handleVerificationTestError = (error: FaceVerificationError) => {
    console.error('Verification test failed:', error);
    setShowFaceModal(false);

    Alert.alert(
      'Verification Test Failed',
      `The verification test failed: ${error.message}\n\nYou may need to re-register your face.`,
      [
        { text: 'Skip for Now', onPress: () => router.replace('/(dashboard)' as any) },
        {
          text: 'Re-register', onPress: () => {
            setRegistrationData(null);
            setCurrentStep(1);
          }
        },
      ]
    );
  };

  const renderConsentStep = () => (
    <ScrollView className="flex-1 p-6" style={{ paddingTop: Constants.statusBarHeight }}>
      <View className="items-center mb-8">
        <View className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: primaryColor }}>
          <Ionicons name="shield-checkmark" size={40} color="white" />
        </View>
        <Text className={`text-2xl font-bold text-center`} style={{ color: textColor }}>
          Biometric Data Consent
        </Text>
      </View>

      <View className={`p-4 rounded-lg mb-6`} style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}>
        <Text className={`text-lg font-semibold mb-3`} style={{ color: textColor }}>
          How We Use Your Face Data
        </Text>

        <View className="mb-4">
          <Text className={`text-base mb-2`} style={{ color: textColor }}>
            • Your face data is used only for secure shift verification
          </Text>
          <Text className={`text-base mb-2`} style={{ color: textColor }}>
            • Face images are processed locally and never stored
          </Text>
          <Text className={`text-base mb-2`} style={{ color: textColor }}>
            • Only encrypted face encodings are saved securely
          </Text>
          <Text className={`text-base mb-2`} style={{ color: textColor }}>
            • You can delete your face data at any time
          </Text>
          <Text className={`text-base mb-2`} style={{ color: textColor }}>
            • Data is never shared with third parties
          </Text>
        </View>

        <View className={`p-3 rounded-lg`} style={{ backgroundColor: primaryColor + '20' }}>
          <Text className={`text-sm font-medium`} style={{ color: primaryColor }}>
            Your privacy is our priority. Face verification enhances security while protecting your personal data.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleConsentAccept}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          I Accept - Continue Registration
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleFaceRegistrationTest}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Test Face Registration First
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handlecameraLivenessTest}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Test Camera Liveness Test
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={checkFaceDetectionBug}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Check Face Detection Bug (Debug)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={checkFaceVerificationTest}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Check Face Verification Test
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={checkFinalTest}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: primaryColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Check Face Verification Final Test
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text className={`text-center font-medium`} style={{ color: textColor }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRegistrationStep = () => (
    <ScrollView className="flex-1 p-6" style={{ paddingTop: Constants.statusBarHeight }}>
      <View className="items-center mb-8">
        <View className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: primaryColor }}>
          <Ionicons name="camera" size={40} color="white" />
        </View>
        <Text className={`text-2xl font-bold text-center mb-2`} style={{ color: textColor }}>
          Register Your Face
        </Text>
        <Text className={`text-base text-center`} style={{ color: textColor }}>
          We'll capture multiple angles for better accuracy
        </Text>
      </View>

      {/* Multi-angle progress */}
      <View className={`p-4 rounded-lg mb-6`} style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}>
        <Text className={`text-lg font-semibold mb-3`} style={{ color: textColor }}>
          Capture Progress ({capturedAngles.length}/{captureAngles.length})
        </Text>

        {captureAngles.map((angle, index) => (
          <View key={index} className="flex-row items-center mb-2">
            <View
              className={`w-6 h-6 rounded-full items-center justify-center mr-3`}
              style={{
                backgroundColor: capturedAngles.length > index
                  ? successColor
                  : captureStep === index
                    ? primaryColor
                    : borderColor
              }}
            >
              {capturedAngles.length > index ? (
                <Ionicons name="checkmark" size={14} color="white" />
              ) : (
                <Text className="text-white font-bold text-xs">{index + 1}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className={`font-medium`} style={{
                color: capturedAngles.length > index || captureStep === index ? textColor : borderColor
              }}>
                {angle.name}
              </Text>
              <Text className={`text-sm`} style={{
                color: capturedAngles.length > index || captureStep === index ? textColor : borderColor
              }}>
                {angle.description}
              </Text>
            </View>
            <Ionicons
              name={angle.icon as any}
              size={20}
              color={capturedAngles.length > index || captureStep === index ? primaryColor : borderColor}
            />
          </View>
        ))}
      </View>

      {/* Current capture instructions */}
      {captureStep < captureAngles.length && (
        <View className={`p-4 rounded-lg mb-6`} style={{ backgroundColor: primaryColor + '20', borderColor: primaryColor, borderWidth: 1 }}>
          <Text className={`text-lg font-semibold mb-2`} style={{ color: primaryColor }}>
            Next: {captureAngles[captureStep].name}
          </Text>
          <Text className={`text-base`} style={{ color: textColor }}>
            {captureAngles[captureStep].description}
          </Text>
        </View>
      )}

      {/* Registration tips */}
      <View className={`p-4 rounded-lg mb-6`} style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}>
        <Text className={`text-lg font-semibold mb-3`} style={{ color: textColor }}>
          Registration Tips
        </Text>

        <View className="space-y-2">
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color={successColor} />
            <Text className={`ml-2 text-base`} style={{ color: textColor }}>
              Ensure good lighting on your face
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color={successColor} />
            <Text className={`ml-2 text-base`} style={{ color: textColor }}>
              Follow the angle instructions carefully
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color={successColor} />
            <Text className={`ml-2 text-base`} style={{ color: textColor }}>
              Keep your face centered in the frame
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={20} color={successColor} />
            <Text className={`ml-2 text-base`} style={{ color: textColor }}>
              Blink when prompted for liveness detection
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => setShowFaceModal(true)}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: captureStep < captureAngles.length ? primaryColor : successColor }}
        disabled={capturedAngles.length === captureAngles.length}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {captureStep < captureAngles.length
            ? `Capture ${captureAngles[captureStep].name}`
            : 'All Angles Captured!'
          }
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setCurrentStep(0)}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text className={`text-center font-medium`} style={{ color: textColor }}>
          Back
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTestStep = () => (
    <ScrollView className="flex-1 p-6" style={{ paddingTop: Constants.statusBarHeight }}>
      <View className="items-center mb-8">
        <View className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: successColor }}>
          <Ionicons name="checkmark" size={40} color="white" />
        </View>
        <Text className={`text-2xl font-bold text-center mb-2`} style={{ color: textColor }}>
          Test Verification
        </Text>
        <Text className={`text-base text-center`} style={{ color: textColor }}>
          Let's test your face verification setup
        </Text>
      </View>

      <View className={`p-4 rounded-lg mb-6`} style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}>
        <Text className={`text-lg font-semibold mb-3`} style={{ color: textColor }}>
          Registration Complete!
        </Text>
        <Text className={`text-base mb-4`} style={{ color: textColor }}>
          Your face has been successfully registered. Now let's test the verification to ensure everything works correctly.
        </Text>

        {registrationData && (
          <View className={`p-3 rounded-lg`} style={{ backgroundColor: successColor + '20' }}>
            <Text className={`text-sm font-medium mb-2`} style={{ color: successColor }}>
              ✓ Face profile registered with {Math.round((registrationData.confidence || 0) * 100)}% confidence
            </Text>
            <Text className={`text-xs`} style={{ color: successColor }}>
              {capturedAngles.length} angles captured for enhanced accuracy
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={testVerification}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{ backgroundColor: successColor }}
      >
        <Text className="text-white text-center font-semibold text-lg">
          Test Face Verification
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace('/(dashboard)' as any)}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text className={`text-center font-medium`} style={{ color: textColor }}>
          Skip Test - Go to Dashboard
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderProgressIndicator = () => (
    <View className="px-6 py-4">
      <View className="flex-row justify-between items-center">
        {registrationSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            <View className="items-center flex-1">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mb-2`}
                style={{
                  backgroundColor: step.completed
                    ? successColor
                    : currentStep === index
                      ? primaryColor
                      : borderColor
                }}
              >
                {step.completed ? (
                  <Ionicons name="checkmark" size={16} color="white" />
                ) : (
                  <Text className="text-white font-bold text-sm">{index + 1}</Text>
                )}
              </View>
              <Text
                className={`text-xs text-center font-medium`}
                style={{
                  color: step.completed || currentStep === index ? textColor : borderColor
                }}
              >
                {step.title}
              </Text>
            </View>
            {index < registrationSteps.length - 1 && (
              <View
                className="h-0.5 flex-1 mx-2"
                style={{
                  backgroundColor: registrationSteps[index + 1].completed ? successColor : borderColor
                }}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className={`mt-4 text-lg text-center`} style={{ color: textColor }}>
            {capturedAngles.length > 0
              ? `Processing ${capturedAngles.length} face captures...`
              : 'Checking registration status...'
            }
          </Text>
          {capturedAngles.length > 0 && (
            <Text className={`mt-2 text-sm text-center`} style={{ color: textColor }}>
              Combining multiple angles for enhanced accuracy
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <Text className={`text-lg font-semibold`} style={{ color: textColor }}>
          Face Registration
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Content */}
      {currentStep === 0 && renderConsentStep()}
      {currentStep === 1 && renderRegistrationStep()}
      {currentStep === 2 && renderTestStep()}

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        mode={currentStep === 1 ? 'register' : 'verify'}
        onSuccess={currentStep === 1 ? handleFaceRegistrationSuccess : handleVerificationTestSuccess}
        onError={currentStep === 1 ? handleFaceRegistrationError : handleVerificationTestError}
        onCancel={() => setShowFaceModal(false)}
        title={currentStep === 1
          ? `Register: ${captureAngles[captureStep]?.name || 'Face'}`
          : 'Test Face Verification'
        }
        subtitle={currentStep === 1
          ? `${captureAngles[captureStep]?.description || 'Look at the camera'} and blink when prompted`
          : 'Look at the camera and blink to test your face verification setup'
        }
        maxRetries={3}
      />
    </SafeAreaView>
  );
}