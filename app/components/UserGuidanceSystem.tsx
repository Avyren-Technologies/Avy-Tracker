import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  AccessibilityInfo,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import { FaceDetectionData, FaceQuality } from "../types/faceDetection";
import { FaceVerificationErrorType } from "../types/faceVerificationErrors";

// Import guidance components
import FacePositioningGuide from "./FacePositioningGuide";
import LightingConditionFeedback from "./LightingConditionFeedback";
import VerificationTutorial from "./VerificationTutorial";
import TroubleshootingGuide from "./TroubleshootingGuide";
import AccessibilityHelper from "./AccessibilityHelper";

interface UserGuidanceSystemProps {
  visible: boolean;
  mode: "register" | "verify";
  faceData: FaceDetectionData | null;
  faceQuality: FaceQuality | null;
  currentError?: FaceVerificationErrorType;
  onClose: () => void;
  onPositionCorrect?: () => void;
  enableVoiceGuidance?: boolean;
}

interface GuidanceState {
  showPositioningGuide: boolean;
  showLightingFeedback: boolean;
  showTutorial: boolean;
  showTroubleshooting: boolean;
  showAccessibilityHelper: boolean;
  tutorialCompleted: boolean;
  accessibilitySettings: any;
}

/**
 * User Guidance System Component
 *
 * Orchestrates all user guidance and help features for face verification.
 * Provides intelligent guidance based on current state and user needs.
 *
 * Requirements addressed:
 * - 1.7: User guidance and help features
 * - 6.3: Real-time feedback and progress indicators
 * - Accessibility features for visually impaired users
 */
export default function UserGuidanceSystem({
  visible,
  mode,
  faceData,
  faceQuality,
  currentError,
  onClose,
  onPositionCorrect,
  enableVoiceGuidance = true,
}: UserGuidanceSystemProps) {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const successColor = useThemeColor("#10b981", "#34d399");
  const warningColor = useThemeColor("#f59e0b", "#fbbf24");
  const errorColor = useThemeColor("#ef4444", "#f87171");

  const [guidanceState, setGuidanceState] = useState<GuidanceState>({
    showPositioningGuide: true,
    showLightingFeedback: true,
    showTutorial: false,
    showTroubleshooting: false,
    showAccessibilityHelper: false,
    tutorialCompleted: false,
    accessibilitySettings: {
      voiceGuidance: enableVoiceGuidance,
      hapticFeedback: true,
      highContrast: false,
      largeText: false,
      slowAnimations: false,
      screenReaderOptimized: false,
      audioDescriptions: true,
    },
  });

  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);

  /**
   * Check if screen reader is enabled
   */
  const checkScreenReaderStatus = useCallback(async () => {
    try {
      const isEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(isEnabled);

      if (isEnabled) {
        setGuidanceState((prev) => ({
          ...prev,
          accessibilitySettings: {
            ...prev.accessibilitySettings,
            screenReaderOptimized: true,
            voiceGuidance: true,
          },
        }));
      }
    } catch (error) {
      console.error("Error checking screen reader status:", error);
    }
  }, []);

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback(
    (message: string) => {
      if (
        Platform.OS === "ios" &&
        guidanceState.accessibilitySettings.voiceGuidance
      ) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [guidanceState.accessibilitySettings.voiceGuidance],
  );

  /**
   * Show tutorial
   */
  const showTutorial = useCallback(() => {
    setGuidanceState((prev) => ({ ...prev, showTutorial: true }));
    setShowMainMenu(false);
    announceToScreenReader(`Starting ${mode} tutorial`);
  }, [mode, announceToScreenReader]);

  /**
   * Show troubleshooting guide
   */
  const showTroubleshooting = useCallback(() => {
    setGuidanceState((prev) => ({ ...prev, showTroubleshooting: true }));
    setShowMainMenu(false);
    announceToScreenReader("Opening troubleshooting guide");
  }, [announceToScreenReader]);

  /**
   * Show accessibility helper
   */
  const showAccessibilityHelper = useCallback(() => {
    setGuidanceState((prev) => ({ ...prev, showAccessibilityHelper: true }));
    setShowMainMenu(false);
    announceToScreenReader("Opening accessibility settings");
  }, [announceToScreenReader]);

  /**
   * Toggle positioning guide
   */
  const togglePositioningGuide = useCallback(() => {
    setGuidanceState((prev) => ({
      ...prev,
      showPositioningGuide: !prev.showPositioningGuide,
    }));
    announceToScreenReader(
      guidanceState.showPositioningGuide
        ? "Positioning guide hidden"
        : "Positioning guide shown",
    );
  }, [guidanceState.showPositioningGuide, announceToScreenReader]);

  /**
   * Toggle lighting feedback
   */
  const toggleLightingFeedback = useCallback(() => {
    setGuidanceState((prev) => ({
      ...prev,
      showLightingFeedback: !prev.showLightingFeedback,
    }));
    announceToScreenReader(
      guidanceState.showLightingFeedback
        ? "Lighting feedback hidden"
        : "Lighting feedback shown",
    );
  }, [guidanceState.showLightingFeedback, announceToScreenReader]);

  /**
   * Handle tutorial completion
   */
  const handleTutorialComplete = useCallback(() => {
    setGuidanceState((prev) => ({
      ...prev,
      showTutorial: false,
      tutorialCompleted: true,
    }));
    announceToScreenReader("Tutorial completed successfully");
  }, [announceToScreenReader]);

  /**
   * Handle tutorial skip
   */
  const handleTutorialSkip = useCallback(() => {
    setGuidanceState((prev) => ({ ...prev, showTutorial: false }));
    announceToScreenReader("Tutorial skipped");
  }, [announceToScreenReader]);

  /**
   * Handle accessibility settings change
   */
  const handleAccessibilitySettingsChange = useCallback(
    (settings: any) => {
      setGuidanceState((prev) => ({
        ...prev,
        accessibilitySettings: settings,
      }));
      announceToScreenReader("Accessibility settings updated");
    },
    [announceToScreenReader],
  );

  /**
   * Get guidance priority based on current state
   */
  const getGuidancePriority = useCallback(() => {
    const priorities = [];

    // Error-based guidance has highest priority
    if (currentError) {
      priorities.push({
        type: "troubleshooting",
        priority: 10,
        message: "Troubleshooting needed",
        action: showTroubleshooting,
      });
    }

    // Poor lighting conditions
    if (faceQuality && faceQuality.lighting < 0.4) {
      priorities.push({
        type: "lighting",
        priority: 8,
        message: "Improve lighting conditions",
        action: () =>
          setGuidanceState((prev) => ({ ...prev, showLightingFeedback: true })),
      });
    }

    // Poor positioning
    if (faceQuality && faceQuality.size < 0.3) {
      priorities.push({
        type: "positioning",
        priority: 7,
        message: "Adjust face position",
        action: () =>
          setGuidanceState((prev) => ({ ...prev, showPositioningGuide: true })),
      });
    }

    // Tutorial for new users
    if (!guidanceState.tutorialCompleted) {
      priorities.push({
        type: "tutorial",
        priority: 5,
        message: "Learn how to use face verification",
        action: showTutorial,
      });
    }

    return priorities.sort((a, b) => b.priority - a.priority);
  }, [
    currentError,
    faceQuality,
    guidanceState.tutorialCompleted,
    showTroubleshooting,
    showTutorial,
  ]);

  /**
   * Get current guidance status
   */
  const getGuidanceStatus = useCallback(() => {
    if (currentError) {
      return {
        status: "error",
        message: "Issue detected - tap for help",
        color: errorColor,
        icon: "warning" as keyof typeof Ionicons.glyphMap,
      };
    }

    if (faceQuality) {
      if (faceQuality.isValid && faceQuality.overall >= 0.8) {
        return {
          status: "excellent",
          message: "Perfect positioning",
          color: successColor,
          icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
        };
      } else if (faceQuality.overall >= 0.6) {
        return {
          status: "good",
          message: "Good - minor adjustments",
          color: warningColor,
          icon: "thumbs-up" as keyof typeof Ionicons.glyphMap,
        };
      } else {
        return {
          status: "needs-improvement",
          message: "Needs adjustment",
          color: warningColor,
          icon: "information-circle" as keyof typeof Ionicons.glyphMap,
        };
      }
    }

    return {
      status: "waiting",
      message: "Position your face",
      color: primaryColor,
      icon: "scan" as keyof typeof Ionicons.glyphMap,
    };
  }, [
    currentError,
    faceQuality,
    errorColor,
    successColor,
    warningColor,
    primaryColor,
  ]);

  // Check screen reader status on mount
  useEffect(() => {
    if (visible) {
      checkScreenReaderStatus();
    }
  }, [visible, checkScreenReaderStatus]);

  // Auto-show guidance based on priority
  useEffect(() => {
    if (visible) {
      const priorities = getGuidancePriority();
      if (priorities.length > 0 && priorities[0].priority >= 8) {
        // Auto-trigger high priority guidance
        setTimeout(() => {
          priorities[0].action();
        }, 1000);
      }
    }
  }, [visible, getGuidancePriority]);

  const guidanceStatus = getGuidanceStatus();

  if (!visible) {
    return null;
  }

  return (
    <>
      {/* Face Positioning Guide */}
      <FacePositioningGuide
        faceData={faceData}
        faceQuality={faceQuality}
        isVisible={guidanceState.showPositioningGuide}
        onPositionCorrect={onPositionCorrect}
        enableVoiceGuidance={guidanceState.accessibilitySettings.voiceGuidance}
      />

      {/* Lighting Condition Feedback */}
      {guidanceState.showLightingFeedback && (
        <View style={styles.lightingContainer}>
          <LightingConditionFeedback
            faceData={faceData}
            faceQuality={faceQuality}
            isVisible={true}
            enableVoiceGuidance={
              guidanceState.accessibilitySettings.voiceGuidance
            }
          />
        </View>
      )}

      {/* Guidance Control Panel */}
      <View style={[styles.controlPanel, { backgroundColor }]}>
        {/* Status Indicator */}
        <TouchableOpacity
          onPress={() => setShowMainMenu(!showMainMenu)}
          style={[styles.statusButton, { borderColor: guidanceStatus.color }]}
          accessibilityLabel={`Guidance status: ${guidanceStatus.message}`}
          accessibilityHint="Tap to open guidance menu"
        >
          <Ionicons
            name={guidanceStatus.icon}
            size={20}
            color={guidanceStatus.color}
          />
          <Text style={[styles.statusText, { color: textColor }]}>
            {guidanceStatus.message}
          </Text>
          <Ionicons
            name={showMainMenu ? "chevron-up" : "chevron-down"}
            size={16}
            color={textColor}
          />
        </TouchableOpacity>

        {/* Main Menu */}
        {showMainMenu && (
          <View
            style={[
              styles.mainMenu,
              { backgroundColor, borderColor: "rgba(0,0,0,0.1)" },
            ]}
          >
            <TouchableOpacity
              onPress={showTutorial}
              style={styles.menuItem}
              accessibilityLabel="Start tutorial"
              accessibilityHint="Learn how to use face verification step by step"
            >
              <Ionicons name="school" size={20} color={primaryColor} />
              <Text style={[styles.menuText, { color: textColor }]}>
                Tutorial
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showTroubleshooting}
              style={styles.menuItem}
              accessibilityLabel="Troubleshooting guide"
              accessibilityHint="Get help with common face verification issues"
            >
              <Ionicons name="build" size={20} color={warningColor} />
              <Text style={[styles.menuText, { color: textColor }]}>
                Troubleshooting
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={showAccessibilityHelper}
              style={styles.menuItem}
              accessibilityLabel="Accessibility settings"
              accessibilityHint="Configure accessibility features and settings"
            >
              <Ionicons name="accessibility" size={20} color={successColor} />
              <Text style={[styles.menuText, { color: textColor }]}>
                Accessibility
              </Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              onPress={togglePositioningGuide}
              style={styles.menuItem}
              accessibilityLabel={`${guidanceState.showPositioningGuide ? "Hide" : "Show"} positioning guide`}
              accessibilityHint="Toggle the face positioning guide overlay"
            >
              <Ionicons
                name={guidanceState.showPositioningGuide ? "eye-off" : "eye"}
                size={20}
                color={textColor}
              />
              <Text style={[styles.menuText, { color: textColor }]}>
                {guidanceState.showPositioningGuide ? "Hide" : "Show"}{" "}
                Positioning
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleLightingFeedback}
              style={styles.menuItem}
              accessibilityLabel={`${guidanceState.showLightingFeedback ? "Hide" : "Show"} lighting feedback`}
              accessibilityHint="Toggle the lighting condition feedback"
            >
              <Ionicons
                name={
                  guidanceState.showLightingFeedback ? "bulb" : "bulb-outline"
                }
                size={20}
                color={textColor}
              />
              <Text style={[styles.menuText, { color: textColor }]}>
                {guidanceState.showLightingFeedback ? "Hide" : "Show"} Lighting
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tutorial Modal */}
      <VerificationTutorial
        visible={guidanceState.showTutorial}
        mode={mode}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
        enableVoiceGuidance={guidanceState.accessibilitySettings.voiceGuidance}
        autoAdvance={false}
      />

      {/* Troubleshooting Guide Modal */}
      <TroubleshootingGuide
        visible={guidanceState.showTroubleshooting}
        onClose={() =>
          setGuidanceState((prev) => ({ ...prev, showTroubleshooting: false }))
        }
        initialError={currentError}
        enableVoiceGuidance={guidanceState.accessibilitySettings.voiceGuidance}
      />

      {/* Accessibility Helper Modal */}
      <AccessibilityHelper
        visible={guidanceState.showAccessibilityHelper}
        onClose={() =>
          setGuidanceState((prev) => ({
            ...prev,
            showAccessibilityHelper: false,
          }))
        }
        onSettingsChange={handleAccessibilitySettingsChange}
        currentSettings={guidanceState.accessibilitySettings}
      />
    </>
  );
}

const styles = StyleSheet.create({
  lightingContainer: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  controlPanel: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1001,
  },
  statusButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 2,
    borderRadius: 16,
  },
  statusText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
    marginRight: 8,
  },
  mainMenu: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: 8,
    marginHorizontal: 16,
  },
});
