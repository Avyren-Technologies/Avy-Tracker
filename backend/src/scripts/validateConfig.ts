#!/usr/bin/env ts-node

import environmentService from "../config/environment";
import SMSService from "../services/SMSService";
import { pool } from "../config/database";

interface ValidationResult {
  component: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

class ConfigValidator {
  private results: ValidationResult[] = [];

  public async validateAll(): Promise<void> {
    console.log(
      "🔍 Starting Enhanced Shift Tracker Configuration Validation...\n",
    );

    // Validate environment configuration
    await this.validateEnvironment();

    // Validate database connection
    await this.validateDatabase();

    // Validate SMS services
    await this.validateSMSServices();

    // Validate face detection dependencies
    await this.validateFaceDetection();

    // Validate security configuration
    await this.validateSecurity();

    // Print results
    this.printResults();
  }

  private async validateEnvironment(): Promise<void> {
    try {
      const config = environmentService.getConfig();

      // Check critical environment variables
      const criticalVars = [
        { key: "NODE_ENV", value: config.nodeEnv },
        { key: "PORT", value: config.port },
        { key: "JWT_SECRET", value: config.jwt.secret },
        { key: "DATABASE_URL", value: config.database.url },
      ];

      for (const variable of criticalVars) {
        if (
          !variable.value ||
          variable.value === "fallback-secret-change-in-production"
        ) {
          this.addResult(
            "Environment",
            "fail",
            `${variable.key} is not properly configured`,
          );
        } else {
          this.addResult(
            "Environment",
            "pass",
            `${variable.key} is configured`,
          );
        }
      }

      // Check production-specific requirements
      if (config.nodeEnv === "production") {
        const productionChecks = [
          { name: "HTTPS Only", value: config.security.httpsOnly },
          { name: "Secure Cookies", value: config.security.secureCookies },
          { name: "Helmet Enabled", value: config.security.helmetEnabled },
        ];

        for (const check of productionChecks) {
          if (!check.value) {
            this.addResult(
              "Production Security",
              "warning",
              `${check.name} should be enabled in production`,
            );
          } else {
            this.addResult(
              "Production Security",
              "pass",
              `${check.name} is properly configured`,
            );
          }
        }
      }

      // Check feature flags
      const features = config.features;
      this.addResult(
        "Features",
        "pass",
        `Face Verification: ${features.faceVerification ? "Enabled" : "Disabled"}`,
      );
      this.addResult(
        "Features",
        "pass",
        `OTP Verification: ${features.otpVerification ? "Enabled" : "Disabled"}`,
      );
      this.addResult(
        "Features",
        "pass",
        `Geofence Tracking: ${features.geofenceTracking ? "Enabled" : "Disabled"}`,
      );
    } catch (error) {
      this.addResult(
        "Environment",
        "fail",
        `Environment validation failed: ${(error as Error).message}`,
      );
    }
  }

  private async validateDatabase(): Promise<void> {
    try {
      // Test database connection
      const client = await pool.connect();

      try {
        // Test basic query
        const result = await client.query(
          "SELECT NOW() as current_time, version() as pg_version",
        );
        const { current_time, pg_version } = result.rows[0];

        this.addResult("Database", "pass", "Database connection successful", {
          currentTime: current_time,
          version: pg_version.split(" ")[0] + " " + pg_version.split(" ")[1],
        });

        // Check if required tables exist
        const tableCheck = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'companies', 'employee_shifts', 'expenses', 'otp_records')
        `);

        const existingTables = tableCheck.rows.map((row) => row.table_name);
        const requiredTables = [
          "users",
          "companies",
          "employee_shifts",
          "expenses",
        ];

        for (const table of requiredTables) {
          if (existingTables.includes(table)) {
            this.addResult(
              "Database Schema",
              "pass",
              `Table '${table}' exists`,
            );
          } else {
            this.addResult(
              "Database Schema",
              "fail",
              `Table '${table}' is missing`,
            );
          }
        }

        // Check for OTP tables (new feature)
        if (existingTables.includes("otp_records")) {
          this.addResult(
            "Database Schema",
            "pass",
            "OTP tables are configured",
          );
        } else {
          this.addResult(
            "Database Schema",
            "warning",
            "OTP tables not found - run migration 007",
          );
        }

        // Check PostGIS extension for geofencing
        const extensionCheck = await client.query(`
          SELECT extname FROM pg_extension WHERE extname = 'postgis'
        `);

        if (extensionCheck.rows.length > 0) {
          this.addResult(
            "Database Extensions",
            "pass",
            "PostGIS extension is installed",
          );
        } else {
          this.addResult(
            "Database Extensions",
            "warning",
            "PostGIS extension not found - geofencing may not work",
          );
        }
      } finally {
        client.release();
      }
    } catch (error) {
      this.addResult(
        "Database",
        "fail",
        `Database connection failed: ${(error as Error).message}`,
      );
    }
  }

  private async validateSMSServices(): Promise<void> {
    try {
      const smsService = SMSService.getInstance();
      const providerStatus = await smsService.getProviderStatus();

      for (const [providerName, status] of Object.entries(providerStatus)) {
        if (status.available) {
          this.addResult(
            "SMS Provider",
            "pass",
            `${providerName} is available`,
            status.details,
          );
        } else {
          const severity = providerName === "Console" ? "warning" : "fail";
          this.addResult(
            "SMS Provider",
            severity,
            `${providerName} is not available`,
            status.details,
          );
        }
      }

      // Test SMS statistics
      const stats = smsService.getStatistics();
      this.addResult("SMS Service", "pass", "SMS service initialized", {
        totalSent: stats.totalSent,
        totalFailed: stats.totalFailed,
        totalCost: stats.totalCost,
      });
    } catch (error) {
      this.addResult(
        "SMS Service",
        "fail",
        `SMS service validation failed: ${(error as Error).message}`,
      );
    }
  }

  private async validateFaceDetection(): Promise<void> {
    try {
      const config = environmentService.getConfig();

      // Check face verification configuration
      const faceConfig = config.faceVerification;

      if (faceConfig.threshold >= 0 && faceConfig.threshold <= 1) {
        this.addResult(
          "Face Detection",
          "pass",
          `Verification threshold: ${faceConfig.threshold}`,
        );
      } else {
        this.addResult(
          "Face Detection",
          "fail",
          "Invalid face verification threshold",
        );
      }

      if (
        faceConfig.livenessThreshold >= 0 &&
        faceConfig.livenessThreshold <= 1
      ) {
        this.addResult(
          "Face Detection",
          "pass",
          `Liveness threshold: ${faceConfig.livenessThreshold}`,
        );
      } else {
        this.addResult("Face Detection", "fail", "Invalid liveness threshold");
      }

      // Check biometric storage configuration
      const biometricConfig = config.biometric;

      if (biometricConfig.encryptionKey.length === 32) {
        this.addResult(
          "Biometric Storage",
          "pass",
          "Encryption key is properly configured",
        );
      } else {
        this.addResult(
          "Biometric Storage",
          "fail",
          "Biometric encryption key must be 32 characters",
        );
      }

      this.addResult(
        "Biometric Storage",
        "pass",
        `Storage TTL: ${biometricConfig.storageTtl / 86400} days`,
      );
      this.addResult(
        "Biometric Storage",
        "pass",
        `Backup enabled: ${biometricConfig.backupEnabled}`,
      );
    } catch (error) {
      this.addResult(
        "Face Detection",
        "fail",
        `Face detection validation failed: ${(error as Error).message}`,
      );
    }
  }

  private async validateSecurity(): Promise<void> {
    try {
      const config = environmentService.getConfig();
      const security = config.security;

      // Check JWT configuration
      if (config.jwt.secret.length >= 32) {
        this.addResult("Security", "pass", "JWT secret is sufficiently long");
      } else {
        this.addResult(
          "Security",
          "warning",
          "JWT secret should be at least 32 characters",
        );
      }

      // Check bcrypt rounds
      if (security.bcryptRounds >= 10 && security.bcryptRounds <= 15) {
        this.addResult(
          "Security",
          "pass",
          `Bcrypt rounds: ${security.bcryptRounds}`,
        );
      } else {
        this.addResult(
          "Security",
          "warning",
          "Bcrypt rounds should be between 10-15 for optimal security/performance",
        );
      }

      // Check rate limiting
      this.addResult(
        "Security",
        "pass",
        `Rate limit: ${security.rateLimitMaxRequests} requests per ${security.rateLimitWindowMs / 60000} minutes`,
      );

      // Check CORS configuration
      if (config.nodeEnv === "production" && security.corsOrigin === "*") {
        this.addResult(
          "Security",
          "warning",
          "CORS origin should be restricted in production",
        );
      } else {
        this.addResult(
          "Security",
          "pass",
          `CORS origin: ${security.corsOrigin}`,
        );
      }
    } catch (error) {
      this.addResult(
        "Security",
        "fail",
        `Security validation failed: ${(error as Error).message}`,
      );
    }
  }

  private addResult(
    component: string,
    status: "pass" | "fail" | "warning",
    message: string,
    details?: any,
  ): void {
    this.results.push({ component, status, message, details });
  }

  private printResults(): void {
    console.log("\n📊 Configuration Validation Results:\n");

    const groupedResults = this.results.reduce(
      (acc, result) => {
        if (!acc[result.component]) {
          acc[result.component] = [];
        }
        acc[result.component].push(result);
        return acc;
      },
      {} as Record<string, ValidationResult[]>,
    );

    let totalPass = 0;
    let totalFail = 0;
    let totalWarning = 0;

    for (const [component, results] of Object.entries(groupedResults)) {
      console.log(`\n🔧 ${component}:`);

      for (const result of results) {
        const icon =
          result.status === "pass"
            ? "✅"
            : result.status === "fail"
              ? "❌"
              : "⚠️";
        console.log(`  ${icon} ${result.message}`);

        if (result.details) {
          console.log(
            `     Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, "\n     ")}`,
          );
        }

        if (result.status === "pass") totalPass++;
        else if (result.status === "fail") totalFail++;
        else totalWarning++;
      }
    }

    console.log("\n📈 Summary:");
    console.log(`  ✅ Passed: ${totalPass}`);
    console.log(`  ⚠️  Warnings: ${totalWarning}`);
    console.log(`  ❌ Failed: ${totalFail}`);

    if (totalFail > 0) {
      console.log(
        "\n🚨 Critical issues found! Please fix the failed validations before proceeding.",
      );
      process.exit(1);
    } else if (totalWarning > 0) {
      console.log(
        "\n⚠️  Some warnings found. Consider addressing them for optimal performance.",
      );
    } else {
      console.log(
        "\n🎉 All validations passed! Your configuration looks good.",
      );
    }

    console.log("\n💡 Tips:");
    console.log("  - Run this validation after any configuration changes");
    console.log(
      "  - Check the .env.example file for all available configuration options",
    );
    console.log(
      "  - Ensure all production secrets are properly set before deployment",
    );
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ConfigValidator();
  validator
    .validateAll()
    .then(() => {
      console.log("\n✨ Configuration validation completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Validation failed with error:", error.message);
      process.exit(1);
    });
}

export default ConfigValidator;
