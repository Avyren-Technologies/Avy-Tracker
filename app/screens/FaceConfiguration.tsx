import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, useThemeColor } from '../hooks/useColorScheme';
import { useAuth } from '../context/AuthContext';
import OTPVerification from '../components/OTPVerification';
import FaceVerificationModal from '../components/FaceVerificationModal';
import { FaceVerificationResult } from '../types/faceDetection';

interface FaceProfileStatus {
  isRegistered: boolean;
  registrationDate?: string;
  lastVerification?: string;
  verificationCount: number;
  isActive: boolean;
}

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  isDestructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = '#3b82f6',
  isDestructive = false,
}) => {
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#0f172a', '#f1f5f9');
  const borderColor = useThemeColor('#e2e8f0', '#334155');

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor, borderColor }]}>
          <View style={styles.modalHeader}>
            <Ionicons 
              name={isDestructive ? "warning" : "information-circle"} 
              size={24} 
              color={isDestructive ? "#ef4444" : "#3b82f6"} 
            />
            <Text style={[styles.modalTitle, { color: textColor }]}>{title}</Text>
          </View>
          
          <Text style={[styles.modalMessage, { color: textColor }]}>{message}</Text>
          
          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalButton, styles.cancelButton, { borderColor }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelButtonText, { color: textColor }]}>
                {cancelText}
              </Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.modalButton,
                styles.confirmButton,
                { backgroundColor: isDestructive ? '#ef4444' : confirmColor }
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function FaceConfiguration() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user, token } = useAuth();
  
  // Theme colors
  const backgroundColor = useThemeColor('#f8fafc', '#0f172a');
  const cardColor = useThemeColor('#ffffff', '#1e293b');
  const textColor = useThemeColor('#0f172a', '#f1f5f9');
  const secondaryTextColor = useThemeColor('#64748b', '#94a3b8');
  const borderColor = useThemeColor('#e2e8f0', '#334155');
  const successColor = useThemeColor('#10b981', '#34d399');
  const errorColor = useThemeColor('#ef4444', '#f87171');
  const warningColor = useThemeColor('#f59e0b', '#fbbf24');

  // State management
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [faceProfileStatus, setFaceProfileStatus] = useState<FaceProfileStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalMode, setFaceModalMode] = useState<'register' | 'verify'>('register');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    action: () => void;
    isDestructive?: boolean;
  }>({
    title: '',
    message: '',
    action: () => {},
  });

  // Load face profile status
  const loadFaceProfileStatus = useCallback(async () => {
    if (!token || !user?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFaceProfileStatus(data);
      } else {
        console.error('Failed to load face profile status');
        setFaceProfileStatus({
          isRegistered: false,
          verificationCount: 0,
          isActive: false,
        });
      }
    } catch (error) {
      console.error('Error loading face profile status:', error);
      setFaceProfileStatus({
        isRegistered: false,
        verificationCount: 0,
        isActive: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, user?.id]);

  // Initialize component
  useEffect(() => {
    loadFaceProfileStatus();
  }, [loadFaceProfileStatus]);

  // Handle OTP verification success
  const handleOTPSuccess = useCallback(() => {
    setIsOTPVerified(true);
    setShowOTPModal(false);
  }, []);

  // Handle face registration/update success
  const handleFaceSuccess = useCallback(async (result: FaceVerificationResult) => {
    setShowFaceModal(false);
    
    Alert.alert(
      'Success',
      'Face profile updated successfully!',
      [{ text: 'OK' }]
    );

    // Reload profile status
    await loadFaceProfileStatus();
  }, [faceModalMode, loadFaceProfileStatus]);

  // Handle face registration/update error
  const handleFaceError = useCallback((error: any) => {
    setShowFaceModal(false);
    
    Alert.alert(
      'Error',
      error.message || 'Failed to process face profile. Please try again.',
      [{ text: 'OK' }]
    );
  }, []);

  // Show confirmation modal
  const showConfirmation = useCallback((config: typeof confirmModalConfig) => {
    setConfirmModalConfig(config);
    setShowConfirmModal(true);
  }, []);

  // Handle face re-registration
  const handleReRegister = useCallback(() => {
    showConfirmation({
      title: 'Re-register Face Profile',
      message: 'This will replace your current face profile with a new one. Are you sure you want to continue?',
      action: () => {
        setFaceModalMode('register'); // Use 'register' for updating profile
        setShowFaceModal(true);
      },
    });
  }, [showConfirmation]);

  // Handle face profile deletion
  const handleDeleteProfile = useCallback(() => {
    showConfirmation({
      title: 'Delete Face Profile',
      message: 'This will permanently delete your face profile and all associated biometric data. This action cannot be undone. Are you sure?',
      action: async () => {
        try {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}/api/face-verification/profile`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            Alert.alert(
              'Success',
              'Face profile deleted successfully.',
              [{ text: 'OK' }]
            );
            await loadFaceProfileStatus();
          } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete face profile');
          }
        } catch (error: any) {
          Alert.alert(
            'Error',
            error.message || 'Failed to delete face profile. Please try again.',
            [{ text: 'OK' }]
          );
        }
      },
      isDestructive: true,
    });
  }, [showConfirmation, token, loadFaceProfileStatus]);

  // Handle initial face registration
  const handleInitialRegistration = useCallback(() => {
    setFaceModalMode('register');
    setShowFaceModal(true);
  }, []);

  // Require OTP verification for access
  if (!isOTPVerified) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Stack.Screen
          options={{
            title: 'Face Configuration',
            headerStyle: { backgroundColor: cardColor },
            headerTintColor: textColor,
          }}
        />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

        <View style={styles.otpGateContainer}>
          <View style={[styles.otpGateCard, { backgroundColor: cardColor, borderColor }]}>
            <Ionicons name="shield-checkmark" size={64} color="#3b82f6" />
            <Text style={[styles.otpGateTitle, { color: textColor }]}>
              Secure Access Required
            </Text>
            <Text style={[styles.otpGateMessage, { color: secondaryTextColor }]}>
              Face configuration settings contain sensitive biometric data. 
              Please verify your identity with OTP to continue.
            </Text>
            
            <TouchableOpacity
              style={styles.otpGateButton}
              onPress={() => setShowOTPModal(true)}
            >
              <Ionicons name="key" size={20} color="#ffffff" />
              <Text style={styles.otpGateButtonText}>Verify with OTP</Text>
            </TouchableOpacity>
          </View>
        </View>

        <OTPVerification
          visible={showOTPModal}
          purpose="face_configuration_access"
          onSuccess={handleOTPSuccess}
          onCancel={() => setShowOTPModal(false)}
          onError={(error) => {
            console.error('OTP verification error:', error);
            setShowOTPModal(false);
          }}
        />
      </View>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor }]}>
        <Stack.Screen
          options={{
            title: 'Face Configuration',
            headerStyle: { backgroundColor: cardColor },
            headerTintColor: textColor,
          }}
        />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
          Loading face profile...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: 'Face Configuration',
          headerStyle: { backgroundColor: cardColor },
          headerTintColor: textColor,
        }}
      />
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Face Profile Status Card */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={24} color="#3b82f6" />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              Face Profile Status
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: secondaryTextColor }]}>
                Registration Status:
              </Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: faceProfileStatus?.isRegistered
                        ? successColor
                        : errorColor,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: faceProfileStatus?.isRegistered
                        ? successColor
                        : errorColor,
                    },
                  ]}
                >
                  {faceProfileStatus?.isRegistered ? 'Registered' : 'Not Registered'}
                </Text>
              </View>
            </View>

            {faceProfileStatus?.isRegistered && (
              <>
                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: secondaryTextColor }]}>
                    Profile Status:
                  </Text>
                  <View style={styles.statusBadge}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: faceProfileStatus.isActive
                            ? successColor
                            : warningColor,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: faceProfileStatus.isActive
                            ? successColor
                            : warningColor,
                        },
                      ]}
                    >
                      {faceProfileStatus.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {faceProfileStatus.registrationDate && (
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: secondaryTextColor }]}>
                      Registered:
                    </Text>
                    <Text style={[styles.statusValue, { color: textColor }]}>
                      {new Date(faceProfileStatus.registrationDate).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {faceProfileStatus.lastVerification && (
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: secondaryTextColor }]}>
                      Last Verification:
                    </Text>
                    <Text style={[styles.statusValue, { color: textColor }]}>
                      {new Date(faceProfileStatus.lastVerification).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                <View style={styles.statusRow}>
                  <Text style={[styles.statusLabel, { color: secondaryTextColor }]}>
                    Verification Count:
                  </Text>
                  <Text style={[styles.statusValue, { color: textColor }]}>
                    {faceProfileStatus.verificationCount}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Actions Card */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings" size={24} color="#3b82f6" />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              Face Profile Management
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            {!faceProfileStatus?.isRegistered ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleInitialRegistration}
              >
                <Ionicons name="add-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Register Face Profile</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, { borderColor }]}
                  onPress={handleReRegister}
                >
                  <Ionicons name="refresh" size={20} color="#3b82f6" />
                  <Text style={[styles.secondaryButtonText, { color: textColor }]}>
                    Update Face Profile
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={handleDeleteProfile}
                >
                  <Ionicons name="trash" size={20} color="#ffffff" />
                  <Text style={styles.dangerButtonText}>Delete Face Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Privacy Information Card */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={24} color="#10b981" />
            <Text style={[styles.cardTitle, { color: textColor }]}>
              Privacy & Security
            </Text>
          </View>

          <View style={styles.privacyContainer}>
            <View style={styles.privacyItem}>
              <Ionicons name="lock-closed" size={16} color="#10b981" />
              <Text style={[styles.privacyText, { color: secondaryTextColor }]}>
                All biometric data is encrypted and stored securely
              </Text>
            </View>

            <View style={styles.privacyItem}>
              <Ionicons name="eye-off" size={16} color="#10b981" />
              <Text style={[styles.privacyText, { color: secondaryTextColor }]}>
                Face images are processed locally and never stored
              </Text>
            </View>

            <View style={styles.privacyItem}>
              <Ionicons name="trash" size={16} color="#10b981" />
              <Text style={[styles.privacyText, { color: secondaryTextColor }]}>
                You can delete your biometric data at any time
              </Text>
            </View>

            <View style={styles.privacyItem}>
              <Ionicons name="shield" size={16} color="#10b981" />
              <Text style={[styles.privacyText, { color: secondaryTextColor }]}>
                Data is only used for shift verification purposes
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        mode={faceModalMode}
        onSuccess={handleFaceSuccess}
        onError={handleFaceError}
        onCancel={() => setShowFaceModal(false)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={() => {
          setShowConfirmModal(false);
          confirmModalConfig.action();
        }}
        onCancel={() => setShowConfirmModal(false)}
        isDestructive={confirmModalConfig.isDestructive}
        confirmText={confirmModalConfig.isDestructive ? 'Delete' : 'Confirm'}
        confirmColor={confirmModalConfig.isDestructive ? '#ef4444' : '#3b82f6'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },

  // OTP Gate Styles
  otpGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  otpGateCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  otpGateTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  otpGateMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  otpGateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  otpGateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Card Styles
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  // Status Styles
  statusContainer: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Actions Styles
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Privacy Styles
  privacyContainer: {
    gap: 12,
  },
  privacyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    maxWidth: 400,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});