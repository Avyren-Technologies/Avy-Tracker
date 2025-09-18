import crypto from "crypto";
import nodemailer from "nodemailer";
import { pool } from "../config/database";
import { MFAToken, MFAVerificationRequest } from "../types";

export class MFAService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  /**
   * Generate a new MFA OTP for a user
   */
  async generateOTP(email: string): Promise<{ otp: string; expires: Date }> {
    const client = await pool.connect();
    try {
      // Check if user exists
      const userResult = await client.query(
        "SELECT id, name FROM users WHERE email = $1",
        [email],
      );

      if (userResult.rows.length === 0) {
        throw new Error("User not found");
      }

      const user = userResult.rows[0];

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();

      // Set expiration to 10 minutes from now
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      // Store OTP in database (encrypted)
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

      await client.query(
        `UPDATE users 
         SET mfa_otp = $1, 
             mfa_otp_expires = $2, 
             mfa_otp_attempts = 0
         WHERE id = $3`,
        [hashedOTP, expires, user.id],
      );

      // Send OTP via email
      await this.sendOTPEmail(email, user.name, otp);

      return { otp, expires };
    } finally {
      client.release();
    }
  }

  /**
   * Verify MFA OTP
   */
  async verifyOTP(
    email: string,
    otp: string,
  ): Promise<{ success: boolean; message: string; userId?: number }> {
    const client = await pool.connect();
    try {
      // Get user and OTP details
      const userResult = await client.query(
        `SELECT id, mfa_otp, mfa_otp_expires, mfa_otp_attempts 
         FROM users 
         WHERE email = $1`,
        [email],
      );

      if (userResult.rows.length === 0) {
        return { success: false, message: "User not found" };
      }

      const user = userResult.rows[0];

      // Check if OTP exists and is not expired
      if (!user.mfa_otp || !user.mfa_otp_expires) {
        return { success: false, message: "No active OTP found" };
      }

      if (new Date() > user.mfa_otp_expires) {
        // Clear expired OTP
        await client.query(
          "UPDATE users SET mfa_otp = NULL, mfa_otp_expires = NULL WHERE id = $1",
          [user.id],
        );
        return { success: false, message: "OTP has expired" };
      }

      // Check if too many attempts
      if (user.mfa_otp_attempts >= 5) {
        return {
          success: false,
          message: "Too many failed attempts. Please request a new OTP",
        };
      }

      // Verify OTP
      const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

      if (user.mfa_otp !== hashedOTP) {
        // Increment failed attempts
        await client.query(
          "UPDATE users SET mfa_otp_attempts = mfa_otp_attempts + 1 WHERE id = $1",
          [user.id],
        );
        return { success: false, message: "Invalid OTP" };
      }

      // OTP is valid - clear it and update last used
      await client.query(
        `UPDATE users 
         SET mfa_otp = NULL, 
             mfa_otp_expires = NULL, 
             mfa_otp_attempts = 0,
             mfa_last_used = NOW()
         WHERE id = $1`,
        [user.id],
      );

      return {
        success: true,
        message: "OTP verified successfully",
        userId: user.id,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send OTP email
   */
  private async sendOTPEmail(
    email: string,
    userName: string,
    otp: string,
  ): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Avy Tracker - Multi-Factor Authentication Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3B82F6, #0EA5E9); padding: 30px; border-radius: 15px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Avy Tracker</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Multi-Factor Authentication</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 15px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1F2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${userName},</h2>
            
            <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Your multi-factor authentication code is:
            </p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 8px;">${otp}</span>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin: 20px 0 0 0;">
              This code will expire in <strong>10 minutes</strong>.
            </p>
            
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p style="color: #92400E; margin: 0; font-size: 14px;">
                <strong>Security Notice:</strong> Never share this code with anyone. Avy Tracker staff will never ask for your authentication code.
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
Avy Tracker - Multi-Factor Authentication

Hello ${userName},

Your multi-factor authentication code is: ${otp}

This code will expire in 10 minutes.

Security Notice: Never share this code with anyone. Avy Tracker staff will never ask for your authentication code.

If you didn't request this code, please contact your administrator immediately.

This is an automated message from Avy Tracker. Please do not reply to this email.
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE users 
         SET mfa_enabled = true, 
             mfa_setup_date = NOW()
         WHERE id = $1`,
        [userId],
      );
      return true;
    } catch (error) {
      console.error("Error enabling MFA:", error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE users 
         SET mfa_enabled = false, 
             mfa_otp = NULL, 
             mfa_otp_expires = NULL, 
             mfa_otp_attempts = 0,
             mfa_setup_date = NULL
         WHERE id = $1`,
        [userId],
      );
      return true;
    } catch (error) {
      console.error("Error disabling MFA:", error);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Get MFA status for a user
   */
  async getMFAStatus(
    userId: number,
  ): Promise<{ enabled: boolean; setupDate?: Date; lastUsed?: Date }> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT mfa_enabled, mfa_setup_date, mfa_last_used 
         FROM users 
         WHERE id = $1`,
        [userId],
      );

      if (result.rows.length === 0) {
        return { enabled: false };
      }

      const user = result.rows[0];
      return {
        enabled: user.mfa_enabled || false,
        setupDate: user.mfa_setup_date,
        lastUsed: user.mfa_last_used,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT mfa_enabled FROM users WHERE id = $1",
        [userId],
      );

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].mfa_enabled || false;
    } finally {
      client.release();
    }
  }
}

export default MFAService;
