/**
 * Error Display Component
 * 
 * Displays error messages with suggestions and recovery actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FaceVerificationError, ErrorRecoveryAction } from '../types/faceVerificationErrors';

interface ErrorDisplayProps {
  error: FaceVerificationError;
  onRetry?: () => void;
  onCancel?: () => void;
  recoveryActions?: ErrorRecoveryAction[];
  isRetrying?: boolean;
  onDismiss?: () => void;
  onRecoveryAction?: (action: ErrorRecoveryAction) => void;
  compact?: boolean;
  showDetails?: boolean;
}

export default function ErrorDisplay({ 
  error, 
  onRetry, 
  onCancel, 
  recoveryActions = [],
  isRetrying = false,
  onDismiss,
  onRecoveryAction,
  compact = false,
  showDetails = false
}: ErrorDisplayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
      </View>
      
      <Text style={styles.title}>Verification Error</Text>
      <Text style={styles.message}>{error.userMessage}</Text>
      
      {error.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {error.suggestions.map((suggestion, index) => (
            <Text key={index} style={styles.suggestion}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}
      
      <View style={styles.actionsContainer}>
        {error.retryable && onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
        
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  suggestionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  suggestion: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});