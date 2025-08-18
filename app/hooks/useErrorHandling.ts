/**
 * Error Handling Hook for Face Verification
 * Provides error handling capabilities to React components
 */

import { useState, useCallback, useRef } from 'react';
import {
  FaceVerificationError,
  FaceVerificationErrorType,
  ErrorContext,
  ErrorRecoveryAction,
  RetryConfig,
  DEFAULT_RETRY_CONFIG
} from '../types/faceVerificationErrors';
import ErrorHandlingService from '../services/ErrorHandlingService';

interface UseErrorHandlingOptions {
  retryConfig?: Partial<RetryConfig>;
  onError?: (error: FaceVerificationError) => void;
  onRetry?: (attempt: number, error: FaceVerificationError) => void;
  onRecovery?: (action: ErrorRecoveryAction) => void;
  sessionId?: string;
}

interface ErrorState {
  currentError: FaceVerificationError | null;
  isRetrying: boolean;
  retryCount: number;
  recoveryActions: ErrorRecoveryAction[];
  errorHistory: FaceVerificationError[];
}

interface UseErrorHandlingReturn {
  // Error state
  error: FaceVerificationError | null;
  isRetrying: boolean;
  retryCount: number;
  recoveryActions: ErrorRecoveryAction[];
  errorHistory: FaceVerificationError[];
  
  // Error handling functions
  handleError: (error: Error | FaceVerificationError, context?: Partial<ErrorContext>) => void;
  clearError: () => void;
  retry: () => Promise<void>;
  executeRecoveryAction: (action: ErrorRecoveryAction) => Promise<void>;
  
  // Utility functions
  formatErrorForDisplay: () => string | { title: string; message: string; suggestions: string[]; actions: ErrorRecoveryAction[] } | null;
  canRetry: () => boolean;
  shouldShowFallback: () => boolean;
  
  // Async operation wrapper
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>
  ) => Promise<T>;
}

export const useErrorHandling = (options: UseErrorHandlingOptions = {}): UseErrorHandlingReturn => {
  const {
    retryConfig = {},
    onError,
    onRetry,
    onRecovery,
    sessionId = 'default'
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    currentError: null,
    isRetrying: false,
    retryCount: 0,
    recoveryActions: [],
    errorHistory: []
  });

  const retryOperationRef = useRef<(() => Promise<void>) | null>(null);
  const mergedRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  /**
   * Handle an error
   */
  const handleError = useCallback((
    error: Error | FaceVerificationError,
    context: Partial<ErrorContext> = {}
  ) => {
    const faceError: FaceVerificationError = !('type' in error)
      ? ErrorHandlingService.mapErrorToFaceVerificationError(error)
      : error as FaceVerificationError;

    const errorContext: ErrorContext = {
      sessionId,
      timestamp: new Date(),
      ...context
    };

    // Report error
    ErrorHandlingService.reportError(faceError, errorContext);

    // Get recovery actions
    const recoveryActions = ErrorHandlingService.getRecoveryActions(faceError);

    // Update state
    setErrorState(prev => ({
      currentError: faceError,
      isRetrying: false,
      retryCount: prev.retryCount + (faceError.retryable ? 1 : 0),
      recoveryActions,
      errorHistory: [...prev.errorHistory, faceError].slice(-10) // Keep last 10 errors
    }));

    // Call error callback
    if (onError) {
      onError(faceError);
    }
  }, [sessionId, onError]);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      currentError: null,
      isRetrying: false,
      recoveryActions: []
    }));
    ErrorHandlingService.resetErrorState(sessionId);
  }, [sessionId]);

  /**
   * Retry the last operation
   */
  const retry = useCallback(async () => {
    if (!retryOperationRef.current || !errorState.currentError?.retryable) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true
    }));

    try {
      await retryOperationRef.current();
      clearError();
    } catch (error) {
      handleError(error as Error);
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [errorState.currentError, clearError, handleError]);

  /**
   * Execute a recovery action
   */
  const executeRecoveryAction = useCallback(async (action: ErrorRecoveryAction) => {
    try {
      await action.action();
      
      if (onRecovery) {
        onRecovery(action);
      }

      // Clear error if it's a successful recovery action
      if (action.type === 'retry' || action.type === 'fallback') {
        clearError();
      }
    } catch (error) {
      handleError(error as Error, { 
        attemptNumber: errorState.retryCount + 1 
      });
    }
  }, [onRecovery, clearError, handleError, errorState.retryCount]);

  /**
   * Format error for display
   */
  const formatErrorForDisplay = useCallback(() => {
    if (!errorState.currentError) return null;
    
    return ErrorHandlingService.formatErrorForUser(errorState.currentError);
  }, [errorState.currentError]);

  /**
   * Check if retry is possible
   */
  const canRetry = useCallback(() => {
    return !!(
      errorState.currentError?.retryable &&
      errorState.retryCount < mergedRetryConfig.maxAttempts &&
      !errorState.isRetrying
    );
  }, [errorState.currentError, errorState.retryCount, errorState.isRetrying, mergedRetryConfig.maxAttempts]);

  /**
   * Check if fallback should be shown
   */
  const shouldShowFallback = useCallback(() => {
    if (!errorState.currentError) return false;
    
    return ErrorHandlingService.shouldUseFallback(
      errorState.currentError,
      errorState.retryCount
    );
  }, [errorState.currentError, errorState.retryCount]);

  /**
   * Execute operation with error handling and retry logic
   */
  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> => {
    // Store operation for retry
    retryOperationRef.current = async () => {
      await operation();
    };

    const errorContext: ErrorContext = {
      sessionId,
      timestamp: new Date(),
      ...context
    };

    try {
      return await ErrorHandlingService.handleErrorWithRetry(
        operation,
        (attempt: number, error: Error) => {
          setErrorState(prev => ({
            ...prev,
            isRetrying: true,
            retryCount: attempt
          }));

          if (onRetry) {
            onRetry(attempt, error as unknown as FaceVerificationError);
          }
        },
        mergedRetryConfig.maxAttempts
      );
    } catch (error) {
      handleError(error as Error, context);
      throw error;
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [sessionId, mergedRetryConfig, onRetry, handleError]);

  return {
    // Error state
    error: errorState.currentError,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    recoveryActions: errorState.recoveryActions,
    errorHistory: errorState.errorHistory,
    
    // Error handling functions
    handleError,
    clearError,
    retry,
    executeRecoveryAction,
    
    // Utility functions
    formatErrorForDisplay,
    canRetry,
    shouldShowFallback,
    
    // Async operation wrapper
    executeWithErrorHandling
  };
};

export default useErrorHandling;