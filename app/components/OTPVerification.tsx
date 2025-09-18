import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  AccessibilityInfo,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, useThemeColor } from "../hooks/useColorScheme";
import { useAuth } from "../context/AuthContext";
import OTPErrorModal from "./OTPErrorModal";
import {
  OTPVerificationProps,
  OTPState,
  OTPGenerationResponse,
  OTPVerificationResponse,
  OTPResendResponse,
  OTPError,
} from "../types/otp";

const { width } = Dimensions.get("window");

const OTPVerification: React.FC<OTPVerificationProps> = ({
  visible,
  purpose,
  phoneNumber,
  onSuccess,
  onError,
  onCancel,
  title = "OTP Verification",
  subtitle = "Enter the verification code sent to your phone",
  maxAttempts = 3,
  expiryMinutes = 5,
}) => {
  const colorScheme = useColorScheme();
  const { token } = useAuth();

  // Theme colors
  const backgroundColor = useThemeColor("#ffffff", "#1e293b");
  const textColor = useThemeColor("#1f2937", "#f8fafc");
  const primaryColor = useThemeColor("#3b82f6", "#60a5fa");
  const errorColor = useThemeColor("#ef4444", "#f87171");
  const successColor = useThemeColor("#10b981", "#34d399");
  const borderColor = useThemeColor("#e5e7eb", "#374151");
  const placeholderColor = useThemeColor("#9ca3af", "#6b7280");
  const disabledColor = useThemeColor("#d1d5db", "#4b5563");

  // State management
  const [state, setState] = useState<OTPState>({
    isLoading: false,
    isVerifying: false,
    isResending: false,
    otp: "",
    timeRemaining: expiryMinutes * 60,
    attempts: 0,
    maxAttempts,
    error: null,
    success: false,
    canResend: false,
    isLocked: false,
    lockoutUntil: null,
  });

  // Error modal state
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState<{
    code: string;
    message: string;
    error?: string;
  } | null>(null);
  const [isErrorModalLocked, setIsErrorModalLocked] = useState(false);

  // Store OTP ID for verification
  const [currentOtpId, setCurrentOtpId] = useState<string | null>(null);

  // Refs
  const otpInputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Initialize component
  useEffect(() => {
    isMountedRef.current = true;

    if (visible) {
      resetState();
      requestOTP();
    }

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [visible]);

  // Timer effect
  useEffect(() => {
    if (
      visible &&
      state.timeRemaining > 0 &&
      !state.success &&
      !state.isLocked
    ) {
      timerRef.current = setInterval(() => {
        setState((prev) => {
          const newTime = prev.timeRemaining - 1;
          if (newTime <= 0) {
            return {
              ...prev,
              timeRemaining: 0,
              canResend: true,
              error: "OTP has expired. Please request a new code.",
            };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [visible, state.timeRemaining, state.success, state.isLocked]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (visible && otpInputRefs.current[0]) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 500);
    }
  }, [visible]);

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      isVerifying: false,
      isResending: false,
      otp: "",
      timeRemaining: expiryMinutes * 60,
      attempts: 0,
      maxAttempts,
      error: null,
      success: false,
      canResend: false,
      isLocked: false,
      lockoutUntil: null,
    });
    // Clear OTP ID when resetting
    setCurrentOtpId(null);
  }, [expiryMinutes, maxAttempts]);

  const updateState = useCallback((updates: Partial<OTPState>) => {
    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const requestOTP = async () => {
    if (!token) {
      onError({
        error: "Authentication required",
        message: "Please log in to continue",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    updateState({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/otp/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ purpose }),
        },
      );

      const data: OTPGenerationResponse = await response.json();

      if (data.success) {
        // Store the OTP ID for verification
        setCurrentOtpId(data.otpId || null);

        updateState({
          isLoading: false,
          timeRemaining: expiryMinutes * 60,
          canResend: false,
        });

        // Announce to screen readers
        AccessibilityInfo.announceForAccessibility(
          `OTP sent to your phone. Please enter the 6-digit code.`,
        );
      } else {
        updateState({
          isLoading: false,
          error: data.message,
        });

        // Show error modal
        const errorData = {
          code: data.code || "GENERATION_FAILED",
          message: data.message,
          error: data.error,
        };
        console.log("🔴 Setting error modal data:", errorData);

        // Use setTimeout to ensure state updates are processed correctly
        setTimeout(() => {
          setErrorModalData(errorData);
          setShowErrorModal(true);
          setIsErrorModalLocked(true); // Lock the modal to prevent auto-closing
          console.log("🔴 Error modal should now be visible and locked");
        }, 100);

        onError({
          error: "OTP generation failed",
          message: data.message,
          code: data.code || "GENERATION_FAILED",
        });
      }
    } catch (error) {
      console.error("Error requesting OTP:", error);
      updateState({
        isLoading: false,
        error:
          "Failed to send OTP. Please check your connection and try again.",
      });

      // Show error modal
      const errorData = {
        code: "NETWORK_ERROR",
        message:
          "Failed to send OTP. Please check your connection and try again.",
        error: "Network error",
      };
      console.log("🔴 Setting network error modal data:", errorData);

      // Use setTimeout to ensure state updates are processed correctly
      setTimeout(() => {
        setErrorModalData(errorData);
        setShowErrorModal(true);
        setIsErrorModalLocked(true); // Lock the modal to prevent auto-closing
        console.log("🔴 Network error modal should now be visible and locked");
      }, 100);

      onError({
        error: "Network error",
        message:
          "Failed to send OTP. Please check your connection and try again.",
        code: "NETWORK_ERROR",
      });
    }
  };

  const verifyOTP = async (otpCode: string) => {
    if (!token || otpCode.length !== 6) return;

    // Check if we have an OTP ID
    if (!currentOtpId) {
      updateState({
        isVerifying: false,
        error: "No OTP session found. Please request a new OTP.",
      });
      return;
    }

    updateState({ isVerifying: true, error: null });

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/otp/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            otp: otpCode,
            purpose,
            otpId: currentOtpId,
          }),
        },
      );

      const data: OTPVerificationResponse = await response.json();

      if (data.success) {
        updateState({
          isVerifying: false,
          success: true,
          error: null,
        });

        // Success vibration
        Vibration.vibrate([100, 50, 100]);

        // Announce success to screen readers
        AccessibilityInfo.announceForAccessibility("OTP verified successfully");

        onSuccess({
          success: true,
          message: data.message,
          verifiedAt: data.verifiedAt || new Date().toISOString(),
          purpose,
        });
      } else {
        const newAttempts = state.attempts + 1;
        const isLocked = data.lockoutUntil !== undefined;

        updateState({
          isVerifying: false,
          attempts: newAttempts,
          error: data.message,
          isLocked,
          lockoutUntil: data.lockoutUntil ? new Date(data.lockoutUntil) : null,
          otp: "", // Clear OTP on failure
        });

        // Error vibration
        Vibration.vibrate([200, 100, 200]);

        // Clear OTP inputs
        otpInputRefs.current.forEach((ref) => {
          if (ref) ref.clear();
        });

        // Focus first input for retry
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);

        // Announce error to screen readers
        AccessibilityInfo.announceForAccessibility(
          `Verification failed. ${data.remainingAttempts ? `${data.remainingAttempts} attempts remaining` : "Please try again"}`,
        );

        if (isLocked) {
          onError({
            error: "Account locked",
            message: data.message,
            code: "ACCOUNT_LOCKED",
            lockoutUntil: data.lockoutUntil,
          });
        }
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      updateState({
        isVerifying: false,
        error:
          "Failed to verify OTP. Please check your connection and try again.",
        otp: "",
      });

      // Clear OTP inputs on error
      otpInputRefs.current.forEach((ref) => {
        if (ref) ref.clear();
      });
    }
  };

  const resendOTP = async () => {
    if (!token || state.isResending) return;

    updateState({ isResending: true, error: null });

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/otp/resend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ purpose }),
        },
      );

      const data: OTPResendResponse = await response.json();

      if (data.success) {
        // Store the new OTP ID for verification
        setCurrentOtpId(data.otpId || null);

        updateState({
          isResending: false,
          timeRemaining: expiryMinutes * 60,
          canResend: false,
          error: null,
          otp: "",
        });

        // Clear OTP inputs
        otpInputRefs.current.forEach((ref) => {
          if (ref) ref.clear();
        });

        // Focus first input
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);

        // Announce to screen readers
        AccessibilityInfo.announceForAccessibility(
          "New OTP sent to your phone",
        );
      } else {
        updateState({
          isResending: false,
          error: data.message,
        });
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      updateState({
        isResending: false,
        error: "Failed to resend OTP. Please try again.",
      });
    }
  };

  const handleOTPChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, "");

    if (digit.length > 1) return; // Prevent multiple digits

    // Update OTP state
    const newOTP = state.otp.split("");
    newOTP[index] = digit;
    const updatedOTP = newOTP.join("");

    updateState({ otp: updatedOTP, error: null });

    // Auto-focus next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (updatedOTP.length === 6) {
      verifyOTP(updatedOTP);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !state.otp[index] && index > 0) {
      // Focus previous input on backspace
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    resetState();
    onCancel();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderOTPInputs = () => {
    return (
      <View style={styles.otpContainer}>
        {Array.from({ length: 6 }, (_, index) => (
          <TextInput
            key={index}
            ref={(ref) => (otpInputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              {
                borderColor: state.error ? errorColor : borderColor,
                backgroundColor: backgroundColor,
                color: textColor,
              },
              state.otp[index] && { borderColor: primaryColor },
            ]}
            value={state.otp[index] || ""}
            onChangeText={(value) => handleOTPChange(value, index)}
            onKeyPress={({ nativeEvent }) =>
              handleKeyPress(nativeEvent.key, index)
            }
            keyboardType="numeric"
            maxLength={1}
            textAlign="center"
            editable={!state.isVerifying && !state.success && !state.isLocked}
            selectTextOnFocus
            accessible={true}
            accessibilityLabel={`OTP digit ${index + 1} of 6`}
            accessibilityHint={`Enter digit ${index + 1} of the verification code`}
          />
        ))}
      </View>
    );
  };

  const renderTimer = () => {
    if (state.success || state.isLocked) return null;

    return (
      <View style={styles.timerContainer}>
        <Ionicons
          name="time-outline"
          size={16}
          color={state.timeRemaining > 60 ? textColor : errorColor}
        />
        <Text
          style={[
            styles.timerText,
            {
              color: state.timeRemaining > 60 ? textColor : errorColor,
            },
          ]}
          accessible={true}
          accessibilityLabel={`Time remaining: ${formatTime(state.timeRemaining)}`}
        >
          {formatTime(state.timeRemaining)}
        </Text>
      </View>
    );
  };

  const renderResendButton = () => {
    if (state.success || state.isLocked) return null;

    const canResend = state.canResend || state.timeRemaining === 0;

    return (
      <TouchableOpacity
        style={[styles.resendButton, !canResend && { opacity: 0.5 }]}
        onPress={resendOTP}
        disabled={!canResend || state.isResending}
        accessible={true}
        accessibilityLabel="Resend OTP"
        accessibilityHint="Tap to request a new verification code"
        accessibilityRole="button"
      >
        {state.isResending ? (
          <ActivityIndicator size="small" color={primaryColor} />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={16} color={primaryColor} />
            <Text style={[styles.resendText, { color: primaryColor }]}>
              Resend Code
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderError = () => {
    if (!state.error) return null;

    return (
      <View
        style={[styles.errorContainer, { backgroundColor: `${errorColor}15` }]}
      >
        <Ionicons name="alert-circle-outline" size={16} color={errorColor} />
        <Text
          style={[styles.errorText, { color: errorColor }]}
          accessible={true}
          accessibilityRole="alert"
        >
          {state.error}
        </Text>
      </View>
    );
  };

  const renderSuccess = () => {
    if (!state.success) return null;

    return (
      <View
        style={[
          styles.successContainer,
          { backgroundColor: `${successColor}15` },
        ]}
      >
        <Ionicons
          name="checkmark-circle-outline"
          size={24}
          color={successColor}
        />
        <Text style={[styles.successText, { color: successColor }]}>
          Verification Successful!
        </Text>
      </View>
    );
  };

  const renderLockout = () => {
    if (!state.isLocked || !state.lockoutUntil) return null;

    const lockoutTime = Math.ceil(
      (state.lockoutUntil.getTime() - Date.now()) / 1000 / 60,
    );

    return (
      <View
        style={[
          styles.lockoutContainer,
          { backgroundColor: `${errorColor}15` },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={24} color={errorColor} />
        <Text style={[styles.lockoutTitle, { color: errorColor }]}>
          Account Temporarily Locked
        </Text>
        <Text style={[styles.lockoutText, { color: textColor }]}>
          Too many failed attempts. Please try again in {lockoutTime} minutes.
        </Text>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.container}>
            <View style={[styles.modal, { backgroundColor }]}>
              {/* Header */}
              <View style={styles.header}>
                <Text
                  style={[styles.title, { color: textColor }]}
                  accessible={true}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleCancel}
                  accessible={true}
                  accessibilityLabel="Close"
                  accessibilityHint="Close OTP verification"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color={textColor} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {state.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Text style={[styles.loadingText, { color: textColor }]}>
                      Sending verification code...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[styles.subtitle, { color: placeholderColor }]}
                      accessible={true}
                    >
                      {subtitle}
                    </Text>

                    {phoneNumber && (
                      <Text
                        style={[styles.phoneNumber, { color: textColor }]}
                        accessible={true}
                      >
                        {phoneNumber}
                      </Text>
                    )}

                    {renderLockout()}
                    {renderSuccess()}
                    {renderError()}

                    {!state.isLocked && !state.success && (
                      <>
                        {renderOTPInputs()}
                        {renderTimer()}
                        {renderResendButton()}
                      </>
                    )}

                    {state.isVerifying && (
                      <View style={styles.verifyingContainer}>
                        <ActivityIndicator size="small" color={primaryColor} />
                        <Text
                          style={[styles.verifyingText, { color: textColor }]}
                        >
                          Verifying...
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text
                  style={[styles.attemptsText, { color: placeholderColor }]}
                  accessible={true}
                >
                  Attempts: {state.attempts}/{state.maxAttempts}
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Error Modal */}
      <OTPErrorModal
        visible={showErrorModal}
        error={errorModalData}
        isLocked={isErrorModalLocked}
        onClose={() => {
          console.log("🔴 Error modal close button pressed");
          setShowErrorModal(false);
          setErrorModalData(null);
          setIsErrorModalLocked(false); // Unlock the modal
        }}
        onRetry={() => {
          console.log("🔴 Error modal retry button pressed");
          setShowErrorModal(false);
          setErrorModalData(null);
          setIsErrorModalLocked(false); // Unlock the modal
          requestOTP();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
  },
  modal: {
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    alignItems: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    width: "100%",
    maxWidth: 300,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 18,
    fontWeight: "600",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  timerText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  resendButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  successContainer: {
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  successText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  lockoutContainer: {
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  lockoutTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  lockoutText: {
    marginTop: 4,
    fontSize: 14,
    textAlign: "center",
  },
  verifyingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
  verifyingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  attemptsText: {
    fontSize: 12,
  },
});

export default OTPVerification;
