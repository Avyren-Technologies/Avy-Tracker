import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  AccessibilityInfo,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";

const { width, height } = Dimensions.get("window");

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tips: string[];
  voiceInstructions: string;
  duration?: number; // Expected duration in seconds
}

interface VerificationTutorialProps {
  visible: boolean;
  mode: "register" | "verify";
  onComplete: () => void;
  onSkip: () => void;
  enableVoiceGuidance?: boolean;
  autoAdvance?: boolean;
}

/**
 * Verification Tutorial Component
 *
 * Provides step-by-step tutorial for face verification process.
 * Includes accessibility features and voice guidance for visually impaired users.
 *
 * Requirements addressed:
 * - 1.7: Step-by-step verification tutorials
 * - 6.3: User guidance and help features
 * - Accessibility features for visually impaired users
 */
export default function VerificationTutorial({
  visible,
  mode,
  onComplete,
  onSkip,
  enableVoiceGuidance = true,
  autoAdvance = false,
}: VerificationTutorialProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const successColor = useThemeColor("#10b981", "#34d399");
  const warningColor = useThemeColor("#f59e0b", "#fbbf24");

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(width));
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  /**
   * Tutorial steps for face registration
   */
  const registrationSteps: TutorialStep[] = [
    {
      id: "welcome",
      title: "Welcome to Face Registration",
      description:
        "We'll help you set up face verification for secure shift operations. This process takes about 2-3 minutes.",
      icon: "person-add",
      tips: [
        "Find a well-lit area",
        "Remove glasses if possible",
        "Ensure your face is clearly visible",
      ],
      voiceInstructions:
        "Welcome to face registration. We will guide you through setting up face verification for secure shift operations.",
      duration: 30,
    },
    {
      id: "positioning",
      title: "Position Your Face",
      description:
        "Center your face in the frame. Keep your head straight and look directly at the camera.",
      icon: "scan",
      tips: [
        "Hold the device at eye level",
        "Keep your face centered in the oval",
        "Maintain a neutral expression",
        "Stay within arm's length of the camera",
      ],
      voiceInstructions:
        "Position your face in the center of the frame. Hold the device at eye level and look directly at the camera.",
      duration: 45,
    },
    {
      id: "lighting",
      title: "Check Lighting Conditions",
      description:
        "Good lighting is essential for accurate face detection. Avoid shadows and backlighting.",
      icon: "sunny",
      tips: [
        "Face a window or light source",
        "Avoid shadows on your face",
        "Turn on room lights if needed",
        "Avoid bright lights behind you",
      ],
      voiceInstructions:
        "Ensure good lighting conditions. Face a light source and avoid shadows on your face.",
      duration: 30,
    },
    {
      id: "liveness",
      title: "Liveness Detection",
      description:
        "We'll ask you to blink naturally to verify you're a real person, not a photo.",
      icon: "eye",
      tips: [
        "Blink naturally when prompted",
        "Don't force or exaggerate blinks",
        "Keep looking at the camera",
        "Stay still during detection",
      ],
      voiceInstructions:
        "When prompted, blink naturally to verify liveness. Keep looking at the camera and stay still.",
      duration: 60,
    },
    {
      id: "capture",
      title: "Photo Capture",
      description:
        "Once everything looks good, we'll automatically capture your photo for registration.",
      icon: "camera",
      tips: [
        "Hold still when capturing",
        "Maintain your position",
        "Don't move until capture is complete",
        "The photo will be taken automatically",
      ],
      voiceInstructions:
        "Hold still while we capture your photo. The photo will be taken automatically when conditions are optimal.",
      duration: 15,
    },
    {
      id: "completion",
      title: "Registration Complete",
      description:
        "Your face profile has been registered successfully. You can now use face verification for shift operations.",
      icon: "checkmark-circle",
      tips: [
        "Your face data is encrypted and secure",
        "You can update your profile anytime",
        "Face verification will be required for shifts",
      ],
      voiceInstructions:
        "Registration complete. Your face profile has been registered successfully and securely.",
      duration: 20,
    },
  ];

  /**
   * Tutorial steps for face verification
   */
  const verificationSteps: TutorialStep[] = [
    {
      id: "welcome",
      title: "Face Verification",
      description:
        "We'll verify your identity using your registered face profile. This process is quick and secure.",
      icon: "shield-checkmark",
      tips: [
        "Use the same lighting conditions as registration",
        "Position your face as you did during registration",
        "The process takes about 30 seconds",
      ],
      voiceInstructions:
        "Starting face verification. We will verify your identity using your registered face profile.",
      duration: 20,
    },
    {
      id: "positioning",
      title: "Position Your Face",
      description:
        "Center your face in the frame, just like during registration.",
      icon: "scan",
      tips: [
        "Use the same position as registration",
        "Keep your face centered",
        "Look directly at the camera",
        "Hold the device steady",
      ],
      voiceInstructions:
        "Position your face in the center of the frame, similar to your registration.",
      duration: 30,
    },
    {
      id: "liveness",
      title: "Liveness Check",
      description: "Blink naturally when prompted to verify you're present.",
      icon: "eye",
      tips: [
        "Blink naturally when asked",
        "Keep your eyes open most of the time",
        "Don't cover your face",
        "Stay still during detection",
      ],
      voiceInstructions:
        "Blink naturally when prompted for liveness verification.",
      duration: 45,
    },
    {
      id: "verification",
      title: "Verifying Identity",
      description:
        "We're comparing your face with the registered profile. Please hold still.",
      icon: "sync",
      tips: [
        "Hold your position steady",
        "Don't move until verification completes",
        "Keep looking at the camera",
        "Verification usually takes 5-10 seconds",
      ],
      voiceInstructions:
        "Verifying your identity. Please hold still while we compare your face with the registered profile.",
      duration: 15,
    },
    {
      id: "completion",
      title: "Verification Complete",
      description:
        "Identity verified successfully. You can now proceed with your shift operation.",
      icon: "checkmark-circle",
      tips: [
        "Verification was successful",
        "You can now start or end your shift",
        "Your identity has been confirmed",
      ],
      voiceInstructions:
        "Verification complete. Your identity has been confirmed successfully.",
      duration: 15,
    },
  ];

  const steps = mode === "register" ? registrationSteps : verificationSteps;

  /**
   * Announce step to screen readers
   */
  const announceStep = useCallback(
    (step: TutorialStep) => {
      if (Platform.OS === "ios" && enableVoiceGuidance) {
        const announcement = `Step ${currentStep + 1} of ${steps.length}. ${step.title}. ${step.voiceInstructions}`;
        AccessibilityInfo.announceForAccessibility(announcement);
      }
    },
    [enableVoiceGuidance, currentStep, steps.length],
  );

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onComplete]);

  /**
   * Go to previous step
   */
  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  /**
   * Skip tutorial
   */
  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  /**
   * Start tutorial playback
   */
  const startPlayback = useCallback(() => {
    setIsPlaying(true);

    if (autoAdvance) {
      const step = steps[currentStep];
      const duration = step.duration || 30;

      setTimeout(() => {
        if (currentStep < steps.length - 1) {
          nextStep();
        } else {
          setIsPlaying(false);
          onComplete();
        }
      }, duration * 1000);
    }
  }, [autoAdvance, currentStep, steps, nextStep, onComplete]);

  /**
   * Pause tutorial playback
   */
  const pausePlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  /**
   * Fade in animation
   */
  const fadeIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  /**
   * Slide to next step animation
   */
  const slideToNext = useCallback(() => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim]);

  // Handle step changes
  useEffect(() => {
    if (visible && steps[currentStep]) {
      announceStep(steps[currentStep]);
      slideToNext();
    }
  }, [currentStep, visible, announceStep, slideToNext, steps]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      fadeIn();
    }
  }, [visible, fadeIn]);

  if (!visible) {
    return null;
  }

  const currentStepData = steps[currentStep];

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="pageSheet"
      onRequestClose={handleSkip}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor,
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.skipButton}
            accessibilityLabel="Skip tutorial"
            accessibilityHint="Skip the tutorial and proceed directly"
          >
            <Text style={[styles.skipText, { color: primaryColor }]}>Skip</Text>
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: textColor }]}>
            {mode === "register"
              ? "Face Registration Tutorial"
              : "Face Verification Tutorial"}
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                  backgroundColor: primaryColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: textColor }]}>
            {currentStep + 1} of {steps.length}
          </Text>
        </View>

        {/* Step Content */}
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Step Icon */}
            <View
              style={[styles.iconContainer, { backgroundColor: primaryColor }]}
            >
              <Ionicons name={currentStepData.icon} size={48} color="#ffffff" />
            </View>

            {/* Step Title */}
            <Text
              style={[styles.stepTitle, { color: textColor }]}
              accessibilityRole="header"
            >
              {currentStepData.title}
            </Text>

            {/* Step Description */}
            <Text
              style={[styles.stepDescription, { color: textColor }]}
              accessibilityRole="text"
            >
              {currentStepData.description}
            </Text>

            {/* Tips */}
            <View style={styles.tipsContainer}>
              <Text style={[styles.tipsTitle, { color: textColor }]}>
                💡 Tips:
              </Text>
              {currentStepData.tips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={successColor}
                    style={styles.tipIcon}
                  />
                  <Text
                    style={[styles.tipText, { color: textColor }]}
                    accessibilityRole="text"
                  >
                    {tip}
                  </Text>
                </View>
              ))}
            </View>

            {/* Duration Indicator */}
            {currentStepData.duration && (
              <View style={styles.durationContainer}>
                <Ionicons
                  name="time"
                  size={16}
                  color={warningColor}
                  style={styles.durationIcon}
                />
                <Text style={[styles.durationText, { color: textColor }]}>
                  Expected duration: {currentStepData.duration} seconds
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        {/* Navigation Controls */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            onPress={previousStep}
            disabled={currentStep === 0}
            style={[
              styles.navButton,
              styles.prevButton,
              {
                opacity: currentStep === 0 ? 0.3 : 1,
                backgroundColor: "rgba(0,0,0,0.1)",
              },
            ]}
            accessibilityLabel="Previous step"
            accessibilityHint="Go to the previous tutorial step"
          >
            <Ionicons name="chevron-back" size={20} color={textColor} />
            <Text style={[styles.navButtonText, { color: textColor }]}>
              Previous
            </Text>
          </TouchableOpacity>

          {/* Playback Controls */}
          {autoAdvance && (
            <TouchableOpacity
              onPress={isPlaying ? pausePlayback : startPlayback}
              style={[styles.playButton, { backgroundColor: primaryColor }]}
              accessibilityLabel={
                isPlaying ? "Pause tutorial" : "Play tutorial"
              }
              accessibilityHint={
                isPlaying
                  ? "Pause automatic progression"
                  : "Start automatic progression"
              }
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#ffffff"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={nextStep}
            style={[
              styles.navButton,
              styles.nextButton,
              { backgroundColor: primaryColor },
            ]}
            accessibilityLabel={
              currentStep === steps.length - 1
                ? "Complete tutorial"
                : "Next step"
            }
            accessibilityHint={
              currentStep === steps.length - 1
                ? "Complete the tutorial"
                : "Go to the next tutorial step"
            }
          >
            <Text style={[styles.navButtonText, { color: "#ffffff" }]}>
              {currentStep === steps.length - 1 ? "Complete" : "Next"}
            </Text>
            <Ionicons
              name={
                currentStep === steps.length - 1
                  ? "checkmark"
                  : "chevron-forward"
              }
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSpacer: {
    width: 60,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 60,
    textAlign: "right",
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 32,
  },
  stepDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.8,
  },
  tipsContainer: {
    marginBottom: 24,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  durationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
  },
  durationIcon: {
    marginRight: 8,
  },
  durationText: {
    fontSize: 14,
    fontWeight: "500",
  },
  navigationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    justifyContent: "center",
  },
  prevButton: {
    flex: 1,
    marginRight: 10,
  },
  nextButton: {
    flex: 1,
    marginLeft: 10,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 8,
  },
});
