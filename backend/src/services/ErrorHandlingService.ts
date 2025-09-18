import fs from "fs";
import path from "path";

interface ErrorContext {
  [key: string]: any;
}

interface ErrorLogEntry {
  id: string;
  code: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: ErrorContext;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  severity: "low" | "medium" | "high" | "critical";
}

export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private errorLogs: ErrorLogEntry[] = [];
  private maxLogEntries = 10000;
  private logFilePath: string;

  private constructor() {
    // Set up log file path
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, "error.log");
  }

  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  public static logError(
    code: string,
    error: Error | null,
    context?: ErrorContext,
  ): void {
    const instance = ErrorHandlingService.getInstance();
    instance.log(code, error, context);
  }

  private log(code: string, error: Error | null, context?: ErrorContext): void {
    const severity = this.determineSeverity(code, error, context);

    const logEntry: ErrorLogEntry = {
      id: this.generateId(),
      code,
      message: error?.message || code,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      context: this.sanitizeContext(context),
      timestamp: new Date(),
      severity,
    };

    // Add to in-memory log
    this.errorLogs.unshift(logEntry);

    // Keep only the most recent entries
    if (this.errorLogs.length > this.maxLogEntries) {
      this.errorLogs = this.errorLogs.slice(0, this.maxLogEntries);
    }

    // Console logging
    this.logToConsole(logEntry);

    // File logging
    this.logToFile(logEntry);

    // Send to external services if configured
    this.sendToExternalServices(logEntry);
  }

  private determineSeverity(
    code: string,
    error: Error | null,
    context?: ErrorContext,
  ): "low" | "medium" | "high" | "critical" {
    // Critical errors
    if (context?.critical || code.includes("CRITICAL")) {
      return "critical";
    }

    // High severity errors
    if (
      code.includes("DATABASE") ||
      code.includes("AUTH") ||
      code.includes("SECURITY") ||
      error?.name === "TypeError" ||
      error?.name === "ReferenceError"
    ) {
      return "high";
    }

    // Medium severity errors
    if (
      code.includes("NETWORK") ||
      code.includes("API") ||
      code.includes("VALIDATION") ||
      error?.name === "ValidationError"
    ) {
      return "medium";
    }

    // Default to low severity
    return "low";
  }

  private sanitizeContext(context?: ErrorContext): ErrorContext | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };

    // Remove sensitive information
    const sensitiveKeys = ["password", "token", "secret", "key", "auth"];

    Object.keys(sanitized).forEach((key) => {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  private logToConsole(logEntry: ErrorLogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const severity = logEntry.severity.toUpperCase();

    console.error(
      `[${timestamp}] ${severity} - ${logEntry.code}: ${logEntry.message}`,
    );

    if (logEntry.error?.stack && process.env.NODE_ENV === "development") {
      console.error("Stack trace:", logEntry.error.stack);
    }

    if (logEntry.context) {
      console.error("Context:", JSON.stringify(logEntry.context, null, 2));
    }
  }

  private logToFile(logEntry: ErrorLogEntry): void {
    try {
      const logLine = JSON.stringify(logEntry) + "\n";
      fs.appendFileSync(this.logFilePath, logLine);
    } catch (fileError) {
      console.error("Failed to write to log file:", fileError);
    }
  }

  private sendToExternalServices(logEntry: ErrorLogEntry): void {
    // Send to Sentry, DataDog, or other monitoring services
    // This is where you'd integrate with external error tracking services

    if (process.env.SENTRY_DSN && logEntry.severity === "critical") {
      // Example Sentry integration (would need @sentry/node package)
      // Sentry.captureException(logEntry.error, {
      //   tags: { code: logEntry.code },
      //   extra: logEntry.context
      // });
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public getRecentErrors(limit: number = 100): ErrorLogEntry[] {
    return this.errorLogs.slice(0, limit);
  }

  public getErrorsByCode(code: string): ErrorLogEntry[] {
    return this.errorLogs.filter((log) => log.code === code);
  }

  public getErrorsBySeverity(
    severity: "low" | "medium" | "high" | "critical",
  ): ErrorLogEntry[] {
    return this.errorLogs.filter((log) => log.severity === severity);
  }

  public clearLogs(): void {
    this.errorLogs = [];
  }

  public getErrorStats(): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrorsCount: number;
  } {
    const errorsByCode: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    this.errorLogs.forEach((log) => {
      errorsByCode[log.code] = (errorsByCode[log.code] || 0) + 1;
      errorsBySeverity[log.severity] =
        (errorsBySeverity[log.severity] || 0) + 1;
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrorsCount = this.errorLogs.filter(
      (log) => log.timestamp > oneHourAgo,
    ).length;

    return {
      totalErrors: this.errorLogs.length,
      errorsByCode,
      errorsBySeverity,
      recentErrorsCount,
    };
  }

  // Static helper methods for common error scenarios
  public static handleCriticalError(
    code: string,
    error: Error,
    context?: ErrorContext,
  ): void {
    ErrorHandlingService.logError(code, error, { ...context, critical: true });
  }

  public static handleDatabaseError(
    operation: string,
    error: Error,
    context?: ErrorContext,
  ): void {
    ErrorHandlingService.logError(
      `DATABASE_${operation.toUpperCase()}_ERROR`,
      error,
      {
        ...context,
        operation,
        type: "database",
      },
    );
  }

  public static handleAuthError(
    operation: string,
    error: Error,
    context?: ErrorContext,
  ): void {
    ErrorHandlingService.logError(
      `AUTH_${operation.toUpperCase()}_ERROR`,
      error,
      {
        ...context,
        operation,
        type: "authentication",
      },
    );
  }

  public static handleValidationError(
    field: string,
    error: Error,
    context?: ErrorContext,
  ): void {
    ErrorHandlingService.logError(
      `VALIDATION_${field.toUpperCase()}_ERROR`,
      error,
      {
        ...context,
        field,
        type: "validation",
      },
    );
  }

  public static handleNetworkError(
    endpoint: string,
    error: Error,
    context?: ErrorContext,
  ): void {
    ErrorHandlingService.logError(
      `NETWORK_${endpoint.toUpperCase()}_ERROR`,
      error,
      {
        ...context,
        endpoint,
        type: "network",
        retryable: true,
      },
    );
  }

  // Method to export logs for analysis
  public exportLogs(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers = ["timestamp", "severity", "code", "message", "context"];
      const rows = this.errorLogs.map((log) => [
        log.timestamp.toISOString(),
        log.severity,
        log.code,
        log.message,
        JSON.stringify(log.context || {}),
      ]);

      return [headers, ...rows].map((row) => row.join(",")).join("\n");
    }

    return JSON.stringify(this.errorLogs, null, 2);
  }
}

export default ErrorHandlingService;
