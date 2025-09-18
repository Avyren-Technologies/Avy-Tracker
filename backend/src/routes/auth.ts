import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { pool } from "../config/database";
import { verifyToken } from "../middleware/auth";
import { JWT_SECRET } from "../middleware/auth";
import { CustomRequest, ResetToken } from "../types";
import MFAService from "../services/MFAService";

const router = express.Router();
const mfaService = new MFAService();

// Store reset tokens (in production, use Redis or database)
const resetTokens = new Map<string, ResetToken>();

// Store MFA session tokens (in production, use Redis)
const mfaSessions = new Map<
  string,
  { userId: number; email: string; expires: Date }
>();

// Update the type definitions for request bodies
interface LoginRequest extends Request {
  body: {
    identifier: string;
    password: string;
  };
}

interface ForgotPasswordRequest extends Request {
  body: {
    email: string;
  };
}

interface VerifyOTPRequest extends Request {
  body: {
    email: string;
    otp: string;
  };
}

interface ResetPasswordRequest extends Request {
  body: {
    email: string;
    otp: string;
    newPassword: string;
  };
}

interface MFALoginRequest extends Request {
  body: {
    email: string;
    otp: string;
    sessionId: string;
  };
}

interface MFASetupRequest extends Request {
  body: {
    userId: number;
    enable: boolean;
  };
}

// Modified login endpoint - now returns session ID for MFA instead of tokens
router.post("/login", async (req: LoginRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { identifier, password } = req.body;

    const isEmail = identifier.includes("@");
    const query = isEmail
      ? `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.email = $1`
      : `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.phone = $1`;

    const result = await client.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check company status for non-super-admin users
    if (
      user.role !== "super-admin" &&
      user.company_id &&
      user.company_status === "disabled"
    ) {
      return res.status(403).json({
        error: "Company access disabled. Please contact administrator.",
        code: "COMPANY_DISABLED",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment failed login attempts
      await client.query(
        "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1",
        [user.id],
      );
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reset failed login attempts and update last login
    await client.query(
      "UPDATE users SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id],
    );

    // Check if MFA is enabled for this user
    if (user.mfa_enabled) {
      // Generate MFA OTP
      try {
        const { otp, expires } = await mfaService.generateOTP(user.email);

        // Create MFA session
        const sessionId = crypto.randomBytes(32).toString("hex");
        const sessionExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        mfaSessions.set(sessionId, {
          userId: user.id,
          email: user.email,
          expires: sessionExpires,
        });

        // Clean up expired sessions
        for (const [key, session] of mfaSessions.entries()) {
          if (session.expires < new Date()) {
            mfaSessions.delete(key);
          }
        }

        return res.json({
          requiresMFA: true,
          sessionId,
          message: "MFA code sent to your email",
          email: user.email,
        });
      } catch (error) {
        console.error("Error generating MFA OTP:", error);
        return res.status(500).json({ error: "Failed to send MFA code" });
      }
    } else {
      // MFA not enabled - proceed with normal login
      // Generate access token (7 days expiry)
      const accessToken = jwt.sign(
        {
          id: user.id,
          role: user.role,
          company_id: user.company_id,
          token_version: user.token_version,
          type: "access",
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // Generate refresh token (30 days expiry)
      const refreshToken = jwt.sign(
        {
          id: user.id,
          token_version: user.token_version,
          type: "refresh",
        },
        JWT_SECRET,
        { expiresIn: "30d" },
      );

      res.json({
        requiresMFA: false,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          company_id: user.company_id,
        },
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  } finally {
    client.release();
  }
});

// New endpoint for MFA verification during login
router.post(
  "/verify-mfa-login",
  async (req: MFALoginRequest, res: Response) => {
    try {
      const { email, otp, sessionId } = req.body;

      // Validate session
      const session = mfaSessions.get(sessionId);
      if (!session || session.expires < new Date() || session.email !== email) {
        return res.status(400).json({ error: "Invalid or expired session" });
      }

      // Verify OTP
      const verificationResult = await mfaService.verifyOTP(email, otp);

      if (!verificationResult.success) {
        return res.status(400).json({ error: verificationResult.message });
      }

      // Clear the session
      mfaSessions.delete(sessionId);

      // Get user details
      const client = await pool.connect();
      try {
        const userResult = await client.query(
          "SELECT * FROM users WHERE id = $1",
          [session.userId],
        );

        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        const user = userResult.rows[0];

        // Generate access token (7 days expiry)
        const accessToken = jwt.sign(
          {
            id: user.id,
            role: user.role,
            company_id: user.company_id,
            token_version: user.token_version,
            type: "access",
          },
          JWT_SECRET,
          { expiresIn: "7d" },
        );

        // Generate refresh token (30 days expiry)
        const refreshToken = jwt.sign(
          {
            id: user.id,
            token_version: user.token_version,
            type: "refresh",
          },
          JWT_SECRET,
          { expiresIn: "30d" },
        );

        res.json({
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            company_id: user.company_id,
          },
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("MFA verification error:", error);
      res.status(500).json({ error: "Failed to verify MFA" });
    }
  },
);

// Endpoint to resend MFA OTP
router.post("/resend-mfa-otp", async (req: Request, res: Response) => {
  try {
    const { email, sessionId } = req.body;

    // Validate session
    const session = mfaSessions.get(sessionId);
    if (!session || session.expires < new Date() || session.email !== email) {
      return res.status(400).json({ error: "Invalid or expired session" });
    }

    // Generate new OTP
    const { otp, expires } = await mfaService.generateOTP(email);

    res.json({
      message: "New MFA code sent successfully",
      expires,
    });
  } catch (error) {
    console.error("Error resending MFA OTP:", error);
    res.status(500).json({ error: "Failed to resend MFA code" });
  }
});

// Endpoint to setup MFA for a user
router.post(
  "/setup-mfa",
  verifyToken,
  async (req: MFASetupRequest, res: Response) => {
    try {
      const { userId, enable } = req.body;
      const requestingUser = (req as CustomRequest).user;

      // Only allow users to modify their own MFA or super admins to modify any
      if (
        requestingUser?.id !== userId &&
        requestingUser?.role !== "super-admin"
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      let success: boolean;
      if (enable) {
        success = await mfaService.enableMFA(userId);
      } else {
        success = await mfaService.disableMFA(userId);
      }

      if (success) {
        res.json({
          message: `MFA ${enable ? "enabled" : "disabled"} successfully`,
        });
      } else {
        res.status(500).json({
          error: `Failed to ${enable ? "enable" : "disable"} MFA`,
        });
      }
    } catch (error) {
      console.error("Error setting up MFA:", error);
      res.status(500).json({ error: "Failed to setup MFA" });
    }
  },
);

// Endpoint to get MFA status
router.get("/mfa-status", verifyToken, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as CustomRequest).user;
    if (!requestingUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const status = await mfaService.getMFAStatus(requestingUser.id);
    res.json(status);
  } catch (error) {
    console.error("Error getting MFA status:", error);
    res.status(500).json({ error: "Failed to get MFA status" });
  }
});

// Endpoint to test MFA setup (send OTP without requiring login)
router.post(
  "/test-mfa-setup",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const requestingUser = (req as CustomRequest).user;
      if (!requestingUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Only allow users to test their own MFA
      if (requestingUser.id !== parseInt(req.body.userId)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { otp, expires } = await mfaService.generateOTP(
        requestingUser.email,
      );

      res.json({
        message: "Test MFA code sent successfully",
        expires,
      });
    } catch (error) {
      console.error("Error testing MFA setup:", error);
      res.status(500).json({ error: "Failed to send test MFA code" });
    }
  },
);

router.post(
  "/forgot-password",
  async (req: ForgotPasswordRequest, res: Response) => {
    try {
      const { email } = req.body;

      const user = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);

      if (user.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      resetTokens.set(email, {
        email,
        token: otp,
        expires,
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset Code",
        text: `Your password reset code is: ${otp}. This code will expire in 30 minutes.`,
        html: `
        <h1>Password Reset Code</h1>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>This code will expire in 30 minutes.</p>
      `,
      });

      res.json({ message: "Reset code sent successfully" });
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  },
);

router.post("/verify-otp", (req: VerifyOTPRequest, res: Response) => {
  try {
    const { email, otp } = req.body;
    const resetToken = resetTokens.get(email);

    if (
      !resetToken ||
      resetToken.token !== otp ||
      resetToken.expires < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    res.json({ message: "Code verified successfully" });
  } catch (error) {
    console.error("Error in verify OTP:", error);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

router.post(
  "/reset-password",
  async (req: ResetPasswordRequest, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body;
      const resetToken = resetTokens.get(email);

      if (
        !resetToken ||
        resetToken.token !== otp ||
        resetToken.expires < new Date()
      ) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2",
        [hashedPassword, email],
      );

      resetTokens.delete(email);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error in reset password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  },
);

router.post("/refresh", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      console.log("No refresh token provided");
      return res.status(400).json({ error: "Refresh token required" });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload;

      // Log decoded token for debugging
      console.log("Decoded refresh token:", {
        id: decoded.id,
        type: decoded.type,
        exp: new Date(decoded.exp! * 1000).toISOString(),
        iat: new Date(decoded.iat! * 1000).toISOString(),
      });

      // Validate token type first
      if (decoded.type !== "refresh") {
        console.log("Invalid token type:", decoded.type);
        return res.status(401).json({
          error: "Invalid token type",
          details: "Expected refresh token but received " + decoded.type,
        });
      }

      // Check token expiration explicitly
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        console.log("Refresh token expired:", {
          expiry: new Date(decoded.exp * 1000).toISOString(),
          now: new Date(now * 1000).toISOString(),
        });
        return res.status(401).json({ error: "Refresh token expired" });
      }

      // Get user details
      const result = await client.query(
        `SELECT u.*, c.status as company_status 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         WHERE u.id = $1 AND u.token_version = $2`,
        [decoded.id, decoded.token_version],
      );

      if (result.rows.length === 0) {
        console.log("No user found or token version mismatch:", {
          userId: decoded.id,
          tokenVersion: decoded.token_version,
        });
        return res.status(401).json({ error: "Invalid refresh token" });
      }

      const user = result.rows[0];

      // Check company status
      if (
        user.role !== "super-admin" &&
        user.company_id &&
        user.company_status === "disabled"
      ) {
        return res.status(403).json({
          error: "Company access disabled, please contact administrator",
          code: "COMPANY_DISABLED",
        });
      }

      // Generate new access token (7 days expiry)
      const newAccessToken = jwt.sign(
        {
          id: user.id,
          role: user.role,
          company_id: user.company_id,
          token_version: user.token_version,
          type: "access",
        },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      // Generate new refresh token (30 days expiry)
      const newRefreshToken = jwt.sign(
        {
          id: user.id,
          token_version: user.token_version,
          type: "refresh",
        },
        JWT_SECRET,
        { expiresIn: "30d" },
      );

      console.log("Token refresh successful for user:", user.id);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          company_id: user.company_id,
        },
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log("Refresh token expired");
        return res.status(401).json({ error: "Refresh token expired" });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        console.log("Invalid refresh token:", error.message);
        return res.status(401).json({ error: "Invalid refresh token" });
      }
      throw error;
    }
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  } finally {
    client.release();
  }
});

router.get(
  "/check-role",
  verifyToken,
  async (req: CustomRequest, res: Response) => {
    try {
      console.log("Check role request:", {
        user: req.user,
        headers: req.headers,
      });

      if (!req.user) {
        return res.status(401).json({ error: "No user found" });
      }

      res.json({
        role: req.user.role,
        id: req.user.id,
        name: req.user.name,
      });
    } catch (error) {
      console.error("Check role error:", error);
      res.status(500).json({ error: "Failed to check role" });
    }
  },
);

export default router;
