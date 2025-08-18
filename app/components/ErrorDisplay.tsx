/**
 * Error Display Component
 * Shows user-friendly error messages with recovery actions
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FaceVerificationError,
  ErrorRecoveryAction
} from '../types/faceVerificationErrors';
import ThemeContext from '../context/ThemeContext';

interface ErrorDisplayProps {
  error: FaceVerificationError | null;
  isRetrying?: boolean;
  recoveryActions?: ErrorRecoveryAction[];
  onRetry?: () => void;
  onDismiss?: () => void;
  onRecoveryAction?: (action: ErrorRecoveryAction) => void;
  showDetails?: boolean;
  compact?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  isRetrying = false,
  recoveryActions = [],
  onRetry,
  onDismiss,
  onRecoveryAction,
  showDetails = false,
  compact = false
}) => {
  const { theme } = ThemeContext.useTheme();

  const colors = {
    light: {
      background: '#FEF2F2',
      border: '#FECACA',
      text: '#991B1B',
      secondaryText: '#7F1D1D',
      buttonBackground: '#DC2626',
      buttonText: '#FFFFFF',
      iconColor: '#DC2626',
      suggestionBackground: '#FEF7F7',
      suggestionBorder: '#FED7D7'
    },
    dark: {
      background: '#7F1D1D',
      border: '#991B1B',
      text: '#FEF2F2',
      secondaryText: '#FECACA',
      buttonBackground: '#EF4444',
      buttonText: '#FFFFFF',
      iconColor: '#EF4444',
      suggestionBackground: '#991B1B',
      suggestionBorder: '#B91C1C'
    }
  };

  const currentColors = colors[theme];

  if (!error) return null;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      case 'medium':
        return 'information-circle';
      case 'low':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#EA580C';
      case 'medium':
        return '#D97706';
      case 'low':
        return '#059669';
      default:
        return '#6B7280';
    }
  };

  const handleRecoveryAction = (action: ErrorRecoveryAction) => {
    if (action.type === 'manual') {
      Alert.alert(
        'Manual Action Required',
        `This action will ${action.label.toLowerCase()}. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              if (onRecoveryAction) {
                onRecoveryAction(action);
              }
            }
          }
        ]
      );
    } else {
      if (onRecoveryAction) {
        onRecoveryAction(action);
      }
    }
  };

  if (compact) {
    return (
      <View style={{
        backgroundColor: currentColors.background,
        borderColor: currentColors.border,
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 8,
        flexDirection: 'row',
        alignItems: 'center'
      }}>
        <Ionicons
          name={getSeverityIcon(error.severity)}
          size={20}
          color={getSeverityColor(error.severity)}
          style={{ marginRight: 8 }}
        />
        <Text style={{
          color: currentColors.text,
          fontSize: 14,
          flex: 1
        }}>
          {error.userMessage}
        </Text>
        {onRetry && error.retryable && (
          <TouchableOpacity
            onPress={onRetry}
            disabled={isRetrying}
            style={{
              backgroundColor: currentColors.buttonBackground,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 4,
              marginLeft: 8
            }}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={currentColors.buttonText} />
            ) : (
              <Text style={{
                color: currentColors.buttonText,
                fontSize: 12,
                fontWeight: '600'
              }}>
                Retry
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={{
      backgroundColor: currentColors.background,
      borderColor: currentColors.border,
      borderWidth: 1,
      borderRadius: 12,
      margin: 16,
      maxHeight: 400
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: currentColors.border
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons
            name={getSeverityIcon(error.severity)}
            size={24}
            color={getSeverityColor(error.severity)}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{
              color: currentColors.text,
              fontSize: 16,
              fontWeight: '600'
            }}>
              Verification Issue
            </Text>
            <Text style={{
              color: currentColors.secondaryText,
              fontSize: 12,
              textTransform: 'capitalize'
            }}>
              {error.severity} Priority
            </Text>
          </View>
        </View>
        
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={{
              padding: 4,
              borderRadius: 4
            }}
          >
            <Ionicons
              name="close"
              size={20}
              color={currentColors.secondaryText}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      <View style={{ padding: 16 }}>
        <Text style={{
          color: currentColors.text,
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 12
        }}>
          {error.userMessage}
        </Text>

        {/* Suggestions */}
        {error.suggestions.length > 0 && (
          <View style={{
            backgroundColor: currentColors.suggestionBackground,
            borderColor: currentColors.suggestionBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16
          }}>
            <Text style={{
              color: currentColors.text,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: 8
            }}>
              Suggestions:
            </Text>
            {error.suggestions.map((suggestion, index) => (
              <View key={index} style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 4
              }}>
                <Text style={{
                  color: currentColors.secondaryText,
                  fontSize: 12,
                  marginRight: 8
                }}>
                  •
                </Text>
                <Text style={{
                  color: currentColors.secondaryText,
                  fontSize: 12,
                  flex: 1,
                  lineHeight: 16
                }}>
                  {suggestion}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recovery Actions */}
        {recoveryActions.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              color: currentColors.text,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: 8
            }}>
              Available Actions:
            </Text>
            {recoveryActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleRecoveryAction(action)}
                style={{
                  backgroundColor: currentColors.buttonBackground,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isRetrying && action.type === 'retry' ? (
                  <ActivityIndicator
                    size="small"
                    color={currentColors.buttonText}
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Ionicons
                    name={
                      action.type === 'retry' ? 'refresh' :
                      action.type === 'fallback' ? 'swap-horizontal' :
                      action.type === 'manual' ? 'settings' : 'arrow-forward'
                    }
                    size={16}
                    color={currentColors.buttonText}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={{
                  color: currentColors.buttonText,
                  fontSize: 14,
                  fontWeight: '600'
                }}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Error Details (if enabled) */}
        {showDetails && (
          <View style={{
            backgroundColor: currentColors.suggestionBackground,
            borderColor: currentColors.suggestionBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12
          }}>
            <Text style={{
              color: currentColors.text,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: 8
            }}>
              Technical Details:
            </Text>
            <Text style={{
              color: currentColors.secondaryText,
              fontSize: 11,
              fontFamily: 'monospace'
            }}>
              Error Code: {error.code}
            </Text>
            <Text style={{
              color: currentColors.secondaryText,
              fontSize: 11,
              fontFamily: 'monospace'
            }}>
              Type: {error.type}
            </Text>
            <Text style={{
              color: currentColors.secondaryText,
              fontSize: 11,
              fontFamily: 'monospace'
            }}>
              Time: {error.timestamp.toLocaleString()}
            </Text>
            {error.details && (
              <Text style={{
                color: currentColors.secondaryText,
                fontSize: 11,
                fontFamily: 'monospace',
                marginTop: 4
              }}>
                Details: {JSON.stringify(error.details, null, 2)}
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default ErrorDisplay;