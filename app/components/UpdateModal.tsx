import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Updates from "expo-updates";
import ThemeContext from "../context/ThemeContext";
import { MotiView } from "moti";

interface UpdateModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdateLater?: () => void;
}

const { width, height } = Dimensions.get("window");

const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  onClose,
  onUpdateLater,
}) => {
  const { theme } = ThemeContext.useTheme();
  const isDark = theme === "dark";

  const [updateState, setUpdateState] = useState<
    "available" | "downloading" | "ready" | "error"
  >("available");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(height));

  // Theme-based colors
  const colors = {
    light: {
      background: "#FFFFFF",
      surface: "#F8FAFC",
      primary: "#3B82F6",
      secondary: "#0EA5E9",
      accent: "#6366F1",
      text: "#0F172A",
      textSecondary: "#475569",
      border: "#E2E8F0",
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
    },
    dark: {
      background: "#0F172A",
      surface: "#1E293B",
      primary: "#60A5FA",
      secondary: "#38BDF8",
      accent: "#818CF8",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      border: "#334155",
      success: "#34D399",
      warning: "#FBBF24",
      error: "#F87171",
    },
  };

  const currentColors = colors[theme];

  useEffect(() => {
    if (visible) {
      // Animate modal in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate modal out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleUpdateNow = async () => {
    try {
      setUpdateState("downloading");
      setError(null);

      // Start downloading the update
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        setUpdateState("ready");
        // Small delay to show "ready" state
        setTimeout(() => {
          Updates.reloadAsync();
        }, 1500);
      } else {
        // No new update available
        setError("No new updates available at this time.");
        setUpdateState("error");
      }
    } catch (err) {
      console.error("Update failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download update. Please try again."
      );
      setUpdateState("error");
    }
  };

  const handleUpdateLater = () => {
    setUpdateState("available");
    setError(null);
    onUpdateLater?.();
  };

  const getUpdateIcon = () => {
    switch (updateState) {
      case "downloading":
        return "cloud-download-outline";
      case "ready":
        return "checkmark-circle-outline";
      case "error":
        return "alert-circle-outline";
      default:
        return "arrow-up-circle-outline";
    }
  };

  const getUpdateIconColor = () => {
    switch (updateState) {
      case "ready":
        return currentColors.success;
      case "error":
        return currentColors.error;
      default:
        return currentColors.primary;
    }
  };

  const getTitleText = () => {
    switch (updateState) {
      case "downloading":
        return "Downloading Update...";
      case "ready":
        return "Update Ready!";
      case "error":
        return "Update Failed";
      default:
        return "Update Available";
    }
  };

  const getMessageText = () => {
    switch (updateState) {
      case "downloading":
        return "Please wait while we download the latest version of the app.";
      case "ready":
        return "Update downloaded successfully! The app will restart automatically.";
      case "error":
        return error || "Something went wrong while updating. Please try again.";
      default:
        return "A new version of Avy Tracker is available with improvements and bug fixes.";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: isDark
              ? "rgba(15, 23, 42, 0.8)"
              : "rgba(15, 23, 42, 0.6)",
          },
        ]}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
              backgroundColor: currentColors.background,
              borderColor: currentColors.border,
            },
          ]}
        >
          {/* Header with gradient background */}
          <LinearGradient
            colors={[
              currentColors.primary,
              currentColors.secondary,
              currentColors.accent,
            ]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.headerContent}>
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", delay: 200 }}
              >
                <Ionicons
                  name={getUpdateIcon()}
                  size={48}
                  color="#FFFFFF"
                  style={styles.headerIcon}
                />
              </MotiView>

              <MotiView
                from={{ translateY: 20, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{ delay: 300 }}
              >
                <Text style={styles.headerTitle}>{getTitleText()}</Text>
              </MotiView>
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <MotiView
              from={{ translateY: 20, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              transition={{ delay: 400 }}
            >
              <Text
                style={[
                  styles.message,
                  { color: currentColors.textSecondary },
                ]}
              >
                {getMessageText()}
              </Text>
            </MotiView>

            {/* Progress indicator for downloading state */}
            {updateState === "downloading" && (
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 500 }}
                style={styles.progressContainer}
              >
                <ActivityIndicator
                  size="large"
                  color={currentColors.primary}
                />
                <Text
                  style={[
                    styles.progressText,
                    { color: currentColors.text },
                  ]}
                >
                  Downloading update... {downloadProgress}%
                </Text>
              </MotiView>
            )}

            {/* Success indicator for ready state */}
            {updateState === "ready" && (
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 500, type: "spring" }}
                style={styles.successContainer}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={64}
                  color={currentColors.success}
                />
              </MotiView>
            )}

            {/* Error indicator */}
            {updateState === "error" && (
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 500 }}
                style={styles.errorContainer}
              >
                <Ionicons
                  name="alert-circle"
                  size={48}
                  color={currentColors.error}
                />
              </MotiView>
            )}
          </View>

          {/* Action Buttons */}
          <MotiView
            from={{ translateY: 20, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ delay: 600 }}
            style={styles.footer}
          >
            {updateState === "available" && (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    { borderColor: currentColors.border },
                  ]}
                  onPress={handleUpdateLater}
                  disabled={false}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryButtonText,
                      { color: currentColors.text },
                    ]}
                  >
                    Later
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    { backgroundColor: currentColors.primary },
                  ]}
                  onPress={handleUpdateNow}
                  disabled={false}
                >
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    Update Now
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {updateState === "error" && (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    { borderColor: currentColors.border },
                  ]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryButtonText,
                      { color: currentColors.text },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.primaryButton,
                    { backgroundColor: currentColors.primary },
                  ]}
                  onPress={() => {
                    setUpdateState("available");
                    setError(null);
                  }}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {(updateState === "downloading" || updateState === "ready") && (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.secondaryButton,
                    { borderColor: currentColors.border, flex: 1 },
                  ]}
                  onPress={onClose}
                  disabled={updateState === "downloading"}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      styles.secondaryButtonText,
                      {
                        color:
                          updateState === "downloading"
                            ? currentColors.textSecondary
                            : currentColors.text,
                      },
                    ]}
                  >
                    {updateState === "ready" ? "Cancel" : "Please Wait..."}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </MotiView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  headerGradient: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  headerContent: {
    alignItems: "center",
  },
  headerIcon: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  content: {
    padding: 24,
    alignItems: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 24,
  },
  progressContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
  successContainer: {
    marginTop: 16,
  },
  errorContainer: {
    marginTop: 16,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButtonText: {
    color: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#0F172A",
  },
});

export default UpdateModal;
