-- Migration: Add Multi-Factor Authentication (MFA) fields to users table
-- Date: 2024-12-19
-- Description: Implements email-based OTP verification for enhanced security

-- Add MFA-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_otp VARCHAR(6),
ADD COLUMN IF NOT EXISTS mfa_otp_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS mfa_otp_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mfa_last_used TIMESTAMP,
ADD COLUMN IF NOT EXISTS mfa_setup_date TIMESTAMP;

-- Create index for MFA OTP lookups
CREATE INDEX IF NOT EXISTS idx_users_mfa_otp ON users(mfa_otp, mfa_otp_expires);

-- Create index for MFA enabled users
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled);

-- Add comment to document the new columns
COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN users.mfa_otp IS 'Current MFA OTP code (encrypted)';
COMMENT ON COLUMN users.mfa_otp_expires IS 'When the current MFA OTP expires';
COMMENT ON COLUMN users.mfa_otp_attempts IS 'Number of failed MFA attempts';
COMMENT ON COLUMN users.mfa_last_used IS 'Last time MFA was successfully used';
COMMENT ON COLUMN users.mfa_setup_date IS 'When MFA was first enabled';

-- Update existing users to have MFA disabled by default
UPDATE users SET mfa_enabled = false WHERE mfa_enabled IS NULL;

-- Create a function to clean up expired MFA OTPs
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_otps()
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET mfa_otp = NULL, 
        mfa_otp_expires = NULL, 
        mfa_otp_attempts = 0
    WHERE mfa_otp_expires < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired OTPs (runs every 5 minutes)
SELECT cron.schedule('cleanup-expired-mfa-otps', '*/5 * * * *', 'SELECT cleanup_expired_mfa_otps();');

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_mfa_otps() TO PUBLIC;
