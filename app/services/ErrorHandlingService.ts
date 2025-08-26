interface ErrorContext {
  [key: string]: any;
}

interface ErrorLogEntry {
  code: string;
  message: string;
  error?: Error;
  context?: ErrorContext;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

// Import the types we need
import { FaceVerificationError, FaceVerificationErrorType, ErrorRecoveryAction } from '../types/faceVerificationErrors';

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorLogs: ErrorLogEntry[] = [];
  private maxLogEntries = 1000;

  private constructor() {}

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  public static logError(
    code: string,
    error: Error | null,
    context?: ErrorContext
  ): void {
    const instance = ErrorHandlingService.getInstance();
    instance.log(code, error, context);
  }

  private log(
    code: string,
    error: Error | null,
    context?: ErrorContext
  ): void {
    const logEntry: ErrorLogEntry = {
      code,
      message: error?.message || code,
      error: error || undefined,
      context,
      timestamp: new Date()
    };

    // Add to in-memory log
    this.errorLogs.unshift(logEntry);
    
    // Keep only the most recent entries
    if (this.errorLogs.length > this.maxLogEntries) {
      this.errorLogs = this.errorLogs.slice(0, this.maxLogEntries);
    }

    // Console logging for development
    if (__DEV__) {
      console.group(`🚨 Error: ${code}`);
      console.error('Message:', logEntry.message);
      if (error) {
        console.error('Error:', error);
      }
      if (context) {
        console.log('Context:', context);
      }
      console.log('Timestamp:', logEntry.timestamp.toISOString());
      console.groupEnd();
    }

    // In production, you might want to send to a logging service
    // this.sendToLoggingService(logEntry);
  }

  public getRecentErrors(limit: number = 50): ErrorLogEntry[] {
    return this.errorLogs.slice(0, limit);
  }

  public clearLogs(): void {
    this.errorLogs = [];
  }

  public getErrorStats(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    recentErrorsCount: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    
    this.errorLogs.forEach(log => {
      errorsByCode[log.code] = (errorsByCode[log.code] || 0) + 1;
      
      // Try to extract type and severity from error if it's a FaceVerificationError
      if (log.error && 'type' in log.error) {
        const faceError = log.error as any;
        if (faceError.type) {
          errorsByType[faceError.type] = (errorsByType[faceError.type] || 0) + 1;
        }
        if (faceError.severity) {
          errorsBySeverity[faceError.severity] = (errorsBySeverity[faceError.severity] || 0) + 1;
        }
      }
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrorsCount = this.errorLogs.filter(
      log => log.timestamp > oneHourAgo
    ).length;

    return {
      totalErrors: this.errorLogs.length,
      errorsByCode,
      recentErrorsCount,
      errorsByType,
      errorsBySeverity
    };
  }

  // Map regular Error to FaceVerificationError
  public static mapErrorToFaceVerificationError(error: Error): FaceVerificationError {
    return {
      type: FaceVerificationErrorType.UNKNOWN_ERROR,
      message: error.message,
      userMessage: 'An unexpected error occurred',
      retryable: true,
      suggestions: ['Please try again', 'Check your connection'],
      severity: 'medium',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date()
    };
  }

  // Create a FaceVerificationError from an Error and type
  public static createError(
    type: FaceVerificationErrorType,
    error: Error,
    context?: ErrorContext
  ): FaceVerificationError {
    return {
      type,
      message: error.message,
      userMessage: this.getUserMessageForType(type),
      retryable: this.isRetryableError(type),
      suggestions: this.getSuggestionsForType(type),
      severity: this.getSeverityForType(type),
      code: type,
      timestamp: new Date()
    };
  }

  // Get user-friendly message for error type
  private static getUserMessageForType(type: FaceVerificationErrorType): string {
    const messages: Record<FaceVerificationErrorType, string> = {
      [FaceVerificationErrorType.CAMERA_PERMISSION_DENIED]: 'Camera access is required. Please check permissions.',
      [FaceVerificationErrorType.CAMERA_NOT_AVAILABLE]: 'Camera is not available on this device.',
      [FaceVerificationErrorType.CAMERA_INITIALIZATION_FAILED]: 'Failed to initialize camera. Please try again.',
      [FaceVerificationErrorType.CAMERA_HARDWARE_ERROR]: 'Camera hardware error. Please restart the app.',
      [FaceVerificationErrorType.NO_FACE_DETECTED]: 'No face detected. Please position your face in the frame.',
      [FaceVerificationErrorType.MULTIPLE_FACES]: 'Multiple faces detected. Please ensure only one face is visible.',
      [FaceVerificationErrorType.FACE_TOO_SMALL]: 'Face appears too small. Please move closer to the camera.',
      [FaceVerificationErrorType.FACE_TOO_LARGE]: 'Face appears too large. Please move further from the camera.',
      [FaceVerificationErrorType.FACE_NOT_CENTERED]: 'Face not centered. Please position your face in the center.',
      [FaceVerificationErrorType.FACE_ANGLE_INVALID]: 'Face angle not suitable. Please look straight at the camera.',
      [FaceVerificationErrorType.POOR_LIGHTING]: 'Poor lighting detected. Please move to a well-lit area.',
      [FaceVerificationErrorType.TOO_BRIGHT]: 'Lighting too bright. Please move to a less bright area.',
      [FaceVerificationErrorType.TOO_DARK]: 'Lighting too dark. Please move to a brighter area.',
      [FaceVerificationErrorType.BLURRY_IMAGE]: 'Image is blurry. Please hold the device steady.',
      [FaceVerificationErrorType.LOW_IMAGE_QUALITY]: 'Image quality is low. Please try again.',
      [FaceVerificationErrorType.NO_LIVENESS_DETECTED]: 'No liveness detected. Please blink or move slightly.',
      [FaceVerificationErrorType.LIVENESS_TIMEOUT]: 'Liveness detection timed out. Please try again.',
      [FaceVerificationErrorType.INSUFFICIENT_MOVEMENT]: 'Insufficient movement detected. Please blink naturally.',
      [FaceVerificationErrorType.FAKE_FACE_DETECTED]: 'Potential fake face detected. Please use a real face.',
      [FaceVerificationErrorType.LOW_CONFIDENCE]: 'Low confidence in verification. Please try again.',
      [FaceVerificationErrorType.FACE_NOT_REGISTERED]: 'Face not registered. Please register your face first.',
      [FaceVerificationErrorType.VERIFICATION_FAILED]: 'Face verification failed. Please try again.',
      [FaceVerificationErrorType.ENCODING_GENERATION_FAILED]: 'Failed to generate face encoding. Please try again.',
      [FaceVerificationErrorType.NETWORK_ERROR]: 'Network error. Please check your connection.',
      [FaceVerificationErrorType.SERVER_ERROR]: 'Server error. Please try again later.',
      [FaceVerificationErrorType.STORAGE_ERROR]: 'Storage error. Please try again.',
      [FaceVerificationErrorType.SYNC_ERROR]: 'Sync error. Data will be synced when connection is restored.',
      [FaceVerificationErrorType.TOO_MANY_ATTEMPTS]: 'Too many attempts. Please wait before trying again.',
      [FaceVerificationErrorType.ACCOUNT_LOCKED]: 'Account temporarily locked. Please contact support.',
      [FaceVerificationErrorType.SECURITY_VIOLATION]: 'Security violation detected. Please contact support.',
      [FaceVerificationErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [FaceVerificationErrorType.TIMEOUT_ERROR]: 'Operation timed out. Please try again.',
      [FaceVerificationErrorType.MEMORY_ERROR]: 'Memory error. Please restart the app.',
      [FaceVerificationErrorType.PROCESSING_ERROR]: 'Processing error. Please try again.'
    };
    return messages[type] || 'An unexpected error occurred. Please try again.';
  }

  // Check if error type is retryable
  private static isRetryableError(type: FaceVerificationErrorType): boolean {
    const nonRetryableTypes = [
      FaceVerificationErrorType.CAMERA_PERMISSION_DENIED,
      FaceVerificationErrorType.CAMERA_NOT_AVAILABLE,
      FaceVerificationErrorType.FACE_NOT_REGISTERED,
      FaceVerificationErrorType.ACCOUNT_LOCKED,
      FaceVerificationErrorType.SECURITY_VIOLATION
    ];
    return !nonRetryableTypes.includes(type);
  }

  // Get suggestions for error type
  private static getSuggestionsForType(type: FaceVerificationErrorType): string[] {
    const suggestions: Record<FaceVerificationErrorType, string[]> = {
      [FaceVerificationErrorType.CAMERA_PERMISSION_DENIED]: ['Check camera permissions', 'Restart the app'],
      [FaceVerificationErrorType.CAMERA_NOT_AVAILABLE]: ['Check if camera is available', 'Try different device'],
      [FaceVerificationErrorType.CAMERA_INITIALIZATION_FAILED]: ['Restart the app', 'Check camera permissions'],
      [FaceVerificationErrorType.CAMERA_HARDWARE_ERROR]: ['Restart the app', 'Contact support'],
      [FaceVerificationErrorType.NO_FACE_DETECTED]: ['Position face in frame', 'Check lighting', 'Remove glasses'],
      [FaceVerificationErrorType.MULTIPLE_FACES]: ['Ensure only one face visible', 'Move to private area'],
      [FaceVerificationErrorType.FACE_TOO_SMALL]: ['Move closer to camera', 'Check face positioning'],
      [FaceVerificationErrorType.FACE_TOO_LARGE]: ['Move further from camera', 'Check face positioning'],
      [FaceVerificationErrorType.FACE_NOT_CENTERED]: ['Center face in frame', 'Look directly at camera'],
      [FaceVerificationErrorType.FACE_ANGLE_INVALID]: ['Look straight at camera', 'Avoid extreme angles'],
      [FaceVerificationErrorType.POOR_LIGHTING]: ['Move to well-lit area', 'Avoid backlighting', 'Use natural light'],
      [FaceVerificationErrorType.TOO_BRIGHT]: ['Move to less bright area', 'Avoid direct sunlight'],
      [FaceVerificationErrorType.TOO_DARK]: ['Move to brighter area', 'Turn on lights'],
      [FaceVerificationErrorType.BLURRY_IMAGE]: ['Hold device steady', 'Clean camera lens'],
      [FaceVerificationErrorType.LOW_IMAGE_QUALITY]: ['Improve lighting', 'Clean camera lens', 'Try again'],
      [FaceVerificationErrorType.NO_LIVENESS_DETECTED]: ['Blink naturally', 'Move slightly', 'Try again'],
      [FaceVerificationErrorType.LIVENESS_TIMEOUT]: ['Try again', 'Ensure good lighting'],
      [FaceVerificationErrorType.INSUFFICIENT_MOVEMENT]: ['Blink naturally', 'Move head slightly'],
      [FaceVerificationErrorType.FAKE_FACE_DETECTED]: ['Use real face', 'Remove masks/coverings'],
      [FaceVerificationErrorType.LOW_CONFIDENCE]: ['Improve lighting', 'Center face in frame', 'Look directly at camera'],
      [FaceVerificationErrorType.FACE_NOT_REGISTERED]: ['Register face first', 'Contact admin'],
      [FaceVerificationErrorType.VERIFICATION_FAILED]: ['Try again', 'Check lighting', 'Improve positioning'],
      [FaceVerificationErrorType.ENCODING_GENERATION_FAILED]: ['Try again', 'Check camera', 'Restart app'],
      [FaceVerificationErrorType.NETWORK_ERROR]: ['Check internet connection', 'Try again later', 'Use offline mode'],
      [FaceVerificationErrorType.SERVER_ERROR]: ['Try again later', 'Contact support'],
      [FaceVerificationErrorType.STORAGE_ERROR]: ['Try again', 'Check storage space', 'Restart app'],
      [FaceVerificationErrorType.SYNC_ERROR]: ['Data will sync when online', 'Check connection'],
      [FaceVerificationErrorType.TOO_MANY_ATTEMPTS]: ['Wait before trying again', 'Contact support'],
      [FaceVerificationErrorType.ACCOUNT_LOCKED]: ['Contact support', 'Wait for unlock'],
      [FaceVerificationErrorType.SECURITY_VIOLATION]: ['Contact support immediately'],
      [FaceVerificationErrorType.UNKNOWN_ERROR]: ['Try again', 'Restart app', 'Contact support'],
      [FaceVerificationErrorType.TIMEOUT_ERROR]: ['Check connection speed', 'Try again', 'Use offline mode'],
      [FaceVerificationErrorType.MEMORY_ERROR]: ['Restart app', 'Close other apps', 'Contact support'],
      [FaceVerificationErrorType.PROCESSING_ERROR]: ['Try again', 'Restart app', 'Contact support']
    };
    return suggestions[type] || ['Try again', 'Check settings', 'Contact support'];
  }

  // Get severity for error type
  private static getSeverityForType(type: FaceVerificationErrorType): 'low' | 'medium' | 'high' | 'critical' {
    const criticalTypes = [
      FaceVerificationErrorType.CAMERA_HARDWARE_ERROR,
      FaceVerificationErrorType.ACCOUNT_LOCKED,
      FaceVerificationErrorType.SECURITY_VIOLATION
    ];
    const highTypes = [
      FaceVerificationErrorType.CAMERA_PERMISSION_DENIED,
      FaceVerificationErrorType.FACE_NOT_REGISTERED,
      FaceVerificationErrorType.SERVER_ERROR
    ];
    const mediumTypes = [
      FaceVerificationErrorType.NETWORK_ERROR,
      FaceVerificationErrorType.STORAGE_ERROR,
      FaceVerificationErrorType.TIMEOUT_ERROR
    ];
    
    if (criticalTypes.includes(type)) return 'critical';
    if (highTypes.includes(type)) return 'high';
    if (mediumTypes.includes(type)) return 'medium';
    return 'low';
  }

  // Get recovery actions for FaceVerificationError
  public static getRecoveryActions(error: FaceVerificationError): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];
    
    if (error.retryable) {
      actions.push({
        type: 'retry',
        label: 'Retry',
        action: () => console.log('Retrying operation...'),
        priority: 1
      });
    }
    
    if (error.type?.includes('CAMERA') || error.message.includes('Camera')) {
      actions.push({
        type: 'manual',
        label: 'Check Permissions',
        action: () => console.log('Checking camera permissions...'),
        priority: 2
      });
    }
    
    actions.push({
      type: 'fallback',
      label: 'Use Alternative',
      action: () => console.log('Using fallback method...'),
      priority: 3
    });
    
    return actions;
  }

  // Report error method
  public static async reportError(error: Error | FaceVerificationError, context?: ErrorContext): Promise<void> {
    if ('type' in error) {
      // It's a FaceVerificationError
      ErrorHandlingService.logError(error.type, null, context);
    } else {
      // It's a regular Error
      ErrorHandlingService.logError(error.name || 'UNKNOWN_ERROR', error, context);
    }
  }

  // Get error statistics
  public static getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    recentErrorsCount: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
  } {
    const instance = ErrorHandlingService.getInstance();
    return instance.getErrorStats();
  }

  // Should use fallback
  public static shouldUseFallback(error: Error | FaceVerificationError, attemptCount: number): boolean {
    const maxAttempts = 3;
    
    if ('type' in error) {
      // FaceVerificationError
      const isCritical = error.severity === 'critical';
      const isRetryable = error.retryable;
      return attemptCount >= maxAttempts || isCritical || !isRetryable;
    } else {
      // Regular Error
      const isCritical = (error as any).critical || error.name.includes('Critical');
      const isRetryable = (error as any).retryable !== false;
      return attemptCount >= maxAttempts || isCritical || !isRetryable;
    }
  }

  // Format error for user
  public static formatErrorForUser(error: Error | FaceVerificationError): string | { title: string; message: string; suggestions: string[]; actions: ErrorRecoveryAction[] } {
    if ('type' in error) {
      // FaceVerificationError
      return {
        title: error.type || 'Error',
        message: error.userMessage,
        suggestions: error.suggestions || [],
        actions: this.getRecoveryActions(error)
      };
    } else {
      // Regular Error
      const userFriendlyMessages: Record<string, string> = {
        'NetworkError': 'Please check your internet connection and try again.',
        'CameraError': 'Camera access is required. Please check permissions.',
        'FaceVerificationError': 'Face verification failed. Please try again with better lighting.',
        'BiometricError': 'Biometric verification failed. Please try again.',
        'OTPError': 'OTP verification failed. Please check the code and try again.'
      };
      
      const message = userFriendlyMessages[error.name] || 'An unexpected error occurred. Please try again.';
      
      return message;
    }
  }

  // Handle error with retry
  public static async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    retryCallback: (attempt: number, error: Error) => void,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        retryCallback(attempt, lastError);
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
    
    throw lastError!;
  }

  // Reset error state
  public static resetErrorState(sessionId?: string): void {
    const instance = ErrorHandlingService.getInstance();
    if (sessionId) {
      // Filter out errors for specific session
      instance.errorLogs = instance.errorLogs.filter(
        log => (log as any).sessionId !== sessionId
      );
    } else {
      instance.clearLogs();
    }
  }

  // Clear error history
  public static clearErrorHistory(): void {
    const instance = ErrorHandlingService.getInstance();
    instance.clearLogs();
  }

  // Check if error is retryable (missing method that was causing the error)
  public static isRetryable(error: FaceVerificationError | null): boolean {
    if (!error) return false;
    return error.retryable !== false;
  }

  // Get user message (missing method)
  public static getUserMessage(error: FaceVerificationError): string {
    return error.userMessage || error.message || 'An unexpected error occurred';
  }

  // Get suggestions (missing method)
  public static getSuggestions(error: FaceVerificationError): string[] {
    return error.suggestions || ['Try again', 'Contact support if the issue persists'];
  }
}

export default ErrorHandlingService;