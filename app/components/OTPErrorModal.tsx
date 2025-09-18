import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";

interface OTPErrorModalProps {
  visible: boolean;
  error: {
    code: string;
    message: string;
    error?: string;
  } | null;
  onClose: () => void;
  onRetry?: () => void;
  isLocked?: boolean;
}

const { width } = Dimensions.get("window");

const OTPErrorModal: React.FC<OTPErrorModalProps> = ({
  visible,
  error,
  onClose,
  onRetry,
  isLocked = false,
}) => {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#0f172a", "#f1f5f9");
  const borderColor = useThemeColor("#e2e8f0", "#334155");
  const errorColor = useThemeColor("#ef4444", "#f87171");
  const warningColor = useThemeColor("#f59e0b", "#fbbf24");

  const getErrorIcon = (code: string) => {
    switch (code) {
      case "RATE_LIMIT_EXCEEDED":
        return { name: "time-outline", color: warningColor };
      case "GENERATION_FAILED":
        return { name: "alert-circle-outline", color: errorColor };
      case "NETWORK_ERROR":
        return { name: "wifi-outline", color: errorColor };
      case "ACCOUNT_LOCKED":
        return { name: "lock-closed-outline", color: errorColor };
      case "AUTH_REQUIRED":
        return { name: "person-outline", color: errorColor };
      default:
        return { name: "warning-outline", color: errorColor };
    }
  };

  const getErrorTitle = (code: string) => {
    switch (code) {
      case "RATE_LIMIT_EXCEEDED":
        return "Too Many Requests";
      case "GENERATION_FAILED":
        return "OTP Generation Failed";
      case "NETWORK_ERROR":
        return "Connection Error";
      case "ACCOUNT_LOCKED":
        return "Account Temporarily Locked";
      case "AUTH_REQUIRED":
        return "Authentication Required";
      case "PHONE_NOT_FOUND":
        return "Phone Number Not Found";
      case "USER_NOT_FOUND":
        return "User Not Found";
      case "INVALID_PURPOSE":
        return "Invalid Request";
      case "MISSING_PURPOSE":
        return "Missing Information";
      case "MISSING_OTP_ID":
        return "Session Expired";
      default:
        return "Verification Error";
    }
  };

  const getErrorMessage = (code: string, message: string) => {
    switch (code) {
      case "RATE_LIMIT_EXCEEDED":
        return "You have exceeded the maximum number of OTP requests. Please wait 15 minutes before trying again.";
      case "GENERATION_FAILED":
        return message || "Failed to generate OTP. Please try again later.";
      case "NETWORK_ERROR":
        return "Please check your internet connection and try again.";
      case "ACCOUNT_LOCKED":
        return "Your account has been temporarily locked due to multiple failed attempts. Please try again later.";
      case "AUTH_REQUIRED":
        return "Please log in to continue with OTP verification.";
      case "PHONE_NOT_FOUND":
        return "No phone number is registered for your account. Please contact support to add your phone number.";
      case "USER_NOT_FOUND":
        return "User account not found. Please log in again.";
      case "INVALID_PURPOSE":
        return "Invalid request type. Please try again or contact support.";
      case "MISSING_PURPOSE":
        return "Missing required information. Please try again.";
      case "MISSING_OTP_ID":
        return "Your OTP session has expired. Please request a new OTP.";
      default:
        return message || "An unexpected error occurred. Please try again.";
    }
  };

  const getActionButton = (code: string) => {
    switch (code) {
      case "RATE_LIMIT_EXCEEDED":
        return { text: "OK", action: onClose };
      case "GENERATION_FAILED":
        return { text: "Try Again", action: onRetry };
      case "NETWORK_ERROR":
        return { text: "Retry", action: onRetry };
      case "ACCOUNT_LOCKED":
        return { text: "OK", action: onClose };
      case "AUTH_REQUIRED":
        return { text: "OK", action: onClose };
      case "PHONE_NOT_FOUND":
        return { text: "Contact Support", action: onClose };
      case "USER_NOT_FOUND":
        return { text: "OK", action: onClose };
      case "INVALID_PURPOSE":
        return { text: "OK", action: onClose };
      case "MISSING_PURPOSE":
        return { text: "OK", action: onClose };
      case "MISSING_OTP_ID":
        return { text: "Request New OTP", action: onRetry };
      default:
        return { text: "Try Again", action: onRetry };
    }
  };

  // Don't render if not visible or no error
  //   console.log('🔴 OTPErrorModal render check:', { visible, error: error?.code });
  //   if (!visible || !error) {
  //     console.log('🔴 OTPErrorModal not rendering:', { visible, hasError: !!error });
  //     return null;
  //   }

  const icon = getErrorIcon(error?.code || "DEFAULT");
  const title = getErrorTitle(error?.code || "DEFAULT");
  const message = getErrorMessage(error?.code || "", error?.message || "");
  const actionButton = getActionButton(error?.code || "DEFAULT");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // console.log('🔴 OTPErrorModal onRequestClose triggered');
        if (!isLocked) {
          onClose();
        } else {
          console.log("🔴 OTPErrorModal is locked, preventing auto-close");
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor, borderColor }]}>
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${icon.color}20` },
            ]}
          >
            <Ionicons name={icon.name as any} size={48} color={icon.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.message, { color: textColor }]}>{message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {actionButton.action && (
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={actionButton.action}
              >
                <Text style={styles.primaryButtonText}>
                  {actionButton.text}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryButtonText, { color: textColor }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    width: width - 48,
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 32,
    opacity: 0.8,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default OTPErrorModal;
