import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import { useAuth } from "../context/AuthContext";
import FaceVerificationModal from "../components/FaceVerificationModal";
import {
  FaceVerificationResult,
  FaceVerificationError,
} from "../types/faceDetection";
// import { useFaceDetection } from '../hooks/useFaceDetection';
import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

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
  const { user, token } = useAuth();

  // Face detection hook
  // const { device } = useFaceDetection({
  //   performanceMode: 'fast',
  //   enableLivenessDetection: true,
  //   qualityThreshold: 0.7,
  // });

  // Theme colors
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const successColor = useThemeColor("#10b981", "#34d399");
  const borderColor = useThemeColor("#e5e7eb", "#374151");
  const cardColor = useThemeColor("#ffffff", "#1e293b");

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [registrationData, setRegistrationData] =
    useState<FaceVerificationResult | null>(null);
  const [captureStep, setCaptureStep] = useState(0);
  const [capturedAngles, setCapturedAngles] = useState<
    FaceVerificationResult[]
  >([]);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [isModalTransitioning, setIsModalTransitioning] = useState(false);

  // Modal state for existing profile warning
  const [showExistingProfileModal, setShowExistingProfileModal] =
    useState(false);

  // CRITICAL: Component lifecycle management for multi-angle registration
  const isMountedRef = useRef(true);

  // Multi-angle capture configuration
  const captureAngles = [
    {
      name: "Front View",
      description: "Look directly at the camera",
      icon: "person",
    },
    {
      name: "Slight Left",
      description: "Turn your head slightly to the left",
      icon: "arrow-back",
    },
    {
      name: "Slight Right",
      description: "Turn your head slightly to the right",
      icon: "arrow-forward",
    },
  ];

  // Registration steps
  const registrationSteps: RegistrationStep[] = [
    {
      id: 0,
      title: "Privacy Consent",
      description: "Review and accept biometric data usage terms",
      completed: consentGiven,
    },
    {
      id: 1,
      title: "Face Registration",
      description: "Capture your face profile for verification",
      completed: capturedAngles.length === captureAngles.length,
    },
    {
      id: 2,
      title: "Verification Test",
      description: "Test your face verification setup",
      completed: registrationComplete,
    },
  ];

  const checkExistingRegistration = useCallback(async () => {
    // Don't make API call if token is null or user is not authenticated
    if (!token || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data?.isRegistered) {
        setHasExistingProfile(true);
        // User already registered, show modal with options
        setShowExistingProfileModal(true);
      }
    } catch (error) {
      console.error("Error checking registration status:", error);
      // If we can't check status, allow registration to proceed
      console.log("Proceeding with registration due to status check failure");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Check if user already has face registration
  useEffect(() => {
    checkExistingRegistration();
  }, [checkExistingRegistration]);

  // CRITICAL FIX: Prevent face modal from opening if user already has a profile
  useEffect(() => {
    if (hasExistingProfile && showFaceModal) {
      setShowFaceModal(false);
      Alert.alert(
        "Profile Already Exists",
        "You already have a face profile. Please use it for verification.",
        [{ text: "OK" }],
      );
    }
  }, [hasExistingProfile, showFaceModal]);

  // CRITICAL: Component cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setCurrentStep(1);
  };

  const routeToDashboard = () => {
    const userRole = user?.role;
    switch (userRole) {
      case "employee":
        router.replace("/(dashboard)/employee/employee");
        break;
      case "group-admin":
        router.replace("/(dashboard)/Group-Admin/group-admin");
        break;
      case "management":
        router.replace("/(dashboard)/management/management");
        break;
      case "super-admin":
        router.replace("/(dashboard)/super-admin/super-admin");
        break;
      default:
        console.error("Invalid user role:", userRole);
        break;
    }
  };

  const routeToFaceConfiguration = () => {
    router.push("/(dashboard)/employee/face-configuration");
  };

  const handleFaceRegistrationSuccess = async (
    result: FaceVerificationResult,
  ) => {
    console.log("Face registration successful for angle:", captureStep, result);

    // CRITICAL FIX: Prevent processing if user already has a profile
    if (hasExistingProfile) {
      Alert.alert(
        "Profile Already Exists",
        "You already have a face profile. Please use the existing profile for verification.",
        [{ text: "OK", onPress: () => setShowFaceModal(false) }],
      );
      return;
    }

    // Add this capture to our collection
    const newCapturedAngles = [...capturedAngles, result];
    setCapturedAngles(newCapturedAngles);

    // Close modal and reset transition state
    setShowFaceModal(false);
    setIsModalTransitioning(false);

    // Check if we've captured all required angles
    if (newCapturedAngles.length < captureAngles.length) {
      // Move to next angle
      const nextStep = captureStep + 1;
      setCaptureStep(nextStep);

      // FIXED: Add delay before opening next capture to ensure camera is ready
      Alert.alert(
        "Capture Complete",
        `${captureAngles[captureStep].name} captured successfully!\n\nNext: ${captureAngles[nextStep].name}`,
        [
          { text: "Continue Later", style: "cancel" },
          {
            text: "Continue Now",
            onPress: () => {
              // Add delay to ensure camera is properly reset before next capture
              setIsModalTransitioning(true);
              setTimeout(() => {
                setShowFaceModal(true);
                setIsModalTransitioning(false);
              }, 2000); // Increased from 1000ms to 2000ms for better camera stability
            },
          },
        ],
      );
    } else {
      // All angles captured, process registration
      await processMultiAngleRegistration(newCapturedAngles);
    }
  };

  const processMultiAngleRegistration = async (
    angles: FaceVerificationResult[],
  ) => {
    try {
      setIsLoading(true);

      // CRITICAL FIX: Check if user already has a face profile before attempting registration
      try {
        // Don't make API call if token is null or user is not authenticated
        if (!token || !user) {
          setIsLoading(false);
          return;
        }

        const statusResponse = await axios.get(
          `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (statusResponse.data.isRegistered) {
          // User already has a face profile - handle gracefully
          Alert.alert(
            "Face Profile Already Exists",
            "You already have a face profile registered. You can either:\n\n• Use your existing profile for verification\n• Update your existing profile with new data",
            [
              {
                text: "Use Existing Profile",
                onPress: () => {
                  setRegistrationData({
                    success: true,
                    confidence: 1.0,
                    livenessDetected: true,
                    faceEncoding: "existing_profile",
                    timestamp: new Date(),
                  });
                  setCurrentStep(2);
                },
              },
              {
                text: "Update Profile",
                onPress: () => {
                  // Proceed with registration to update existing profile
                  console.log("Proceeding with profile update...");
                },
              },
            ],
          );
          return;
        }
      } catch (statusError) {
        console.warn(
          "Could not check face profile status, proceeding with registration:",
          statusError,
        );
      }

      // Combine all face encodings for better accuracy
      const combinedResult: FaceVerificationResult = {
        success: true,
        confidence:
          angles.reduce((sum, angle) => sum + (angle.confidence || 0), 0) /
          angles.length,
        livenessDetected: angles.every((angle) => angle.livenessDetected),
        faceEncoding: angles.map((angle) => angle.faceEncoding).join("|"), // Combine encodings
        timestamp: new Date(),
      };

      // CRITICAL FIX: Backend expects faceEncoding to be a valid JSON array string
      const registrationData = {
        faceEncoding: JSON.stringify(angles.map((angle) => angle.faceEncoding)), // ✅ JSON array string
        consentGiven: true, // ✅ Required field
        qualityScore: combinedResult.confidence, // ✅ Correct field
        deviceInfo: {
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        },
      };

      // Send to backend for registration
      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/register`,
        registrationData, // ✅ Use the correctly formatted data
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // CRITICAL FIX: Update user's face_registered status in the database
      try {
        await axios.patch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/users/profile`,
          { face_registered: true },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        console.log("✅ User face_registered status updated successfully");
      } catch (updateError) {
        console.warn(
          "⚠️ Failed to update user face_registered status:",
          updateError,
        );
        // Don't fail the registration if this update fails
      }

      setRegistrationData(combinedResult);
      setCurrentStep(2);

      Alert.alert(
        "Registration Complete!",
        `All ${captureAngles.length} face angles captured successfully with ${Math.round((combinedResult.confidence || 0) * 100)}% average confidence.\n\nLet's test the verification.`,
        [{ text: "Test Verification", onPress: () => testVerification() }],
      );
    } catch (error: any) {
      console.error("Error processing multi-angle registration:", error);

      // Enhanced error logging
      if (error.response) {
        console.error("Backend error response:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      }

      // CRITICAL FIX: Handle specific error cases gracefully
      let errorMessage = "Failed to complete face registration.";
      let showRetry = true;

      if (error.response?.status === 409) {
        // Profile already exists - this shouldn't happen with our check above, but handle it gracefully
        errorMessage =
          "A face profile already exists for your account. Please contact support if you need to update it.";
        showRetry = false;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        "Registration Error",
        errorMessage,
        showRetry
          ? [
              {
                text: "OK",
                onPress: () => {
                  setShowFaceModal(true);
                },
              },
            ]
          : [
              {
                text: "OK",
                onPress: () => {
                  // Navigate back or to dashboard since we can't retry
                  router.back();
                },
              },
            ],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFaceRegistrationError = (error: FaceVerificationError) => {
    console.error("Face registration failed:", error);
    setShowFaceModal(false);

    const currentAngle = captureAngles[captureStep];

    // Check if it's a camera initialization error
    const isCameraError =
      error.message?.includes("camera") ||
      error.message?.includes("Camera") ||
      error.message?.includes("timeout") ||
      error.message?.includes("initialization");

    const errorMessage = isCameraError
      ? `Camera failed to initialize for ${currentAngle?.name}. This might be due to:\n\n• Camera permission issues\n• App backgrounding during capture\n• Device camera being used by another app\n\nPlease try again.`
      : `Failed to capture ${currentAngle?.name}: ${error.message}`;

    Alert.alert("Capture Failed", errorMessage, [
      { text: "Cancel", style: "cancel", onPress: () => router.back() },
      {
        text: "Retry",
        onPress: () => {
          // Add delay before retry to ensure camera is ready
          setIsModalTransitioning(true);
          setTimeout(() => {
            setShowFaceModal(true);
            setIsModalTransitioning(false);
          }, 3000); // Increased from 1500ms to 3000ms for better camera stability
        },
      },
      { text: "Start Over", onPress: resetRegistration },
    ]);
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
    console.log("Verification test successful:", result);
    setShowFaceModal(false);
    setRegistrationComplete(true);

    Alert.alert(
      "Setup Complete!",
      "Face verification has been set up successfully. You can now use face verification for shift operations.",
      [{ text: "Get Started", onPress: routeToDashboard }],
    );
  };

  const handleVerificationTestError = (error: FaceVerificationError) => {
    console.error("Verification test failed:", error);
    setShowFaceModal(false);

    Alert.alert(
      "Verification Test Failed",
      `The verification test failed: ${error.message}\n\nYou may need to re-register your face.`,
      [
        { text: "Skip for Now", onPress: routeToDashboard },
        {
          text: "Re-register",
          onPress: () => {
            setRegistrationData(null);
            setCurrentStep(1);
          },
        },
      ],
    );
  };

  const renderConsentStep = () => (
    <ScrollView
      className="flex-1 p-6"
      style={{ paddingTop: Constants.statusBarHeight }}
    >
      <View className="items-center mb-8">
        <View
          className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: primaryColor }}
        >
          <Ionicons name="shield-checkmark" size={40} color="white" />
        </View>
        <Text
          className={`text-2xl font-bold text-center`}
          style={{ color: textColor }}
        >
          Biometric Data Consent
        </Text>
      </View>

      <View
        className={`p-4 rounded-lg mb-6`}
        style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}
      >
        <Text
          className={`text-lg font-semibold mb-3`}
          style={{ color: textColor }}
        >
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

        <View
          className={`p-3 rounded-lg`}
          style={{ backgroundColor: primaryColor + "20" }}
        >
          <Text
            className={`text-sm font-medium`}
            style={{ color: primaryColor }}
          >
            Your privacy is our priority. Face verification enhances security
            while protecting your personal data.
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
        onPress={() => router.back()}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text
          className={`text-center font-medium`}
          style={{ color: textColor }}
        >
          Cancel
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderRegistrationStep = () => (
    <ScrollView
      className="flex-1 p-6"
      style={{ paddingTop: Constants.statusBarHeight }}
    >
      <View className="items-center mb-8">
        <View
          className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: primaryColor }}
        >
          <Ionicons name="camera" size={40} color="white" />
        </View>
        <Text
          className={`text-2xl font-bold text-center mb-2`}
          style={{ color: textColor }}
        >
          Register Your Face
        </Text>
        <Text className={`text-base text-center`} style={{ color: textColor }}>
          We'll capture multiple angles for better accuracy
        </Text>
      </View>

      {/* Multi-angle progress */}
      <View
        className={`p-4 rounded-lg mb-6`}
        style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}
      >
        <Text
          className={`text-lg font-semibold mb-3`}
          style={{ color: textColor }}
        >
          Capture Progress ({capturedAngles.length}/{captureAngles.length})
        </Text>

        {captureAngles.map((angle, index) => (
          <View key={index} className="flex-row items-center mb-2">
            <View
              className={`w-6 h-6 rounded-full items-center justify-center mr-3`}
              style={{
                backgroundColor:
                  capturedAngles.length > index
                    ? successColor
                    : captureStep === index
                      ? primaryColor
                      : borderColor,
              }}
            >
              {capturedAngles.length > index ? (
                <Ionicons name="checkmark" size={14} color="white" />
              ) : (
                <Text className="text-white font-bold text-xs">
                  {index + 1}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text
                className={`font-medium`}
                style={{
                  color:
                    capturedAngles.length > index || captureStep === index
                      ? textColor
                      : borderColor,
                }}
              >
                {angle.name}
              </Text>
              <Text
                className={`text-sm`}
                style={{
                  color:
                    capturedAngles.length > index || captureStep === index
                      ? textColor
                      : borderColor,
                }}
              >
                {angle.description}
              </Text>
            </View>
            <Ionicons
              name={angle.icon as any}
              size={20}
              color={
                capturedAngles.length > index || captureStep === index
                  ? primaryColor
                  : borderColor
              }
            />
          </View>
        ))}
      </View>

      {/* Current capture instructions */}
      {captureStep < captureAngles.length && (
        <View
          className={`p-4 rounded-lg mb-6`}
          style={{
            backgroundColor: primaryColor + "20",
            borderColor: primaryColor,
            borderWidth: 1,
          }}
        >
          <Text
            className={`text-lg font-semibold mb-2`}
            style={{ color: primaryColor }}
          >
            Next: {captureAngles[captureStep].name}
          </Text>
          <Text className={`text-base`} style={{ color: textColor }}>
            {captureAngles[captureStep].description}
          </Text>
        </View>
      )}

      {/* Registration tips */}
      <View
        className={`p-4 rounded-lg mb-6`}
        style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}
      >
        <Text
          className={`text-lg font-semibold mb-3`}
          style={{ color: textColor }}
        >
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
        onPress={() => {
          if (hasExistingProfile) {
            setShowExistingProfileModal(true);
            return;
          }
          if (!isModalTransitioning) {
            setShowFaceModal(true);
          }
        }}
        className={`py-4 px-6 rounded-lg mb-4`}
        style={{
          backgroundColor: hasExistingProfile
            ? borderColor
            : captureStep < captureAngles.length
              ? primaryColor
              : successColor,
        }}
        disabled={
          capturedAngles.length === captureAngles.length || isModalTransitioning
        }
      >
        <Text className="text-white text-center font-semibold text-lg">
          {isModalTransitioning
            ? "Preparing Camera..."
            : hasExistingProfile
              ? "Profile Already Exists - Click to Manage"
              : captureStep < captureAngles.length
                ? `Capture ${captureAngles[captureStep].name}`
                : "All Angles Captured!"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setCurrentStep(0)}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text
          className={`text-center font-medium`}
          style={{ color: textColor }}
        >
          Back
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTestStep = () => (
    <ScrollView
      className="flex-1 p-6"
      style={{ paddingTop: Constants.statusBarHeight }}
    >
      <View className="items-center mb-8">
        <View
          className={`w-20 h-20 rounded-full items-center justify-center mb-4`}
          style={{ backgroundColor: successColor }}
        >
          <Ionicons name="checkmark" size={40} color="white" />
        </View>
        <Text
          className={`text-2xl font-bold text-center mb-2`}
          style={{ color: textColor }}
        >
          Test Verification
        </Text>
        <Text className={`text-base text-center`} style={{ color: textColor }}>
          Let's test your face verification setup
        </Text>
      </View>

      <View
        className={`p-4 rounded-lg mb-6`}
        style={{ backgroundColor: cardColor, borderColor, borderWidth: 1 }}
      >
        <Text
          className={`text-lg font-semibold mb-3`}
          style={{ color: textColor }}
        >
          Registration Complete!
        </Text>
        <Text className={`text-base mb-4`} style={{ color: textColor }}>
          Your face has been successfully registered. Now let's test the
          verification to ensure everything works correctly.
        </Text>

        {registrationData && (
          <View
            className={`p-3 rounded-lg`}
            style={{ backgroundColor: successColor + "20" }}
          >
            <Text
              className={`text-sm font-medium mb-2`}
              style={{ color: successColor }}
            >
              ✓ Face profile registered with{" "}
              {Math.round((registrationData.confidence || 0) * 100)}% confidence
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
        onPress={routeToDashboard}
        className={`py-3 px-6 rounded-lg`}
        style={{ backgroundColor: borderColor }}
      >
        <Text
          className={`text-center font-medium`}
          style={{ color: textColor }}
        >
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
                      : borderColor,
                }}
              >
                {step.completed ? (
                  <Ionicons name="checkmark" size={16} color="white" />
                ) : (
                  <Text className="text-white font-bold text-sm">
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                className={`text-xs text-center font-medium`}
                style={{
                  color:
                    step.completed || currentStep === index
                      ? textColor
                      : borderColor,
                }}
              >
                {step.title}
              </Text>
            </View>
            {index < registrationSteps.length - 1 && (
              <View
                className="h-0.5 flex-1 mx-2"
                style={{
                  backgroundColor: registrationSteps[index + 1].completed
                    ? successColor
                    : borderColor,
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
          <Text
            className={`mt-4 text-lg text-center`}
            style={{ color: textColor }}
          >
            {capturedAngles.length > 0
              ? `Processing ${capturedAngles.length} face captures...`
              : "Checking registration status..."}
          </Text>
          {capturedAngles.length > 0 && (
            <Text
              className={`mt-2 text-sm text-center`}
              style={{ color: textColor }}
            >
              Combining multiple angles for enhanced accuracy
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor }}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

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

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Indicator */}
        {renderProgressIndicator()}

        {/* Content */}
        {currentStep === 0 && renderConsentStep()}
        {currentStep === 1 && renderRegistrationStep()}
        {currentStep === 2 && renderTestStep()}
      </ScrollView>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        key={`face-modal-${captureStep}-${showFaceModal}`} // Force re-mount for each capture
        visible={showFaceModal}
        mode={currentStep === 1 ? "register" : "verify"}
        onSuccess={
          currentStep === 1
            ? handleFaceRegistrationSuccess
            : handleVerificationTestSuccess
        }
        onError={
          currentStep === 1
            ? handleFaceRegistrationError
            : handleVerificationTestError
        }
        onCancel={() => {
          setShowFaceModal(false);
          setIsModalTransitioning(false);
        }}
        title={
          currentStep === 1
            ? `Register: ${captureAngles[captureStep]?.name || "Face"}`
            : "Test Face Verification"
        }
        subtitle={
          currentStep === 1
            ? `${captureAngles[captureStep]?.description || "Look at the camera"} and blink when prompted`
            : "Look at the camera and blink to test your face verification setup"
        }
        maxRetries={3}
      />

      {/* Existing Profile Warning Modal */}
      <Modal
        visible={showExistingProfileModal}
        transparent
        animationType="fade"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className={`m-5 p-6 rounded-xl ${
              colorScheme === "dark" ? "bg-gray-800" : "bg-white"
            } w-5/6`}
          >
            <View className="items-center mb-4">
              <View
                className={`w-16 h-16 rounded-full items-center justify-center mb-4`}
                style={{ backgroundColor: primaryColor }}
              >
                <Ionicons name="shield-checkmark" size={32} color="white" />
              </View>
              <Text
                className={`text-xl font-bold text-center mb-2`}
                style={{ color: textColor }}
              >
                Face Profile Already Exists
              </Text>
              <Text
                className={`text-base text-center`}
                style={{ color: textColor }}
              >
                You have already completed face registration. What would you
                like to do?
              </Text>
            </View>

            <View className="space-y-3">
              <TouchableOpacity
                onPress={() => {
                  setShowExistingProfileModal(false);
                  routeToFaceConfiguration();
                }}
                className={`py-3 px-4 rounded-lg`}
                style={{ backgroundColor: primaryColor }}
              >
                <Text className="text-white text-center font-semibold">
                  Manage Face Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowExistingProfileModal(false);
                  setRegistrationData({
                    success: true,
                    confidence: 1.0,
                    livenessDetected: true,
                    faceEncoding: "existing_profile",
                    timestamp: new Date(),
                  });
                  setCurrentStep(2); // Skip to verification test
                }}
                className={`py-3 px-4 rounded-lg`}
                style={{ backgroundColor: successColor }}
              >
                <Text className="text-white text-center font-semibold">
                  Test Verification
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowExistingProfileModal(false);
                  routeToDashboard();
                }}
                className={`py-3 px-4 rounded-lg`}
                style={{ backgroundColor: borderColor }}
              >
                <Text
                  className={`text-center font-medium`}
                  style={{ color: textColor }}
                >
                  Go to Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
