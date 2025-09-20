import crypto from "crypto";
import nodemailer from "nodemailer";
import ErrorHandlingService from "./ErrorHandlingService";
import SMSService from "./SMSService";
import { pool } from "../config/database";

interface OTPRecord {
  id: string;
  phoneNumber?: string;
  email?: string;
  otp: string;
  purpose:
    | "shift_start"
    | "shift_end"
    | "face_verification"
    | "account_verification"
    | "face-settings-access"
    | "profile-update"
    | "security-verification"
    | "password-reset"
    | "manager_override";
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
  deviceFingerprint?: string;
  ipAddress?: string;
}

interface OTPVerificationResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  isBlocked?: boolean;
  blockExpiresAt?: Date;
}

export class OTPService {
  private static instance: OTPService;
  private smsService: SMSService;
  private emailTransporter: nodemailer.Transporter;
  private otpRecords: Map<string, OTPRecord> = new Map();
  private rateLimitMap: Map<string, { count: number; resetTime: Date }> =
    new Map();
  private emailRateLimitMap: Map<string, { count: number; resetTime: Date }> =
    new Map();
  private blockedNumbers: Map<string, Date> = new Map();
  private blockedEmails: Map<string, Date> = new Map();

  // Rate limiting configuration
  private readonly MAX_OTP_REQUESTS_PER_HOUR = 5;
  private readonly MAX_VERIFICATION_ATTEMPTS = 3;
  private readonly BLOCK_DURATION_MINUTES = 30;
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly OTP_LENGTH = 6;

  private constructor() {
    this.smsService = SMSService.getInstance();
    
    // Initialize email transporter using the same configuration as MFAService
    this.emailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Cleanup expired records every 10 minutes
    setInterval(
      () => {
        this.cleanupExpiredRecords();
      },
      10 * 60 * 1000,
    );

    console.log("OTPService initialized with SMS and Email integration");
  }

  public static getInstance(): OTPService {
    if (!OTPService.instance) {
      OTPService.instance = new OTPService();
    }
    return OTPService.instance;
  }

  // Generate secure OTP
  private generateOTP(): string {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }
    return otp;
  }

  // Validate phone number format
  private validatePhoneNumber(phoneNumber: string): boolean {
    // Basic international phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Validate email format
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Check rate limiting for phone numbers
  private checkRateLimit(phoneNumber: string): boolean {
    const now = new Date();
    const rateLimit = this.rateLimitMap.get(phoneNumber);

    if (!rateLimit) {
      this.rateLimitMap.set(phoneNumber, {
        count: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      });
      return true;
    }

    if (now > rateLimit.resetTime) {
      // Reset rate limit
      this.rateLimitMap.set(phoneNumber, {
        count: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      });
      return true;
    }

    if (rateLimit.count >= this.MAX_OTP_REQUESTS_PER_HOUR) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  // Check rate limiting for email addresses
  private checkEmailRateLimit(email: string): boolean {
    const now = new Date();
    const rateLimit = this.emailRateLimitMap.get(email);

    if (!rateLimit) {
      this.emailRateLimitMap.set(email, {
        count: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      });
      return true;
    }

    if (now > rateLimit.resetTime) {
      // Reset rate limit
      this.emailRateLimitMap.set(email, {
        count: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      });
      return true;
    }

    if (rateLimit.count >= this.MAX_OTP_REQUESTS_PER_HOUR) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  // Check if contact (phone or email) is blocked
  private isContactBlocked(contact: string, isEmail: boolean = false): boolean {
    const blockMap = isEmail ? this.blockedEmails : this.blockedNumbers;
    const blockExpiry = blockMap.get(contact);
    if (!blockExpiry) return false;

    if (new Date() > blockExpiry) {
      blockMap.delete(contact);
      return false;
    }
    return true;
  }

  // Block contact (phone or email)
  private blockContact(contact: string, isEmail: boolean = false): void {
    const blockMap = isEmail ? this.blockedEmails : this.blockedNumbers;
    const blockUntil = new Date();
    blockUntil.setMinutes(
      blockUntil.getMinutes() + this.BLOCK_DURATION_MINUTES,
    );
    blockMap.set(contact, blockUntil);
  }

  // Store OTP in database
  private async storeOTPInDatabase(otpRecord: OTPRecord): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `
        INSERT INTO otp_records (
          id, phone_number, email, otp_hash, purpose, expires_at, 
          attempts, is_used, device_fingerprint, ip_address, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
        [
          otpRecord.id,
          otpRecord.phoneNumber,
          otpRecord.email,
          crypto.createHash("sha256").update(otpRecord.otp).digest("hex"),
          otpRecord.purpose,
          otpRecord.expiresAt,
          otpRecord.attempts,
          otpRecord.isUsed,
          otpRecord.deviceFingerprint,
          otpRecord.ipAddress,
          otpRecord.createdAt,
        ],
      );
    } finally {
      client.release();
    }
  }

  // Send OTP via email
  private async sendOTPEmail(
    email: string,
    userName: string,
    otp: string,
    purpose: string,
  ): Promise<void> {
    const purposeText = {
      "face-settings-access": "access face configuration settings",
      "profile-update": "update your profile",
      "security-verification": "verify your security",
      "password-reset": "reset your password",
      "account-verification": "verify your account",
      "face_verification": "verify your identity",
      "manager_override": "manager override",
    }[purpose] || "verify your identity";

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Avy Tracker - Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3B82F6, #0EA5E9); padding: 30px; border-radius: 15px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Avy Tracker</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Verification Code</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 15px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${userName},</h2>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Your verification code to ${purposeText} is:
            </p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 8px;">${otp}</span>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              This code will expire in <strong>5 minutes</strong>.
            </p>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="color: #92400E; margin: 0; font-size: 14px;">
                <strong>Security Notice:</strong> Never share this code with anyone. Avy Tracker staff will never ask for your verification code.
              </p>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              If you didn't request this code, please contact your administrator immediately.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #9CA3AF; font-size: 12px;">
            <p>This is an automated message from Avy Tracker. Please do not reply to this email.</p>
          </div>
        </div>
      `,
      text: `
Avy Tracker - Verification Code

Hello ${userName},

Your verification code to ${purposeText} is: ${otp}

This code will expire in 5 minutes.

Security Notice: Never share this code with anyone. Avy Tracker staff will never ask for your verification code.

If you didn't request this code, please contact your administrator immediately.

This is an automated message from Avy Tracker. Please do not reply to this email.
      `,
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  // Generate and send OTP via email
  public async generateAndSendEmailOTP(
    email: string,
    purpose:
      | "face-settings-access"
      | "profile-update"
      | "security-verification"
      | "password-reset"
      | "account_verification"
      | "face_verification"
      | "manager_override",
    deviceFingerprint?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    try {
      // Validate email
      if (!this.validateEmail(email)) {
        return {
          success: false,
          message: "Invalid email format",
        };
      }

      // Check if email is blocked
      if (this.isContactBlocked(email, true)) {
        const blockExpiry = this.blockedEmails.get(email);
        return {
          success: false,
          message: `Email is temporarily blocked. Try again after ${blockExpiry?.toLocaleTimeString()}`,
        };
      }

      // Check rate limiting
      if (!this.checkEmailRateLimit(email)) {
        return {
          success: false,
          message: "Too many OTP requests. Please try again later.",
        };
      }

      // Get user name from database
      const client = await pool.connect();
      let userName = "User";
      try {
        const result = await client.query(
          "SELECT name FROM users WHERE email = $1",
          [email],
        );
        if (result.rows.length > 0) {
          userName = result.rows[0].name;
        }
      } finally {
        client.release();
      }

      // Generate OTP
      const otp = this.generateOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      // Create OTP record
      const otpRecord: OTPRecord = {
        id: otpId,
        email,
        otp,
        purpose,
        expiresAt,
        attempts: 0,
        isUsed: false,
        createdAt: new Date(),
        deviceFingerprint,
        ipAddress,
      };

      // Store in memory and database
      this.otpRecords.set(otpId, otpRecord);
      await this.storeOTPInDatabase(otpRecord);

      // Send email
      await this.sendOTPEmail(email, userName, otp, purpose);

      // Log successful OTP generation
      ErrorHandlingService.logError("EMAIL_OTP_GENERATED", null, {
        context: "OTPService.generateAndSendEmailOTP",
        email: email.replace(/(.{2}).*(@.*)/, "$1***$2"),
        purpose,
        otpId,
        deviceFingerprint,
        ipAddress,
      });

      return {
        success: true,
        message: `OTP sent to ${email.replace(/(.{2}).*(@.*)/, "$1***$2")}`,
        otpId,
      };
    } catch (error) {
      ErrorHandlingService.logError("EMAIL_OTP_GENERATION_ERROR", error as Error, {
        context: "OTPService.generateAndSendEmailOTP",
        email: email.replace(/(.{2}).*(@.*)/, "$1***$2"),
        purpose,
        deviceFingerprint,
        ipAddress,
      });

      return {
        success: false,
        message: "Internal error occurred. Please try again.",
      };
    }
  }

  // Generate and send OTP (SMS version - kept for backward compatibility)
  public async generateAndSendOTP(
    phoneNumber: string,
    purpose:
      | "shift_start"
      | "shift_end"
      | "face_verification"
      | "account_verification"
      | "face-settings-access"
      | "profile-update"
      | "security-verification"
      | "password-reset"
      | "manager_override",
    deviceFingerprint?: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string; otpId?: string }> {
    try {
      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        return {
          success: false,
          message:
            "Invalid phone number format. Please use international format (+1234567890)",
        };
      }

      // Check if number is blocked
      if (this.isContactBlocked(phoneNumber, false)) {
        const blockExpiry = this.blockedNumbers.get(phoneNumber);
        return {
          success: false,
          message: `Phone number is temporarily blocked. Try again after ${blockExpiry?.toLocaleTimeString()}`,
        };
      }

      // Check rate limiting
      if (!this.checkRateLimit(phoneNumber)) {
        return {
          success: false,
          message: "Too many OTP requests. Please try again later.",
        };
      }

      // Generate OTP
      const otp = this.generateOTP();
      const otpId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      // Create OTP record
      const otpRecord: OTPRecord = {
        id: otpId,
        phoneNumber,
        otp,
        purpose,
        expiresAt,
        attempts: 0,
        isUsed: false,
        createdAt: new Date(),
        deviceFingerprint,
        ipAddress,
      };

      // Store in memory and database
      this.otpRecords.set(otpId, otpRecord);
      await this.storeOTPInDatabase(otpRecord);

      // Prepare SMS message based on purpose
      const purposeText =
        {
          shift_start: "start your shift",
          shift_end: "end your shift",
          face_verification: "verify your identity",
          account_verification: "verify your account",
          "face-settings-access": "access face settings",
          "profile-update": "update your profile",
          "security-verification": "verify your security",
          "password-reset": "reset your password",
          manager_override: "manager override",
        }[purpose] || "verify your identity";

      // Send SMS using SMS service
      const smsResult = await this.smsService.sendOTPSMS(
        phoneNumber,
        otp,
        purposeText || "verify your identity",
      );

      if (!smsResult.success) {
        // Remove OTP record if SMS failed
        this.otpRecords.delete(otpId);
        return {
          success: false,
          message: "Failed to send OTP. Please try again.",
        };
      }

      // Log successful OTP generation
      ErrorHandlingService.logError("OTP_GENERATED", null, {
        context: "OTPService.generateAndSendOTP",
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"),
        purpose,
        otpId,
        smsProvider: smsResult.provider,
        deviceFingerprint,
        ipAddress,
      });

      return {
        success: true,
        message: `OTP sent to ${phoneNumber.replace(/\d(?=\d{4})/g, "*")}`,
        otpId,
      };
    } catch (error) {
      ErrorHandlingService.logError("OTP_GENERATION_ERROR", error as Error, {
        context: "OTPService.generateAndSendOTP",
        phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*"),
        purpose,
        deviceFingerprint,
        ipAddress,
      });

      return {
        success: false,
        message: "Internal error occurred. Please try again.",
      };
    }
  }

  // Verify OTP
  public async verifyOTP(
    otpId: string,
    providedOTP: string,
    deviceFingerprint?: string,
    ipAddress?: string,
  ): Promise<OTPVerificationResult> {
    try {
      const otpRecord = this.otpRecords.get(otpId);
      if (!otpRecord) {
        return {
          success: false,
          message: "Invalid or expired OTP ID",
        };
      }

      // Check if OTP is already used
      if (otpRecord.isUsed) {
        return {
          success: false,
          message: "OTP has already been used",
        };
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        this.otpRecords.delete(otpId);
        await this.updateOTPInDatabase(otpId, { isUsed: true });
        return {
          success: false,
          message: "OTP has expired. Please request a new one.",
        };
      }

      // Check if contact is blocked
      const isEmail = !!otpRecord.email;
      const contact = otpRecord.email || otpRecord.phoneNumber!;
      if (this.isContactBlocked(contact, isEmail)) {
        return {
          success: false,
          message: `${isEmail ? 'Email' : 'Phone number'} is temporarily blocked due to too many failed attempts`,
        };
      }

      // Increment attempt count
      otpRecord.attempts++;
      await this.updateOTPInDatabase(otpId, { attempts: otpRecord.attempts });

      // Verify OTP
      if (otpRecord.otp !== providedOTP) {
        const remainingAttempts =
          this.MAX_VERIFICATION_ATTEMPTS - otpRecord.attempts;

        if (remainingAttempts <= 0) {
          // Block the contact and mark OTP as used
          this.blockContact(contact, isEmail);
          otpRecord.isUsed = true;
          await this.updateOTPInDatabase(otpId, { isUsed: true });
          this.otpRecords.delete(otpId);

          const blockMap = isEmail ? this.blockedEmails : this.blockedNumbers;
          const blockExpiry = blockMap.get(contact);

          ErrorHandlingService.logError("OTP_VERIFICATION_BLOCKED", null, {
            context: "OTPService.verifyOTP",
            contact: isEmail ? contact.replace(/(.{2}).*(@.*)/, "$1***$2") : contact.replace(/\d(?=\d{4})/g, "*"),
            contactType: isEmail ? "email" : "phone",
            attempts: otpRecord.attempts,
            otpId,
            deviceFingerprint,
            ipAddress,
          });

          return {
            success: false,
            message:
              `Too many failed attempts. ${isEmail ? 'Email' : 'Phone number'} blocked temporarily.`,
            isBlocked: true,
            blockExpiresAt: blockExpiry,
          };
        }

        ErrorHandlingService.logError("OTP_VERIFICATION_FAILED", null, {
          context: "OTPService.verifyOTP",
          contact: isEmail ? contact.replace(/(.{2}).*(@.*)/, "$1***$2") : contact.replace(/\d(?=\d{4})/g, "*"),
          contactType: isEmail ? "email" : "phone",
          attempts: otpRecord.attempts,
          remainingAttempts,
          otpId,
          deviceFingerprint,
          ipAddress,
        });

        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
        };
      }

      // OTP is valid - mark as used
      otpRecord.isUsed = true;
      await this.updateOTPInDatabase(otpId, {
        isUsed: true,
        verifiedAt: new Date(),
      });

      // Log successful verification
      ErrorHandlingService.logError("OTP_VERIFICATION_SUCCESS", null, {
        context: "OTPService.verifyOTP",
        contact: isEmail ? contact.replace(/(.{2}).*(@.*)/, "$1***$2") : contact.replace(/\d(?=\d{4})/g, "*"),
        contactType: isEmail ? "email" : "phone",
        purpose: otpRecord.purpose,
        attempts: otpRecord.attempts,
        otpId,
        deviceFingerprint,
        ipAddress,
      });

      // Clean up the OTP record after successful verification
      setTimeout(() => {
        this.otpRecords.delete(otpId);
      }, 5000); // Keep for 5 seconds for any immediate follow-up requests

      return {
        success: true,
        message: "OTP verified successfully",
      };
    } catch (error) {
      ErrorHandlingService.logError("OTP_VERIFICATION_ERROR", error as Error, {
        context: "OTPService.verifyOTP",
        otpId,
        deviceFingerprint,
        ipAddress,
      });

      return {
        success: false,
        message: "Internal error occurred during verification",
      };
    }
  }

  // Update OTP record in database
  private async updateOTPInDatabase(
    otpId: string,
    updates: Partial<{
      attempts: number;
      isUsed: boolean;
      verifiedAt: Date;
    }>,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Map JavaScript property names to database column names
      const columnMapping: { [key: string]: string } = {
        attempts: "attempts",
        isUsed: "is_used",
        verifiedAt: "verified_at",
      };

      const setClause = Object.keys(updates)
        .map((key, index) => `${columnMapping[key] || key} = $${index + 2}`)
        .join(", ");

      if (setClause) {
        await client.query(
          `UPDATE otp_records SET ${setClause}, updated_at = NOW() WHERE id = $1`,
          [otpId, ...Object.values(updates)],
        );
      }
    } finally {
      client.release();
    }
  }

  // Get OTP status
  public getOTPStatus(otpId: string): {
    exists: boolean;
    isExpired?: boolean;
    isUsed?: boolean;
    attempts?: number;
    remainingTime?: number;
  } {
    const otpRecord = this.otpRecords.get(otpId);
    if (!otpRecord) {
      return { exists: false };
    }

    const now = new Date();
    const isExpired = now > otpRecord.expiresAt;
    const remainingTime = Math.max(
      0,
      otpRecord.expiresAt.getTime() - now.getTime(),
    );

    return {
      exists: true,
      isExpired,
      isUsed: otpRecord.isUsed,
      attempts: otpRecord.attempts,
      remainingTime: Math.floor(remainingTime / 1000), // Return in seconds
    };
  }

  // Cleanup expired records
  private cleanupExpiredRecords(): void {
    const now = new Date();
    let cleanedCount = 0;

    // Clean expired OTP records
    for (const [otpId, record] of this.otpRecords.entries()) {
      if (now > record.expiresAt || record.isUsed) {
        this.otpRecords.delete(otpId);
        cleanedCount++;
      }
    }

    // Clean expired rate limits
    for (const [phoneNumber, rateLimit] of this.rateLimitMap.entries()) {
      if (now > rateLimit.resetTime) {
        this.rateLimitMap.delete(phoneNumber);
      }
    }

    // Clean expired email rate limits
    for (const [email, rateLimit] of this.emailRateLimitMap.entries()) {
      if (now > rateLimit.resetTime) {
        this.emailRateLimitMap.delete(email);
      }
    }

    // Clean expired blocks
    for (const [phoneNumber, blockExpiry] of this.blockedNumbers.entries()) {
      if (now > blockExpiry) {
        this.blockedNumbers.delete(phoneNumber);
      }
    }

    // Clean expired email blocks
    for (const [email, blockExpiry] of this.blockedEmails.entries()) {
      if (now > blockExpiry) {
        this.blockedEmails.delete(email);
      }
    }

    if (cleanedCount > 0) {
      console.log(`OTPService: Cleaned up ${cleanedCount} expired records`);
    }
  }

  // Get service statistics (for monitoring)
  public getStatistics(): {
    activeOTPs: number;
    rateLimitedNumbers: number;
    rateLimitedEmails: number;
    blockedNumbers: number;
    blockedEmails: number;
    smsStatistics: any;
  } {
    return {
      activeOTPs: this.otpRecords.size,
      rateLimitedNumbers: this.rateLimitMap.size,
      rateLimitedEmails: this.emailRateLimitMap.size,
      blockedNumbers: this.blockedNumbers.size,
      blockedEmails: this.blockedEmails.size,
      smsStatistics: this.smsService.getStatistics(),
    };
  }

  // Admin functions
  public unblockNumber(phoneNumber: string): boolean {
    return this.blockedNumbers.delete(phoneNumber);
  }

  public unblockEmail(email: string): boolean {
    return this.blockedEmails.delete(email);
  }

  public resetRateLimit(contact: string, isEmail: boolean = false): boolean {
    if (isEmail) {
      return this.emailRateLimitMap.delete(contact);
    } else {
      return this.rateLimitMap.delete(contact);
    }
  }

  // Get SMS provider status
  public async getSMSProviderStatus(): Promise<any> {
    return await this.smsService.getProviderStatus();
  }
}

export default OTPService;
