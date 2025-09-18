/**
 * Error Handling Hook
 *
 * Provides error handling capabilities with retry logic
 */

import { useState, useCallback } from "react";
import {
  FaceVerificationError,
  FaceVerificationErrorType,
  ErrorRecoveryAction,
  ErrorHandlingConfig,
  ErrorContext,
} from "../types/faceVerificationErrors";
import ErrorHandlingService from "../services/ErrorHandlingService";

interface UseErrorHandlingReturn {
  error: FaceVerificationError | null;
  isRetrying: boolean;
  retryCount: number;
  recoveryActions: ErrorRecoveryAction[];
  handleError: (error: FaceVerificationError) => void;
  clearError: () => void;
  retry: () => void;
  executeRecoveryAction: (action: ErrorRecoveryAction) => void;
  canRetry: boolean;
  shouldShowFallback: boolean;
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>,
  ) => Promise<T>;
  formatErrorForDisplay?: (error: FaceVerificationError) => any;
}

export function useErrorHandling(
  config: ErrorHandlingConfig = {},
): UseErrorHandlingReturn {
  const [error, setError] = useState<FaceVerificationError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const maxRetries = config.retryConfig?.maxAttempts || 3;

  const handleError = useCallback(
    (newError: FaceVerificationError) => {
      setError(newError);
      if (config.onError) {
        config.onError(newError);
      }
    },
    [config],
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  const retry = useCallback(() => {
    if (retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    if (config.onRetry && error) {
      config.onRetry(retryCount + 1, error);
    }

    // Clear error after retry attempt
    setTimeout(() => {
      setError(null);
      setIsRetrying(false);
    }, 1000);
  }, [retryCount, maxRetries, config, error]);

  const executeRecoveryAction = useCallback(
    (action: ErrorRecoveryAction) => {
      if (config.onRecovery) {
        config.onRecovery(action);
      }
      action.action();
    },
    [config],
  );

  const executeWithErrorHandling = useCallback(
    async <T>(
      operation: () => Promise<T>,
      context?: Partial<ErrorContext>,
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        let faceError: FaceVerificationError;

        if (error && typeof error === "object" && "type" in error) {
          faceError = error as FaceVerificationError;
        } else {
          faceError = ErrorHandlingService.createError(
            FaceVerificationErrorType.UNKNOWN_ERROR,
            error as Error,
            context,
          );
        }

        handleError(faceError);
        throw faceError;
      }
    },
    [handleError],
  );

  const recoveryActions: ErrorRecoveryAction[] = [
    {
      type: "retry",
      label: "Try Again",
      description: "Retry the operation",
      action: retry,
      priority: 1,
    },
    {
      type: "fallback",
      label: "Cancel",
      description: "Cancel the operation",
      action: clearError,
      priority: 2,
    },
  ];

  const formatErrorForDisplay = (error: FaceVerificationError) => {
    return {
      title: error.type || "Error",
      message: error.userMessage || error.message,
      suggestions: error.suggestions || [],
    };
  };

  return {
    error,
    isRetrying,
    retryCount,
    recoveryActions,
    handleError,
    clearError,
    retry,
    executeRecoveryAction,
    canRetry:
      retryCount < maxRetries && ErrorHandlingService.isRetryable(error),
    shouldShowFallback: retryCount >= maxRetries,
    executeWithErrorHandling,
    formatErrorForDisplay,
  };
}
